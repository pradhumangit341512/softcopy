import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-razorpay-signature') || '';
    const body = await req.text();

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(body);

    if (event.event === 'payment.authorized') {
      const { razorpay_order_id, razorpay_payment_id } = event.payload.payment.entity;

      // Update subscription in database
      const order = await db.invoice.findFirst({
        where: { razorpayOrderId: razorpay_order_id },
      });

      if (order) {
        const validityDays =
          order.planType === 'Enterprise'
            ? 365
            : order.planType === 'Pro'
            ? 180
            : 30;

        await db.invoice.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'completed',
            razorpayPaymentId,
            validUpto: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000),
          },
        });

        await db.company.update({
          where: { id: order.companyId },
          data: {
            subscriptionType: order.planType,
            subscriptionExpiry: new Date(
              Date.now() + validityDays * 24 * 60 * 60 * 1000
            ),
          },
        });
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}