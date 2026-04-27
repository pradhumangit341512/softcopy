import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { requireAdmin } from '@/lib/authorize';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

async function recomputeSplitTotals(splitId: string) {
  const [split, agg] = await Promise.all([
    db.commissionSplit.findUnique({
      where: { id: splitId },
      select: { shareAmount: true },
    }),
    db.commissionSplitPayout.aggregate({
      where: { splitId, deletedAt: null },
      _sum: { amount: true },
    }),
  ]);
  if (!split) return;

  const paidOut = agg._sum.amount ?? 0;
  const EPS = 1; // 1 rupee tolerance — sub-rupee drift shouldn't strand a deal at Partial/InProgress
  const status =
    paidOut <= 0
      ? 'Pending'
      : paidOut + EPS >= split.shareAmount
        ? 'Paid'
        : 'Partial';

  await db.commissionSplit.update({
    where: { id: splitId },
    data: { paidOut, status },
  });
}

/**
 * DELETE /api/commissions/:id/splits/:splitId/payouts/:payoutId — admin
 * only. Soft-delete and recompute the split's running totals.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; splitId: string; payoutId: string }> },
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    const { id, splitId, payoutId } = await params;

    const payout = await db.commissionSplitPayout.findFirst({
      where: {
        id: payoutId,
        splitId,
        commissionId: id,
        companyId: payload.companyId,
        deletedAt: null,
      },
    });
    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    await db.commissionSplitPayout.update({
      where: { id: payoutId },
      data: { deletedAt: new Date() },
    });

    await recomputeSplitTotals(splitId);

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'commission.split_payout.delete',
      resource: 'CommissionSplitPayout',
      resourceId: payoutId,
      metadata: { commissionId: id, splitId, amount: payout.amount },
      req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete split payout error:', error);
    return NextResponse.json({ error: 'Failed to delete payout' }, { status: 500 });
  }
}
