import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth, isValidObjectId } from "@/lib/auth";
import { isAdminRole } from "@/lib/authorize";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req) as AuthPayload | null;
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status") || "";
    const propertyType = searchParams.get("propertyType") || "";
    const bhkType = searchParams.get("bhkType") || "";
    const listingType = searchParams.get("listingType") || "";
    const priceMin = searchParams.get("priceMin") || "";
    const priceMax = searchParams.get("priceMax") || "";
    const vacateFrom = searchParams.get("vacateFrom") || "";
    const vacateTo = searchParams.get("vacateTo") || "";
    const createdBy = searchParams.get("createdBy") || "";
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};
    if (isValidObjectId(payload.companyId)) {
      where.companyId = payload.companyId;
    }

    if (payload.role === 'user') {
      where.createdBy = payload.userId;
    }

    if (status) where.status = status;
    if (propertyType) where.propertyType = propertyType;
    if (bhkType) where.bhkType = bhkType;

    if (listingType === 'rent') {
      where.askingRent = { not: null, gt: 0 };
    } else if (listingType === 'sale') {
      where.sellingPrice = { not: null, gt: 0 };
    }

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

    if (vacateFrom || vacateTo) {
      const vacateFilter: Record<string, Date> = {};
      if (vacateFrom) vacateFilter.gte = new Date(vacateFrom);
      if (vacateTo) vacateFilter.lte = new Date(vacateTo);
      where.vacateDate = vacateFilter;
    }

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

    const EXPORT_LIMIT = 50_000;
    const properties = await db.property.findMany({
      where: { ...where, deletedAt: null },
      include: { creator: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: EXPORT_LIMIT,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Inventory");

    worksheet.columns = [
      { header: "Property Name", key: "propertyName", width: 25 },
      { header: "Type", key: "propertyType", width: 15 },
      { header: "BHK", key: "bhkType", width: 10 },
      { header: "Address", key: "address", width: 30 },
      { header: "Owner Name", key: "ownerName", width: 20 },
      { header: "Owner Phone", key: "ownerPhone", width: 15 },
      { header: "Owner Email", key: "ownerEmail", width: 25 },
      { header: "Asking Rent", key: "askingRent", width: 15 },
      { header: "Selling Price", key: "sellingPrice", width: 15 },
      { header: "Area", key: "area", width: 15 },
      { header: "Vacate Date", key: "vacateDate", width: 15 },
      { header: "Status", key: "status", width: 12 },
      { header: "Added By", key: "creatorName", width: 18 },
      { header: "Added On", key: "createdAt", width: 15 },
    ];

    properties.forEach((p) => {
      worksheet.addRow({
        propertyName: p.propertyName,
        propertyType: p.propertyType,
        bhkType: p.bhkType ?? "",
        address: p.address,
        ownerName: p.ownerName,
        ownerPhone: p.ownerPhone,
        ownerEmail: p.ownerEmail ?? "",
        askingRent: p.askingRent ?? "",
        sellingPrice: p.sellingPrice ?? "",
        area: p.area ?? "",
        vacateDate: p.vacateDate
          ? p.vacateDate.toLocaleDateString("en-IN")
          : "",
        status: p.status,
        creatorName: p.creator?.name ?? "",
        createdAt: p.createdAt.toLocaleDateString("en-IN"),
      });
    });

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    headerRow.commit();

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="properties.xlsx"',
      },
    });
  } catch (error) {
    console.error("Export properties error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
