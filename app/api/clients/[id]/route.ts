import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isValidObjectId } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertCompanyOwnership, isTeamMember, isAdminRole } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

/* ==================== GET ==================== */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Client id missing" }, { status: 400 });
    }

    const client = await db.client.findFirst({
      where: { id, deletedAt: null },
      include: {
        creator: { select: { id: true, name: true } },
        commissions: { where: { deletedAt: null } },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const forbidden = assertCompanyOwnership(payload, client);
    if (forbidden) return forbidden;

    return NextResponse.json(client);
  } catch (error) {
    console.error("Get client error:", error);
    return NextResponse.json({ error: "Failed to fetch client" }, { status: 500 });
  }
}

/* ==================== PUT ==================== */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Parse the raw body manually — explicit field extraction avoids
    // Zod v4 transform/strip edge cases that silently drop fields.
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Build update data explicitly — only include fields that are present in the body
    const updateData: Record<string, unknown> = {};
    if (body.clientName !== undefined) updateData.clientName = String(body.clientName).trim();
    if (body.phone !== undefined) updateData.phone = String(body.phone).trim();
    if (body.email !== undefined) updateData.email = body.email === '' ? null : body.email;
    if (body.companyName !== undefined) updateData.companyName = body.companyName || null;
    if (body.requirementType !== undefined) updateData.requirementType = body.requirementType;
    if (body.inquiryType !== undefined) updateData.inquiryType = body.inquiryType;
    if (body.budget !== undefined) updateData.budget = body.budget === '' || body.budget === null ? null : Number(body.budget);
    if (body.preferredLocation !== undefined) updateData.preferredLocation = body.preferredLocation || null;
    if (body.address !== undefined) updateData.address = body.address || null;
    if (body.visitingTime !== undefined) updateData.visitingTime = body.visitingTime || null;
    if (body.source !== undefined) updateData.source = body.source || null;
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    if (body.visitingDate !== undefined) updateData.visitingDate = body.visitingDate ? new Date(body.visitingDate as string) : null;
    if (body.followUpDate !== undefined) updateData.followUpDate = body.followUpDate ? new Date(body.followUpDate as string) : null;
    if (body.nextFollowUp !== undefined) updateData.nextFollowUp = body.nextFollowUp ? new Date(body.nextFollowUp as string) : null;
    if (body.lastContactDate !== undefined) updateData.lastContactDate = body.lastContactDate ? new Date(body.lastContactDate as string) : null;
    if (body.propertyVisited !== undefined) updateData.propertyVisited = body.propertyVisited === true || body.propertyVisited === 'true';
    if (body.visitStatus !== undefined) updateData.visitStatus = body.visitStatus;

    if (body.status !== undefined) updateData.status = body.status;

    // Admin can reassign the lead to another teammate. After F2, reassign
    // updates `ownedBy` (current owner) rather than `createdBy` (audit anchor)
    // so capture history is preserved. Goes through the same audit trail
    // as a transfer would.
    if (body.assignedTo && isAdminRole(payload.role) && isValidObjectId(body.assignedTo as string)) {
      const targetUser = await db.user.findFirst({
        where: { id: body.assignedTo as string, companyId: payload.companyId, deletedAt: null },
        select: { id: true },
      });
      if (targetUser) {
        updateData.ownedBy = body.assignedTo;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      id,
      companyId: payload.companyId,
      deletedAt: null,
    };
    // Team members can only mutate leads they currently own. We OR on
    // createdBy for legacy rows where ownedBy is still null pre-migration 008.
    if (isTeamMember(payload.role)) {
      where.OR = [
        { ownedBy: payload.userId },
        { ownedBy: null, createdBy: payload.userId },
      ];
    }

    const result = await db.client.updateMany({ where, data: updateData });
    if (result.count === 0) {
      return NextResponse.json(
        { error: "Client not found or not authorized" },
        { status: 404 }
      );
    }

    const updated = await db.client.findUnique({
      where: { id },
      include: { creator: { select: { id: true, name: true } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update client error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

/* ==================== DELETE (soft) ==================== */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const where: Record<string, unknown> = {
      id,
      companyId: payload.companyId,
      deletedAt: null,
    };
    // Same ownership scope as PUT — current owner OR creator-on-legacy-rows.
    if (isTeamMember(payload.role)) {
      where.OR = [
        { ownedBy: payload.userId },
        { ownedBy: null, createdBy: payload.userId },
      ];
    }

    const result = await db.client.updateMany({
      where,
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: "Client not found or not authorized" },
        { status: 404 }
      );
    }

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: "client.delete",
      resource: "Client",
      resourceId: id,
      req,
    });

    return NextResponse.json({
      success: true,
      message: "Client deleted successfully",
    });
  } catch (error) {
    console.error("Delete client error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
