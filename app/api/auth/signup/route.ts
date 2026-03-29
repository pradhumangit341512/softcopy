// app/api/auth/signup/route.ts
// Step 1: POST { name, email, phone, password, companyName }           → validates → sends OTP → { requireOTP: true }
// Step 2: POST { name, email, phone, password, companyName, otp }      → verifies OTP → creates account → sets cookie
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendOTPEmail } from "@/lib/email";
import {
  generateOTP, hashOTP, verifyOTPHash,
  OTP_EXPIRY_MS, RESEND_COOLDOWN, MAX_ATTEMPTS,
} from '@/lib/otp';

// ── DEV BYPASS: skip DB + OTP when BYPASS_AUTH=true (dev only) ──
const BYPASS_AUTH = process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, password, companyName, otp } = body;

    // ── Validate all required fields ──
    if (!name || !email || !phone || !password || !companyName) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // ════════════════════════════════════
    // DEV BYPASS MODE
    // ════════════════════════════════════
    if (BYPASS_AUTH) {
      if (otp) {
        const hashedPassword = await bcrypt.hash(password, 10);

        let company = await db.company.findFirst({ where: { companyName: companyName || 'Dev Company' } });
        if (!company) {
          company = await db.company.create({
            data: {
              companyName: companyName || 'Dev Company',
              subscriptionType: 'Basic',
              subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              status: 'active',
            },
          });
        }

        let user = await db.user.findUnique({ where: { email } });
        if (!user) {
          const phoneUser = await db.user.findUnique({ where: { phone } });
          if (phoneUser) {
            user = phoneUser;
          } else {
            user = await db.user.create({
              data: {
                name, email, phone,
                password: hashedPassword,
                role: 'admin',
                companyId: company.id,
                status: 'active',
              },
            });
          }
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
          { message: 'Account created successfully', user: safeUser },
          { status: 201 }
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

    // ── Check if email already exists ──
    const existingEmail = await db.user.findUnique({ where: { email } });
    if (existingEmail) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // ── Check if phone already exists ──
    const existingPhone = await db.user.findUnique({ where: { phone } });
    if (existingPhone) {
      return NextResponse.json({ error: 'Phone number already registered' }, { status: 409 });
    }

    // ════════════════════════════════════
    // STEP 2: OTP provided → verify + create account
    // ════════════════════════════════════
    if (otp) {
      const record = await db.emailOTP.findFirst({
        where: { email, purpose: 'signup' },
        orderBy: { createdAt: 'desc' },
      });

      if (!record) {
        return NextResponse.json({ error: 'No OTP found. Please request a new one.' }, { status: 400 });
      }
      if (record.expiresAt < new Date()) {
        await db.emailOTP.delete({ where: { id: record.id } });
        return NextResponse.json({ error: 'OTP expired. Please try again.' }, { status: 400 });
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

      // OTP correct — delete it and create account
      await db.emailOTP.delete({ where: { id: record.id } });

      // ── Create company + user (handle race condition with unique constraint) ──
      try {
        const hashedPassword   = await bcrypt.hash(password, 10);
        const subscriptionExpiry = new Date();
        subscriptionExpiry.setDate(subscriptionExpiry.getDate() + 30);

        const company = await db.company.create({
          data: {
            companyName,
            subscriptionType:   'Basic',
            subscriptionExpiry,
            status:             'active',
          },
        });

        const newUser = await db.user.create({
          data: {
            name, email, phone,
            password: hashedPassword,
            role:      'admin',
            companyId: company.id,
            status:    'active',
          },
        });

        const fullUser = await db.user.findUnique({
          where: { id: newUser.id },
          include: { company: true },
        });

        if (!fullUser) {
          return NextResponse.json({ error: 'Failed to retrieve created user' }, { status: 500 });
        }

        if (!process.env.JWT_SECRET) {
          return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const token = jwt.sign(
          { userId: fullUser.id, companyId: fullUser.companyId, role: fullUser.role, email: fullUser.email },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        const { password: _, ...safeUser } = fullUser;
        const response = NextResponse.json(
          { message: 'Account created successfully', user: safeUser },
          { status: 201 }
        );

        response.cookies.set('auth_token', token, {
          httpOnly: true,
          secure:   process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path:     '/',
          maxAge:   60 * 60 * 24 * 7,
        });

        return response;
      } catch (createError: any) {
        // Handle Prisma unique constraint violation (race condition)
        if (createError?.code === 'P2002') {
          const field = createError.meta?.target?.[0] || 'field';
          return NextResponse.json(
            { error: `This ${field} is already registered. Please try logging in instead.` },
            { status: 409 }
          );
        }
        throw createError;
      }
    }

    // ════════════════════════════════════
    // STEP 1: All valid → send OTP
    // ════════════════════════════════════

    // Enforce resend cooldown
    const lastOTP = await db.emailOTP.findFirst({
      where: { email, purpose: 'signup' },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOTP && Date.now() - new Date(lastOTP.createdAt).getTime() < RESEND_COOLDOWN) {
      return NextResponse.json(
        { requireOTP: true, message: 'OTP already sent. Please check your email.' },
        { status: 200 }
      );
    }

    // Delete old OTPs and send a fresh one
    await db.emailOTP.deleteMany({ where: { email, purpose: 'signup' } });

    const newOTP  = generateOTP();
    const otpHash = hashOTP(newOTP);

    await db.emailOTP.create({
      data: {
        email,
        otpHash,
        purpose:   'signup',
        attempts:  0,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      },
    });

    await sendOTPEmail(email, newOTP, 'signup');

    return NextResponse.json(
      { requireOTP: true, message: 'OTP sent to your email address. Please verify to complete signup.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 });
  }
}
