import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { newRequestId } from '@/lib/errors';

export const runtime = 'nodejs';

/**
 * GET /api/cron/cleanup-expired
 *
 * Sweeps expired records that are no longer useful:
 *   - VerificationToken rows past their TTL (signup email-verification links)
 *   - TrustedDevice rows past their 30-day expiry
 *   - EmailOTP rows past their 10-minute expiry
 *   - SMS OTP rows past their TTL
 *
 * Schedule via Vercel Cron in vercel.json:
 *   { "path": "/api/cron/cleanup-expired", "schedule": "0 * * * *" }  // hourly
 *
 * Authenticated with CRON_SECRET (Bearer header). Vercel Cron auto-injects
 * Authorization with this format if `vercel.json` declares the cron route.
 */
export async function GET(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: '/api/cron/cleanup-expired', requestId });

  // Auth via shared secret. Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  // when the cron is registered with our project.
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  try {
    const [verificationTokens, trustedDevices, emailOtps, smsOtps] =
      await Promise.all([
        db.verificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
        db.trustedDevice.deleteMany({ where: { expiresAt: { lt: now } } }),
        db.emailOTP.deleteMany({ where: { expiresAt: { lt: now } } }),
        db.oTP.deleteMany({ where: { expiresAt: { lt: now } } }),
      ]);

    log.info(
      {
        verificationTokens: verificationTokens.count,
        trustedDevices: trustedDevices.count,
        emailOtps: emailOtps.count,
        smsOtps: smsOtps.count,
      },
      'cleanup-expired finished'
    );

    return NextResponse.json({
      ok: true,
      cleaned: {
        verificationTokens: verificationTokens.count,
        trustedDevices: trustedDevices.count,
        emailOtps: emailOtps.count,
        smsOtps: smsOtps.count,
      },
    });
  } catch (err) {
    log.error({ err }, 'cleanup-expired failed');
    return NextResponse.json(
      { ok: false, error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}
