import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth, isValidObjectId } from "@/lib/auth";
import { createCommissionSchema, parseBody } from "@/lib/validations";
import { isTeamMember } from "@/lib/authorize";

export const runtime = "nodejs";

// ── GET: List commissions with filters, search, pagination ──
export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({
        commissions: [],
        totals: { totalCommission: 0, pendingCommission: 0 },
        pagination: { page: 1, limit: 10, total: 0, pages: 1 },
      });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "10")));
    const paidStatus = searchParams.get("paidStatus") || undefined;
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
      deletedAt: null,
    };

    if (isTeamMember(payload.role)) {
      where.client = { createdBy: payload.userId };
    }
    if (paidStatus) where.paidStatus = paidStatus;
    if (search) {
      where.OR = [
        { client: { clientName: { contains: search, mode: "insensitive" } } },
        { salesPersonName: { contains: search, mode: "insensitive" } },
      ];
    }

    // Totals are company-wide (not affected by paidStatus filter), but still
    // respect team-member scoping. Uses groupBy to replace the old
    // "load every row then sum in JS" N+1.
    const totalsWhere: Record<string, unknown> = {
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (isTeamMember(payload.role)) {
      totalsWhere.client = { createdBy: payload.userId };
    }

    const [commissions, total, grouped] = await Promise.all([
      db.commission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { clientName: true } },
          user: { select: { name: true } },
        },
      }),
      db.commission.count({ where }),
      db.commission.groupBy({
        by: ["paidStatus"],
        where: totalsWhere,
        _sum: { commissionAmount: true },
      }),
    ]);

    const totalCommission = grouped.reduce(
      (s, row) => s + (row._sum.commissionAmount ?? 0),
      0
    );
    const pendingCommission = grouped
      .filter((row) => row.paidStatus === "Pending")
      .reduce((s, row) => s + (row._sum.commissionAmount ?? 0), 0);

    return NextResponse.json({
      commissions,
      totals: { totalCommission, pendingCommission },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Get commissions error:", error);
    return NextResponse.json({ error: "Failed to fetch commissions" }, { status: 500 });
  }
}

// ── POST: Create commission ──
export async function POST(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json(
        { error: "Invalid session. Please log out and log in again." },
        { status: 400 }
      );
    }

    const parsed = await parseBody(req, createCommissionSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    // Verify the client belongs to this company (prevents cross-company writes)
    const client = await db.client.findFirst({
      where: { id: data.clientId, companyId: payload.companyId, deletedAt: null },
      select: { id: true, createdBy: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    if (
      isTeamMember(payload.role) &&
      client.createdBy !== payload.userId
    ) {
      return NextResponse.json(
        { error: "Forbidden — not your client" },
        { status: 403 }
      );
    }

    const commissionAmount = (data.dealAmount * data.commissionPercentage) / 100;

    const newCommission = await db.commission.create({
      data: {
        clientId: data.clientId,
        companyId: payload.companyId,
        salesPersonName: data.salesPersonName,
        dealAmount: data.dealAmount,
        commissionPercentage: data.commissionPercentage,
        commissionAmount,
        paidStatus: data.paidStatus,
        paymentReference: data.paymentReference,
        paymentDate: data.paidStatus === "Paid" ? new Date() : null,
        deletedAt: null,
      },
      include: {
        client: { select: { clientName: true } },
        user: { select: { name: true } },
      },
    });

    return NextResponse.json({ commission: newCommission }, { status: 201 });
  } catch (error) {
    console.error("Create commission error:", error);
    return NextResponse.json({ error: "Failed to create commission" }, { status: 500 });
  }
}
