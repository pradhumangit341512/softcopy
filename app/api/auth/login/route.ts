// app/api/auth/login/route.ts
// Step 1: POST { email, password }         → validates creds → sends OTP → { requireOTP: true }
// Step 2: POST { email, password, otp }    → verifies OTP  → sets cookie → { user }
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import {
  generateToken,
  IS_DEV_BYPASS,
  getEnumerationShieldHash,
} from '@/lib/auth';
import { sendOTPEmail } from '@/lib/email';
import {
  generateOTP, hashOTP, verifyEmailOtp,
  OTP_EXPIRY_MS, RESEND_COOLDOWN,
} from '@/lib/otp';
import { loginSchema, parseBody } from '@/lib/validations';
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
    const ipLimit = await authLimiter.check(20, `login:ip:${ip}`);
    if (!ipLimit.success) {
      return rateLimited('Too many login attempts. Please try again later.', ipLimit.retryAfter);
    }

    const parsed = await parseBody(req, loginSchema);
    if (!parsed.ok) return parsed.response;
    const { email, password, otp } = parsed.data;

    const emailLimit = await authLimiter.check(10, `login:email:${email}`);
    if (!emailLimit.success) {
      return rateLimited('Too many attempts for this account. Please try again later.', emailLimit.retryAfter);
    }

    // ════════════════════════════════════
    // DEV BYPASS — only when IS_DEV_BYPASS is true (localhost + explicit flag)
    // Still requires correct password; uses user.role (never hardcoded admin).
    // ════════════════════════════════════
    if (IS_DEV_BYPASS) {
      const user = await db.user.findUnique({
        where: { email },
        include: { company: true },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'Dev bypass requires an existing user. Sign up first.' },
          { status: 401 }
        );
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }

      if (!otp) {
        return NextResponse.json(
          { requireOTP: true, message: 'DEV MODE: enter any 6-digit OTP' },
          { status: 200 }
        );
      }

      const token = await generateToken(
        user.id, user.companyId!, user.role, user.email,
        {
          subscriptionExpiry: user.company?.subscriptionExpiry ?? null,
          tokenVersion: user.tokenVersion,
        }
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _pw, ...safeUser } = user;
      const response = NextResponse.json(
        { message: 'Login successful', user: safeUser },
        { status: 200 }
      );
      response.cookies.set('auth_token', token, COOKIE_OPTS);
      return response;
    }

    // ════════════════════════════════════
    // PRODUCTION FLOW
    // ════════════════════════════════════
    const user = await db.user.findUnique({
      where: { email },
      include: { company: true },
    });

    // Constant-time-ish: compare against a real bcrypt hash even when user
    // is missing so timing can't reveal whether the email exists.
    const shield = await getEnumerationShieldHash();
    const passwordMatch = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, shield);

    if (!user || !passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Account is inactive' }, { status: 403 });
    }
    if (user.company && new Date() > user.company.subscriptionExpiry) {
      return NextResponse.json({ error: 'Subscription expired' }, { status: 403 });
    }

    // STEP 2: OTP provided → verify it
    if (otp) {
      const record = await db.emailOTP.findFirst({
        where: { email, purpose: 'login' },
        orderBy: { createdAt: 'desc' },
      });

      if (!record) {
        return NextResponse.json({ error: 'No OTP found. Please request a new one.' }, { status: 400 });
      }

      const outcome = await verifyEmailOtp(record.id, String(otp));
      if (outcome === 'expired') {
        await db.emailOTP.delete({ where: { id: record.id } }).catch(() => {});
        return NextResponse.json({ error: 'OTP expired. Please try logging in again.' }, { status: 400 });
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

      const token = await generateToken(
        user.id, user.companyId!, user.role, user.email,
        {
          subscriptionExpiry: user.company?.subscriptionExpiry ?? null,
          tokenVersion: user.tokenVersion,
        }
      );

      if (user.companyId) {
        await recordAudit({
          companyId: user.companyId,
          userId: user.id,
          action: 'auth.login',
          resource: 'User',
          resourceId: user.id,
          req,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _pw, ...safeUser } = user;
      const response = NextResponse.json(
        { message: 'Login successful', user: safeUser },
        { status: 200 }
      );
      response.cookies.set('auth_token', token, COOKIE_OPTS);
      return response;
    }

    // STEP 1: Password correct → send OTP
    const lastOTP = await db.emailOTP.findFirst({
      where: { email, purpose: 'login' },
      orderBy: { createdAt: 'desc' },
    });
    if (lastOTP && Date.now() - new Date(lastOTP.createdAt).getTime() < RESEND_COOLDOWN) {
      return NextResponse.json(
        { requireOTP: true, message: 'OTP already sent. Please check your email.' },
        { status: 200 }
      );
    }

    await db.emailOTP.deleteMany({ where: { email, purpose: 'login' } });

    const newOTP = generateOTP();
    const otpHash = hashOTP(newOTP);
    await db.emailOTP.create({
      data: {
        email,
        otpHash,
        purpose: 'login',
        attempts: 0,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      },
    });
    await sendOTPEmail(email, newOTP, 'login');

    return NextResponse.json(
      { requireOTP: true, message: 'OTP sent to your email address' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
