import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import twilio from 'twilio';
import {
  generateOTP, hashOTP, verifySmsOtp,
  OTP_EXPIRY_MS, RESEND_COOLDOWN,
} from '@/lib/otp';
import { parseBody, sendSmsOtpSchema, verifySmsOtpSchema } from '@/lib/validations';
import { otpLimiter, getClientIp, rateLimited } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * Look up the caller's company from their session if possible. We do NOT
 * trust a body-supplied companyId for rate-limit bucketing or SMS delivery.
 */
async function resolveCompanyId(phone: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { phone },
    select: { companyId: true },
  });
  return user?.companyId ?? null;
}

/* =========================
   SEND OTP — POST /api/auth/otp
========================= */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // Twilio config — fail fast and never log secrets
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid?.startsWith('AC') || !authToken || !phoneNumber) {
      return NextResponse.json({ error: 'OTP service not configured' }, { status: 500 });
    }

    // IP-level limit first (global abuse protection)
    const ipLimit = await otpLimiter.check(10, `sms-otp:ip:${ip}`);
    if (!ipLimit.success) {
      return rateLimited('Too many requests. Please try again later.', ipLimit.retryAfter);
    }

    const parsed = await parseBody(req, sendSmsOtpSchema);
    if (!parsed.ok) return parsed.response;
    const { phone } = parsed.data;

    // Phone-level limit keyed ONLY on the normalized phone — client-supplied
    // companyId is not part of the key (a rotating companyId would otherwise
    // bypass the cap and enable SMS-pumping).
    const phoneLimit = await otpLimiter.check(3, `sms-otp:phone:${phone}`);
    if (!phoneLimit.success) {
      return rateLimited('Too many codes requested for this number. Please wait.', phoneLimit.retryAfter);
    }

    // Resolve company server-side. If phone doesn't map to a user, we still
    // accept (e.g. initial signup SMS flows), but the OTP is not scoped to
    // a specific company in that case.
    const companyId = await resolveCompanyId(phone);
    if (!companyId) {
      return NextResponse.json(
        { error: 'Phone number not recognized.' },
        { status: 404 }
      );
    }

    const lastOtp = await db.oTP.findFirst({
      where: { phone, companyId },
      orderBy: { createdAt: 'desc' },
    });
    if (lastOtp && Date.now() - new Date(lastOtp.createdAt).getTime() < RESEND_COOLDOWN) {
      return NextResponse.json(
        { error: 'Please wait before requesting another OTP.' },
        { status: 429 }
      );
    }

    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    await db.oTP.create({
      data: {
        phone,
        companyId,
        otpHash,
        ipAddress: ip,
        attempts: 0,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      },
    });

    const client = twilio(accountSid, authToken);
    await client.messages.create({
      body: `Your OTP is ${otp}. Valid for 10 minutes.`,
      from: phoneNumber,
      to: phone,
    });

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
    });
  } catch (error) {
    console.error('SEND OTP ERROR:', error);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}

/* =========================
   VERIFY OTP — PUT /api/auth/otp
========================= */
export async function PUT(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const ipLimit = await otpLimiter.check(20, `sms-otp-verify:ip:${ip}`);
    if (!ipLimit.success) {
      return rateLimited('Too many attempts. Try again later.', ipLimit.retryAfter);
    }

    const parsed = await parseBody(req, verifySmsOtpSchema);
    if (!parsed.ok) return parsed.response;
    const { phone, otp } = parsed.data;

    const companyId = await resolveCompanyId(phone);
    if (!companyId) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    const record = await db.oTP.findFirst({
      where: { phone, companyId },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    const outcome = await verifySmsOtp(record.id, otp);
    if (outcome === 'expired') {
      return NextResponse.json({ error: 'OTP expired' }, { status: 400 });
    }
    if (outcome === 'locked') {
      return NextResponse.json(
        { error: 'Too many attempts. Try later.' },
        { status: 429, headers: { 'Retry-After': '600' } }
      );
    }
    if (outcome === 'mismatch') {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    await db.oTP.delete({ where: { id: record.id } });

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (error) {
    console.error('VERIFY OTP ERROR:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
