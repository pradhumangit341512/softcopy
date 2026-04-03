import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenCookie, verifyToken, isValidObjectId } from "@/lib/auth";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

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

    const { companyId, userId } = payload;

    if (!isValidObjectId(companyId) || !isValidObjectId(userId)) {
      return NextResponse.json({
        assignedLeads: [],
        pendingFollowUps: [],
        todayVisits: [],
        stats: { total: 0, new: 0, interested: 0, followUpsDue: 0, visitsToday: 0 },
      });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Filter: leads created by OR assigned to this user
    const myLeadsFilter = {
      companyId,
      OR: [
        { createdBy: userId },
        { assignedTo: userId },
      ],
    };

    // All leads belonging to this user (created or assigned)
    const assignedLeads = await db.client.findMany({
      where: myLeadsFilter,
      include: { creator: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    });

    // Leads with follow-ups due today or overdue
    const pendingFollowUps = await db.client.findMany({
      where: {
        ...myLeadsFilter,
        followUpDate: { lte: todayEnd },
        status: { notIn: ["DealDone", "Rejected"] },
      },
      orderBy: { followUpDate: "asc" },
    });

    // Today's visits for this user
    const todayVisits = await db.client.findMany({
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
      orderBy: { visitingTime: "asc" },
    });

    // Stats
    const stats = {
      total: assignedLeads.length,
      new: assignedLeads.filter((l) => l.status === "New").length,
      interested: assignedLeads.filter((l) => l.status === "Interested").length,
      dealDone: assignedLeads.filter((l) => l.status === "DealDone").length,
      rejected: assignedLeads.filter((l) => l.status === "Rejected").length,
      followUpsDue: pendingFollowUps.length,
      visitsToday: todayVisits.length,
    };

    return NextResponse.json({
      assignedLeads,
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
