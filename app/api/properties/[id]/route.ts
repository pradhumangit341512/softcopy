import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth, isValidObjectId, type AuthTokenPayload } from "@/lib/auth";
import { isTeamMember, assertCompanyOwnership } from "@/lib/authorize";
import { updatePropertySchema, parseBody } from "@/lib/validations";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

async function authFromRequest(req: NextRequest): Promise<AuthTokenPayload | null> {
  return verifyAuth(req);
}

/* ==================== GET ==================== */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authFromRequest(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid property ID" }, { status: 400 });
    }

    // Properties are shared inventory — team members can VIEW any property
    // in their company (matching the list endpoint's behavior). Only
    // PUT/DELETE restrict to createdBy for write protection.
    const property = await db.property.findFirst({
      where: { id, companyId: payload.companyId, deletedAt: null },
      include: { creator: { select: { id: true, name: true } } },
    });
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    return NextResponse.json(property);
  } catch (error) {
    console.error("Get property error:", error);
    return NextResponse.json({ error: "Failed to fetch property" }, { status: 500 });
  }
}

/* ==================== PUT ==================== */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authFromRequest(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid property ID" }, { status: 400 });
    }

    const parsed = await parseBody(req, updatePropertySchema);
    if (!parsed.ok) return parsed.response;

    const where: Record<string, unknown> = {
      id,
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (isTeamMember(payload.role)) where.createdBy = payload.userId;

    const result = await db.property.updateMany({ where, data: parsed.data });
    if (result.count === 0) {
      return NextResponse.json(
        { error: "Property not found or not authorized" },
        { status: 404 }
      );
    }

    const updated = await db.property.findUnique({ where: { id } });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("Update property error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update property" },
      { status: 500 }
    );
  }
}

/* ==================== DELETE (soft) ==================== */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authFromRequest(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid property ID" }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      id,
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (isTeamMember(payload.role)) where.createdBy = payload.userId;

    const result = await db.property.updateMany({
      where,
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: "Property not found or not authorized" },
        { status: 404 }
      );
    }

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: "property.delete",
      resource: "Property",
      resourceId: id,
      req,
    });

    return NextResponse.json({
      success: true,
      message: "Property deleted successfully",
    });
  } catch (error) {
    console.error("Delete property error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
