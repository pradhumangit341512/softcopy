// app/api/auth/send-email-otp/route.ts
// Unified OTP sender for login and signup
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendOTPEmail } from '@/lib/email';
import {
  generateOTP, hashOTP,
  OTP_EXPIRY_MS, RESEND_COOLDOWN,
} from '@/lib/otp';

export async function POST(req: NextRequest) {
  try {
    const { email, purpose } = await req.json();

    // ── Validate input ──
    if (!email || !purpose) {
      return NextResponse.json(
        { error: 'Email and purpose are required' },
        { status: 400 }
      );
    }

    if (!['login', 'signup'].includes(purpose)) {
      return NextResponse.json({ error: 'Invalid purpose' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // ── For login: verify user exists first ──
    if (purpose === 'login') {
      const user = await db.user.findUnique({ where: { email } });
      if (!user) {
        // Return generic message to avoid email enumeration
        return NextResponse.json(
          { success: true, message: 'If this email exists, an OTP has been sent' },
          { status: 200 }
        );
      }
    }

    // ── Check resend cooldown ──
    const lastOTP = await db.emailOTP.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (
      lastOTP &&
      Date.now() - new Date(lastOTP.createdAt).getTime() < RESEND_COOLDOWN
    ) {
      return NextResponse.json(
        { error: 'Please wait before requesting another OTP' },
        { status: 429 }
      );
    }

    // ── Delete old OTPs for this email+purpose ──
    await db.emailOTP.deleteMany({ where: { email, purpose } });

    // ── Generate and save new OTP ──
    const otp     = generateOTP();
    const otpHash = hashOTP(otp);

    await db.emailOTP.create({
      data: {
        email,
        otpHash,
        purpose,
        attempts:  0,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      },
    });

    // ── Send email ──
    await sendOTPEmail(email, otp, purpose as 'login' | 'signup');

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your email address',
    });
  } catch (error) {
    console.error('Send email OTP error:', error);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}