// app/api/auth/verify-email-otp/route.ts
// Verifies OTP only — used by both login and signup flows
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashOTP, verifyOTPHash, MAX_ATTEMPTS } from '@/lib/otp';

export async function POST(req: NextRequest) {
  try {
    const { email, otp, purpose } = await req.json();

    if (!email || !otp || !purpose) {
      return NextResponse.json(
        { error: 'Email, OTP and purpose are required' },
        { status: 400 }
      );
    }

    // Find latest OTP record
    const record = await db.emailOTP.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return NextResponse.json({ error: 'No OTP found. Please request a new one.' }, { status: 400 });
    }

    // Expiry check
    if (record.expiresAt < new Date()) {
      await db.emailOTP.deleteMany({ where: { email, purpose } });
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    // Max attempts check (consistent with login route — use MAX_ATTEMPTS, not MAX_ATTEMPTS - 1)
    if (record.attempts >= MAX_ATTEMPTS) {
      await db.emailOTP.deleteMany({ where: { email, purpose } });
      return NextResponse.json(
        { error: 'Too many failed attempts. Please request a new OTP.' },
        { status: 429 }
      );
    }

    // SECURITY: Use constant-time comparison (prevents timing attacks)
    const hashedInput = hashOTP(String(otp));
    if (!verifyOTPHash(hashedInput, record.otpHash)) {
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

    // OTP correct — delete ALL OTPs for this email+purpose
    await db.emailOTP.deleteMany({ where: { email, purpose } });

    return NextResponse.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Verify email OTP error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
