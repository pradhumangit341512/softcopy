import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenCookie, verifyToken, isValidObjectId } from "@/lib/auth";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

/* ==================== GET ==================== */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getTokenCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as AuthPayload | null;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid property ID" }, { status: 400 });
    }

    const property = await db.property.findUnique({
      where: { id },
      include: { creator: { select: { id: true, name: true } } },
    });

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    if (
      isValidObjectId(payload.companyId) &&
      property.companyId !== payload.companyId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Team member can only view their own properties
    if (!["admin", "superadmin"].includes(payload.role) && property.createdBy !== payload.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(property);
  } catch (error) {
    console.error("Get property error:", error);
    return NextResponse.json(
      { error: "Failed to fetch property" },
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
    const token = await getTokenCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as AuthPayload | null;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid property ID" }, { status: 400 });
    }

    const existing = await db.property.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    if (
      isValidObjectId(payload.companyId) &&
      existing.companyId !== payload.companyId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Role check: team members can only edit their own properties
    if (!["admin", "superadmin"].includes(payload.role) && existing.createdBy !== payload.userId) {
      return NextResponse.json({ error: "You can only edit your own properties" }, { status: 403 });
    }

    const body = await req.json();

    const askingRent =
      body.askingRent && String(body.askingRent).trim() !== ""
        ? parseFloat(body.askingRent)
        : null;
    const sellingPrice =
      body.sellingPrice && String(body.sellingPrice).trim() !== ""
        ? parseFloat(body.sellingPrice)
        : null;

    const updated = await db.property.update({
      where: { id },
      data: {
        propertyName: body.propertyName?.trim(),
        address: body.address?.trim(),
        propertyType: body.propertyType,
        bhkType: body.bhkType?.trim() || null,
        vacateDate: body.vacateDate ? new Date(body.vacateDate) : null,
        askingRent: askingRent && !isNaN(askingRent) ? askingRent : null,
        sellingPrice:
          sellingPrice && !isNaN(sellingPrice) ? sellingPrice : null,
        area: body.area?.trim() || null,
        description: body.description?.trim() || null,
        status: body.status,
        ownerName: body.ownerName?.trim(),
        ownerPhone: body.ownerPhone?.trim(),
        ownerEmail: body.ownerEmail?.trim() || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Update property error:", error);
    return NextResponse.json(
      { error: "Failed to update property" },
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
    const token = await getTokenCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as AuthPayload | null;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid property ID" }, { status: 400 });
    }

    const existing = await db.property.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    if (
      isValidObjectId(payload.companyId) &&
      existing.companyId !== payload.companyId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Role check: only admin/superadmin can delete properties
    if (!["admin", "superadmin"].includes(payload.role)) {
      return NextResponse.json({ error: "Only admins can delete properties" }, { status: 403 });
    }

    await db.property.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete property error:", error);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 }
    );
  }
}
