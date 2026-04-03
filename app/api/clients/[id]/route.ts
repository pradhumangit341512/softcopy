import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/* ==================== GET ==================== */
export async function GET(
  req: NextRequest,
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

    const client = await db.client.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        commissions: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // 🔐 Company protection
    if (client.companyId !== payload.companyId) {
      return NextResponse.json(
        { error: "Unauthorized company access" },
        { status: 403 }
      );
    }

    // 🔐 Team member can only view clients they created or are assigned to
    if (
      !["admin", "superadmin"].includes(payload.role) &&
      client.createdBy !== payload.userId &&
      client.assignedTo !== payload.userId
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Get client error:", error);
    return NextResponse.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    );
  }
}

/* ==================== PUT ==================== */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, payload } = await requireAuth();

    // Only login required
    if (!authorized || !payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json() as Record<string, any>;

    const existing = await db.client.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // 🔐 Company protection
    if (existing.companyId !== payload.companyId) {
      return NextResponse.json(
        { error: "Unauthorized company access" },
        { status: 403 }
      );
    }

    // 🔐 Role-based ownership: team members can only edit their own or assigned clients
    if (
      !["admin", "superadmin"].includes(payload.role) &&
      existing.createdBy !== payload.userId &&
      existing.assignedTo !== payload.userId
    ) {
      return NextResponse.json({ error: "You can only edit clients assigned to you" }, { status: 403 });
    }

    // Build update data — only include fields that were actually sent
    const updateData: Record<string, any> = {};

    if (body.clientName !== undefined)      updateData.clientName = body.clientName;
    if (body.phone !== undefined)           updateData.phone = body.phone;
    if (body.email !== undefined)           updateData.email = body.email || null;
    if (body.companyName !== undefined)     updateData.companyName = body.companyName || null;
    if (body.requirementType !== undefined) updateData.requirementType = body.requirementType;
    if (body.inquiryType !== undefined)     updateData.inquiryType = body.inquiryType;
    if (body.budget !== undefined)          updateData.budget = body.budget ?? null;
    if (body.preferredLocation !== undefined) updateData.preferredLocation = body.preferredLocation || null;
    if (body.address !== undefined)         updateData.address = body.address || null;
    if (body.status !== undefined)          updateData.status = body.status;
    if (body.source !== undefined)          updateData.source = body.source || null;
    if (body.notes !== undefined)           updateData.notes = body.notes || null;
    if (body.visitingTime !== undefined)    updateData.visitingTime = body.visitingTime || null;
    if (body.propertyVisited !== undefined) updateData.propertyVisited = Boolean(body.propertyVisited);
    if (body.visitStatus !== undefined)     updateData.visitStatus = body.visitStatus;
    if (body.assignedTo !== undefined)      updateData.assignedTo = body.assignedTo || null;
    if (body.assignedToName !== undefined)  updateData.assignedToName = body.assignedToName || null;

    // Handle date fields — convert string/Date to Date or null
    if (body.visitingDate !== undefined) {
      updateData.visitingDate = body.visitingDate ? new Date(body.visitingDate) : null;
    }
    if (body.followUpDate !== undefined) {
      updateData.followUpDate = body.followUpDate ? new Date(body.followUpDate) : null;
    }
    if (body.nextFollowUp !== undefined) {
      updateData.nextFollowUp = body.nextFollowUp ? new Date(body.nextFollowUp) : null;
    }
    if (body.lastContactDate !== undefined) {
      updateData.lastContactDate = body.lastContactDate ? new Date(body.lastContactDate) : null;
    }

    const updated = await db.client.update({
      where: { id },
      data: updateData,
    });

    // Log activity for key changes
    const activityLogs: Array<{ action: string; description: string; oldValue?: string; newValue?: string }> = [];

    if (body.status !== undefined && body.status !== existing.status) {
      activityLogs.push({
        action: "status_change",
        description: `Status changed from "${existing.status}" to "${body.status}"`,
        oldValue: existing.status,
        newValue: body.status,
      });
    }
    if (body.notes !== undefined && body.notes !== existing.notes) {
      activityLogs.push({
        action: "note_added",
        description: body.notes ? `Note updated: "${body.notes.slice(0, 100)}"` : "Note cleared",
      });
    }
    if (body.visitingDate !== undefined && body.visitingDate !== existing.visitingDate?.toISOString()) {
      activityLogs.push({
        action: "visit_scheduled",
        description: body.visitingDate ? `Visit scheduled for ${new Date(body.visitingDate).toLocaleDateString("en-IN")}` : "Visit date cleared",
      });
    }
    if (body.followUpDate !== undefined && body.followUpDate !== existing.followUpDate?.toISOString()) {
      activityLogs.push({
        action: "follow_up_set",
        description: body.followUpDate ? `Follow-up set for ${new Date(body.followUpDate).toLocaleDateString("en-IN")}` : "Follow-up date cleared",
      });
    }
    if (body.assignedTo !== undefined && body.assignedTo !== existing.assignedTo) {
      activityLogs.push({
        action: "assigned",
        description: body.assignedToName ? `Lead assigned to ${body.assignedToName}` : "Lead assignment removed",
        oldValue: existing.assignedToName || undefined,
        newValue: body.assignedToName || undefined,
      });
    }

    if (activityLogs.length === 0) {
      activityLogs.push({ action: "updated", description: `Client details updated` });
    }

    await Promise.all(
      activityLogs.map((log) =>
        db.activityLog.create({
          data: {
            clientId: id,
            companyId: payload.companyId,
            userId: payload.userId,
            ...log,
          },
        })
      )
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json(
      { error: "Update failed" },
      { status: 500 }
    );
  }
}

/* ==================== DELETE ==================== */
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

    const existing = await db.client.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // 🔐 Company protection
    if (existing.companyId !== payload.companyId) {
      return NextResponse.json(
        { error: "Unauthorized company access" },
        { status: 403 }
      );
    }

    // 🔐 Only admin/superadmin can delete clients
    if (!["admin", "superadmin"].includes(payload.role)) {
      return NextResponse.json({ error: "Only admins can delete clients" }, { status: 403 });
    }

    await db.client.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 }
    );
  }
}