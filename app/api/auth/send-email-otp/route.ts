// app/api/auth/send-email-otp/route.ts
// Unified OTP sender for login, signup, and reset-password.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendOTPEmail } from '@/lib/email';
import { generateOTP, hashOTP, OTP_EXPIRY_MS, RESEND_COOLDOWN } from '@/lib/otp';
import { otpLimiter, getClientIp, rateLimited } from '@/lib/rate-limit';
import { z } from 'zod';
import { parseBody, emailSchema } from '@/lib/validations';

export const runtime = 'nodejs';

const ALLOWED_PURPOSES = ['login', 'signup', 'reset-password'] as const;

const sendOtpSchema = z.object({
  email: emailSchema,
  purpose: z.enum(ALLOWED_PURPOSES),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const ipLimit = await otpLimiter.check(10, `email-otp:ip:${ip}`);
    if (!ipLimit.success) {
      return rateLimited('Too many requests. Please try again later.', ipLimit.retryAfter);
    }

    const parsed = await parseBody(req, sendOtpSchema);
    if (!parsed.ok) return parsed.response;
    const { email, purpose } = parsed.data;

    // Per-email cap — avoids spamming someone's inbox + acts as OTP bruteforce guard.
    const emailLimit = await otpLimiter.check(3, `email-otp:email:${email}:${purpose}`);
    if (!emailLimit.success) {
      return rateLimited('Please wait before requesting another code.', emailLimit.retryAfter);
    }

    // Enumeration defense: for login + reset-password, always return generic success
    // regardless of whether the email exists. Only actually send the email if the user exists.
    const userExists = !!(await db.user.findUnique({ where: { email }, select: { id: true } }));
    if ((purpose === 'login' || purpose === 'reset-password') && !userExists) {
      return NextResponse.json(
        { success: true, message: 'If an account exists, a code has been sent.' },
        { status: 200 }
      );
    }

    const lastOTP = await db.emailOTP.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (lastOTP && Date.now() - new Date(lastOTP.createdAt).getTime() < RESEND_COOLDOWN) {
      return NextResponse.json(
        { error: 'Please wait before requesting another code.' },
        { status: 429 }
      );
    }

    await db.emailOTP.deleteMany({ where: { email, purpose } });

    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    await db.emailOTP.create({
      data: {
        email,
        otpHash,
        purpose,
        attempts: 0,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      },
    });

    const emailPurpose: 'login' | 'signup' | 'reset' =
      purpose === 'reset-password' ? 'reset' : purpose;
    await sendOTPEmail(email, otp, emailPurpose);

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your email address',
    });
  } catch (error) {
    console.error('Send email OTP error:', error);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
