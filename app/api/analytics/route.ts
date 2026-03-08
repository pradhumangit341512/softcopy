import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth } from "date-fns";
import jwt from "jsonwebtoken";

export const runtime = "nodejs";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

// ================= VERIFY AUTH =================
async function verifyAuth(req: NextRequest): Promise<AuthPayload | null> {
  try {
    const token = req.cookies.get("token")?.value;

    if (!token) return null;
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET missing");
      return null;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    ) as AuthPayload;

    return decoded;
  } catch {
    return null;
  }
}

// ================= GET ANALYTICS =================
export async function GET(req: NextRequest) {
  try {
    // 🔐 AUTH
    const payload = await verifyAuth(req);

    if (!payload) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const companyId = payload.companyId;

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // ================= TOTAL CLIENTS =================
    const totalClientsPromise = db.client.count({
      where: { companyId },
    });

    // ================= TODAY VISITS =================
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // count for dashboard
    const todayVisitsCountPromise = db.client.count({
      where: {
        companyId,
        visitingDate: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });

    // list for 🔔 bell dropdown
    const todayVisitListPromise = db.client.findMany({
      where: {
        companyId,
        visitingDate: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
      select: {
        id: true,
        clientName: true,
        phone: true,
        visitingDate: true,
        visitingTime: true,
        preferredLocation: true,
      },
      orderBy: {
        visitingTime: "asc",
      },
    });

    // ================= CLOSED DEALS =================
    const closedDealsPromise = db.client.count({
      where: {
        companyId,
        status: "DealDone",
        updatedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    // ================= COMMISSION =================
    const commissionsPromise = db.commission.aggregate({
      where: {
        companyId,
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { commissionAmount: true },
    });

    // ================= LEADS BY STATUS =================
    const leadsByStatusPromise = db.client.groupBy({
      by: ["status"],
      where: { companyId },
      _count: true,
    });

    // ================= MONTHLY DATA =================
    const monthlyData: any[] = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);

      const mStart = startOfMonth(date);
      const mEnd = endOfMonth(date);

      const [leads, deals] = await Promise.all([
        db.client.count({
          where: {
            companyId,
            createdAt: { gte: mStart, lte: mEnd },
          },
        }),
        db.client.count({
          where: {
            companyId,
            status: "DealDone",
            updatedAt: { gte: mStart, lte: mEnd },
          },
        }),
      ]);

      monthlyData.push({
        month: date.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        leads,
        deals,
      });
    }

    // ================= PARALLEL EXECUTION =================
    const [
      totalClients,
      todayVisitsCount,
      todayVisitList,
      closedDeals,
      commissions,
      leadsByStatus,
    ] = await Promise.all([
      totalClientsPromise,
      todayVisitsCountPromise,
      todayVisitListPromise,
      closedDealsPromise,
      commissionsPromise,
      leadsByStatusPromise,
    ]);

    // ================= RESPONSE =================
    return NextResponse.json({
      summary: {
        totalClients,
        todayVisitsCount, // 🔁 updated name
        closedDeals,
        totalCommission: commissions._sum.commissionAmount ?? 0,
      },

      // 🔔 bell dropdown data
      todayVisits: todayVisitList,

      leadsByStatus,
      monthlyData,
    });

  } catch (error) {
    console.error("Analytics API error:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}