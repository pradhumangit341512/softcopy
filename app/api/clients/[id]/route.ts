import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertCompanyOwnership, isTeamMember } from "@/lib/authorize";
import {
  updateClientSchema,
  updateClientByTeamMemberSchema,
  parseBody,
} from "@/lib/validations";
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

    // Team members use a restricted schema — they cannot set status or
    // visitStatus (those are admin-only state transitions).
    const schema = isTeamMember(payload.role)
      ? updateClientByTeamMemberSchema
      : updateClientSchema;

    const parsed = await parseBody(req, schema);
    if (!parsed.ok) return parsed.response;

    // Atomic: the WHERE includes companyId + deletedAt + (for team members)
    // createdBy — collapses ownership check + existence + TOCTOU window.
    const where: Record<string, unknown> = {
      id,
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (isTeamMember(payload.role)) where.createdBy = payload.userId;

    const result = await db.client.updateMany({ where, data: parsed.data });
    if (result.count === 0) {
      return NextResponse.json(
        { error: "Client not found or not authorized" },
        { status: 404 }
      );
    }

    const updated = await db.client.findUnique({ where: { id } });
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
    if (isTeamMember(payload.role)) where.createdBy = payload.userId;

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
