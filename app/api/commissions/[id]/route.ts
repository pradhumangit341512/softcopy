import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authorize";
import { updateCommissionSchema, parseBody } from "@/lib/validations";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

// ── PUT: Update commission ──
// Editing a commission's financial metadata (deal amount, commission %,
// salesperson attribution) is admin-only. Team members may create their
// own commissions and record payments against them, but they cannot
// rewrite what was recorded at deal-close. This prevents a team member
// from quietly inflating a deal after the fact.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    const { id } = await params;

    const existing = await db.commission.findFirst({
      where: { id, companyId: payload.companyId, deletedAt: null },
      include: { client: { select: { createdBy: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Commission not found" }, { status: 404 });
    }

    const parsed = await parseBody(req, updateCommissionSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    // paidStatus is deliberately NOT handled here — it's computed from the
    // CommissionPayment ledger. Callers mark a commission paid by POSTing to
    // /api/commissions/:id/payments with an amount.
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

    // Atomic guard: only updates if the row is still in the same company
    // and not soft-deleted — kills the TOCTOU window.
    const result = await db.commission.updateMany({
      where: { id, companyId: payload.companyId, deletedAt: null },
      data: updateData,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Commission not found" }, { status: 404 });
    }

    // If commissionAmount changed, the existing paidAmount may now cross a
    // threshold (e.g. a deal was renegotiated upward, flipping Paid→Partial).
    // Recompute paidStatus so it stays consistent with the ledger.
    if (updateData.commissionAmount !== undefined) {
      const fresh = await db.commission.findUnique({
        where: { id },
        select: { commissionAmount: true, paidAmount: true },
      });
      if (fresh) {
        const EPS = 0.005;
        const nextStatus =
          fresh.paidAmount <= 0
            ? 'Pending'
            : fresh.paidAmount + EPS >= fresh.commissionAmount
              ? 'Paid'
              : 'Partial';
        await db.commission.update({
          where: { id },
          data: {
            paidStatus: nextStatus,
            paymentDate: nextStatus === 'Paid' ? new Date() : null,
          },
        });
      }
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
// Admin-only: removing a commission wipes the deal from every report, so
// it needs higher authority than day-to-day logging. Team members cannot
// retract their own entries.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    const { id } = await params;

    const existing = await db.commission.findFirst({
      where: { id, companyId: payload.companyId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Commission not found" }, { status: 404 });
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
