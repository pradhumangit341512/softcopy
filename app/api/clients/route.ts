import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenCookie, verifyToken, isValidObjectId } from "@/lib/auth";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

// ================= GET CLIENTS =================
export async function GET(req: NextRequest) {
  try {
    const token = await getTokenCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as AuthPayload | null;

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({
        clients: [],
        pagination: { total: 0, page: 1, pages: 1 },
      });
    }

    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const assignedTo = searchParams.get("assignedTo");
    const view = searchParams.get("view"); // "my" for assigned-to-me leads
    const page = Number(searchParams.get("page") || 1);
    const take = 10;
    const skip = (page - 1) * take;

    const where: any = { companyId: payload.companyId };
    const andConditions: any[] = [];

    // Role-based data isolation:
    // - admin/superadmin see ALL company leads
    // - everyone else sees only leads they created OR assigned to them
    if (!["admin", "superadmin"].includes(payload.role)) {
      andConditions.push({
        OR: [
          { createdBy: payload.userId },
          { assignedTo: payload.userId },
        ],
      });
    }

    if (status) where.status = status;

    // Additional assignment filter (for explicit filtering)
    if (assignedTo) {
      where.assignedTo = assignedTo;
    } else if (view === "my") {
      where.assignedTo = payload.userId;
    }

    if (search) {
      andConditions.push({
        OR: [
          { clientName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [clients, total] = await Promise.all([
      db.client.findMany({
        where,
        include: { creator: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.client.count({ where }),
    ]);

    return NextResponse.json({
      clients,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / take),
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

    const payload = (await verifyToken(token)) as AuthPayload | null;

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({ error: "Invalid session. Please log out and log in again." }, { status: 400 });
    }

    const body = await req.json();

    // Duplicate detection: check if a client with the same phone already exists
    if (body.phone) {
      const existingByPhone = await db.client.findFirst({
        where: { companyId: payload.companyId, phone: body.phone },
        select: { id: true, clientName: true, phone: true },
      });
      if (existingByPhone) {
        return NextResponse.json(
          {
            error: `A client with phone ${body.phone} already exists (${existingByPhone.clientName}). Please check for duplicates.`,
            duplicate: true,
            existingClient: existingByPhone,
          },
          { status: 409 }
        );
      }
    }

    if (body.email) {
      const existingByEmail = await db.client.findFirst({
        where: { companyId: payload.companyId, email: body.email },
        select: { id: true, clientName: true, email: true },
      });
      if (existingByEmail) {
        return NextResponse.json(
          {
            error: `A client with email ${body.email} already exists (${existingByEmail.clientName}). Please check for duplicates.`,
            duplicate: true,
            existingClient: existingByEmail,
          },
          { status: 409 }
        );
      }
    }

    // Whitelist allowed fields to prevent mass assignment
    const client = await db.client.create({
      data: {
        clientName:        body.clientName,
        phone:             body.phone,
        email:             body.email || null,
        companyName:       body.companyName || null,
        requirementType:   body.requirementType,
        inquiryType:       body.inquiryType,
        budget:            body.budget ?? null,
        preferredLocation: body.preferredLocation || null,
        address:           body.address || null,
        visitingTime:      body.visitingTime || null,
        status:            body.status || 'New',
        source:            body.source || null,
        notes:             body.notes || null,
        companyId:         payload.companyId,
        createdBy:         payload.userId,
        assignedTo:        body.assignedTo || null,
        assignedToName:    body.assignedToName || null,
        visitingDate:      body.visitingDate ? new Date(body.visitingDate) : null,
        followUpDate:      body.followUpDate ? new Date(body.followUpDate) : null,
      },
    });

    // Log activity: client created
    await db.activityLog.create({
      data: {
        clientId: client.id,
        companyId: payload.companyId,
        userId: payload.userId,
        action: "created",
        description: `Client "${client.clientName}" was added`,
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