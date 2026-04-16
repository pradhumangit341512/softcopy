/**
 * POST /api/auth/signup
 *
 * Simplified single-step signup:
 *   1. Validate body (name, email, phone, password, companyName)
 *   2. Reject if email/phone already registered (409)
 *   3. Create Company + User in a transaction, emailVerified=null, status='pending_verification'
 *   4. Mint a single-use verification token, hash it, store hash
 *   5. Email the raw token inside a link: APP_URL/verify-email?token=RAW
 *   6. Return generic success — the user activates by clicking the link
 *
 * No OTP during signup. The OTP flow now only runs during login (and only on
 * untrusted devices). See /api/auth/login.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { sendVerificationEmail } from '@/lib/email';
import { signupSchema, parseBody } from '@/lib/validations';
import { authLimiter, getClientIp, rateLimited } from '@/lib/rate-limit';
import { ErrorCode, apiError, newRequestId } from '@/lib/errors';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const ip = getClientIp(req);
  const log = logger.child({ route: '/api/auth/signup', requestId, ip });

  try {
    // ── Rate limit per IP ──
    const ipLimit = await authLimiter.check(10, `signup:ip:${ip}`);
    if (!ipLimit.success) {
      return rateLimited('Too many signup attempts. Please try again later.', ipLimit.retryAfter);
    }

    // ── Validate body (OTP field on the schema is ignored/unused now) ──
    const parsed = await parseBody(req, signupSchema);
    if (!parsed.ok) return parsed.response;
    const { name, email, phone, password, companyName } = parsed.data;

    // ── Duplicate check ──
    const existing = await db.user.findFirst({
      where: { OR: [{ email }, { phone }] },
      select: { email: true, phone: true },
    });
    if (existing) {
      const field = existing.email === email ? 'email' : 'phone number';
      return apiError(
        ErrorCode.RESOURCE_CONFLICT,
        `This ${field} is already registered. Please log in instead.`,
        { requestId, status: 409 }
      );
    }

    // ── Create account (pending-verification) + token atomically ──
    const hashedPassword = await bcrypt.hash(password, 12);
    const subscriptionExpiry = new Date();
    subscriptionExpiry.setDate(subscriptionExpiry.getDate() + 30);

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    let userId: string;

    try {
      const { user } = await db.$transaction(async (tx) => {
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
            name,
            email,
            phone,
            password: hashedPassword,
            role: 'admin',
            companyId: company.id,
            status: 'pending_verification',
            emailVerified: null,
          },
        });
        await tx.verificationToken.create({
          data: {
            userId: user.id,
            tokenHash,
            purpose: 'email-verification',
            expiresAt,
          },
        });
        return { user, company };
      });
      userId = user.id;
    } catch (createError: unknown) {
      const e = createError as { code?: string; meta?: { target?: string[] } };
      if (e?.code === 'P2002') {
        const field = e.meta?.target?.[0] || 'field';
        return apiError(
          ErrorCode.RESOURCE_CONFLICT,
          `This ${field} is already registered. Please log in instead.`,
          { requestId, status: 409 }
        );
      }
      throw createError;
    }

    // ── Send verification email — if it fails, roll back the user create
    // so the user can retry signup rather than being stuck with an unclickable account. ──
    const verifyLink = `${env.APP_URL}/verify-email?token=${encodeURIComponent(rawToken)}`;
    try {
      await sendVerificationEmail(email, verifyLink, name);
    } catch (sendErr) {
      log.error({ err: sendErr, userId }, 'Verification email send failed');
      // Roll back — delete user + company + token. Cascade handles token.
      await db.user.delete({ where: { id: userId } }).catch(() => {});
      return apiError(
        ErrorCode.OTP_SEND_FAILED,
        'We could not send the verification email right now. Please try again.',
        { requestId }
      );
    }

    log.info({ userId, email: email.slice(0, 3) + '***' }, 'Signup pending verification');

    // Dev-only echo of the link so you can test without opening an inbox.
    const IS_DEV_LOCAL =
      process.env.NODE_ENV === 'development' &&
      !process.env.VERCEL &&
      !process.env.VERCEL_ENV;
    if (IS_DEV_LOCAL) {
      // eslint-disable-next-line no-console
      console.log(`\n✅ [DEV] verification link for ${email}:\n${verifyLink}\n`);
    }

    const body: Record<string, unknown> = {
      success: true,
      message: "Check your email — we've sent a link to verify your address.",
    };
    if (IS_DEV_LOCAL) {
      body.__dev = { verifyLink };
    }

    return NextResponse.json(body, {
      status: 201,
      headers: { 'X-Request-Id': requestId },
    });
  } catch (error) {
    log.error({ err: error }, 'Signup failed');
    return apiError(
      ErrorCode.SYSTEM_INTERNAL_ERROR,
      'Signup failed. Please try again.',
      { requestId }
    );
  }
}
