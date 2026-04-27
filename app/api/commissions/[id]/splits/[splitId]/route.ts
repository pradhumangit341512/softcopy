import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { requireAdmin } from '@/lib/authorize';
import { updateCommissionSplitSchema, parseBody } from '@/lib/validations';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * PATCH /api/commissions/:id/splits/:splitId — admin only. Edit
 * sharePercent / participantName / participantUserId on an existing split.
 * Recomputes shareAmount from the parent commissionAmount.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; splitId: string }> },
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    const { id, splitId } = await params;

    const split = await db.commissionSplit.findFirst({
      where: {
        id: splitId,
        commissionId: id,
        companyId: payload.companyId,
        deletedAt: null,
      },
      include: {
        commission: { select: { commissionAmount: true } },
      },
    });
    if (!split) {
      return NextResponse.json({ error: 'Split not found' }, { status: 404 });
    }

    const parsed = await parseBody(req, updateCommissionSplitSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    if (data.participantUserId) {
      const exists = await db.user.findFirst({
        where: {
          id: data.participantUserId,
          companyId: payload.companyId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!exists) {
        return NextResponse.json(
          { error: 'Participant user not found in this company.' },
          { status: 400 },
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.participantUserId !== undefined)
      updateData.participantUserId = data.participantUserId;
    if (data.participantName !== undefined)
      updateData.participantName = data.participantName;
    if (data.sharePercent !== undefined) {
      updateData.sharePercent = data.sharePercent;
      updateData.shareAmount =
        (split.commission.commissionAmount * data.sharePercent) / 100;

      // If shareAmount shrank below paidOut, the split is over-paid relative
      // to its new share. Status flips to "Paid" (capped) — this surfaces
      // the over-payment in the UI without losing the ledger trail.
      const newShareAmount = updateData.shareAmount as number;
      const EPS = 1; // 1 rupee tolerance — sub-rupee drift shouldn't strand a deal at Partial/InProgress
      const paidOut = split.paidOut;
      updateData.status =
        paidOut <= 0
          ? 'Pending'
          : paidOut + EPS >= newShareAmount
            ? 'Paid'
            : 'Partial';
    }

    const updated = await db.commissionSplit.update({
      where: { id: splitId },
      data: updateData,
      include: { participant: { select: { id: true, name: true } } },
    });

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'commission.split.update',
      resource: 'CommissionSplit',
      resourceId: splitId,
      metadata: { commissionId: id, ...updateData },
      req,
    });

    return NextResponse.json({ split: updated });
  } catch (error) {
    console.error('Update commission split error:', error);
    return NextResponse.json({ error: 'Failed to update split' }, { status: 500 });
  }
}

/**
 * DELETE /api/commissions/:id/splits/:splitId — admin only. Soft-delete.
 * Cascades the soft-delete to all of this split's payouts (so they don't
 * count toward any future report).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; splitId: string }> },
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    const { id, splitId } = await params;

    const split = await db.commissionSplit.findFirst({
      where: {
        id: splitId,
        commissionId: id,
        companyId: payload.companyId,
        deletedAt: null,
      },
    });
    if (!split) {
      return NextResponse.json({ error: 'Split not found' }, { status: 404 });
    }

    const now = new Date();
    await db.commissionSplit.update({
      where: { id: splitId },
      data: { deletedAt: now },
    });
    // Cascade-soft-delete payouts so they vanish from reports too.
    await db.commissionSplitPayout.updateMany({
      where: { splitId, deletedAt: null },
      data: { deletedAt: now },
    });

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'commission.split.delete',
      resource: 'CommissionSplit',
      resourceId: splitId,
      metadata: { commissionId: id, sharePercent: split.sharePercent },
      req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete commission split error:', error);
    return NextResponse.json({ error: 'Failed to delete split' }, { status: 500 });
  }
}
