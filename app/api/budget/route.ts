import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth, isValidObjectId } from "@/lib/auth";

type AuthPayload = { userId: string; companyId: string; role: string; email: string };

// ── GET: Fetch budget for a given month ──
export async function GET(req: NextRequest) {
  try {
    const payload = (await verifyAuth(req)) as AuthPayload | null;
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({ budget: null });
    }

    const month = req.nextUrl.searchParams.get("month"); // "YYYY-MM"
    if (!month)
      return NextResponse.json({ error: "month param required" }, { status: 400 });

    const budget = await db.monthlyBudget.findFirst({
      where: { companyId: payload.companyId, month },
    });

    return NextResponse.json({ budget: budget || null });
  } catch (error) {
    console.error("Get budget error:", error);
    return NextResponse.json({ error: "Failed to fetch budget" }, { status: 500 });
  }
}

// ── POST: Create or update budget for a month ──
export async function POST(req: NextRequest) {
  try {
    const payload = (await verifyAuth(req)) as AuthPayload | null;
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only admin/superadmin can set budgets
    if (!["admin", "superadmin"].includes(payload.role)) {
      return NextResponse.json({ error: "Only admins can set budgets" }, { status: 403 });
    }

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({ error: "Invalid session. Please log out and log in again." }, { status: 400 });
    }

    const { month, targetAmount } = await req.json();
    if (!month || targetAmount === undefined)
      return NextResponse.json({ error: "month and targetAmount are required" }, { status: 400 });

    // Upsert — create if doesn't exist, update if it does
    const budget = await db.monthlyBudget.upsert({
      where: {
        companyId_month: { companyId: payload.companyId, month },
      },
      update: { targetAmount: Number(targetAmount) },
      create: {
        companyId: payload.companyId,
        month,
        targetAmount: Number(targetAmount),
      },
    });

    return NextResponse.json({ budget });
  } catch (error) {
    console.error("Save budget error:", error);
    return NextResponse.json({ error: "Failed to save budget" }, { status: 500 });
  }
}