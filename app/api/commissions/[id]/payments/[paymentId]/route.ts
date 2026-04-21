import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

/** Re-implemented here to avoid cross-file import cycles in the route tree. */
async function recomputeCommissionTotals(commissionId: string) {
  const [commission, agg] = await Promise.all([
    db.commission.findUnique({
      where: { id: commissionId },
      select: { commissionAmount: true },
    }),
    db.commissionPayment.aggregate({
      where: { commissionId, deletedAt: null },
      _sum: { amount: true },
      _max: { paidOn: true },
    }),
  ]);
  if (!commission) return;

  const paidAmount = agg._sum.amount ?? 0;
  const EPS = 0.005;
  const paidStatus =
    paidAmount <= 0
      ? 'Pending'
      : paidAmount + EPS >= commission.commissionAmount
        ? 'Paid'
        : 'Partial';

  await db.commission.update({
    where: { id: commissionId },
    data: {
      paidAmount,
      paidStatus,
      paymentDate: paidStatus === 'Paid' ? (agg._max.paidOn ?? new Date()) : null,
    },
  });
}

/** DELETE /api/commissions/:id/payments/:paymentId — soft-delete a payment. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, paymentId } = await params;

    const payment = await db.commissionPayment.findFirst({
      where: { id: paymentId, commissionId: id, companyId: payload.companyId, deletedAt: null },
      include: {
        commission: {
          include: { client: { select: { createdBy: true } } },
        },
      },
    });
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    if (
      isTeamMember(payload.role) &&
      payment.commission?.client?.createdBy !== payload.userId
    ) {
      return NextResponse.json({ error: 'Forbidden — not your commission' }, { status: 403 });
    }

    await db.commissionPayment.update({
      where: { id: paymentId },
      data: { deletedAt: new Date() },
    });

    await recomputeCommissionTotals(id);

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'commission.payment.delete',
      resource: 'CommissionPayment',
      resourceId: paymentId,
      metadata: { commissionId: id, amount: payment.amount },
      req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete commission payment error:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
