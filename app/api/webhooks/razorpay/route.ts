import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { newRequestId } from '@/lib/errors';

export const runtime = 'nodejs';

/**
 * POST /api/webhooks/razorpay
 *
 * Razorpay payment webhook. We MUST be:
 *   1. Idempotent — Razorpay retries failed webhooks up to 12 times in 24h.
 *   2. Fast — long responses get retried as failures.
 *   3. Status-code aware:
 *      - 200/202 → Razorpay marks delivered, won't retry
 *      - 4xx     → Razorpay won't retry (client error)
 *      - 5xx     → Razorpay retries with backoff
 *
 * Idempotency strategy: each event carries a unique payment ID. We check
 * if the corresponding Invoice is already marked completed BEFORE doing
 * any work. If yes → return 200 immediately, no double-credit.
 *
 * Returning 202 (Accepted) for parse/signature errors so Razorpay stops
 * retrying junk. Only return 5xx on transient infra failures (DB down).
 */
export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: '/api/webhooks/razorpay', requestId });

  try {
    const signature = req.headers.get('x-razorpay-signature') || '';
    const body = await req.text();

    if (!process.env.RAZORPAY_KEY_SECRET) {
      log.error({}, 'RAZORPAY_KEY_SECRET not configured');
      // Return 202 — webhook is malformed config; retrying won't help.
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 202 });
    }

    // Constant-time signature compare
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      log.warn({}, 'Invalid Razorpay signature');
      // 202 — not a transient failure. Don't retry forged/stale payloads.
      return NextResponse.json({ error: 'Invalid signature' }, { status: 202 });
    }

    let event: {
      event: string;
      payload?: { payment?: { entity?: Record<string, unknown> } };
    };
    try {
      event = JSON.parse(body);
    } catch {
      log.warn({}, 'Webhook body not JSON');
      return NextResponse.json({ error: 'Bad payload' }, { status: 202 });
    }

    // We only act on payment.captured (final success) + payment.authorized (legacy).
    if (event.event !== 'payment.captured' && event.event !== 'payment.authorized') {
      // Acknowledge any other event (refund.processed, etc.) — but don't process.
      log.info({ eventType: event.event }, 'Ignoring non-payment event');
      return NextResponse.json({ status: 'ignored' });
    }

    const entity = event.payload?.payment?.entity ?? {};
    const razorpayOrderId = entity.order_id as string | undefined;
    const razorpayPaymentId = entity.id as string | undefined;

    if (!razorpayOrderId || !razorpayPaymentId) {
      log.warn({ entity }, 'Webhook missing order_id or payment id');
      return NextResponse.json({ error: 'Missing fields' }, { status: 202 });
    }

    const invoice = await db.invoice.findFirst({ where: { razorpayOrderId } });
    if (!invoice) {
      // Possibly a payment for an order we never tracked (legacy data).
      // 202 — not transient. Don't retry.
      log.warn({ razorpayOrderId }, 'No invoice found for order');
      return NextResponse.json({ status: 'no-invoice' }, { status: 202 });
    }

    // ── IDEMPOTENCY GUARD ──
    // If the invoice is already marked completed, this is a Razorpay retry
    // for a payment we already processed. Return 200 immediately so they
    // stop retrying — but DO NOT extend the subscription a second time.
    if (invoice.paymentStatus === 'completed') {
      log.info({ invoiceId: invoice.id }, 'Webhook is a retry — already processed');
      return NextResponse.json({ status: 'already-processed' });
    }

    // First-time processing.
    const validityDays =
      invoice.planType === 'Enterprise' ? 365 :
      invoice.planType === 'Pro'        ? 180 :
                                          30;

    const expiryDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

    await db.$transaction([
      db.invoice.update({
        where: { id: invoice.id },
        data: {
          paymentStatus: 'completed',
          razorpayPaymentId,
          validUpto: expiryDate,
        },
      }),
      db.company.update({
        where: { id: invoice.companyId },
        data: {
          subscriptionType: invoice.planType,
          subscriptionExpiry: expiryDate,
        },
      }),
    ]);

    log.info(
      { invoiceId: invoice.id, companyId: invoice.companyId, plan: invoice.planType },
      'Subscription activated via webhook'
    );

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    // Truly transient (DB connection lost, etc.) — let Razorpay retry.
    log.error({ err }, 'Webhook processing failed (transient)');
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
