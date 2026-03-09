import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth } from "date-fns";
import jwt from "jsonwebtoken";

export const runtime = "nodejs";

type AuthPayload = { userId: string; companyId: string; role: string; email: string };

// ✅ FIXED: reads "auth_token" cookie — matches login & signup routes
async function verifyAuth(req: NextRequest): Promise<AuthPayload | null> {
  try {
    // ✅ Was reading "token" — now reads "auth_token" to match login/signup
    const token = req.cookies.get("auth_token")?.value;
    if (!token) return null;
    if (!process.env.JWT_SECRET) return null;
    return jwt.verify(token, process.env.JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const companyId = payload.companyId;
    const now       = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd   = endOfMonth(now);

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd   = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      totalClients,
      todayVisitsCount,
      todayVisitList,
      closedDeals,
      commissions,
      leadsByStatus,
    ] = await Promise.all([
      db.client.count({ where: { companyId } }),

      db.client.count({
        where: { companyId, visitingDate: { gte: todayStart, lt: todayEnd } },
      }),

      db.client.findMany({
        where: { companyId, visitingDate: { gte: todayStart, lt: todayEnd } },
        select: {
          id: true, clientName: true, phone: true,
          visitingDate: true, visitingTime: true, preferredLocation: true,
        },
        orderBy: { visitingTime: "asc" },
      }),

      db.client.count({
        where: { companyId, status: "DealDone", updatedAt: { gte: monthStart, lte: monthEnd } },
      }),

      db.commission.aggregate({
        where: { companyId, createdAt: { gte: monthStart, lte: monthEnd } },
        _sum: { commissionAmount: true },
      }),

      db.client.groupBy({
        by: ["status"],
        where: { companyId },
        _count: true,
      }),
    ]);

    // Monthly data (last 12 months)
    const monthlyData: any[] = [];
    for (let i = 11; i >= 0; i--) {
      const date   = new Date(now);
      date.setMonth(date.getMonth() - i);
      const mStart = startOfMonth(date);
      const mEnd   = endOfMonth(date);
      const [leads, deals] = await Promise.all([
        db.client.count({ where: { companyId, createdAt: { gte: mStart, lte: mEnd } } }),
        db.client.count({ where: { companyId, status: "DealDone", updatedAt: { gte: mStart, lte: mEnd } } }),
      ]);
      monthlyData.push({
        month: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        leads,
        deals,
      });
    }

    return NextResponse.json({
      summary: {
        totalClients,
        todayVisits: todayVisitsCount,
        closedDeals,
        totalCommission: commissions._sum.commissionAmount ?? 0,
      },
      todayVisits: todayVisitList,
      leadsByStatus,
      monthlyData,
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}