import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

type AuthPayload = { userId: string; companyId: string; role: string; email: string };

// ── GET: List commissions with filters, search, pagination ──
export async function GET(req: NextRequest) {
  try {
    const payload = (await verifyAuth(req)) as AuthPayload | null;
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page       = Number(searchParams.get("page") || "1");
    const limit      = Number(searchParams.get("limit") || "10");
    const paidStatus = searchParams.get("paidStatus") || undefined;
    const search     = searchParams.get("search") || "";
    const skip       = (page - 1) * limit;

    const where: any = { companyId: payload.companyId };
    if (paidStatus) where.paidStatus = paidStatus;
    if (search) {
      where.OR = [
        { client: { clientName: { contains: search, mode: "insensitive" } } },
        { salesPersonName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [commissions, total, allCommissions] = await Promise.all([
      db.commission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { clientName: true } },
          user:   { select: { name: true } },
        },
      }),
      db.commission.count({ where }),
      db.commission.findMany({
        where: { companyId: payload.companyId },
        select: { commissionAmount: true, paidStatus: true },
      }),
    ]);

    const totalCommission   = allCommissions.reduce((s, c) => s + c.commissionAmount, 0);
    const pendingCommission = allCommissions
      .filter(c => c.paidStatus === "Pending")
      .reduce((s, c) => s + c.commissionAmount, 0);

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
    const payload = (await verifyAuth(req)) as AuthPayload | null;
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      clientId,
      salesPersonName,   // free-text, optional
      dealAmount,
      commissionPercentage,
      paidStatus,
      paymentReference,
    } = body;

    if (!clientId)    return NextResponse.json({ error: "Client is required" }, { status: 400 });
    if (!dealAmount)  return NextResponse.json({ error: "Deal amount is required" }, { status: 400 });

    const deal       = Number(dealAmount);
    const pct        = Number(commissionPercentage || 0);
    const commission = (deal * pct) / 100;

    const newCommission = await db.commission.create({
      data: {
        clientId,
        companyId:           payload.companyId,
        salesPersonName:     salesPersonName?.trim() || null,
        dealAmount:          deal,
        commissionPercentage: pct,
        commissionAmount:    commission,
        paidStatus:          paidStatus || "Pending",
        paymentReference:    paymentReference || null,
        paymentDate:         paidStatus === "Paid" ? new Date() : null,
      },
      include: {
        client: { select: { clientName: true } },
        user:   { select: { name: true } },
      },
    });

    return NextResponse.json({ commission: newCommission }, { status: 201 });
  } catch (error) {
    console.error("Create commission error:", error);
    return NextResponse.json({ error: "Failed to create commission" }, { status: 500 });
  }
}