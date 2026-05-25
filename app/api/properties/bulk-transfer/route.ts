/**
 * POST /api/properties/bulk-transfer
 *
 * Bulk-reassign multiple inventory items to a single teammate.
 * Body: { propertyIds: string[], toUserId: string }
 *
 * - Admins can transfer any property in their company
 * - Max 100 properties per request
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, isValidObjectId } from '@/lib/auth';
import { isAdminRole } from '@/lib/authorize';
import { z } from 'zod';

export const runtime = 'nodejs';

const bulkTransferSchema = z.object({
  propertyIds: z.array(z.string()).min(1).max(100),
  toUserId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAdminRole(payload.role)) {
      return NextResponse.json({ error: 'Only admins can bulk assign inventory' }, { status: 403 });
    }

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

    const { propertyIds, toUserId } = parsed.data;

    if (!isValidObjectId(toUserId)) {
      return NextResponse.json({ error: 'Invalid target user id' }, { status: 400 });
    }

    for (const pid of propertyIds) {
      if (!isValidObjectId(pid)) {
        return NextResponse.json({ error: `Invalid property id: ${pid}` }, { status: 400 });
      }
    }

    // Validate target user
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

    // Bulk update ownedBy
    const result = await db.property.updateMany({
      where: {
        id: { in: propertyIds },
        companyId: payload.companyId,
        deletedAt: null,
      },
      data: { ownedBy: toUserId },
    });

    return NextResponse.json({
      success: true,
      transferred: result.count,
      total: propertyIds.length,
    });
  } catch (error) {
    console.error('Property bulk transfer error:', error);
    return NextResponse.json({ error: 'Bulk transfer failed' }, { status: 500 });
  }
}
