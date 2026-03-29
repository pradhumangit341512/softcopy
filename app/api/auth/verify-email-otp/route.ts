// app/api/auth/verify-email-otp/route.ts
// Verifies OTP only — used by both login and signup flows
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

const MAX_ATTEMPTS = 5;

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const { email, otp, purpose } = await req.json();

    if (!email || !otp || !purpose) {
      return NextResponse.json(
        { error: 'Email, OTP and purpose are required' },
        { status: 400 }
      );
    }

    // ── Find latest OTP record ──
    const record = await db.emailOTP.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return NextResponse.json({ error: 'No OTP found. Please request a new one.' }, { status: 400 });
    }

    // ── Expiry check ──
    if (record.expiresAt < new Date()) {
      await db.emailOTP.delete({ where: { id: record.id } });
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    // ── Max attempts check ──
    if (record.attempts >= MAX_ATTEMPTS - 1) {
      await db.emailOTP.delete({ where: { id: record.id } });
      return NextResponse.json(
        { error: 'Too many failed attempts. Please request a new OTP.' },
        { status: 429 }
      );
    }

    // ── Hash and compare ──
    const hashedInput = hashOTP(String(otp));

    if (hashedInput !== record.otpHash) {
      await db.emailOTP.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      const remaining = MAX_ATTEMPTS - record.attempts - 1;
      return NextResponse.json(
        { error: `Invalid OTP. ${remaining} attempt(s) remaining.` },
        { status: 400 }
      );
    }

    // ── OTP is correct — delete it ──
    await db.emailOTP.delete({ where: { id: record.id } });

    return NextResponse.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Verify email OTP error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}