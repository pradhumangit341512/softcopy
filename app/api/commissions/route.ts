import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenCookie, verifyToken } from "@/lib/auth";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

// ================= CREATE COMMISSION =================
export async function POST(req: NextRequest) {
  try {
    const token = await getTokenCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // FIX: await verifyToken
    const payload = (await verifyToken(token)) as AuthPayload | null;

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const commission = await db.commission.create({
      data: {
        clientId: body.clientId,
        userId: body.userId,
        companyId: payload.companyId,
        dealAmount: body.dealAmount,
        commissionPercentage: body.commissionPercentage,
        commissionAmount:
          (body.dealAmount * body.commissionPercentage) / 100,
      },
    });

    return NextResponse.json(commission, { status: 201 });
  } catch (error) {
    console.error("Create commission error:", error);
    return NextResponse.json(
      { error: "Failed to create commission" },
      { status: 500 }
    );
  }
}

// ================= GET COMMISSIONS =================
export async function GET(req: NextRequest) {
  try {
    const token = await getTokenCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as AuthPayload | null;

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const paidStatus = searchParams.get("paidStatus");
    const userId = searchParams.get("userId");

    const where: any = { companyId: payload.companyId };

    if (paidStatus) where.paidStatus = paidStatus;
    if (userId) where.userId = userId;

    const commissions = await db.commission.findMany({
      where,
      include: {
        client: { select: { clientName: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Totals
    const totals = await db.commission.aggregate({
      where: { companyId: payload.companyId },
      _sum: { commissionAmount: true },
    });

    const pendingTotal = await db.commission.aggregate({
      where: {
        companyId: payload.companyId,
        paidStatus: "Pending",
      },
      _sum: { commissionAmount: true },
    });

    return NextResponse.json({
      commissions,
      totals: {
        totalCommission: totals._sum.commissionAmount || 0,
        pendingCommission: pendingTotal._sum.commissionAmount || 0,
      },
    });
  } catch (error) {
    console.error("Fetch commissions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch commissions" },
      { status: 500 }
    );
  }
}
