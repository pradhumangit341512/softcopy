import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import jwt from "jsonwebtoken";
import { startOfMonth, endOfMonth } from "date-fns";

export const runtime = "nodejs";

type AuthPayload = { userId: string; companyId: string; role: string; email: string };

async function verifyAuth(req: NextRequest): Promise<AuthPayload | null> {
  try {
    const token = req.cookies.get("auth_token")?.value;
    if (!token || !process.env.JWT_SECRET) return null;
    return jwt.verify(token, process.env.JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin/superadmin can view full team performance
    if (!["admin", "superadmin"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const companyId = payload.companyId;
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Get all users in the company
    const users = await db.user.findMany({
      where: { companyId, status: "active" },
      select: { id: true, name: true, email: true, role: true, profilePhoto: true },
    });

    // For each user, get their performance metrics
    const performance = await Promise.all(
      users.map(async (user) => {
        const [
          totalClients,
          monthlyClients,
          dealsClosedAllTime,
          dealsClosedMonth,
          totalCommission,
          monthlyCommission,
          totalProperties,
        ] = await Promise.all([
          db.client.count({ where: { companyId, createdBy: user.id } }),
          db.client.count({
            where: {
              companyId,
              createdBy: user.id,
              createdAt: { gte: monthStart, lte: monthEnd },
            },
          }),
          db.client.count({
            where: { companyId, createdBy: user.id, status: "DealDone" },
          }),
          db.client.count({
            where: {
              companyId,
              createdBy: user.id,
              status: "DealDone",
              updatedAt: { gte: monthStart, lte: monthEnd },
            },
          }),
          db.commission.aggregate({
            where: { companyId, userId: user.id },
            _sum: { commissionAmount: true },
          }),
          db.commission.aggregate({
            where: {
              companyId,
              userId: user.id,
              createdAt: { gte: monthStart, lte: monthEnd },
            },
            _sum: { commissionAmount: true },
          }),
          db.property.count({ where: { companyId, createdBy: user.id } }),
        ]);

        const conversionRate = totalClients > 0
          ? Math.round((dealsClosedAllTime / totalClients) * 100)
          : 0;

        return {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            profilePhoto: user.profilePhoto,
          },
          metrics: {
            totalClients,
            monthlyClients,
            dealsClosedAllTime,
            dealsClosedMonth,
            totalCommission: totalCommission._sum.commissionAmount ?? 0,
            monthlyCommission: monthlyCommission._sum.commissionAmount ?? 0,
            totalProperties,
            conversionRate,
          },
        };
      })
    );

    // Sort by deals closed this month (descending), then by total commission
    performance.sort((a, b) => {
      if (b.metrics.dealsClosedMonth !== a.metrics.dealsClosedMonth) {
        return b.metrics.dealsClosedMonth - a.metrics.dealsClosedMonth;
      }
      return b.metrics.monthlyCommission - a.metrics.monthlyCommission;
    });

    // Team totals
    const teamTotals = {
      totalClients: performance.reduce((s, p) => s + p.metrics.totalClients, 0),
      monthlyClients: performance.reduce((s, p) => s + p.metrics.monthlyClients, 0),
      dealsClosedMonth: performance.reduce((s, p) => s + p.metrics.dealsClosedMonth, 0),
      monthlyCommission: performance.reduce((s, p) => s + p.metrics.monthlyCommission, 0),
      totalMembers: users.length,
    };

    return NextResponse.json({ performance, teamTotals });
  } catch (error) {
    console.error("Team performance API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
