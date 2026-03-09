import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-min-32-characters'
);

const COOKIE_NAME = 'auth_token'; // ✅ single source of truth — matches login & signup

const JWT_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

// ==================== TOKEN GENERATION ====================

export async function generateToken(
  userId: string,
  companyId: string,
  role: string,
  email: string
): Promise<string> {
  try {
    const token = await new SignJWT({ userId, companyId, role, email })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);
    return token;
  } catch (error) {
    console.error('Token generation error:', error);
    throw new Error('Failed to generate token');
  }
}

// ==================== TOKEN VERIFICATION ====================

export async function verifyToken(token: string): Promise<{
  userId: string;
  companyId: string;
  role: string;
  email: string;
} | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as any;
  } catch (error) {
    console.error('Token verification error:', error);
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
  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS);
  } catch (error) {
    console.error('Set token cookie error:', error);
  }
}

export async function getTokenCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(COOKIE_NAME)?.value ?? null;
  } catch (error) {
    console.error('Get token cookie error:', error);
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  try {
    return req.cookies.get(COOKIE_NAME)?.value ?? null;
  } catch (error) {
    console.error('Get token from request error:', error);
    return null;
  }
}

export async function clearTokenCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 });
  } catch (error) {
    console.error('Clear token cookie error:', error);
  }
}

// ==================== AUTH MIDDLEWARE ====================

export async function verifyAuth(req: NextRequest): Promise<{
  userId: string;
  companyId: string;
  role: string;
  email: string;
} | null> {
  try {
    // Try request cookies first (fastest path)
    let token = getTokenFromRequest(req);

    // Fallback to next/headers (needed in some server contexts)
    if (!token) {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get(COOKIE_NAME)?.value ?? null;
      } catch {}
    }

    if (!token) return null;
    return await verifyToken(token);
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

// ==================== REQUIRE AUTH ====================

export async function requireAuth() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return { authorized: false, payload: null };
    const payload = await verifyToken(token);
    if (!payload) return { authorized: false, payload: null };
    return { authorized: true, payload };
  } catch (error) {
    console.error('Require auth error:', error);
    return { authorized: false, payload: null };
  }
}

// ==================== PASSWORD HASHING ====================

export async function hashPassword(password: string): Promise<string> {
  try {
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    console.error('Password hashing error:', error);
    throw new Error('Failed to hash password');
  }
}

export async function comparePasswords(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    const bcrypt = require('bcryptjs');
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
}

// ==================== VALIDATION ====================

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  return /^\+?[1-9]\d{1,14}$/.test(phone.replace(/\s/g, ''));
}

export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (password.length < 6)       errors.push('Password must be at least 6 characters');
  if (!/[A-Z]/.test(password))   errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password))   errors.push('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password))   errors.push('Password must contain at least one number');
  return { isValid: errors.length === 0, errors };
}

// ==================== UTILITY ====================

export function generateRandomString(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

export function getTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setSeconds(expiry.getSeconds() + JWT_EXPIRY);
  return expiry;
}

// ==================== ERROR MESSAGES ====================

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS:    'Invalid email or password',
  ACCOUNT_INACTIVE:       'Account is inactive',
  SUBSCRIPTION_EXPIRED:   'Subscription has expired',
  INVALID_TOKEN:          'Invalid or expired token',
  NOT_AUTHENTICATED:      'Not authenticated',
  UNAUTHORIZED:           'Unauthorized access',
  USER_NOT_FOUND:         'User not found',
  EMAIL_ALREADY_EXISTS:   'Email already registered',
  PHONE_ALREADY_EXISTS:   'Phone number already registered',
  INVALID_EMAIL:          'Invalid email format',
  INVALID_PHONE:          'Invalid phone number',
  WEAK_PASSWORD:          'Password does not meet requirements',
  PASSWORDS_DONT_MATCH:   'Passwords do not match',
  OTP_INVALID:            'Invalid or expired OTP',
  OTP_SENT:               'OTP sent successfully',
};