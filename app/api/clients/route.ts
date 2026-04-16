import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTokenCookie,
  verifyToken,
  isValidObjectId,
  type AuthTokenPayload,
} from "@/lib/auth";
import { createClientSchema, parseBody } from "@/lib/validations";
import { isTeamMember } from "@/lib/authorize";

export const runtime = "nodejs";

// ================= GET CLIENTS =================
export async function GET(req: NextRequest) {
  try {
    const token = await getTokenCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as AuthTokenPayload | null;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({
        clients: [],
        pagination: { total: 0, page: 1, limit: 10, pages: 1 },
      });
    }

    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
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

    if (isTeamMember(payload.role)) {
      where.createdBy = payload.userId;
    }

    if (status) where.status = status;

    if (search) {
      where.OR = [
        { clientName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (dateFrom || dateTo) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(dateTo);
      where.createdAt = createdAt;
    }

    const [clients, total] = await Promise.all([
      db.client.findMany({
        where,
        include: { creator: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.client.count({ where }),
    ]);

    return NextResponse.json({
      clients,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fetch clients error:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

// ================= CREATE CLIENT =================
export async function POST(req: NextRequest) {
  try {
    const token = await getTokenCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as AuthTokenPayload | null;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json(
        { error: "Invalid session. Please log out and log in again." },
        { status: 400 }
      );
    }

    const parsed = await parseBody(req, createClientSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    const client = await db.client.create({
      data: {
        clientName: data.clientName,
        phone: data.phone,
        email: data.email,
        companyName: data.companyName,
        requirementType: data.requirementType,
        inquiryType: data.inquiryType,
        budget: data.budget ?? null,
        preferredLocation: data.preferredLocation,
        address: data.address,
        visitingTime: data.visitingTime,
        status: data.status,
        source: data.source,
        notes: data.notes,
        propertyVisited: data.propertyVisited,
        visitStatus: data.visitStatus,
        companyId: payload.companyId,
        createdBy: payload.userId,
        visitingDate: data.visitingDate,
        followUpDate: data.followUpDate,
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("Create client error:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
