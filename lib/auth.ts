import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-min-32-characters'
);

const JWT_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

// ==================== TOKEN GENERATION ====================

export async function generateToken(
  userId: string,
  companyId: string,
  role: string,
  email: string
): Promise<string> {
  try {
    const token = await new SignJWT({
      userId,
      companyId,
      role,
      email,
    })
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

export async function setTokenCookie(token: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: JWT_EXPIRY,
      path: '/',
    });
  } catch (error) {
    console.error('Set token cookie error:', error);
  }
}

export async function getTokenCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    return token || null;
  } catch (error) {
    console.error('Get token cookie error:', error);
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  try {
    const token = req.cookies.get('token')?.value;
    return token || null;
  } catch (error) {
    console.error('Get token from request error:', error);
    return null;
  }
}

export async function clearTokenCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
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
    const token = getTokenFromRequest(req);

    if (!token) {
      return null;
    }

    const payload = await verifyToken(token);
    return payload;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

// ==================== PASSWORD HASHING ====================

export async function hashPassword(password: string): Promise<string> {
  try {
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
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
    const match = await bcrypt.compare(password, hashedPassword);
    return match;
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
}

// ==================== VALIDATION ====================

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  // Accept various phone formats
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ==================== UTILITY FUNCTIONS ====================

export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

export function getTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setSeconds(expiry.getSeconds() + JWT_EXPIRY);
  return expiry;
}

// ==================== ERROR RESPONSES ====================

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_INACTIVE: 'Account is inactive',
  SUBSCRIPTION_EXPIRED: 'Subscription has expired',
  INVALID_TOKEN: 'Invalid or expired token',
  NOT_AUTHENTICATED: 'Not authenticated',
  UNAUTHORIZED: 'Unauthorized access',
  USER_NOT_FOUND: 'User not found',
  EMAIL_ALREADY_EXISTS: 'Email already registered',
  PHONE_ALREADY_EXISTS: 'Phone number already registered',
  INVALID_EMAIL: 'Invalid email format',
  INVALID_PHONE: 'Invalid phone number',
  WEAK_PASSWORD: 'Password does not meet requirements',
  PASSWORDS_DONT_MATCH: 'Passwords do not match',
  OTP_INVALID: 'Invalid or expired OTP',
  OTP_SENT: 'OTP sent successfully',
};