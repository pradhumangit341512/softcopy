import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { isTeamMember, requireAdmin } from '@/lib/authorize';
import { createCommissionSplitPayoutSchema, parseBody } from '@/lib/validations';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * Recompute split.paidOut + status from the sum of its non-deleted
 * CommissionSplitPayout rows. Mirror of the recompute pattern used by
 * commission-payments and deal-payments.
 */
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

interface AuthContext {
  companyId: string;
  userId: string;
  role: string;
}

async function loadSplitForAccess(
  commissionId: string,
  splitId: string,
  payload: AuthContext,
) {
  const commission = await db.commission.findFirst({
    where: { id: commissionId, companyId: payload.companyId, deletedAt: null },
    include: { client: { select: { createdBy: true } } },
  });
  if (!commission) return { error: 'Commission not found', status: 404 as const };
  if (isTeamMember(payload.role) && commission.client?.createdBy !== payload.userId) {
    return { error: 'Forbidden — not your commission', status: 403 as const };
  }

  const split = await db.commissionSplit.findFirst({
    where: {
      id: splitId,
      commissionId,
      companyId: payload.companyId,
      deletedAt: null,
    },
  });
  if (!split) return { error: 'Split not found', status: 404 as const };

  return { commission, split };
}

/** GET /api/commissions/:id/splits/:splitId/payouts — list non-deleted payouts. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; splitId: string }> },
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, splitId } = await params;

    const access = await loadSplitForAccess(id, splitId, payload);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const payouts = await db.commissionSplitPayout.findMany({
      where: { splitId, deletedAt: null },
      orderBy: { paidOn: 'desc' },
      include: { recorder: { select: { id: true, name: true } } },
    });

    const refreshed = await db.commissionSplit.findUnique({
      where: { id: splitId },
      select: { shareAmount: true, paidOut: true, status: true },
    });

    return NextResponse.json({
      payouts,
      split: {
        id: splitId,
        shareAmount: refreshed?.shareAmount ?? 0,
        paidOut: refreshed?.paidOut ?? 0,
        status: refreshed?.status ?? 'Pending',
      },
    });
  } catch (error) {
    console.error('List split payouts error:', error);
    return NextResponse.json({ error: 'Failed to list payouts' }, { status: 500 });
  }
}

/**
 * POST /api/commissions/:id/splits/:splitId/payouts — record a payout.
 * Admin-only. Team members may view the payout history but not write to it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; splitId: string }> },
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    const { id, splitId } = await params;

    const access = await loadSplitForAccess(id, splitId, payload);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const parsed = await parseBody(req, createCommissionSplitPayoutSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    // Cap overpayment so a single payout can't push paidOut past shareAmount.
    const remaining = Math.max(0, access.split.shareAmount - access.split.paidOut);
    if (data.amount > remaining + 0.005) {
      return NextResponse.json(
        {
          error: `Amount exceeds remaining payout balance (₹${remaining.toLocaleString('en-IN')}).`,
          remaining,
        },
        { status: 400 },
      );
    }

    const created = await db.commissionSplitPayout.create({
      data: {
        splitId,
        commissionId: id,
        companyId: payload.companyId,
        amount: data.amount,
        paidOn: data.paidOn,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
        recordedBy: payload.userId,
        deletedAt: null,
      },
      include: { recorder: { select: { id: true, name: true } } },
    });

    await recomputeSplitTotals(splitId);

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'commission.split_payout.create',
      resource: 'CommissionSplitPayout',
      resourceId: created.id,
      metadata: { commissionId: id, splitId, amount: data.amount, method: data.method },
      req,
    });

    const refreshed = await db.commissionSplit.findUnique({
      where: { id: splitId },
      select: { shareAmount: true, paidOut: true, status: true },
    });

    return NextResponse.json(
      {
        payout: created,
        split: {
          id: splitId,
          shareAmount: refreshed?.shareAmount ?? 0,
          paidOut: refreshed?.paidOut ?? 0,
          status: refreshed?.status ?? 'Pending',
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Record split payout error:', error);
    return NextResponse.json({ error: 'Failed to record payout' }, { status: 500 });
  }
}
