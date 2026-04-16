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

    // Monthly data (last 12 months) — single aggregation instead of 24
    // sequential count queries. Pulls all rows once, buckets in memory.
    interface MonthlyDataPoint { month: string; leads: number; deals: number; }
    const yearAgo = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 11, 1));

    // 2 round-trips total (vs the previous 24).
    const [leadRows, dealRows] = await Promise.all([
      db.client.findMany({
        where: { ...clientFilter, createdAt: { gte: yearAgo } },
        select: { createdAt: true },
      }),
      db.client.findMany({
        where: { ...clientFilter, status: "DealDone", updatedAt: { gte: yearAgo } },
        select: { updatedAt: true },
      }),
    ]);

    // Build a YYYY-MM-keyed bucket map, then walk the last 12 months in order.
    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const leadBuckets = new Map<string, number>();
    for (const r of leadRows) {
      const k = monthKey(r.createdAt);
      leadBuckets.set(k, (leadBuckets.get(k) ?? 0) + 1);
    }
    const dealBuckets = new Map<string, number>();
    for (const r of dealRows) {
      const k = monthKey(r.updatedAt);
      dealBuckets.set(k, (dealBuckets.get(k) ?? 0) + 1);
    }

    const monthlyData: MonthlyDataPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = monthKey(date);
      monthlyData.push({
        month: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        leads: leadBuckets.get(k) ?? 0,
        deals: dealBuckets.get(k) ?? 0,
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