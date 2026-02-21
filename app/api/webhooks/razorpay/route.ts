import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-razorpay-signature') || '';
    const body = await req.text();

    // Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.event === 'payment.authorized') {
      // ✅ rename snake_case → camelCase
      const {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
      } = event.payload.payment.entity;

      // find invoice
      const order = await db.invoice.findFirst({
        where: { razorpayOrderId },
      });

      if (order) {
        const validityDays =
          order.planType === 'Enterprise'
            ? 365
            : order.planType === 'Pro'
            ? 180
            : 30;

        const expiryDate = new Date(
          Date.now() + validityDays * 24 * 60 * 60 * 1000
        );

        // update invoice
        await db.invoice.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'completed',
            razorpayPaymentId, // ✅ now defined
            validUpto: expiryDate,
          },
        });

        // update company subscription
        await db.company.update({
          where: { id: order.companyId },
          data: {
            subscriptionType: order.planType,
            subscriptionExpiry: expiryDate,
          },
        });
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}