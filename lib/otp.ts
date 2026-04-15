import crypto from 'crypto';

export const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
export const RESEND_COOLDOWN = 60 * 1000;    // 60 seconds
export const MAX_ATTEMPTS = 5;

/**
 * Secret pepper used to HMAC the OTP before storing. This means an attacker
 * who dumps the DB still can't brute-force offline without also owning the
 * server secret — plain SHA-256 of a 6-digit number would fall in seconds.
 *
 * Resolves from OTP_PEPPER if set, else falls back to JWT_SECRET so existing
 * deployments keep working. Bumping OTP_PEPPER invalidates all live OTPs,
 * which is usually what you want after a suspected breach.
 */
const PEPPER = process.env.OTP_PEPPER || process.env.JWT_SECRET;
if (!PEPPER || PEPPER.length < 16) {
  throw new Error(
    'FATAL: OTP_PEPPER (or JWT_SECRET fallback) must be set and at least 16 chars.'
  );
}

/** CSPRNG 6-digit OTP. */
export function generateOTP(): string {
  return crypto.randomInt(100000, 1_000_000).toString();
}

/**
 * HMAC-SHA256 of the OTP, keyed with the server-side pepper.
 * Deterministic so we can compare, but useless to an attacker without PEPPER.
 */
export function hashOTP(otp: string): string {
  return crypto.createHmac('sha256', PEPPER!).update(otp).digest('hex');
}

/** Constant-time comparison of two hex-encoded HMAC digests. */
export function verifyOTPHash(inputHash: string, storedHash: string): boolean {
  try {
    const a = Buffer.from(inputHash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Verify an OTP against a stored record, atomically incrementing the attempt
 * counter BEFORE the compare. This closes the race where two concurrent
 * wrong-guess requests could both see `attempts < MAX` and both be allowed
 * to compare, effectively doubling the attacker's budget.
 *
 * Returns:
 *   - 'ok'       — OTP matched. Caller should delete the record.
 *   - 'expired'  — record is past its TTL.
 *   - 'locked'   — attempts would exceed MAX_ATTEMPTS after this try.
 *   - 'mismatch' — OTP did not match. Attempt counter already incremented.
 */
export type OtpCheck = 'ok' | 'expired' | 'locked' | 'mismatch';

import { db } from './db';

export async function verifyEmailOtp(
  recordId: string,
  otp: string
): Promise<OtpCheck> {
  // Atomic increment that also applies both the expiry and max-attempts
  // guards. If the row no longer qualifies (expired or maxed), updateMany
  // returns count=0 and we map to the right outcome.
  const now = new Date();
  const result = await db.emailOTP.updateMany({
    where: {
      id: recordId,
      expiresAt: { gt: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: { attempts: { increment: 1 } },
  });

  if (result.count === 0) {
    const current = await db.emailOTP.findUnique({ where: { id: recordId } });
    if (!current) return 'expired';
    if (current.expiresAt <= now) return 'expired';
    return 'locked';
  }

  const record = await db.emailOTP.findUnique({ where: { id: recordId } });
  if (!record) return 'expired';

  const ok = verifyOTPHash(hashOTP(otp), record.otpHash);
  return ok ? 'ok' : 'mismatch';
}

/** Same atomic-increment logic for SMS OTP records. */
export async function verifySmsOtp(
  recordId: string,
  otp: string
): Promise<OtpCheck> {
  const now = new Date();
  const result = await db.oTP.updateMany({
    where: {
      id: recordId,
      expiresAt: { gt: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: { attempts: { increment: 1 } },
  });

  if (result.count === 0) {
    const current = await db.oTP.findUnique({ where: { id: recordId } });
    if (!current) return 'expired';
    if (current.expiresAt <= now) return 'expired';
    return 'locked';
  }

  const record = await db.oTP.findUnique({ where: { id: recordId } });
  if (!record) return 'expired';

  const ok = verifyOTPHash(hashOTP(otp), record.otpHash);
  return ok ? 'ok' : 'mismatch';
}
