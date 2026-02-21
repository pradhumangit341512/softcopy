import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenCookie, verifyToken } from "@/lib/auth";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

export async function GET(req: NextRequest) {
  try {
    // ================= AUTH =================
    const token = await getTokenCookie();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // verifyToken is async → MUST await
    const payload = (await verifyToken(token)) as AuthPayload | null;

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = payload.companyId;

    // ================= DATE RANGE =================
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // ================= COMMISSION BY STATUS =================
    const byStatus = await db.commission.groupBy({
      by: ["paidStatus"],
      where: {
        companyId,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { commissionAmount: true },
      _count: true,
    });

    // ================= TOP PERFORMERS =================
    const topPerformersRaw = await db.commission.groupBy({
      by: ["userId"],
      where: { companyId },
      _sum: { commissionAmount: true },
      _count: true,
      orderBy: { _sum: { commissionAmount: "desc" } },
      take: 10,
    });

    // ================= FETCH USER DETAILS =================
    const performers = await Promise.all(
      topPerformersRaw.map(async (perf) => {
        const user = await db.user.findUnique({
          where: { id: perf.userId },
          select: { name: true },
        });

        return {
          userId: perf.userId,
          userName: user?.name || "Unknown",
          totalCommission: perf._sum.commissionAmount || 0,
          deals: perf._count,
        };
      })
    );

    // ================= RESPONSE =================
    return NextResponse.json({
      byStatus,
      topPerformers: performers,
    });
  } catch (error) {
    console.error("Commission analytics error:", error);
    return NextResponse.json(
      { error: "Analytics failed" },
      { status: 500 }
    );
  }
}
