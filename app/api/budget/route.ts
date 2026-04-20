import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth, isValidObjectId, type AuthTokenPayload } from "@/lib/auth";
import { monthlyBudgetSchema, parseBody } from "@/lib/validations";
import { isAdminRole } from "@/lib/authorize";
import { ErrorCode, apiError, newRequestId } from "@/lib/errors";

type AuthPayload = AuthTokenPayload;

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

// ── POST: Create or update budget for a month (admin-only) ──
export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  try {
    const payload = (await verifyAuth(req)) as AuthPayload | null;
    if (!payload) return apiError(ErrorCode.AUTH_UNAUTHORIZED, 'Unauthorized', { requestId });

    if (!isAdminRole(payload.role)) {
      return apiError(ErrorCode.AUTH_ACCOUNT_INACTIVE, 'Only admins can set budgets', { requestId });
    }
    if (!isValidObjectId(payload.companyId)) {
      return apiError(ErrorCode.VALIDATION_FAILED, 'Invalid session. Please log out and log in again.', { requestId });
    }

    const parsed = await parseBody(req, monthlyBudgetSchema);
    if (!parsed.ok) return parsed.response;
    const { month, targetAmount } = parsed.data;

    const budget = await db.monthlyBudget.upsert({
      where: { companyId_month: { companyId: payload.companyId, month } },
      update: { targetAmount },
      create: { companyId: payload.companyId, month, targetAmount },
    });

    return NextResponse.json({ budget });
  } catch (error) {
    console.error("Save budget error:", error);
    return apiError(ErrorCode.SYSTEM_INTERNAL_ERROR, 'Failed to save budget', { requestId });
  }
}