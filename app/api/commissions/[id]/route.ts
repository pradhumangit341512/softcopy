import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth } from "@/lib/auth";
import { isTeamMember } from "@/lib/authorize";
import { updateCommissionSchema, parseBody } from "@/lib/validations";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

// ── PUT: Update commission ──
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Load with relation for team-member ownership check.
    const existing = await db.commission.findFirst({
      where: { id, companyId: payload.companyId, deletedAt: null },
      include: { client: { select: { createdBy: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Commission not found" }, { status: 404 });
    }
    if (
      isTeamMember(payload.role) &&
      existing.client?.createdBy !== payload.userId
    ) {
      return NextResponse.json(
        { error: "Forbidden — not your commission" },
        { status: 403 }
      );
    }

    const parsed = await parseBody(req, updateCommissionSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (data.salesPersonName !== undefined) updateData.salesPersonName = data.salesPersonName;
    if (data.paymentReference !== undefined) updateData.paymentReference = data.paymentReference;
    if (data.dealAmount !== undefined) updateData.dealAmount = data.dealAmount;
    if (data.commissionPercentage !== undefined) updateData.commissionPercentage = data.commissionPercentage;
    if (data.dealAmount !== undefined || data.commissionPercentage !== undefined) {
      const deal = data.dealAmount ?? existing.dealAmount;
      const pct = data.commissionPercentage ?? existing.commissionPercentage;
      updateData.commissionAmount = (deal * pct) / 100;
    }
    if (data.paidStatus !== undefined) {
      updateData.paidStatus = data.paidStatus;
      if (data.paidStatus === "Paid") updateData.paymentDate = new Date();
    }

    // Atomic guard: only updates if the row is still in the same company
    // and not soft-deleted — kills the TOCTOU window.
    const result = await db.commission.updateMany({
      where: { id, companyId: payload.companyId, deletedAt: null },
      data: updateData,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Commission not found" }, { status: 404 });
    }

    const updated = await db.commission.findUnique({
      where: { id },
      include: {
        client: { select: { clientName: true } },
        user: { select: { name: true } },
      },
    });

    return NextResponse.json({ commission: updated });
  } catch (error) {
    console.error("Update commission error:", error);
    return NextResponse.json({ error: "Failed to update commission" }, { status: 500 });
  }
}

// ── DELETE: Soft remove commission ──
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const existing = await db.commission.findFirst({
      where: { id, companyId: payload.companyId, deletedAt: null },
      include: { client: { select: { createdBy: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Commission not found" }, { status: 404 });
    }
    if (
      isTeamMember(payload.role) &&
      existing.client?.createdBy !== payload.userId
    ) {
      return NextResponse.json(
        { error: "Forbidden — not your commission" },
        { status: 403 }
      );
    }

    const result = await db.commission.updateMany({
      where: { id, companyId: payload.companyId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Commission not found" }, { status: 404 });
    }

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: "commission.delete",
      resource: "Commission",
      resourceId: id,
      req,
    });

    return NextResponse.json({
      success: true,
      message: "Commission deleted successfully",
    });
  } catch (error) {
    console.error("Delete commission error:", error);
    return NextResponse.json({ error: "Failed to delete commission" }, { status: 500 });
  }
}
