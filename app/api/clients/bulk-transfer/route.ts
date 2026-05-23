/**
 * POST /api/clients/bulk-transfer
 *
 * Bulk-reassign multiple leads to a single teammate.
 * Body: { clientIds: string[], toUserId: string, reason?: string }
 *
 * - Feature-gated: feature.lead_transfer
 * - Admins can transfer any lead in their company
 * - Team members can only transfer leads they own
 * - Max 100 leads per request
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, isValidObjectId } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import { requireFeature } from '@/lib/require-feature';
import { recordAudit } from '@/lib/audit';
import { z } from 'zod';

export const runtime = 'nodejs';

const MAX_BULK = 100;

const bulkTransferSchema = z.object({
  clientIds: z.array(z.string()).min(1).max(MAX_BULK),
  toUserId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gate = await requireFeature(payload.companyId, 'feature.lead_transfer');
    if (!gate.ok) return gate.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = bulkTransferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { clientIds, toUserId, reason } = parsed.data;

    if (!isValidObjectId(toUserId)) {
      return NextResponse.json({ error: 'Invalid target user id' }, { status: 400 });
    }

    // Validate all client IDs
    for (const cid of clientIds) {
      if (!isValidObjectId(cid)) {
        return NextResponse.json({ error: `Invalid client id: ${cid}` }, { status: 400 });
      }
    }

    // Load target user
    const target = await db.user.findFirst({
      where: { id: toUserId, deletedAt: null, companyId: payload.companyId },
      select: { id: true, name: true, role: true, status: true },
    });

    if (!target) {
      return NextResponse.json({ error: 'Target user not found in this company' }, { status: 404 });
    }
    if (target.status !== 'active') {
      return NextResponse.json({ error: 'Target user is not active' }, { status: 400 });
    }
    if (target.role === 'superadmin') {
      return NextResponse.json({ error: 'Cannot transfer leads to a superadmin' }, { status: 400 });
    }

    // Load all leads
    const clients = await db.client.findMany({
      where: {
        id: { in: clientIds },
        deletedAt: null,
        companyId: payload.companyId,
      },
      select: { id: true, clientName: true, ownedBy: true, createdBy: true },
    });

    if (clients.length === 0) {
      return NextResponse.json({ error: 'No valid leads found' }, { status: 404 });
    }

    const now = new Date();
    const transferred: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const client of clients) {
      const currentOwner = client.ownedBy ?? client.createdBy;

      // Team members can only transfer leads they own
      if (isTeamMember(payload.role) && currentOwner !== payload.userId) {
        skipped.push({ id: client.id, reason: 'Not owned by you' });
        continue;
      }

      // Skip if already owned by target
      if (currentOwner === toUserId) {
        skipped.push({ id: client.id, reason: 'Already owned by target' });
        continue;
      }

      await db.client.update({
        where: { id: client.id },
        data: {
          ownedBy: toUserId,
          transferredFrom: currentOwner,
          transferredAt: now,
        },
      });

      await recordAudit({
        companyId: payload.companyId,
        userId: payload.userId,
        action: 'client.transfer',
        resource: 'Client',
        resourceId: client.id,
        metadata: {
          fromUserId: currentOwner,
          toUserId,
          toUserName: target.name,
          reason: reason ?? null,
          bulk: true,
        },
        req,
      });

      transferred.push(client.id);
    }

    return NextResponse.json({
      success: true,
      transferred: transferred.length,
      skipped: skipped.length,
      total: clients.length,
      details: { transferred, skipped },
    });
  } catch (error) {
    console.error('Bulk transfer error:', error);
    return NextResponse.json({ error: 'Bulk transfer failed' }, { status: 500 });
  }
}
