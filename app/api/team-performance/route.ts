import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenCookie, verifyToken, isValidObjectId } from "@/lib/auth";

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
    const token = await getTokenCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as AuthPayload | null;
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
      where: { companyId, status: "active" },
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
        const [totalLeads, dealsClosed, commissions, pendingFollowUps] =
          await Promise.all([
            db.client.count({
              where: { companyId, createdBy: user.id },
            }),
            db.client.count({
              where: { companyId, createdBy: user.id, status: "DealDone" },
            }),
            db.commission.aggregate({
              where: {
                companyId,
                client: { createdBy: user.id },
              },
              _sum: { commissionAmount: true },
              _count: true,
            }),
            db.client.count({
              where: {
                companyId,
                createdBy: user.id,
                followUpDate: { lte: new Date() },
                status: { notIn: ["DealDone", "Rejected"] },
              },
            }),
          ]);

        const conversionRate =
          totalLeads > 0 ? Math.round((dealsClosed / totalLeads) * 100) : 0;

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
