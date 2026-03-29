import crypto from 'crypto';

export const OTP_EXPIRY_MS   = 10 * 60 * 1000;  // 10 minutes
export const RESEND_COOLDOWN = 60 * 1000;        // 60 seconds
export const MAX_ATTEMPTS    = 5;

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/** Constant-time comparison of two hex-encoded OTP hashes */
export function verifyOTPHash(inputHash: string, storedHash: string): boolean {
  const a = Buffer.from(inputHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
