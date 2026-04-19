/**
 * /api/superadmin/payments
 *
 * The manual revenue ledger. SuperAdmin records every payment received from
 * a broker (bank transfer, UPI, cash, etc.). Recording a payment auto-extends
 * the company's `subscriptionUntil` to MAX(current, coversUntil) so the
 * subscription window stacks cleanly across multiple payments.
 *
 * GET   → list all payments (newest first), optional ?companyId= filter
 * POST  → record a new payment, side-effect: extend subscription window
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidObjectId } from '@/lib/auth';
import { requireSuperAdmin } from '@/lib/superadmin';
import { recordPaymentSchema, parseBody } from '@/lib/validations';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

// ==================== GET ====================

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (companyId && isValidObjectId(companyId)) where.companyId = companyId;

  const [payments, total, agg] = await Promise.all([
    db.paymentRecord.findMany({
      where,
      orderBy: { paidOn: 'desc' },
      skip,
      take: limit,
      include: {
        company: { select: { id: true, companyName: true } },
      },
    }),
    db.paymentRecord.count({ where }),
    db.paymentRecord.aggregate({ where, _sum: { amount: true } }),
  ]);

  return NextResponse.json({
    payments,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    totals: { totalAmount: agg._sum.amount ?? 0 },
  });
}

// ==================== POST ====================

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(req, recordPaymentSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const company = await db.company.findUnique({
    where: { id: data.companyId },
    select: { id: true, subscriptionUntil: true, subscriptionExpiry: true, status: true },
  });
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const payment = await db.paymentRecord.create({
    data: {
      companyId: data.companyId,
      amount: data.amount,
      paidOn: data.paidOn,
      coversFrom: data.coversFrom,
      coversUntil: data.coversUntil,
      method: data.method,
      reference: data.reference ?? null,
      notes: data.notes ?? null,
      recordedBy: auth.payload.userId,
    },
  });

  // Extend subscription: take MAX of current and coversUntil so multiple
  // overlapping payments don't shrink the window.
  const currentUntil = company.subscriptionUntil ?? company.subscriptionExpiry;
  const newUntil =
    !currentUntil || data.coversUntil > currentUntil ? data.coversUntil : currentUntil;

  // Flip status back to active if expired or suspended (a paying company
  // should be able to log in). Warn in response if it was suspended.
  const wasSuspended = company.status === 'suspended';
  const statusUpdate =
    company.status === 'expired' || company.status === 'suspended'
      ? { status: 'active' as const }
      : {};

  try {
    await db.company.update({
      where: { id: data.companyId },
      data: {
        subscriptionUntil: newUntil,
        subscriptionExpiry: newUntil,
        ...statusUpdate,
      },
    });
  } catch (updateErr) {
    console.error('[superadmin.payments] payment recorded but subscription update failed', {
      paymentId: payment.id,
      companyId: data.companyId,
      desiredUntil: newUntil.toISOString(),
      error: updateErr instanceof Error ? updateErr.message : String(updateErr),
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Payment recorded but subscription could not be extended. Contact engineering.',
        paymentId: payment.id,
      },
      { status: 207 }
    );
  }

  await recordAudit({
    companyId: data.companyId,
    userId: auth.payload.userId,
    action: 'superadmin.payment.record',
    resource: 'PaymentRecord',
    resourceId: payment.id,
    metadata: {
      amount: data.amount,
      method: data.method,
      coversUntil: data.coversUntil.toISOString(),
      previousSubscriptionUntil: currentUntil?.toISOString() ?? null,
      newSubscriptionUntil: newUntil.toISOString(),
    },
    req,
  });

  return NextResponse.json(
    {
      success: true,
      payment,
      newSubscriptionUntil: newUntil,
      ...(wasSuspended
        ? { note: 'Company was suspended and has been reactivated by this payment.' }
        : {}),
    },
    { status: 201 }
  );
}
