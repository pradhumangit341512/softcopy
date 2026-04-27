import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { isTeamMember, requireAdmin } from '@/lib/authorize';
import { createDealPaymentSchema, parseBody } from '@/lib/validations';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * Recompute Commission.dealAmountPaid + dealStatus from the sum of its
 * non-deleted DealPayment rows. Mirrors recomputeCommissionTotals on the
 * commission-payments side. Called after every create/delete.
 */
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
  // Tiny tolerance so a rounding mismatch on the last instalment still flips
  // status to Completed.
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

/** Shared authorization guard: only members of the same company can read /
 *  mutate. Team members are limited to their own clients' deals. */
async function loadCommissionForAccess(commissionId: string, payload: { companyId: string; userId: string; role: string }) {
  const commission = await db.commission.findFirst({
    where: { id: commissionId, companyId: payload.companyId, deletedAt: null },
    include: { client: { select: { createdBy: true } } },
  });
  if (!commission) return { error: 'Commission not found', status: 404 as const };
  if (isTeamMember(payload.role) && commission.client?.createdBy !== payload.userId) {
    return { error: 'Forbidden — not your commission', status: 403 as const };
  }
  return { commission };
}

/** GET /api/commissions/:id/deal-payments — list non-deleted deal payments. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const access = await loadCommissionForAccess(id, payload);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const payments = await db.dealPayment.findMany({
      where: { commissionId: id, deletedAt: null },
      orderBy: { paidOn: 'desc' },
      include: { recorder: { select: { id: true, name: true } } },
    });

    const fresh = await db.commission.findUnique({
      where: { id },
      select: { dealAmount: true, dealAmountPaid: true, dealStatus: true },
    });

    return NextResponse.json({
      payments,
      commission: {
        id,
        dealAmount: fresh?.dealAmount ?? 0,
        dealAmountPaid: fresh?.dealAmountPaid ?? 0,
        dealStatus: fresh?.dealStatus ?? 'Open',
      },
    });
  } catch (error) {
    console.error('List deal payments error:', error);
    return NextResponse.json({ error: 'Failed to list deal payments' }, { status: 500 });
  }
}

/**
 * POST /api/commissions/:id/deal-payments — record one buyer→builder instalment.
 * Admin-only. Team members may view the ledger but not write to it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    const { id } = await params;

    const access = await loadCommissionForAccess(id, payload);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const parsed = await parseBody(req, createDealPaymentSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    // Cap overpayment so a single recorded instalment can't push the running
    // total beyond dealAmount. Surface a clear error so the broker can fix it.
    const dealAmount = access.commission.dealAmount;
    const dealAmountPaid = access.commission.dealAmountPaid ?? 0;
    const remaining = Math.max(0, dealAmount - dealAmountPaid);
    if (data.amount > remaining + 0.005) {
      return NextResponse.json(
        {
          error: `Amount exceeds remaining deal balance (₹${remaining.toLocaleString('en-IN')}).`,
          remaining,
        },
        { status: 400 },
      );
    }

    const created = await db.dealPayment.create({
      data: {
        commissionId: id,
        companyId: payload.companyId,
        amount: data.amount,
        paidOn: data.paidOn,
        stage: data.stage,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
        recordedBy: payload.userId,
        deletedAt: null,
      },
      include: { recorder: { select: { id: true, name: true } } },
    });

    await recomputeDealTotals(id);

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'commission.deal_payment.create',
      resource: 'DealPayment',
      resourceId: created.id,
      metadata: { commissionId: id, amount: data.amount, stage: data.stage },
      req,
    });

    const refreshed = await db.commission.findUnique({
      where: { id },
      select: { dealAmount: true, dealAmountPaid: true, dealStatus: true },
    });

    return NextResponse.json(
      {
        payment: created,
        commission: {
          id,
          dealAmount: refreshed?.dealAmount ?? 0,
          dealAmountPaid: refreshed?.dealAmountPaid ?? 0,
          dealStatus: refreshed?.dealStatus ?? 'Open',
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Record deal payment error:', error);
    return NextResponse.json({ error: 'Failed to record deal payment' }, { status: 500 });
  }
}
