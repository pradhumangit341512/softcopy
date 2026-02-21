import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenCookie, verifyToken } from "@/lib/auth";
import Razorpay from "razorpay";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

const PLANS = {
  Basic: 999,
  Pro: 1999,
  Enterprise: 2999,
};

export async function POST(req: NextRequest) {
  try {
    // ================= AUTH =================
    const token = await getTokenCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as AuthPayload | null;

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ================= RAZORPAY ENV CHECK =================
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay not configured" },
        { status: 500 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // ================= PLAN =================
    const { planType } = await req.json();

    if (!["Basic", "Pro", "Enterprise"].includes(planType)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const amount = PLANS[planType as keyof typeof PLANS] * 100;

    // ================= CREATE ORDER =================
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `order_${payload.companyId}_${Date.now()}`,
      notes: {
        companyId: payload.companyId,
        planType,
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("Razorpay order error:", error);
    return NextResponse.json(
      { error: "Order creation failed" },
      { status: 500 }
    );
  }
}