/**
 * Trusted-device helpers.
 *
 * Flow:
 *   1. On successful OTP verification during login, `rememberDevice()` creates
 *      a random 32-byte token, hashes it, stores the hash in the DB, and
 *      returns the raw token. The caller sets it as an httpOnly cookie.
 *   2. On subsequent login attempts, `isDeviceTrusted()` reads the cookie,
 *      hashes it, looks up a non-expired, non-revoked row for that user.
 *      If found, the login short-circuits — no OTP required.
 *
 * Rules:
 *   - Admins + superadmins NEVER ride on trusted-device status. They always
 *     re-verify with OTP. (High-privilege accounts must have a second factor.)
 *   - Trust expires after 30 days of inactivity.
 *   - Revoking a device (future "active sessions" UI) sets revokedAt.
 *   - Cookie is scoped to the full app, sameSite=strict so it's never sent
 *     cross-site. httpOnly so XSS can't exfiltrate it.
 */

import crypto from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { db } from './db';

const COOKIE_NAME = 'trusted_device';
const TRUST_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Roles that must always do the OTP step, even on trusted devices. */
const FORCE_OTP_ROLES = new Set(['admin', 'superadmin']);

export function roleRequiresOtp(role: string | undefined): boolean {
  return typeof role === 'string' && FORCE_OTP_ROLES.has(role);
}

// ==================== TOKEN HELPERS ====================

/** Generate a new random 32-byte token (base64url encoded). */
export function newDeviceToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** SHA-256 of the raw token — what we actually store in the DB. */
export function hashDeviceToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ==================== COOKIE ====================

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: Math.floor(TRUST_DURATION_MS / 1000),
};

export function getDeviceCookie(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

export function setDeviceCookie(res: NextResponse, rawToken: string): void {
  res.cookies.set(COOKIE_NAME, rawToken, cookieOpts);
}

export function clearDeviceCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, '', { ...cookieOpts, maxAge: 0 });
}

// ==================== DB OPERATIONS ====================

/**
 * Returns true if the caller is on a device this user has previously
 * completed an OTP challenge on, and that trust is still valid.
 *
 * Side effect: bumps `lastUsedAt` on a hit so a regularly-used device
 * stays trusted indefinitely (rolling window).
 */
export async function isDeviceTrusted(
  userId: string,
  rawToken: string | null
): Promise<boolean> {
  if (!rawToken) return false;
  const tokenHash = hashDeviceToken(rawToken);

  const row = await db.trustedDevice.findUnique({
    where: { tokenHash },
  });
  if (!row) return false;
  if (row.userId !== userId) return false; // token belongs to a different user
  if (row.revokedAt) return false;
  if (row.expiresAt < new Date()) return false;

  // Bump lastUsedAt + sliding expiry — fire-and-forget
  db.trustedDevice
    .update({
      where: { id: row.id },
      data: {
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + TRUST_DURATION_MS),
      },
    })
    .catch(() => {});

  return true;
}

/**
 * Create a new trusted-device row for this user+device. Returns the RAW token
 * the caller should set as a cookie. The DB only ever sees the hash.
 *
 * The caller must have already validated: credentials correct + OTP verified.
 */
export async function rememberDevice(
  userId: string,
  opts: { userAgent?: string; ipAddress?: string } = {}
): Promise<string> {
  const rawToken = newDeviceToken();
  const tokenHash = hashDeviceToken(rawToken);

  await db.trustedDevice.create({
    data: {
      userId,
      tokenHash,
      userAgent: opts.userAgent?.slice(0, 500) ?? null,
      ipAddress: opts.ipAddress ?? null,
      expiresAt: new Date(Date.now() + TRUST_DURATION_MS),
      label: deriveDeviceLabel(opts.userAgent),
    },
  });

  return rawToken;
}

/** Revoke a single device by its raw cookie value (used on logout). */
export async function revokeDeviceByToken(rawToken: string): Promise<void> {
  const tokenHash = hashDeviceToken(rawToken);
  await db.trustedDevice
    .updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    .catch(() => {});
}

/** Best-effort, human-friendly label derived from a UA string. */
function deriveDeviceLabel(ua: string | undefined): string | null {
  if (!ua) return null;
  const browser =
    /Firefox\/\d/.test(ua) ? 'Firefox' :
    /Edg\/\d/.test(ua) ? 'Edge' :
    /Chrome\/\d/.test(ua) ? 'Chrome' :
    /Safari\/\d/.test(ua) ? 'Safari' :
    'Browser';
  const os =
    /Mac OS X/.test(ua) ? 'macOS' :
    /Windows/.test(ua) ? 'Windows' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad/.test(ua) ? 'iOS' :
    /Linux/.test(ua) ? 'Linux' :
    'Unknown';
  return `${browser} on ${os}`;
}
