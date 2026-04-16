/**
 * POST /api/auth/verify-otp
 *
 * Step 2 of the single-form login flow. Accepts { email, password, otp },
 * re-validates all three server-side, issues the JWT cookie, and returns
 * the user + role-based redirect path.
 *
 * This is the real authentication endpoint. /api/auth/login is kept as a
 * legacy compatibility shim; new UI flows should call this.
 *
 * Security:
 *   - Re-validates password server-side even though send-otp already did —
 *     don't trust that the UI couldn't skip step 1.
 *   - OTP compare is atomic (verifyEmailOtp) — attempt counter increments
 *     BEFORE the hash compare, so concurrent wrong guesses can't race past
 *     MAX_ATTEMPTS.
 *   - Role-based redirect path returned to client (not a 302 redirect —
 *     cleaner for SPAs).
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { generateToken, getEnumerationShieldHash } from '@/lib/auth';
import { verifyEmailOtp } from '@/lib/otp';
import { loginSchema, otpCodeSchema, parseBody } from '@/lib/validations';
import { authLimiter, getClientIp, rateLimited } from '@/lib/rate-limit';
import { ErrorCode, apiError, newRequestId } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

/** Where this user should land after login, based on role. */
function redirectPathFor(role: string): string {
  if (role === 'admin' || role === 'superadmin') return '/admin/dashboard';
  return '/team/dashboard';
}

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const ip = getClientIp(req);
  const log = logger.child({ route: '/api/auth/verify-otp', requestId, ip });

  try {
    // ── Rate limits ──
    const ipLimit = await authLimiter.check(20, `verify-otp:ip:${ip}`);
    if (!ipLimit.success) {
      return rateLimited('Too many attempts. Please try again later.', ipLimit.retryAfter);
    }

    // ── Parse body — OTP is required here ──
    // Build a schema that's loginSchema minus its optional otp, plus a
    // required otp. Avoids the fragile `.shape.otp.unwrap()` trick that
    // would break if loginSchema's otp wrapping ever changed.
    const schema = loginSchema.omit({ otp: true }).extend({ otp: otpCodeSchema });
    const parsed = await parseBody(req, schema);
    if (!parsed.ok) return parsed.response;
    const { email, password, otp } = parsed.data;

    const emailLimit = await authLimiter.check(10, `verify-otp:email:${email}`);
    if (!emailLimit.success) {
      return rateLimited(
        'Too many attempts for this account. Please wait.',
        emailLimit.retryAfter
      );
    }

    // ── Re-validate credentials ──
    const user = await db.user.findUnique({
      where: { email },
      include: { company: true },
    });

    const shield = await getEnumerationShieldHash();
    const passwordMatch = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, shield);

    if (!user || !passwordMatch) {
      log.info({ emailTried: email.slice(0, 3) + '***' }, 'verify-otp invalid credentials');
      return apiError(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Invalid credentials. Please start over.',
        { requestId }
      );
    }

    if (user.status !== 'active') {
      return apiError(
        ErrorCode.AUTH_ACCOUNT_INACTIVE,
        'Account is inactive. Contact support.',
        { requestId }
      );
    }

    if (user.company && new Date() > user.company.subscriptionExpiry) {
      return apiError(
        ErrorCode.AUTH_SUBSCRIPTION_EXPIRED,
        'Your subscription has expired. Please renew to continue.',
        { requestId }
      );
    }

    // ── Verify OTP (atomic attempt increment) ──
    const record = await db.emailOTP.findFirst({
      where: { email, purpose: 'login' },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      return apiError(
        ErrorCode.OTP_NOT_FOUND,
        'No verification code found. Please request a new one.',
        { requestId }
      );
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

    // ── Success — consume OTP, issue JWT ──
    await db.emailOTP.delete({ where: { id: record.id } });

    const token = await generateToken(
      user.id,
      user.companyId!,
      user.role,
      user.email,
      {
        subscriptionExpiry: user.company?.subscriptionExpiry ?? null,
        tokenVersion: user.tokenVersion,
      }
    );

    await recordAudit({
      companyId: user.companyId!,
      userId: user.id,
      action: 'auth.login',
      resource: 'User',
      resourceId: user.id,
      req,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...safeUser } = user;
    const redirectTo = redirectPathFor(user.role);

    log.info({ userId: user.id, role: user.role, redirectTo }, 'login success');

    const response = NextResponse.json(
      {
        message: 'Login successful',
        user: safeUser,
        redirectTo,
      },
      { status: 200, headers: { 'X-Request-Id': requestId } }
    );
    response.cookies.set('auth_token', token, COOKIE_OPTS);
    return response;
  } catch (err) {
    log.error({ err }, 'Unhandled error');
    return apiError(
      ErrorCode.SYSTEM_INTERNAL_ERROR,
      'Could not complete login. Please try again.',
      { requestId }
    );
  }
}
