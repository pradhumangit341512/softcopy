import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth, isValidObjectId } from "@/lib/auth";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

/**
 * GET /api/team-performance
 * Admin/superadmin only. Returns performance metrics for every team member:
 * - Total leads created
 * - Deals closed
 * - Commission earned
 * - Pending follow-ups
 */
export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req) as AuthPayload | null;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin/superadmin can view team performance
    if (payload.role !== "admin" && payload.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { companyId } = payload;

    if (!isValidObjectId(companyId)) {
      return NextResponse.json({ members: [] });
    }

    // Get all users in the company
    const users = await db.user.findMany({
      where: { companyId, status: "active", deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        profilePhoto: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Compute metrics for each user
    const members = await Promise.all(
      users.map(async (user) => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        const [totalLeads, dealsClosed, commissions, pendingFollowUps, todaySession, weekSessions] =
          await Promise.all([
            db.client.count({
              where: { companyId, createdBy: user.id, deletedAt: null },
            }),
            db.client.count({
              where: {
                companyId,
                createdBy: user.id,
                status: "DealDone",
                deletedAt: null,
              },
            }),
            db.commission.aggregate({
              where: {
                companyId,
                deletedAt: null,
                client: { createdBy: user.id, deletedAt: null },
              },
              _sum: { commissionAmount: true },
              _count: true,
            }),
            db.client.count({
              where: {
                companyId,
                createdBy: user.id,
                deletedAt: null,
                followUpDate: { lte: now },
                status: { notIn: ["DealDone", "Rejected"] },
              },
            }),
            // Most recent session today (for "online" status + login time)
            db.userSession.findFirst({
              where: { userId: user.id, loginAt: { gte: todayStart } },
              orderBy: { loginAt: 'desc' },
              select: { loginAt: true, logoutAt: true, duration: true },
            }),
            // All sessions this week (for total hours)
            db.userSession.findMany({
              where: { userId: user.id, loginAt: { gte: weekStart } },
              select: { loginAt: true, logoutAt: true, duration: true },
              orderBy: { loginAt: 'desc' },
              take: 50,
            }),
          ]);

        const conversionRate =
          totalLeads > 0 ? Math.round((dealsClosed / totalLeads) * 100) : 0;

        // Compute session stats
        const isOnline = todaySession && !todaySession.logoutAt;
        const lastLoginAt = todaySession?.loginAt ?? null;
        const totalWeekMinutes = weekSessions.reduce((sum, s) => {
          if (s.duration) return sum + s.duration;
          if (s.logoutAt) return sum + Math.round((s.logoutAt.getTime() - s.loginAt.getTime()) / 60000);
          // Still online — count from login to now
          return sum + Math.round((now.getTime() - s.loginAt.getTime()) / 60000);
        }, 0);
        const daysActiveThisWeek = new Set(
          weekSessions.map((s) => s.loginAt.toISOString().slice(0, 10))
        ).size;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profilePhoto: user.profilePhoto,
          joinedAt: user.createdAt,
          stats: {
            totalLeads,
            dealsClosed,
            conversionRate,
            commissionEarned: commissions._sum.commissionAmount ?? 0,
            commissionCount: commissions._count,
            pendingFollowUps,
          },
          session: {
            isOnline: !!isOnline,
            lastLoginAt,
            totalWeekMinutes,
            totalWeekHours: Math.round(totalWeekMinutes / 60 * 10) / 10,
            daysActiveThisWeek,
            sessionsThisWeek: weekSessions.length,
          },
        };
      })
    );

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Team performance API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch team performance" },
      { status: 500 }
    );
  }
}
