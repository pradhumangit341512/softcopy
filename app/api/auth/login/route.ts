/**
 * POST /api/auth/login  — consolidated auth entrypoint.
 *
 * Single-session enforcement: only ONE active session per account at a time.
 * When a new login succeeds, all previous sessions are terminated instantly
 * (tokenVersion bump + session close + trusted-device revocation).
 *
 * OTP is ALWAYS required — no trusted-device bypass. Every login goes through:
 *   1. Email + password → server validates, sends OTP → { requireOTP: true }
 *   2. Email + password + OTP → server verifies all three → JWT issued
 *
 * Security:
 *   - Emailed-unverified accounts are blocked with AUTH_EMAIL_NOT_VERIFIED.
 *   - Subscription expiry enforced here for clearer error messages.
 *   - Constant-time bcrypt against shield hash for missing users.
 *   - OTP attempt counter increments atomically BEFORE compare.
 *   - Single-session: old JWTs are instantly invalidated via tokenVersion bump.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { generateToken, getEnumerationShieldHash } from '@/lib/auth';
import { sendOTPEmail, sendLoginAlertEmail } from '@/lib/email';
import {
  generateOTP, hashOTP, verifyEmailOtp,
  OTP_EXPIRY_MS, RESEND_COOLDOWN,
} from '@/lib/otp';
import { loginSchema, parseBody } from '@/lib/validations';
import { authLimiter, getClientIp, rateLimited } from '@/lib/rate-limit';
import { ErrorCode, apiError, newRequestId } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { recordAudit } from '@/lib/audit';

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

function parseUserAgent(ua: string): string {
  if (!ua) return 'Unknown device';
  let browser = 'Unknown browser';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';

  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
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

    // ═════════════════════════════════════════════
    // OTP PROVIDED → verify + issue JWT (single session)
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

      const response = await completeLogin(user, req, requestId);
      log.info({ userId: user.id, path: 'otp-verified' }, 'login success (single session enforced)');
      return response;
    }

    // ═════════════════════════════════════════════
    // NO OTP → generate + send, return requireOTP
    // ═════════════════════════════════════════════
    const lastOTP = await db.emailOTP.findFirst({
      where: { email, purpose: 'login' },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOTP && Date.now() - new Date(lastOTP.createdAt).getTime() < RESEND_COOLDOWN) {
      log.info({ userId: user.id, path: 'otp-cooldown' }, 'login cooldown hit');
      return NextResponse.json(
        {
          requireOTP: true,
          message: 'A code was already sent. Please check your email.',
          reason: 'mandatory-otp',
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
        reason: 'mandatory-otp',
      },
      { status: 200, headers: { 'X-Request-Id': requestId } }
    );
  } catch (err) {
    log.error({ err }, 'Unhandled login error');
    return apiError(ErrorCode.SYSTEM_INTERNAL_ERROR, 'Login failed. Please try again.', { requestId });
  }
}

/**
 * Single-session login: terminates all previous sessions, bumps tokenVersion,
 * issues a fresh JWT with the new version. Only ONE device can be active.
 */
async function completeLogin(
  user: Awaited<ReturnType<typeof db.user.findUnique>> & { company?: { subscriptionExpiry: Date; status: string } | null },
  req: NextRequest,
  requestId: string
): Promise<NextResponse> {
  if (!user) throw new Error('completeLogin called with null user');

  const companyId = user.companyId ?? '';
  const loginIp = getClientIp(req);
  const loginUa = req.headers.get('user-agent') ?? '';
  const now = new Date();

  // ── 1. Terminate all previous sessions ──
  // Bump tokenVersion → every existing JWT instantly fails verification
  const updated = await db.user.update({
    where: { id: user.id },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });

  // Close all open UserSession records
  const openSessions = await db.userSession.findMany({
    where: { userId: user.id, logoutAt: { isSet: false } },
    select: { id: true, loginAt: true },
  });
  if (openSessions.length > 0) {
    await Promise.all(
      openSessions.map((s) =>
        db.userSession.update({
          where: { id: s.id },
          data: {
            logoutAt: now,
            duration: Math.round((now.getTime() - s.loginAt.getTime()) / 60000),
          },
        }).catch(() => {})
      )
    );
  }

  // Revoke all trusted devices
  await db.trustedDevice.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: now },
  }).catch(() => {});

  // ── 2. Issue fresh JWT with new tokenVersion ──
  const token = await generateToken(
    user.id,
    companyId,
    user.role,
    user.email,
    {
      subscriptionExpiry: user.company?.subscriptionExpiry ?? null,
      tokenVersion: updated.tokenVersion,
    }
  );

  // ── 3. Create the ONE active session ──
  if (companyId) {
    await db.userSession.create({
      data: {
        userId: user.id,
        companyId,
        loginAt: now,
        ipAddress: loginIp,
        userAgent: loginUa || undefined,
      },
    }).catch((err) => console.error('Session tracking failed:', err));
  }

  await recordAudit({
    companyId,
    userId: user.id,
    action: 'auth.login',
    resource: 'User',
    resourceId: user.id,
    metadata: { singleSession: true, previousSessions: openSessions.length },
    req,
  });

  // ── 4. Login alert email (fire-and-forget) ──
  const device = parseUserAgent(loginUa);
  sendLoginAlertEmail(user.email, user.name, device, loginIp).catch((err) =>
    console.error('Login alert email failed:', err)
  );

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
