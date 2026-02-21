import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { db } from "@/lib/db";
import { UpdateClientRequest } from "@/lib/types";

/* ==================== GET ==================== */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, response, payload } = await requireAuth(req);
    if (!authorized || !payload) return response;

    // 🔥 NEXT 16 FIX
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Client id missing" }, { status: 400 });
    }

    const client = await db.client.findUnique({
      where: { id },
      include: {
        creator: true,
        commissions: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (client.companyId !== payload.companyId) {
      return NextResponse.json(
        { error: "Unauthorized - wrong company" },
        { status: 403 }
      );
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
    const { authorized, response, payload } = await requireAuth(req);
    if (!authorized || !payload) return response;

    const { id } = await context.params;

    const body: UpdateClientRequest = await req.json();

    const existing = await db.client.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (existing.companyId !== payload.companyId) {
      return NextResponse.json(
        { error: "Unauthorized - wrong company" },
        { status: 403 }
      );
    }

    if (!["admin", "manager"].includes(payload.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const updated = await db.client.update({
      where: { id },
      data: {
        clientName: body.clientName,
        phone: body.phone,
        email: body.email,
        budget: body.budget,
        preferredLocation: body.preferredLocation,
        status: body.status,
        notes: body.notes,
      },
    });

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
    const { authorized, response, payload } = await requireAuth(req);
    if (!authorized || !payload) return response;

    const { id } = await context.params;

    const existing = await db.client.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (existing.companyId !== payload.companyId) {
      return NextResponse.json(
        { error: "Unauthorized - wrong company" },
        { status: 403 }
      );
    }

    if (payload.role !== "admin") {
      return NextResponse.json(
        { error: "Admin only" },
        { status: 403 }
      );
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
