import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenCookie, verifyToken } from "@/lib/auth";
import ExcelJS from "exceljs";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

export async function GET(req: NextRequest) {
  try {
    /* ================= AUTH ================= */

    const token = await getTokenCookie();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as AuthPayload | null;

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = payload.companyId;

    /* ================= QUERY PARAM ================= */

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "all";

    let where: any = { companyId };

    if (type === "today") {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      where.visitingDate = {
        gte: start,
        lt: end,
      };
    }

    /* ================= FETCH DATA ================= */

    const clients = await db.client.findMany({
      where,
      include: {
        creator: {
          select: { name: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    /* ================= CREATE EXCEL ================= */

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Clients");

    worksheet.columns = [
      { header: "Client Name", key: "clientName", width: 20 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Email", key: "email", width: 25 },
      { header: "Requirement", key: "requirementType", width: 15 },
      { header: "Inquiry Type", key: "inquiryType", width: 15 },
      { header: "Budget", key: "budget", width: 15 },
      { header: "Location", key: "preferredLocation", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Visit Date", key: "visitingDate", width: 15 },
      { header: "Follow-up Date", key: "followUpDate", width: 15 },
      { header: "Added By", key: "creatorName", width: 20 },
    ];

    clients.forEach((client) => {
      worksheet.addRow({
        clientName: client.clientName,
        phone: client.phone,
        email: client.email ?? "",
        requirementType: client.requirementType,
        inquiryType: client.inquiryType,
        budget: client.budget ?? "",
        preferredLocation: client.preferredLocation ?? "",
        status: client.status,
        visitingDate: client.visitingDate
          ? client.visitingDate.toLocaleDateString()
          : "",
        followUpDate: client.followUpDate
          ? client.followUpDate.toLocaleDateString()
          : "",
        creatorName: client.creator?.name ?? "",
      });
    });

    /* ================= HEADER STYLE ================= */

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };

    /* ================= RETURN FILE ================= */

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="clients.xlsx"',
      },
    });
  } catch (error) {
    console.error("Export clients error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
