import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth, isValidObjectId } from "@/lib/auth";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

export async function GET(req: NextRequest) {
  try {
    // ── AUTH ──
    const payload = await verifyAuth(req) as AuthPayload | null;
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({
        commissionsByStatus: [],
        monthlyCommissions: [],
        totals: { totalCommission: 0, pendingCommission: 0, paidCommission: 0 },
      });
    }

    const companyId = payload.companyId;

    // ── DATE RANGE ──
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // ── COMMISSION BY STATUS ──
    const byStatus = await db.commission.groupBy({
      by: ["paidStatus"],
      where: {
        companyId,
        deletedAt: null, // exclude soft-deleted commissions from totals
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { commissionAmount: true },
      _count: true,
    });

    // ── TOP PERFORMERS ──
    // userId is optional (String?) — group only where userId is set
    const topPerformersRaw = await db.commission.groupBy({
      by: ["userId"],
      where: {
        companyId,
        deletedAt: null, // exclude soft-deleted commissions from rankings
        userId: { not: null },   // skip commissions with no linked user
      },
      _sum: { commissionAmount: true },
      _count: true,
      orderBy: { _sum: { commissionAmount: "desc" } },
      take: 10,
    });

    // ── FETCH USER DETAILS ──
    const performers = await Promise.all(
      topPerformersRaw.map(async (perf) => {
        // After filtering `not: null` above, userId is guaranteed non-null here
        const userId = perf.userId as string;

        const user = await db.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });

        return {
          userId,
          userName:        user?.name ?? "Unknown",
          totalCommission: perf._sum.commissionAmount ?? 0,
          deals:           perf._count,
        };
      })
    );

    // ── Also include salesPersonName-only performers (no userId) ──
    const namedPerformersRaw = await db.commission.groupBy({
      by: ["salesPersonName"],
      where: {
        companyId,
        deletedAt: null,
        userId: null,
        salesPersonName: { not: null },
      },
      _sum: { commissionAmount: true },
      _count: true,
      orderBy: { _sum: { commissionAmount: "desc" } },
      take: 10,
    });

    const namedPerformers = namedPerformersRaw.map((perf) => ({
      userId:          null,
      userName:        perf.salesPersonName ?? "Unknown",
      totalCommission: perf._sum.commissionAmount ?? 0,
      deals:           perf._count,
    }));

    // Merge and sort combined list by totalCommission desc
    const allPerformers = [...performers, ...namedPerformers]
      .sort((a, b) => b.totalCommission - a.totalCommission)
      .slice(0, 10);

    return NextResponse.json({
      byStatus,
      topPerformers: allPerformers,
    });
  } catch (error) {
    console.error("Commission analytics error:", error);
    return NextResponse.json({ error: "Analytics failed" }, { status: 500 });
  }
}