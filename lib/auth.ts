import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

// ⚠️ Fail fast at module load. Never fall back to empty string — an empty
// secret silently makes every token forgeable.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error(
    'FATAL: JWT_SECRET must be set and at least 32 characters long.'
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const JWT_ALG = 'HS256' as const;
const JWT_ALGS = [JWT_ALG] as const;

const COOKIE_NAME = 'auth_token';
const JWT_EXPIRY = 7 * 24 * 60 * 60; // 7 days

// ==================== TOKEN TYPES ====================

export interface AuthTokenPayload {
  userId: string;
  companyId: string;
  role: string;
  email: string;
  /** token version — bumping User.tokenVersion instantly revokes old sessions */
  tv?: number;
  /** subscription expiry (epoch ms) — optional so legacy tokens still verify */
  subExp?: number;
}

// ==================== TOKEN GENERATION ====================

export async function generateToken(
  userId: string,
  companyId: string,
  role: string,
  email: string,
  opts?: { subscriptionExpiry?: Date | null; tokenVersion?: number }
): Promise<string> {
  const claims: Record<string, unknown> = { userId, companyId, role, email };
  if (opts?.subscriptionExpiry) claims.subExp = opts.subscriptionExpiry.getTime();
  if (typeof opts?.tokenVersion === 'number') claims.tv = opts.tokenVersion;

  return new SignJWT(claims)
    .setProtectedHeader({ alg: JWT_ALG, typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

// ==================== TOKEN VERIFICATION ====================

export async function verifyToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    // Explicit algorithm allowlist — do not accept tokens signed with any
    // other algorithm, even if the key type later changes.
    const verified = await jwtVerify(token, JWT_SECRET, { algorithms: [...JWT_ALGS] });
    return verified.payload as unknown as AuthTokenPayload;
  } catch {
    return null;
  }
}

// ==================== COOKIE MANAGEMENT ====================

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: JWT_EXPIRY,
};

export async function setTokenCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS);
}

export async function getTokenCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

export function getTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

export async function clearTokenCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 });
}

// ==================== AUTH HELPERS ====================

export async function verifyAuth(req: NextRequest): Promise<AuthTokenPayload | null> {
  let token = getTokenFromRequest(req);
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(COOKIE_NAME)?.value ?? null;
    } catch {}
  }
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return { authorized: false as const, payload: null };
  const payload = await verifyToken(token);
  if (!payload) return { authorized: false as const, payload: null };
  return { authorized: true as const, payload };
}

// ==================== PASSWORD HASHING ====================

const BCRYPT_COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function comparePasswords(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch {
    return false;
  }
}

/**
 * Pre-computed bcrypt hash at matching cost, used to prevent user-enumeration
 * timing attacks. We compare against this when the user doesn't exist so the
 * total response time matches the "user exists, wrong password" path.
 */
let USER_ENUMERATION_SHIELD: string | null = null;
export async function getEnumerationShieldHash(): Promise<string> {
  if (!USER_ENUMERATION_SHIELD) {
    USER_ENUMERATION_SHIELD = await bcrypt.hash(
      'user-enumeration-shield-' + Math.random().toString(36),
      BCRYPT_COST
    );
  }
  return USER_ENUMERATION_SHIELD;
}

// ==================== DEV BYPASS (hardened) ====================

/**
 * True only when:
 *   - running locally (NODE_ENV=development)
 *   - NOT on Vercel (no VERCEL or VERCEL_ENV env markers — those are always
 *     set by Vercel in preview+production, so a leaked BYPASS_AUTH=true in
 *     prod env vars cannot enable bypass)
 *   - BYPASS_AUTH=true explicitly set
 *
 * Even when enabled, consumers MUST still verify the user's real password
 * and use the user's real role — bypass only skips the OTP step.
 */
export const IS_DEV_BYPASS =
  process.env.NODE_ENV === 'development' &&
  !process.env.VERCEL &&
  !process.env.VERCEL_ENV &&
  process.env.BYPASS_AUTH === 'true';

// ==================== UTILITIES ====================

export function isValidObjectId(id: string | null | undefined): boolean {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ==================== ERROR MESSAGES ====================

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS:  'Invalid email or password',
  ACCOUNT_INACTIVE:     'Account is inactive',
  SUBSCRIPTION_EXPIRED: 'Subscription has expired',
  INVALID_TOKEN:        'Invalid or expired token',
  NOT_AUTHENTICATED:    'Not authenticated',
  UNAUTHORIZED:         'Unauthorized access',
  USER_NOT_FOUND:       'User not found',
  EMAIL_ALREADY_EXISTS: 'Email already registered',
  PHONE_ALREADY_EXISTS: 'Phone number already registered',
  WEAK_PASSWORD:        'Password does not meet requirements',
  OTP_INVALID:          'Invalid or expired OTP',
};
