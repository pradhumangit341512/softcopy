import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth } from "date-fns";
import { isValidObjectId, verifyToken, type AuthTokenPayload } from "@/lib/auth";

export const runtime = "nodejs";

type AuthPayload = AuthTokenPayload;

async function verifyAuthFromCookie(req: NextRequest): Promise<AuthPayload | null> {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Empty analytics response for dev bypass or missing company
function emptyAnalytics() {
  return NextResponse.json({
    summary: {
      totalClients: 0,
      todayVisits: 0,
      todayVisitsCount: 0,
      closedDeals: 0,
      totalCommission: 0,
    },
    todayVisits: [],
    leadsByStatus: [],
    monthlyData: [],
  });
}

export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuthFromCookie(req);
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const companyId = payload.companyId;

    if (!isValidObjectId(companyId)) {
      return emptyAnalytics();
    }

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd   = endOfMonth(now);

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd   = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Role-based filter: team members see only their own data.
    // Always exclude soft-deleted rows — otherwise tombstoned records
    // inflate every count/aggregate below.
    const isTeamMember = payload.role === 'user';
    const clientFilter = isTeamMember
      ? { companyId, createdBy: payload.userId, deletedAt: null }
      : { companyId, deletedAt: null };
    const commissionFilter = isTeamMember
      ? { companyId, deletedAt: null, client: { createdBy: payload.userId, deletedAt: null } }
      : { companyId, deletedAt: null, client: { deletedAt: null } };

    const [
      totalClients,
      todayVisitsCount,
      todayVisitList,
      closedDeals,
      commissions,
      leadsByStatus,
    ] = await Promise.all([
      db.client.count({ where: clientFilter }),

      db.client.count({
        where: { ...clientFilter, visitingDate: { gte: todayStart, lt: todayEnd } },
      }),

      db.client.findMany({
        where: { ...clientFilter, visitingDate: { gte: todayStart, lt: todayEnd } },
        select: {
          id: true, clientName: true, phone: true,
          visitingDate: true, visitingTime: true, preferredLocation: true,
        },
        orderBy: { visitingTime: "asc" },
      }),

      db.client.count({
        where: { ...clientFilter, status: "DealDone", updatedAt: { gte: monthStart, lte: monthEnd } },
      }),

      db.commission.aggregate({
        where: { ...commissionFilter, createdAt: { gte: monthStart, lte: monthEnd } },
        _sum: { commissionAmount: true },
      }),

      db.client.groupBy({
        by: ["status"],
        where: clientFilter,
        _count: true,
      }),
    ]);

    // Monthly data (last 12 months)
    interface MonthlyDataPoint { month: string; leads: number; deals: number; }
    const monthlyData: MonthlyDataPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const date   = new Date(now);
      date.setMonth(date.getMonth() - i);
      const mStart = startOfMonth(date);
      const mEnd   = endOfMonth(date);
      const [leads, deals] = await Promise.all([
        db.client.count({ where: { ...clientFilter, createdAt: { gte: mStart, lte: mEnd } } }),
        db.client.count({ where: { ...clientFilter, status: "DealDone", updatedAt: { gte: mStart, lte: mEnd } } }),
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