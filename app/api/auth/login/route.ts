/**
 * POST /api/auth/login  — consolidated auth entrypoint for Option A flow.
 *
 * Three possible paths, all keyed off { email, password, otp? }:
 *
 *   A. TRUSTED DEVICE (no OTP needed):
 *      User has a valid `trusted_device` cookie AND their role does not
 *      force OTP (admin/superadmin always force OTP). We validate the
 *      password, issue the JWT, return `{ user, redirectTo }`.
 *
 *   B. FIRST STEP, OTP REQUIRED:
 *      Device is untrusted (no cookie, expired, revoked, or role-forced).
 *      We validate password + send OTP to the user's email, return
 *      `{ requireOTP: true }`. Frontend shows the OTP input.
 *
 *   C. SECOND STEP, VERIFYING OTP:
 *      Body contains `otp`. We re-validate password, verify OTP, issue JWT,
 *      AND remember this device so next login skips OTP.
 *
 * Security:
 *   - Emailed-unverified accounts are blocked with AUTH_EMAIL_NOT_VERIFIED
 *     (they must click the signup link before they can log in).
 *   - Subscription expiry enforced here for clearer error messages than
 *     the middleware would provide.
 *   - Constant-time bcrypt against shield hash for missing users.
 *   - OTP attempt counter increments atomically BEFORE compare (via
 *     verifyEmailOtp helper).
 *   - Admin / superadmin bypasses the trusted-device shortcut.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { generateToken, getEnumerationShieldHash } from '@/lib/auth';
import { sendOTPEmail } from '@/lib/email';
import {
  generateOTP, hashOTP, verifyEmailOtp,
  OTP_EXPIRY_MS, RESEND_COOLDOWN,
} from '@/lib/otp';
import { loginSchema, parseBody } from '@/lib/validations';
import { authLimiter, getClientIp, rateLimited } from '@/lib/rate-limit';
import { ErrorCode, apiError, newRequestId } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { recordAudit } from '@/lib/audit';
import {
  isDeviceTrusted,
  rememberDevice,
  setDeviceCookie,
  getDeviceCookie,
  roleRequiresOtp,
} from '@/lib/trusted-device';

export const runtime = 'nodejs';

const AUTH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

function redirectPathFor(role: string): string {
  if (role === 'superadmin') return '/superadmin';
  if (role === 'admin') return '/admin/dashboard';
  return '/team/dashboard';
}

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const ip = getClientIp(req);
  const log = logger.child({ route: '/api/auth/login', requestId, ip });

  try {
    // ── Rate limits ──
    const ipLimit = await authLimiter.check(20, `login:ip:${ip}`);
    if (!ipLimit.success) {
      return rateLimited('Too many login attempts. Please try again later.', ipLimit.retryAfter);
    }

    const parsed = await parseBody(req, loginSchema);
    if (!parsed.ok) return parsed.response;
    const { email, password, otp } = parsed.data;

    const emailLimit = await authLimiter.check(10, `login:email:${email}`);
    if (!emailLimit.success) {
      return rateLimited(
        'Too many attempts for this account. Please wait.',
        emailLimit.retryAfter
      );
    }

    // ── Validate credentials (constant-time against missing users) ──
    const user = await db.user.findUnique({
      where: { email },
      include: { company: true },
    });

    const shield = await getEnumerationShieldHash();
    const passwordMatch = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, shield);

    if (!user || !passwordMatch) {
      log.info({ emailTried: email.slice(0, 3) + '***' }, 'login invalid credentials');
      return apiError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid email or password.', { requestId });
    }

    // ── Blockers ──
    if (!user.emailVerified) {
      return apiError(
        ErrorCode.AUTH_ACCOUNT_INACTIVE,
        'Please verify your email before logging in. Check your inbox for the verification link.',
        { requestId, status: 403 }
      );
    }
    if (user.status !== 'active') {
      return apiError(
        ErrorCode.AUTH_ACCOUNT_INACTIVE,
        'Account is inactive. Contact support.',
        { requestId }
      );
    }
    // Suspended companies cannot log in. Superadmin (no companyId) bypasses.
    if (user.company && user.company.status === 'suspended' && user.role !== 'superadmin') {
      return apiError(
        ErrorCode.AUTH_ACCOUNT_INACTIVE,
        'Your account has been suspended. Please contact support.',
        { requestId, status: 403 }
      );
    }
    if (user.company && new Date() > user.company.subscriptionExpiry) {
      return apiError(
        ErrorCode.AUTH_SUBSCRIPTION_EXPIRED,
        'Your subscription has expired. Please renew to continue.',
        { requestId }
      );
    }

    // ── Decide: does this login require OTP? ──
    const deviceToken = getDeviceCookie(req);
    const deviceTrusted = !roleRequiresOtp(user.role) && await isDeviceTrusted(user.id, deviceToken);

    // ═════════════════════════════════════════════
    // PATH A — Trusted device, no OTP needed → issue JWT immediately
    // ═════════════════════════════════════════════
    if (deviceTrusted) {
      const response = await completeLogin(user, req, requestId);
      log.info({ userId: user.id, path: 'trusted-device' }, 'login success');
      return response;
    }

    // ═════════════════════════════════════════════
    // PATH C — OTP provided → verify + issue JWT + remember device
    // ═════════════════════════════════════════════
    if (otp) {
      const record = await db.emailOTP.findFirst({
        where: { email, purpose: 'login' },
        orderBy: { createdAt: 'desc' },
      });
      if (!record) {
        return apiError(ErrorCode.OTP_NOT_FOUND, 'No code found. Please request a new one.', { requestId });
      }

      const outcome = await verifyEmailOtp(record.id, otp);
      if (outcome === 'expired') {
        await db.emailOTP.delete({ where: { id: record.id } }).catch(() => {});
        return apiError(ErrorCode.OTP_EXPIRED, 'Code expired. Please request a new one.', { requestId });
      }
      if (outcome === 'locked') {
        await db.emailOTP.delete({ where: { id: record.id } }).catch(() => {});
        return apiError(
          ErrorCode.OTP_LOCKED,
          'Too many failed attempts. Please request a new code.',
          { requestId, retryAfter: 600 }
        );
      }
      if (outcome === 'mismatch') {
        return apiError(ErrorCode.OTP_INVALID, 'Invalid code.', { requestId });
      }

      await db.emailOTP.delete({ where: { id: record.id } });

      // Issue JWT + remember this device (unless role forces OTP every time)
      const response = await completeLogin(user, req, requestId);
      if (!roleRequiresOtp(user.role)) {
        const rawDeviceToken = await rememberDevice(user.id, {
          userAgent: req.headers.get('user-agent') || undefined,
          ipAddress: ip,
        });
        setDeviceCookie(response, rawDeviceToken);
      }

      log.info({ userId: user.id, path: 'otp-verified' }, 'login success');
      return response;
    }

    // ═════════════════════════════════════════════
    // PATH B — No OTP yet → generate + send, return requireOTP
    // ═════════════════════════════════════════════
    const lastOTP = await db.emailOTP.findFirst({
      where: { email, purpose: 'login' },
      orderBy: { createdAt: 'desc' },
    });

    // Cooldown: silently return the same requireOTP response if a code was sent <60s ago.
    if (lastOTP && Date.now() - new Date(lastOTP.createdAt).getTime() < RESEND_COOLDOWN) {
      log.info({ userId: user.id, path: 'otp-cooldown' }, 'login cooldown hit');
      return NextResponse.json(
        {
          requireOTP: true,
          message: 'A code was already sent. Please check your email.',
          reason: roleRequiresOtp(user.role) ? 'admin-2fa' : 'new-device',
        },
        { status: 200, headers: { 'X-Request-Id': requestId } }
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

    try {
      await sendOTPEmail(email, newOTP, 'login');
    } catch (sendErr) {
      await db.emailOTP.deleteMany({ where: { email, purpose: 'login' } }).catch(() => {});
      log.error({ err: sendErr, userId: user.id }, 'OTP email send failed');
      return apiError(
        ErrorCode.OTP_SEND_FAILED,
        'We could not send the code right now. Please try again.',
        { requestId }
      );
    }

    log.info({ userId: user.id, path: 'otp-sent' }, 'login OTP sent');

    const IS_DEV_LOCAL =
      process.env.NODE_ENV === 'development' &&
      !process.env.VERCEL &&
      !process.env.VERCEL_ENV;
    if (IS_DEV_LOCAL) {

      console.log(`\n🔑 [DEV] login OTP for ${email}: ${newOTP}\n`);
    }

    return NextResponse.json(
      {
        requireOTP: true,
        message: "We've sent a verification code to your email.",
        reason: roleRequiresOtp(user.role) ? 'admin-2fa' : 'new-device',
      },
      { status: 200, headers: { 'X-Request-Id': requestId } }
    );
  } catch (err) {
    log.error({ err }, 'Unhandled login error');
    return apiError(ErrorCode.SYSTEM_INTERNAL_ERROR, 'Login failed. Please try again.', { requestId });
  }
}

/**
 * Issue the auth JWT cookie + audit + compose the user-facing response.
 * Caller is responsible for also setting the trusted-device cookie if
 * this login qualifies.
 */
