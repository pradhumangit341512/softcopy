import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenCookie, verifyToken, isValidObjectId } from "@/lib/auth";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

// ================= GET PROPERTIES =================
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
        properties: [],
        pagination: { total: 0, page: 1, pages: 1 },
      });
    }

    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const propertyType = searchParams.get("propertyType");
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = Number(searchParams.get("page") || 1);
    const take = 10;
    const skip = (page - 1) * take;

    const where: any = {};
    if (isValidObjectId(payload.companyId)) {
      where.companyId = payload.companyId;
    }

    // Role-based isolation: team members see only their created properties
    if (!["admin", "superadmin"].includes(payload.role)) {
      where.createdBy = payload.userId;
    }

    if (status) where.status = status;
    if (propertyType) where.propertyType = propertyType;

    if (search) {
      where.AND = [{
        OR: [
          { propertyName: { contains: search, mode: "insensitive" } },
          { ownerName: { contains: search, mode: "insensitive" } },
          { ownerPhone: { contains: search } },
          { address: { contains: search, mode: "insensitive" } },
        ],
      }];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [properties, total] = await Promise.all([
      db.property.findMany({
        where,
        include: { creator: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.property.count({ where }),
    ]);

    return NextResponse.json({
      properties,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / take),
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
    const token = await getTokenCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as AuthPayload | null;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isValidObjectId(payload.companyId) || !isValidObjectId(payload.userId)) {
      return NextResponse.json(
        { error: "Invalid session. Please log out and log in again." },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Validate required fields
    if (!body.propertyName || !body.address || !body.propertyType || !body.ownerName || !body.ownerPhone) {
      return NextResponse.json(
        { error: "Missing required fields: propertyName, address, propertyType, ownerName, ownerPhone" },
        { status: 400 }
      );
    }

    const askingRent = body.askingRent && String(body.askingRent).trim() !== "" ? parseFloat(body.askingRent) : null;
    const sellingPrice = body.sellingPrice && String(body.sellingPrice).trim() !== "" ? parseFloat(body.sellingPrice) : null;

    const property = await db.property.create({
      data: {
        propertyName: body.propertyName.trim(),
        address: body.address.trim(),
        propertyType: body.propertyType,
        bhkType: body.bhkType?.trim() || null,
        vacateDate: body.vacateDate ? new Date(body.vacateDate) : null,
        askingRent: askingRent && !isNaN(askingRent) ? askingRent : null,
        sellingPrice: sellingPrice && !isNaN(sellingPrice) ? sellingPrice : null,
        area: body.area?.trim() || null,
        description: body.description?.trim() || null,
        status: body.status || "Available",
        ownerName: body.ownerName.trim(),
        ownerPhone: body.ownerPhone.trim(),
        ownerEmail: body.ownerEmail?.trim() || null,
        companyId: payload.companyId,
        createdBy: payload.userId,
      },
    });

    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    console.error("Create property error:", error);
    return NextResponse.json(
      { error: "Failed to create property" },
      { status: 500 }
    );
  }
}
