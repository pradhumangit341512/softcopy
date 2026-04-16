/**
 * GET /api/auth/verify-email?token=RAW
 *
 * The user clicked the link in their signup email. Validates the token,
 * marks the account as verified, and redirects to /login?verified=1.
 *
 * Invalid / expired / already-used tokens redirect to /login?verified=0
 * with a helpful message — we never leak WHY (no enumeration).
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { newRequestId } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: '/api/auth/verify-email', requestId });

  const token = req.nextUrl.searchParams.get('token');
  const badUrl = new URL('/login?verified=0', env.APP_URL);
  const goodUrl = new URL('/login?verified=1', env.APP_URL);

  if (!token) {
    return NextResponse.redirect(badUrl);
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const record = await db.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      log.info({ outcome: 'not_found' }, 'verify-email bad token');
      return NextResponse.redirect(badUrl);
    }
    if (record.usedAt) {
      log.info({ outcome: 'already_used', userId: record.userId }, 'verify-email already used');
      return NextResponse.redirect(badUrl);
    }
    if (record.expiresAt < new Date()) {
      log.info({ outcome: 'expired', userId: record.userId }, 'verify-email expired');
      return NextResponse.redirect(badUrl);
    }
    if (record.purpose !== 'email-verification') {
      log.warn({ outcome: 'wrong_purpose', userId: record.userId }, 'verify-email wrong purpose');
      return NextResponse.redirect(badUrl);
    }

    // Atomic activation: mark token used + flip user to active.
    await db.$transaction([
      db.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      db.user.update({
        where: { id: record.userId },
        data: {
          emailVerified: new Date(),
          status: 'active',
        },
      }),
    ]);

    log.info({ userId: record.userId, outcome: 'verified' }, 'verify-email success');
    return NextResponse.redirect(goodUrl);
  } catch (err) {
    log.error({ err }, 'verify-email unhandled error');
    return NextResponse.redirect(badUrl);
  }
}
