import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth } from "@/lib/auth";
import { startOfMonth, endOfMonth } from "date-fns";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

export async function GET(req: NextRequest) {
  try {
    // ================= AUTH =================
    const payload = (await verifyAuth(req)) as AuthPayload | null;
    
    if (!payload) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const companyId = payload.companyId;
    const period = req.nextUrl.searchParams.get('period') || '6m';

    // Determine month range
    let monthsBack = 6;
    if (period === '3m') monthsBack = 3;
    if (period === '12m') monthsBack = 12;

    const now = new Date();
    const revenueData: {
      month: string;
      revenue: number;
      target: number;
      profit: number;
      expenses: number;
    }[] = [];

    // ================= REVENUE DATA (12 MONTHS) =================
    for (let i = monthsBack - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const mStart = startOfMonth(date);
      const mEnd = endOfMonth(date);

      // Get commissions (revenue)
      const commissions = await db.commission.aggregate({
        where: {
          companyId,
          createdAt: { gte: mStart, lte: mEnd },
        },
        _sum: { dealAmount: true },
      });

      const revenue = commissions._sum.dealAmount ?? 0;
      const profit = Math.round(revenue * 0.4); // Assume 40% profit
      const expenses = Math.round(revenue * 0.6); // Assume 60% expenses
      const target = 400000 + i * 50000; // Incremental target

      revenueData.push({
        month: date.toLocaleDateString("en-US", { month: "short" }),
        revenue,
        target,
        profit,
        expenses,
      });
    }

    // ================= REVENUE SOURCES =================
    const sourceData = [
      { source: 'Direct Sales', amount: Math.round(revenueData.reduce((sum, d) => sum + d.revenue, 0) * 0.35), percentage: 35 },
      { source: 'Referrals', amount: Math.round(revenueData.reduce((sum, d) => sum + d.revenue, 0) * 0.29), percentage: 29 },
      { source: 'Digital Marketing', amount: Math.round(revenueData.reduce((sum, d) => sum + d.revenue, 0) * 0.25), percentage: 25 },
      { source: 'Partnerships', amount: Math.round(revenueData.reduce((sum, d) => sum + d.revenue, 0) * 0.11), percentage: 11 },
    ];

    // ================= RESPONSE =================
    return NextResponse.json({
      revenueData,
      sourceData,
      period,
    });
  } catch (error) {
    console.error("Revenue analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch revenue data" },
      { status: 500 }
    );
  }
}