async function completeLogin(
  user: Awaited<ReturnType<typeof db.user.findUnique>> & { company?: { subscriptionExpiry: Date; status: string } | null },
  req: NextRequest,
  requestId: string
): Promise<NextResponse> {
  if (!user) throw new Error('completeLogin called with null user');

  const companyId = user.companyId ?? '';

  const token = await generateToken(
    user.id,
    companyId,
    user.role,
    user.email,
    {
      subscriptionExpiry: user.company?.subscriptionExpiry ?? null,
      tokenVersion: user.tokenVersion,
    }
  );

  await recordAudit({
    companyId,
    userId: user.id,
    action: 'auth.login',
    resource: 'User',
    resourceId: user.id,
    req,
  });

  // Track login session for team-performance analytics
  if (companyId) {
    db.userSession.create({
      data: {
        userId: user.id,
        companyId,
        loginAt: new Date(),
        ipAddress: getClientIp(req),
        userAgent: req.headers.get('user-agent') ?? undefined,
      },
    }).catch((err) => console.error('Session tracking failed:', err));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _pw, ...safeUser } = user;
  const redirectTo = redirectPathFor(user.role);

  const response = NextResponse.json(
    { message: 'Login successful', user: safeUser, redirectTo },
    { status: 200, headers: { 'X-Request-Id': requestId } }
  );
  response.cookies.set('auth_token', token, AUTH_COOKIE_OPTS);
  return response;
}
