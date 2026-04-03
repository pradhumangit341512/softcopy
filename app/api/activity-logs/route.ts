import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenCookie, verifyToken } from "@/lib/auth";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

// GET activity logs for a client
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

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    // Team member can only view logs for clients they own or are assigned to
    if (!["admin", "superadmin"].includes(payload.role)) {
      const client = await db.client.findUnique({
        where: { id: clientId },
        select: { createdBy: true, assignedTo: true, companyId: true },
      });
      if (
        !client ||
        client.companyId !== payload.companyId ||
        (client.createdBy !== payload.userId && client.assignedTo !== payload.userId)
      ) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const logs = await db.activityLog.findMany({
      where: { clientId, companyId: payload.companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Fetch activity logs error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}

// POST a new activity log entry
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

    const body = await req.json();

    // SECURITY: Verify the clientId belongs to the user's company
    if (body.clientId) {
      const client = await db.client.findUnique({
        where: { id: body.clientId },
        select: { companyId: true },
      });
      if (!client || client.companyId !== payload.companyId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const log = await db.activityLog.create({
      data: {
        clientId: body.clientId,
        companyId: payload.companyId,
        userId: payload.userId,
        userName: body.userName || null,
        action: body.action,
        description: body.description,
        oldValue: body.oldValue || null,
        newValue: body.newValue || null,
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Create activity log error:", error);
    return NextResponse.json(
      { error: "Failed to create activity log" },
      { status: 500 }
    );
  }
}
