/**
 * POST /api/auth/send-otp
 *
 * Step 1 of the single-form login flow. Accepts { email, password }, silently
 * validates BOTH before sending an OTP. Always returns a generic success
 * response so an attacker can't distinguish invalid-email vs invalid-password
 * vs rate-limited-by-cooldown.
 *
 * In LOCAL dev only (NODE_ENV=development AND no Vercel env markers), the
 * response also includes a `__dev` diagnostic block that exposes the real
 * outcome + the OTP itself. This is gated tightly — never reachable on
 * Vercel preview or production deployments.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { getEnumerationShieldHash } from '@/lib/auth';
import { sendOTPEmail } from '@/lib/email';
import {
  generateOTP,
  hashOTP,
  OTP_EXPIRY_MS,
  RESEND_COOLDOWN,
} from '@/lib/otp';
import { loginSchema, parseBody } from '@/lib/validations';
import { authLimiter, getClientIp, rateLimited } from '@/lib/rate-limit';
import { ErrorCode, apiError, newRequestId } from '@/lib/errors';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/** Only true on a developer laptop, never on Vercel. */
const IS_DEV_LOCAL =
  process.env.NODE_ENV === 'development' &&
  !process.env.VERCEL &&
  !process.env.VERCEL_ENV;

type Outcome =
  | 'otp_sent'
  | 'invalid_credentials'
  | 'account_inactive'
  | 'cooldown'
  | 'send_failed';

const GENERIC_MESSAGE =
  'If your credentials are correct, a verification code has been sent to your email.';

/**
 * Build the HTTP response. In prod, always generic. In local dev, attaches
 * `__dev.outcome` (always) and `__dev.otp` (only when an OTP was actually sent).
 */
function buildResponse(
  requestId: string,
  outcome: Outcome,
  devOtp?: string,
  devNote?: string
): NextResponse {
  const body: Record<string, unknown> = {
    success: true,
    message: GENERIC_MESSAGE,
  };

  if (IS_DEV_LOCAL) {
    body.__dev = {
      outcome,
      ...(devOtp ? { otp: devOtp } : {}),
      ...(devNote ? { note: devNote } : {}),
    };
  }

  return NextResponse.json(body, {
    status: 200,
    headers: { 'X-Request-Id': requestId },
  });
}

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const ip = getClientIp(req);
  const log = logger.child({ route: '/api/auth/send-otp', requestId, ip });

  try {
    // ── Rate limit per IP ──
    const ipLimit = await authLimiter.check(20, `send-otp:ip:${ip}`);
    if (!ipLimit.success) {
      return rateLimited('Too many requests. Please try again later.', ipLimit.retryAfter);
    }

    // ── Validate body ──
    const parsed = await parseBody(req, loginSchema.omit({ otp: true }));
    if (!parsed.ok) return parsed.response;
    const { email, password } = parsed.data;

    // ── Rate limit per email ──
    const emailLimit = await authLimiter.check(5, `send-otp:email:${email}`);
    if (!emailLimit.success) {
      return rateLimited(
        'Too many verification attempts for this account. Please wait.',
        emailLimit.retryAfter
      );
    }

    // ── Silently validate credentials (constant-time vs missing users) ──
    const user = await db.user.findUnique({
      where: { email },
      include: { company: true },
    });

    const shield = await getEnumerationShieldHash();
    const passwordMatch = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, shield);

    if (!user || !passwordMatch) {
      log.info(
        { emailTried: email.slice(0, 3) + '***', outcome: 'invalid_credentials' },
        'send-otp blocked'
      );
      return buildResponse(
        requestId,
        'invalid_credentials',
        undefined,
        'No account found with that email, or the password is wrong. Sign up first at /signup.'
      );
    }

    if (user.status !== 'active') {
      log.info({ userId: user.id, outcome: 'account_inactive' }, 'send-otp blocked');
      return buildResponse(
        requestId,
        'account_inactive',
        undefined,
        'Account exists but is marked inactive in DB.'
      );
    }

    // ── Resend cooldown (per-DB row, not per-limiter) ──
    const lastOTP = await db.emailOTP.findFirst({
      where: { email, purpose: 'login' },
      orderBy: { createdAt: 'desc' },
    });
    if (lastOTP && Date.now() - new Date(lastOTP.createdAt).getTime() < RESEND_COOLDOWN) {
      log.info({ userId: user.id, outcome: 'cooldown' }, 'send-otp within cooldown');
      return buildResponse(
        requestId,
        'cooldown',
        undefined,
        'An OTP was sent < 60s ago. Wait, or delete the EmailOTP row in DB to retry.'
      );
    }

    // ── Generate + store OTP ──
    await db.emailOTP.deleteMany({ where: { email, purpose: 'login' } });

    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    await db.emailOTP.create({
      data: {
        email,
        otpHash,
        purpose: 'login',
        attempts: 0,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      },
    });

    // ── Send email (Resend → Gmail fallback inside sendOTPEmail) ──
    try {
      await sendOTPEmail(email, otp, 'login');
    } catch (sendErr) {
      const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      log.error({ err: sendErr, userId: user.id }, 'OTP email send failed');

      // In local dev, don't hide a delivery failure — surface it so we can
      // debug provider issues immediately. In prod, return a 5xx (the OTP
      // row is pointless without delivery, so we clean it up either way).
      await db.emailOTP.deleteMany({ where: { email, purpose: 'login' } }).catch(() => {});

      if (IS_DEV_LOCAL) {
        return buildResponse(requestId, 'send_failed', undefined, errMsg);
      }

      return apiError(
        ErrorCode.OTP_SEND_FAILED,
        'We could not send the verification email right now. Please try again.',
        { requestId }
      );
    }

    log.info({ userId: user.id, outcome: 'otp_sent' }, 'send-otp success');

    // In dev, ALSO log the OTP to the terminal as a backup — so even if the
    // browser request is silently swallowed, the dev can still copy the code.
    if (IS_DEV_LOCAL) {
      // eslint-disable-next-line no-console
      console.log(`\n🔑 [DEV] OTP for ${email}: ${otp} (expires in 10 min)\n`);
    }

    return buildResponse(requestId, 'otp_sent', IS_DEV_LOCAL ? otp : undefined);
  } catch (err) {
    log.error({ err }, 'Unhandled error');
    return apiError(
      ErrorCode.SYSTEM_INTERNAL_ERROR,
      'Could not process request. Please try again.',
      { requestId }
    );
  }
}
