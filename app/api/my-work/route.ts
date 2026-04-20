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
 * GET /api/my-work
 * Returns the current user's workspace:
 * - All leads they created
 * - Pending follow-ups (due today or overdue)
 * - Today's visits
 * - Summary stats
 */
export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req) as AuthPayload | null;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { companyId, userId } = payload;

    if (!isValidObjectId(companyId) || !isValidObjectId(userId)) {
      return NextResponse.json({
        assignedLeads: [],
        pendingFollowUps: [],
        todayVisits: [],
        stats: {
          total: 0,
          new: 0,
          interested: 0,
          dealDone: 0,
          rejected: 0,
          followUpsDue: 0,
          visitsToday: 0,
        },
      });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Leads created by this user (exclude soft-deleted rows across the page)
    const myLeadsFilter = {
      companyId,
      createdBy: userId,
      deletedAt: null,
    };

    // Stats via groupBy — 1 query returns counts by status (no data transfer)
    const [statusGroups, followUpCount, visitCount, recentLeads, pendingFollowUps, todayVisits] =
      await Promise.all([
        db.client.groupBy({
          by: ['status'],
          where: myLeadsFilter,
          _count: true,
        }),
        db.client.count({
          where: {
            ...myLeadsFilter,
            followUpDate: { lte: todayEnd },
            status: { notIn: ['DealDone', 'Rejected'] },
          },
        }),
        db.client.count({
          where: {
            ...myLeadsFilter,
            visitingDate: { gte: todayStart, lt: todayEnd },
          },
        }),
        db.client.findMany({
          where: myLeadsFilter,
          include: { creator: { select: { name: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 50,
        }),
        db.client.findMany({
          where: {
            ...myLeadsFilter,
            followUpDate: { lte: todayEnd },
            status: { notIn: ['DealDone', 'Rejected'] },
          },
          orderBy: { followUpDate: 'asc' },
          take: 50,
        }),
        db.client.findMany({
          where: {
            ...myLeadsFilter,
            visitingDate: { gte: todayStart, lt: todayEnd },
          },
          select: {
            id: true,
            clientName: true,
            phone: true,
            visitingDate: true,
            visitingTime: true,
            preferredLocation: true,
            status: true,
          },
          orderBy: { visitingTime: 'asc' },
          take: 50,
        }),
      ]);

    const countByStatus = (s: string) =>
      statusGroups.find((g) => g.status === s)?._count ?? 0;
    const total = statusGroups.reduce((sum, g) => sum + g._count, 0);

    const stats = {
      total,
      new: countByStatus('New'),
      interested: countByStatus('Interested'),
      dealDone: countByStatus('DealDone'),
      rejected: countByStatus('Rejected'),
      followUpsDue: followUpCount,
      visitsToday: visitCount,
    };

    return NextResponse.json({
      assignedLeads: recentLeads,
      pendingFollowUps,
      todayVisits,
      stats,
    });
  } catch (error) {
    console.error("My work API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch work data" },
      { status: 500 }
    );
  }
}
