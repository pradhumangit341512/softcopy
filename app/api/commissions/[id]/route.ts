import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

type AuthPayload = { userId: string; companyId: string; role: string; email: string };

// ── PUT: Update commission ──
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = (await verifyAuth(req)) as AuthPayload | null;
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const existing = await db.commission.findFirst({
      where: { id, companyId: payload.companyId },
    });
    if (!existing)
      return NextResponse.json({ error: "Commission not found" }, { status: 404 });

    const updateData: any = {};

    if (body.salesPersonName !== undefined) {
      updateData.salesPersonName = body.salesPersonName?.trim() || null;
    }
    if (body.dealAmount !== undefined) {
      updateData.dealAmount = Number(body.dealAmount);
    }
    if (body.commissionPercentage !== undefined) {
      updateData.commissionPercentage = Number(body.commissionPercentage);
    }
    if (body.dealAmount !== undefined || body.commissionPercentage !== undefined) {
      const deal = body.dealAmount !== undefined
        ? Number(body.dealAmount) : existing.dealAmount;
      const pct  = body.commissionPercentage !== undefined
        ? Number(body.commissionPercentage) : existing.commissionPercentage;
      updateData.commissionAmount = (deal * pct) / 100;
    }
    if (body.paidStatus !== undefined) {
      updateData.paidStatus = body.paidStatus;
      if (body.paidStatus === "Paid") {
        updateData.paymentDate = new Date();
      }
    }
    if (body.paymentReference !== undefined) {
      updateData.paymentReference = body.paymentReference || null;
    }

    const updated = await db.commission.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { clientName: true } },
        user:   { select: { name: true } },
      },
    });

    return NextResponse.json({ commission: updated });
  } catch (error) {
    console.error("Update commission error:", error);
    return NextResponse.json({ error: "Failed to update commission" }, { status: 500 });
  }
}

// ── DELETE: Remove commission ──
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = (await verifyAuth(req)) as AuthPayload | null;
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const existing = await db.commission.findFirst({
      where: { id, companyId: payload.companyId },
    });
    if (!existing)
      return NextResponse.json({ error: "Commission not found" }, { status: 404 });

    await db.commission.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Delete commission error:", error);
    return NextResponse.json({ error: "Failed to delete commission" }, { status: 500 });
  }
}