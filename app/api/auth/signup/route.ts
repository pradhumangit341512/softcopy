// app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { generateToken, IS_DEV_BYPASS } from '@/lib/auth';
import { sendOTPEmail } from '@/lib/email';
import {
  generateOTP, hashOTP, verifyEmailOtp,
  OTP_EXPIRY_MS, RESEND_COOLDOWN,
} from '@/lib/otp';
import { signupSchema, parseBody } from '@/lib/validations';
import { authLimiter, getClientIp, rateLimited } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const ipLimit = await authLimiter.check(10, `signup:ip:${ip}`);
    if (!ipLimit.success) {
      return rateLimited('Too many signup attempts. Please try again later.', ipLimit.retryAfter);
    }

    const parsed = await parseBody(req, signupSchema);
    if (!parsed.ok) return parsed.response;
    const { name, email, phone, password, companyName, otp } = parsed.data;

    // ════════════════════════════════════
    // DEV BYPASS — ONLY creates a genuinely new account; never hijacks
    // an existing email/phone. Role is NOT hardcoded.
    // ════════════════════════════════════
    if (IS_DEV_BYPASS) {
      if (!otp) {
        return NextResponse.json(
          { requireOTP: true, message: 'DEV MODE: enter any 6-digit OTP' },
          { status: 200 }
        );
      }

      const existing = await db.user.findFirst({
        where: { OR: [{ email }, { phone }] },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'An account with this email or phone already exists.' },
          { status: 409 }
        );
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const subscriptionExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const company = await db.company.create({
        data: {
          companyName: companyName || 'Dev Company',
          subscriptionType: 'Basic',
          subscriptionExpiry,
          status: 'active',
        },
      });

      const user = await db.user.create({
        data: {
          name, email, phone,
          password: hashedPassword,
          role: 'admin',
          companyId: company.id,
          status: 'active',
        },
      });

      const token = await generateToken(
        user.id, company.id, user.role, user.email,
        { subscriptionExpiry, tokenVersion: user.tokenVersion }
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _pw, ...safeUser } = user;
      const response = NextResponse.json(
        { message: 'Account created successfully', user: { ...safeUser, company } },
        { status: 201 }
      );
      response.cookies.set('auth_token', token, COOKIE_OPTS);
      return response;
    }

    // ════════════════════════════════════
    // PRODUCTION FLOW
    // ════════════════════════════════════

    // STEP 2: OTP provided → verify + create account (idempotent-safe via P2002)
    if (otp) {
      // Re-check just before creation; race with concurrent signup handled by
      // the unique constraint + P2002 catch below.
      const existing = await db.user.findFirst({
        where: { OR: [{ email }, { phone }] },
        select: { email: true, phone: true },
      });
      if (existing) {
        const field = existing.email === email ? 'email' : 'phone number';
        return NextResponse.json(
          { error: `This ${field} is already registered. Please log in instead.` },
          { status: 409 }
        );
      }

      const record = await db.emailOTP.findFirst({
        where: { email, purpose: 'signup' },
        orderBy: { createdAt: 'desc' },
      });
      if (!record) {
        return NextResponse.json({ error: 'No OTP found. Please request a new one.' }, { status: 400 });
      }

      const outcome = await verifyEmailOtp(record.id, String(otp));
      if (outcome === 'expired') {
        await db.emailOTP.delete({ where: { id: record.id } }).catch(() => {});
        return NextResponse.json({ error: 'OTP expired. Please try again.' }, { status: 400 });
      }
      if (outcome === 'locked') {
        await db.emailOTP.delete({ where: { id: record.id } }).catch(() => {});
        return NextResponse.json(
          { error: 'Too many failed attempts. Please try again.' },
          { status: 429, headers: { 'Retry-After': '600' } }
        );
      }
      if (outcome === 'mismatch') {
        return NextResponse.json({ error: 'Invalid OTP.' }, { status: 400 });
      }

      await db.emailOTP.delete({ where: { id: record.id } });

      const hashedPassword = await bcrypt.hash(password, 12);
      const subscriptionExpiry = new Date();
      subscriptionExpiry.setDate(subscriptionExpiry.getDate() + 30);

      // Transactional create — if the user insert fails (race P2002, etc.)
      // the company insert is rolled back so no orphan Company rows accumulate.
      try {
        const { user, company } = await db.$transaction(async (tx) => {
          const company = await tx.company.create({
            data: {
              companyName,
              subscriptionType: 'Basic',
              subscriptionExpiry,
              status: 'active',
            },
          });
          const user = await tx.user.create({
            data: {
              name, email, phone,
              password: hashedPassword,
              role: 'admin',
              companyId: company.id,
              status: 'active',
            },
          });
          return { user, company };
        });

        const token = await generateToken(
          user.id, company.id, user.role, user.email,
          { subscriptionExpiry, tokenVersion: user.tokenVersion }
        );

        await recordAudit({
          companyId: company.id,
          userId: user.id,
          action: 'auth.signup',
          resource: 'User',
          resourceId: user.id,
          req,
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _pw, ...safeUser } = user;
        const response = NextResponse.json(
          { message: 'Account created successfully', user: { ...safeUser, company } },
          { status: 201 }
        );
        response.cookies.set('auth_token', token, COOKIE_OPTS);
        return response;
      } catch (createError: unknown) {
        const prismaError = createError as { code?: string; meta?: { target?: string[] } };
        if (prismaError?.code === 'P2002') {
          const field = prismaError.meta?.target?.[0] || 'field';
          return NextResponse.json(
            { error: `This ${field} is already registered. Please try logging in instead.` },
            { status: 409 }
          );
        }
        throw createError;
      }
    }

    // ════════════════════════════════════
    // STEP 1: Send OTP. IMPORTANT: do NOT reveal whether the email/phone is
    // already taken here — that enables account enumeration. The duplicate
    // check runs at OTP-verification time (Step 2).
    // ════════════════════════════════════
    const lastOTP = await db.emailOTP.findFirst({
      where: { email, purpose: 'signup' },
      orderBy: { createdAt: 'desc' },
    });
    if (lastOTP && Date.now() - new Date(lastOTP.createdAt).getTime() < RESEND_COOLDOWN) {
      return NextResponse.json(
        { requireOTP: true, message: 'OTP already sent. Please check your email.' },
        { status: 200 }
      );
    }

    await db.emailOTP.deleteMany({ where: { email, purpose: 'signup' } });

    const newOTP = generateOTP();
    const otpHash = hashOTP(newOTP);
    await db.emailOTP.create({
      data: {
        email,
        otpHash,
        purpose: 'signup',
        attempts: 0,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      },
    });

    // Only actually send the email if the address is free — but always return
    // the same generic response so the attacker can't distinguish.
    const emailExists = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (!emailExists) {
      await sendOTPEmail(email, newOTP, 'signup');
    }

    return NextResponse.json(
      { requireOTP: true, message: 'If this address is available, a verification code has been sent.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 });
  }
}
