// app/api/auth/login/route.ts
// Step 1: POST { email, password }         → validates creds → sends OTP → { requireOTP: true }
// Step 2: POST { email, password, otp }    → verifies OTP  → sets cookie → { user }
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendOTPEmail } from '@/lib/email';
import {
  generateOTP, hashOTP, verifyOTPHash,
  OTP_EXPIRY_MS, RESEND_COOLDOWN, MAX_ATTEMPTS,
} from '@/lib/otp';

// ── DEV BYPASS: skip DB + OTP when BYPASS_AUTH=true (dev only) ──
const BYPASS_AUTH = process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, otp } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // ════════════════════════════════════
    // DEV BYPASS MODE
    // ════════════════════════════════════
    if (BYPASS_AUTH) {
      if (otp) {
        const hashedPassword = await bcrypt.hash(password, 10);

        let company = await db.company.findFirst({ where: { companyName: 'Dev Company' } });
        if (!company) {
          company = await db.company.create({
            data: {
              companyName: 'Dev Company',
              subscriptionType: 'Basic',
              subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              status: 'active',
            },
          });
        }

        let user = await db.user.findUnique({ where: { email } });
        if (!user) {
          user = await db.user.create({
            data: {
              name: 'Dev User',
              email,
              phone: '+919999999999',
              password: hashedPassword,
              role: 'admin',
              companyId: company.id,
              status: 'active',
            },
          });
        }

        if (!process.env.JWT_SECRET) {
          return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const token = jwt.sign(
          { userId: user.id, companyId: company.id, role: 'admin', email },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        const fullUser = await db.user.findUnique({
          where: { id: user.id },
          include: { company: true },
        });

        const { password: _, ...safeUser } = fullUser!;

        const response = NextResponse.json(
          { message: 'Login successful', user: safeUser },
          { status: 200 }
        );

        response.cookies.set('auth_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });

        return response;
      }

      return NextResponse.json(
        { requireOTP: true, message: 'DEV MODE: Enter any 6-digit OTP' },
        { status: 200 }
      );
    }

    // ════════════════════════════════════
    // PRODUCTION FLOW
    // ════════════════════════════════════

    // ── Find user ──
    const user = await db.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Account is inactive' }, { status: 403 });
    }

    // ── Always validate password (both Step 1 and Step 2) ──
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.company && new Date() > user.company.subscriptionExpiry) {
      return NextResponse.json({ error: 'Subscription expired' }, { status: 403 });
    }

    // ════════════════════════════════════
    // STEP 2: OTP provided → verify it
    // ════════════════════════════════════
    if (otp) {
      const record = await db.emailOTP.findFirst({
        where: { email, purpose: 'login' },
        orderBy: { createdAt: 'desc' },
      });

      if (!record) {
        return NextResponse.json({ error: 'No OTP found. Please request a new one.' }, { status: 400 });
      }
      if (record.expiresAt < new Date()) {
        await db.emailOTP.delete({ where: { id: record.id } });
        return NextResponse.json({ error: 'OTP expired. Please try logging in again.' }, { status: 400 });
      }
      if (record.attempts >= MAX_ATTEMPTS) {
        await db.emailOTP.delete({ where: { id: record.id } });
        return NextResponse.json({ error: 'Too many failed attempts. Please try again.' }, { status: 429 });
      }

      const hashedInput = hashOTP(String(otp));
      if (!verifyOTPHash(hashedInput, record.otpHash)) {
        await db.emailOTP.update({
          where: { id: record.id },
          data: { attempts: { increment: 1 } },
        });
        const remaining = MAX_ATTEMPTS - record.attempts - 1;
        return NextResponse.json(
          { error: `Invalid OTP. ${remaining} attempt(s) remaining.` },
          { status: 400 }
        );
      }

      // OTP correct — delete and issue JWT
      await db.emailOTP.delete({ where: { id: record.id } });

      if (!process.env.JWT_SECRET) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }

      const token = jwt.sign(
        { userId: user.id, companyId: user.companyId, role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const { password: _, ...safeUser } = user;
      const response = NextResponse.json(
        { message: 'Login successful', user: safeUser },
        { status: 200 }
      );

      response.cookies.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return response;
    }

    // ════════════════════════════════════
    // STEP 1: Password correct → send OTP
    // ════════════════════════════════════

    // Enforce resend cooldown
    const lastOTP = await db.emailOTP.findFirst({
      where: { email, purpose: 'login' },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOTP && Date.now() - new Date(lastOTP.createdAt).getTime() < RESEND_COOLDOWN) {
      return NextResponse.json(
        { requireOTP: true, message: 'OTP already sent. Please check your email.' },
        { status: 200 }
      );
    }

    // Delete old OTPs and send a fresh one
    await db.emailOTP.deleteMany({ where: { email, purpose: 'login' } });

    const newOTP  = generateOTP();
    const otpHash = hashOTP(newOTP);

    await db.emailOTP.create({
      data: {
        email,
        otpHash,
        purpose:   'login',
        attempts:  0,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      },
    });

    await sendOTPEmail(email, newOTP, 'login');

    return NextResponse.json(
      { requireOTP: true, message: 'OTP sent to your email address' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
