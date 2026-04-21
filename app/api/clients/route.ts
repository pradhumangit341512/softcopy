import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyAuth,
  isValidObjectId,
} from "@/lib/auth";
import { createClientSchema, parseBody } from "@/lib/validations";
import { isTeamMember, isAdminRole } from "@/lib/authorize";

export const runtime = "nodejs";

// ================= GET CLIENTS =================
export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
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

    const status     = searchParams.get("status");
    const source     = searchParams.get("source");
    const search     = searchParams.get("search");
    const dateFrom   = searchParams.get("dateFrom");
    const dateTo     = searchParams.get("dateTo");
    const followUp   = searchParams.get("followUp");
    const budgetMin  = searchParams.get("budgetMin");
    const budgetMax  = searchParams.get("budgetMax");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
      deletedAt: null,
    };

    if (isTeamMember(payload.role)) {
      where.createdBy = payload.userId;
    } else if (isAdminRole(payload.role)) {
      const createdByFilter = searchParams.get('createdBy');
      if (createdByFilter && isValidObjectId(createdByFilter)) {
        where.createdBy = createdByFilter;
      }
    }

    // Multi-select status (comma-separated: "New,Interested")
    if (status) {
      const statuses = status.split(',').filter(Boolean);
      if (statuses.length === 1) where.status = statuses[0];
      else if (statuses.length > 1) where.status = { in: statuses };
    }

    // Multi-select source
    if (source) {
      const sources = source.split(',').filter(Boolean);
      if (sources.length === 1) where.source = sources[0];
      else if (sources.length > 1) where.source = { in: sources };
    }

    // Budget range
    if (budgetMin || budgetMax) {
      const budget: { gte?: number; lte?: number } = {};
      if (budgetMin) budget.gte = Number(budgetMin);
      if (budgetMax) budget.lte = Number(budgetMax);
      where.budget = budget;
    }

    // Follow-up filter
    if (followUp === 'overdue') {
      where.followUpDate = { lt: new Date() };
      where.status = where.status ?? { notIn: ['DealDone', 'Rejected'] };
    } else if (followUp === 'today') {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      where.followUpDate = { gte: todayStart, lte: todayEnd };
    } else if (followUp === 'none') {
      where.followUpDate = null;
    }

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
    const payload = await verifyAuth(req);
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

    // Admin can assign to a team member; team members always self-assign.
    // Verify the target user belongs to the same company (prevent cross-tenant).
    let assignTo = payload.userId;
    if (data.assignedTo && isAdminRole(payload.role)) {
      const targetUser = await db.user.findFirst({
        where: { id: data.assignedTo, companyId: payload.companyId, deletedAt: null },
        select: { id: true },
      });
      if (!targetUser) {
        return NextResponse.json({ error: 'Assigned team member not found in your company' }, { status: 400 });
      }
      assignTo = data.assignedTo;
    }

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
        createdBy: assignTo,
        visitingDate: data.visitingDate,
        followUpDate: data.followUpDate,
        deletedAt: null,
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
