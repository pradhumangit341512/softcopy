import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import { createCommissionPaymentSchema, parseBody } from '@/lib/validations';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * Shared helper: recompute Commission.paidAmount + paidStatus + paymentDate
 * from the sum of its non-deleted payment rows. Called after every
 * create/delete so the denormalized fields stay honest.
 */
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
  // Tiny floating-point tolerance so "48999.99 of 49000" still reads Paid.
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
      // Stamp paymentDate only when the commission is fully settled; clear
      // it if payments were rolled back below the threshold.
      paymentDate: paidStatus === 'Paid' ? (agg._max.paidOn ?? new Date()) : null,
    },
  });
}

/** GET /api/commissions/:id/payments — list payments for a commission. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const commission = await db.commission.findFirst({
      where: { id, companyId: payload.companyId, deletedAt: null },
      include: { client: { select: { createdBy: true } } },
    });
    if (!commission) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }
    if (
      isTeamMember(payload.role) &&
      commission.client?.createdBy !== payload.userId
    ) {
      return NextResponse.json({ error: 'Forbidden — not your commission' }, { status: 403 });
    }

    const payments = await db.commissionPayment.findMany({
      where: { commissionId: id, deletedAt: null },
      orderBy: { paidOn: 'desc' },
      include: { recorder: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      payments,
      commission: {
        id: commission.id,
        commissionAmount: commission.commissionAmount,
        paidAmount: commission.paidAmount,
        paidStatus: commission.paidStatus,
      },
    });
  } catch (error) {
    console.error('List commission payments error:', error);
    return NextResponse.json({ error: 'Failed to list payments' }, { status: 500 });
  }
}

/** POST /api/commissions/:id/payments — record a new payment. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const commission = await db.commission.findFirst({
      where: { id, companyId: payload.companyId, deletedAt: null },
      include: { client: { select: { createdBy: true } } },
    });
    if (!commission) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }
    if (
      isTeamMember(payload.role) &&
      commission.client?.createdBy !== payload.userId
    ) {
      return NextResponse.json({ error: 'Forbidden — not your commission' }, { status: 403 });
    }

    const parsed = await parseBody(req, createCommissionPaymentSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    // Cap overpayment: don't let a single recorded payment push the running
    // total beyond commissionAmount. Surface a clear error so the user can
    // correct the amount.
    const remaining = Math.max(0, commission.commissionAmount - commission.paidAmount);
    if (data.amount > remaining + 0.005) {
      return NextResponse.json(
        {
          error: `Amount exceeds remaining balance (₹${remaining.toLocaleString('en-IN')}).`,
          remaining,
        },
        { status: 400 }
      );
    }

    const created = await db.commissionPayment.create({
      data: {
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

    await recomputeCommissionTotals(id);

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'commission.payment.create',
      resource: 'CommissionPayment',
      resourceId: created.id,
      metadata: { commissionId: id, amount: data.amount, method: data.method },
      req,
    });

    // Re-read commission so the client sees the freshly computed status.
    const refreshed = await db.commission.findUnique({
      where: { id },
      select: {
        id: true,
        commissionAmount: true,
        paidAmount: true,
        paidStatus: true,
        paymentDate: true,
      },
    });

    return NextResponse.json({ payment: created, commission: refreshed }, { status: 201 });
  } catch (error) {
    console.error('Record commission payment error:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
