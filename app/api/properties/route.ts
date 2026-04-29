import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyAuth,
  isValidObjectId,
} from "@/lib/auth";
import { isAdminRole } from "@/lib/authorize";
import { createPropertySchema, parseBody } from "@/lib/validations";

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
    const bhkType = searchParams.get("bhkType");
    const listingType = searchParams.get("listingType");
    const priceMin = searchParams.get("priceMin");
    const priceMax = searchParams.get("priceMax");
    const vacateFrom = searchParams.get("vacateFrom");
    const vacateTo = searchParams.get("vacateTo");
    const createdBy = searchParams.get("createdBy");
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

    if (status) where.status = status;
    if (propertyType) where.propertyType = propertyType;
    if (bhkType) where.bhkType = bhkType;

    // Listing type: filter by rent-only, sale-only, or both
    if (listingType === 'rent') {
      where.askingRent = { not: null, gt: 0 };
    } else if (listingType === 'sale') {
      where.sellingPrice = { not: null, gt: 0 };
    }

    // Price range: applies to rent or sale depending on listingType
    if (priceMin || priceMax) {
      const priceFilter: Record<string, number> = {};
      if (priceMin) priceFilter.gte = Number(priceMin);
      if (priceMax) priceFilter.lte = Number(priceMax);

      if (listingType === 'sale') {
        where.sellingPrice = { ...((where.sellingPrice as object) || {}), ...priceFilter };
      } else {
        where.askingRent = { ...((where.askingRent as object) || {}), ...priceFilter };
      }
    }

    // Vacate date range
    if (vacateFrom || vacateTo) {
      const vacateFilter: Record<string, Date> = {};
      if (vacateFrom) vacateFilter.gte = new Date(vacateFrom);
      if (vacateTo) vacateFilter.lte = new Date(vacateTo);
      where.vacateDate = vacateFilter;
    }

    // Added by (admin only)
    if (createdBy && isAdminRole(payload.role) && isValidObjectId(createdBy)) {
      where.createdBy = createdBy;
    }

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

    // F12 — keep ownerPhone and ownerPhones in lock-step. The primary phone
    // (form's required field) is always element 0; any extras the user
    // typed in the multi-phone UI append after, deduped to avoid duplicates.
    const phoneList = Array.from(
      new Set(
        [data.ownerPhone, ...(data.ownerPhones ?? [])]
          .map((p) => p?.trim())
          .filter((p): p is string => Boolean(p))
      )
    );
    const primaryPhone = phoneList[0] ?? data.ownerPhone;

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
        // F10 — structured project identity (all nullable)
        projectName: data.projectName,
        sectorNo: data.sectorNo,
        unitNo: data.unitNo,
        towerNo: data.towerNo,
        typology: data.typology,
        // F11 — deal-flow fields
        demand: data.demand ?? null,
        paymentStatus: data.paymentStatus,
        caseType: data.caseType,
        loanStatus: data.loanStatus,
        ownerName: data.ownerName,
        ownerPhone: primaryPhone,
        ownerPhones: phoneList,
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
