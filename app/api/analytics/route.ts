import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth } from "date-fns";
import jwt from "jsonwebtoken";

export const runtime = "nodejs";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

// 🔐 Verify token
async function verifyAuth(req: NextRequest): Promise<AuthPayload | null> {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return null;

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as AuthPayload;

    return decoded;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // ================= AUTH =================
    const payload = await verifyAuth(req);

    if (!payload) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const companyId = payload.companyId;

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // ================= TOTAL CLIENTS =================
    const totalClients = await db.client.count({
      where: { companyId },
    });

    // ================= TODAY VISITS =================
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayVisits = await db.client.count({
      where: {
        companyId,
        visitingDate: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });

    // ================= CLOSED DEALS =================
    const closedDeals = await db.client.count({
      where: {
        companyId,
        status: "DealDone",
        updatedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    // ================= COMMISSION =================
    const commissions = await db.commission.aggregate({
      where: {
        companyId,
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { commissionAmount: true },
    });

    // ================= LEADS BY STATUS =================
    const leadsByStatus = await db.client.groupBy({
      by: ["status"],
      where: { companyId },
      _count: true,
    });

    // ================= MONTHLY DATA =================
    const monthlyData = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);

      const mStart = startOfMonth(date);
      const mEnd = endOfMonth(date);

      const leads = await db.client.count({
        where: {
          companyId,
          createdAt: { gte: mStart, lte: mEnd },
        },
      });

      const deals = await db.client.count({
        where: {
          companyId,
          status: "DealDone",
          updatedAt: { gte: mStart, lte: mEnd },
        },
      });

      monthlyData.push({
        month: date.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        leads,
        deals,
      });
    }

    return NextResponse.json({
      summary: {
        totalClients,
        todayVisits,
        closedDeals,
        totalCommission: commissions._sum.commissionAmount ?? 0,
      },
      leadsByStatus,
      monthlyData,
    });

  } catch (error) {
    console.error("Analytics API error:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
