import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth } from "date-fns";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "@/lib/auth";

export const runtime = "nodejs";

type AuthPayload = { userId: string; companyId: string; role: string; email: string };

async function verifyAuthFromCookie(req: NextRequest): Promise<AuthPayload | null> {
  try {
    const token = req.cookies.get("auth_token")?.value;
    if (!token) return null;
    if (!process.env.JWT_SECRET) return null;
    return jwt.verify(token, process.env.JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
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

    const userId = payload.userId;
    const userRole = payload.role;
    const hasValidUserId = userId && isValidObjectId(userId);
    const isTeamMember = !["admin", "superadmin"].includes(userRole);

    // For team members: only show their own data (created by them OR assigned to them)
    // For admin/superadmin: show all company data
    const clientFilter: any = { companyId };
    if (isTeamMember) {
      clientFilter.OR = [
        { createdBy: userId },
        { assignedTo: userId },
      ];
    }

    const baseQueries = [
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
        where: {
          companyId,
          createdAt: { gte: monthStart, lte: monthEnd },
          ...(isTeamMember ? { userId } : {}),
        },
        _sum: { commissionAmount: true },
      }),

      db.client.groupBy({
        by: ["status"],
        where: clientFilter,
        _count: true,
      }),
    ] as const;

    const [
      totalClients,
      todayVisitsCount,
      todayVisitList,
      closedDeals,
      commissions,
      leadsByStatus,
    ] = await Promise.all(baseQueries);

    // These queries depend on a valid userId — run separately to avoid crashing the whole request
    let myAssignedLeads = 0;
    let myPendingFollowUps = 0;

    if (hasValidUserId) {
      try {
        [myAssignedLeads, myPendingFollowUps] = await Promise.all([
          db.client.count({
            where: { companyId, assignedTo: userId },
          }),
          db.client.count({
            where: {
              companyId,
              assignedTo: userId,
              followUpDate: { lte: todayEnd },
              status: { notIn: ["DealDone", "Rejected"] },
            },
          }),
        ]);
      } catch (err) {
        console.error("Error fetching assigned leads:", err);
      }
    }

    // Monthly data (last 12 months)
    const monthlyData: any[] = [];
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

    // Also fetch total commission (all time) for the user's scope
    let allTimeCommission = 0;
    try {
      const allTimeResult = await db.commission.aggregate({
        where: {
          companyId,
          ...(isTeamMember ? { userId } : {}),
        },
        _sum: { commissionAmount: true, dealAmount: true },
        _count: true,
      });
      allTimeCommission = allTimeResult._sum.commissionAmount ?? 0;
    } catch {
      // If no commissions exist, this is fine
    }

    return NextResponse.json({
      summary: {
        totalClients,
        todayVisits: todayVisitsCount,
        todayVisitsCount,
        closedDeals,
        totalCommission: commissions._sum.commissionAmount ?? 0,
        allTimeCommission,
        myAssignedLeads,
        myPendingFollowUps,
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