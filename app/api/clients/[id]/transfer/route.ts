/**
 * /api/clients/[id]/transfer
 *
 * POST → reassign a lead from its current owner (Client.ownedBy) to another
 *        teammate in the same company.
 *
 * Authorization
 * ─────────────
 *   - Admins can transfer any lead in their company.
 *   - Team members ('user' role) can only transfer leads they currently own.
 *   - Target user must belong to the same company, be active, and be a
 *     'user' or 'admin' role (no transferring leads to a superadmin).
 *
 * Side effects
 * ────────────
 *   - Client.ownedBy ← toUserId
 *   - Client.transferredFrom ← previous ownedBy
 *   - Client.transferredAt ← now()
 *   - AuditLog row written with from/to/reason
 *
 * Feature gate: feature.lead_transfer
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, isValidObjectId } from '@/lib/auth';
import { isAdminRole, isTeamMember } from '@/lib/authorize';
import { parseBody, transferLeadSchema } from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gate = await requireFeature(payload.companyId, 'feature.lead_transfer');
    if (!gate.ok) return gate.response;

    const { id } = await context.params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid client id' }, { status: 400 });
    }

    const parsed = await parseBody(req, transferLeadSchema);
    if (!parsed.ok) return parsed.response;

    const { toUserId, reason } = parsed.data;
    if (!isValidObjectId(toUserId)) {
      return NextResponse.json({ error: 'Invalid target user id' }, { status: 400 });
    }

    // ── Load lead + target user in parallel ──
    const [client, target] = await Promise.all([
      db.client.findFirst({
        where: { id, deletedAt: null, companyId: payload.companyId },
        select: {
          id: true,
          clientName: true,
          companyId: true,
          ownedBy: true,
          createdBy: true,
        },
      }),
      db.user.findFirst({
        where: { id: toUserId, deletedAt: null, companyId: payload.companyId },
        select: { id: true, name: true, role: true, status: true },
      }),
    ]);

    if (!client) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    if (!target) {
      return NextResponse.json(
        { error: 'Target user not found in this company' },
        { status: 404 }
      );
    }
    if (target.status !== 'active') {
      return NextResponse.json(
        { error: 'Target user is not active' },
        { status: 400 }
      );
    }
    if (target.role === 'superadmin') {
      return NextResponse.json(
        { error: 'Cannot transfer leads to a superadmin' },
        { status: 400 }
      );
    }

    // Authorization: team members can only transfer leads they own. Fall back
    // to createdBy when ownedBy is null (legacy rows pre-migration 008).
    const currentOwner = client.ownedBy ?? client.createdBy;
    if (isTeamMember(payload.role) && currentOwner !== payload.userId) {
      return NextResponse.json(
        { error: 'Only the current owner or an admin can transfer this lead' },
        { status: 403 }
      );
    }
    // Defense-in-depth — non-admin / non-user roles get rejected here even
    // though the company-scoped queries above would have already returned 404.
    if (!isAdminRole(payload.role) && !isTeamMember(payload.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (currentOwner === toUserId) {
      return NextResponse.json(
        { error: 'Lead is already owned by that user' },
        { status: 400 }
      );
    }

    const now = new Date();
    const updated = await db.client.update({
      where: { id },
      data: {
        ownedBy: toUserId,
        transferredFrom: currentOwner,
        transferredAt: now,
      },
      select: {
        id: true,
        clientName: true,
        ownedBy: true,
        transferredFrom: true,
        transferredAt: true,
      },
    });

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'client.transfer',
      resource: 'Client',
      resourceId: id,
      metadata: {
        fromUserId: currentOwner,
        toUserId,
        toUserName: target.name,
        reason: reason ?? null,
      },
      req,
    });

    return NextResponse.json({ success: true, client: updated });
  } catch (error) {
    console.error('Transfer lead error:', error);
    return NextResponse.json({ error: 'Failed to transfer lead' }, { status: 500 });
  }
}
