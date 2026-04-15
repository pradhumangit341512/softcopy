import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { parseBody, resetPasswordSchema } from '@/lib/validations';
import { resetLimiter, getClientIp, rateLimited } from '@/lib/rate-limit';
import { verifyEmailOtp } from '@/lib/otp';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * POST /api/auth/reset-password
 *
 * Requires a valid OTP previously issued for `purpose='reset-password'`.
 * Flow is: client calls /api/auth/forgot-password → we email an OTP → client
 * calls this endpoint with { email, otp, newPassword, confirmPassword }.
 *
 * Changes from the previous implementation:
 *   - No longer accepts { email, newPassword } without proof of email ownership.
 *   - Zod-validates every field, including password strength.
 *   - Per-email rate limit to prevent OTP-bruteforce.
 *   - Bumps tokenVersion so any existing sessions are invalidated.
 *   - Writes an AuditLog entry.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const ipLimit = await resetLimiter.check(20, `reset:ip:${ip}`);
    if (!ipLimit.success) {
      return rateLimited('Too many attempts. Please try again later.', ipLimit.retryAfter);
    }

    const parsed = await parseBody(req, resetPasswordSchema);
    if (!parsed.ok) return parsed.response;
    const { email, otp, newPassword } = parsed.data;

    const emailLimit = await resetLimiter.check(5, `reset:email:${email}`);
    if (!emailLimit.success) {
      return rateLimited('Too many reset attempts for this account. Try again later.', emailLimit.retryAfter);
    }

    const record = await db.emailOTP.findFirst({
      where: { email, purpose: 'reset-password' },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      return NextResponse.json(
        { error: 'Invalid or expired reset code. Please request a new one.' },
        { status: 400 }
      );
    }

    const outcome = await verifyEmailOtp(record.id, String(otp));
    if (outcome === 'expired') {
      await db.emailOTP.delete({ where: { id: record.id } }).catch(() => {});
      return NextResponse.json(
        { error: 'Reset code expired. Please request a new one.' },
        { status: 400 }
      );
    }
    if (outcome === 'locked') {
      await db.emailOTP.delete({ where: { id: record.id } }).catch(() => {});
      return NextResponse.json(
        { error: 'Too many failed attempts. Please request a new reset code.' },
        { status: 429, headers: { 'Retry-After': '600' } }
      );
    }
    if (outcome === 'mismatch') {
      return NextResponse.json({ error: 'Invalid reset code.' }, { status: 400 });
    }

    // OTP verified — consume it and look up the user.
    await db.emailOTP.delete({ where: { id: record.id } });

    const user = await db.user.findUnique({ where: { email } });
    if (!user || user.status !== 'active') {
      // Don't reveal whether the account exists beyond this point — if OTP
      // was valid but account is gone, say the same thing the happy path would.
      return NextResponse.json(
        { message: 'Password reset successfully' },
        { status: 200 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        // Instant session revocation: every old JWT carrying a lower `tv`
        // claim becomes invalid immediately.
        tokenVersion: { increment: 1 },
      },
    });

    if (user.companyId) {
      await recordAudit({
        companyId: user.companyId,
        userId: user.id,
        action: 'auth.password_reset',
        resource: 'User',
        resourceId: user.id,
        req,
      });
    }

    return NextResponse.json(
      { message: 'Password reset successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
