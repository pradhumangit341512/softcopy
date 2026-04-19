import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyAuth,
  isValidObjectId,
  type AuthTokenPayload,
} from "@/lib/auth";
import { createPropertySchema, parseBody } from "@/lib/validations";
import { isTeamMember } from "@/lib/authorize";

export const runtime = "nodejs";

// ================= GET PROPERTIES =================
export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({
        properties: [],
        pagination: { total: 0, page: 1, limit: 10, pages: 1 },
      });
    }

    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const propertyType = searchParams.get("propertyType");
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
      deletedAt: null,
    };

    // Properties are SHARED INVENTORY across the broker company — every
    // team member sees every property so they can pitch them to their
    // own clients. Clients (in /api/clients) stay personal-book.
    // Per product decision: team-member createdBy filter intentionally OMITTED here.

    if (status) where.status = status;
    if (propertyType) where.propertyType = propertyType;

    if (search) {
      where.OR = [
        { propertyName: { contains: search, mode: "insensitive" } },
        { ownerName: { contains: search, mode: "insensitive" } },
        { ownerPhone: { contains: search } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    if (dateFrom || dateTo) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(dateTo);
      where.createdAt = createdAt;
    }

    const [properties, total] = await Promise.all([
      db.property.findMany({
        where,
        include: { creator: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.property.count({ where }),
    ]);

    return NextResponse.json({
      properties,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fetch properties error:", error);
    return NextResponse.json(
      { error: "Failed to fetch properties" },
      { status: 500 }
    );
  }
}

// ================= CREATE PROPERTY =================
export async function POST(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isValidObjectId(payload.companyId) || !isValidObjectId(payload.userId)) {
      return NextResponse.json(
        { error: "Invalid session. Please log out and log in again." },
        { status: 400 }
      );
    }

    const parsed = await parseBody(req, createPropertySchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    const property = await db.property.create({
      data: {
        propertyName: data.propertyName,
        address: data.address,
        propertyType: data.propertyType,
        bhkType: data.bhkType,
        vacateDate: data.vacateDate,
        askingRent: data.askingRent ?? null,
        sellingPrice: data.sellingPrice ?? null,
        area: data.area,
        description: data.description,
        status: data.status,
        ownerName: data.ownerName,
        ownerPhone: data.ownerPhone,
        ownerEmail: data.ownerEmail,
        companyId: payload.companyId,
        createdBy: payload.userId,
        deletedAt: null,
      },
    });

    return NextResponse.json(property, { status: 201 });
  } catch (error: unknown) {
    console.error("Create property error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create property" },
      { status: 500 }
    );
  }
}
