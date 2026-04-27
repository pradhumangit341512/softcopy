import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { requireAdmin } from '@/lib/authorize';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

/** Mirrored here to avoid cross-file import cycles in the route tree. */
async function recomputeDealTotals(commissionId: string) {
  const [commission, agg] = await Promise.all([
    db.commission.findUnique({
      where: { id: commissionId },
      select: { dealAmount: true },
    }),
    db.dealPayment.aggregate({
      where: { commissionId, deletedAt: null },
      _sum: { amount: true },
    }),
  ]);
  if (!commission) return;

  const dealAmountPaid = agg._sum.amount ?? 0;
  const EPS = 1; // 1 rupee tolerance — sub-rupee drift shouldn't strand a deal at Partial/InProgress
  const dealStatus =
    dealAmountPaid <= 0
      ? 'Open'
      : dealAmountPaid + EPS >= commission.dealAmount
        ? 'Completed'
        : 'InProgress';

  await db.commission.update({
    where: { id: commissionId },
    data: { dealAmountPaid, dealStatus },
  });
}

/**
 * DELETE /api/commissions/:id/deal-payments/:paymentId — soft-delete an
 * instalment. Admin-only: rolling back a recorded buyer payment shifts the
 * running total and the auditable trail, so only admin/superadmin can do
 * it. Team members can record new instalments but cannot undo past ones.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    const { id, paymentId } = await params;

    const payment = await db.dealPayment.findFirst({
      where: {
        id: paymentId,
        commissionId: id,
        companyId: payload.companyId,
        deletedAt: null,
      },
    });
    if (!payment) {
      return NextResponse.json({ error: 'Deal payment not found' }, { status: 404 });
    }

    await db.dealPayment.update({
      where: { id: paymentId },
      data: { deletedAt: new Date() },
    });

    await recomputeDealTotals(id);

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'commission.deal_payment.delete',
      resource: 'DealPayment',
      resourceId: paymentId,
      metadata: { commissionId: id, amount: payment.amount, stage: payment.stage },
      req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete deal payment error:', error);
    return NextResponse.json({ error: 'Failed to delete deal payment' }, { status: 500 });
  }
}
