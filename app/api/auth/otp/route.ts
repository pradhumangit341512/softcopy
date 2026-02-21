import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import twilio from "twilio";
import crypto from "crypto";

/* =========================
   CONFIG
========================= */
const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5;

/* =========================
   UTIL FUNCTIONS
========================= */

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash OTP before storing
function hashOTP(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/* =========================
   SEND OTP
   POST /api/auth/otp
========================= */
export async function POST(req: NextRequest) {
  try {
    // 🔒 Runtime Twilio env check (SAFE for build)
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !phoneNumber) {
      return NextResponse.json(
        { error: "Twilio not configured" },
        { status: 500 }
      );
    }

    if (!accountSid.startsWith("AC")) {
      return NextResponse.json(
        { error: "Invalid Twilio SID" },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);

    const { phone, companyId } = await req.json();

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (!phone || !companyId) {
      return NextResponse.json(
        { error: "Phone and companyId required" },
        { status: 400 }
      );
    }

    /* 🔥 Check resend cooldown */
    const lastOtp = await db.oTP.findFirst({
      where: { phone, companyId },
      orderBy: { createdAt: "desc" },
    });

    if (
      lastOtp &&
      Date.now() - new Date(lastOtp.createdAt).getTime() < RESEND_COOLDOWN
    ) {
      return NextResponse.json(
        { error: "Please wait before requesting another OTP" },
        { status: 429 }
      );
    }

    /* Generate + hash OTP */
    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    /* Save in DB */
    await db.oTP.create({
      data: {
        phone,
        companyId,
        otpHash,
        ipAddress: ip,
        attempts: 0,
        expiresAt: new Date(Date.now() + OTP_EXPIRY),
      },
    });

    /* Send SMS via Twilio */
    await client.messages.create({
      body: `Your OTP is ${otp}. Valid for 5 minutes.`,
      from: phoneNumber,
      to: phone,
    });

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("SEND OTP ERROR:", error);
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}

/* =========================
   VERIFY OTP
   PUT /api/auth/otp
========================= */
export async function PUT(req: NextRequest) {
  try {
    const { phone, otp, companyId } = await req.json();

    if (!phone || !otp || !companyId) {
      return NextResponse.json(
        { error: "Phone, OTP and companyId required" },
        { status: 400 }
      );
    }

    /* Find latest OTP */
    const record = await db.oTP.findFirst({
      where: { phone, companyId },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Invalid OTP" },
        { status: 400 }
      );
    }

    /* Expiry check */
    if (record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "OTP expired" },
        { status: 400 }
      );
    }

    /* Attempt protection */
    if (record.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many attempts. Try later." },
        { status: 429 }
      );
    }

    /* Match hashed OTP */
    const hashedInput = hashOTP(otp);

    if (hashedInput !== record.otpHash) {
      await db.oTP.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });

      return NextResponse.json(
        { error: "Invalid OTP" },
        { status: 400 }
      );
    }

    /* Success → delete OTP */
    await db.oTP.delete({
      where: { id: record.id },
    });

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("VERIFY OTP ERROR:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}