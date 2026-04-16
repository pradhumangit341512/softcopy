import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getTokenCookie,
  verifyToken,
  hashPassword,
  type AuthTokenPayload,
} from "@/lib/auth";
import { requireAdmin } from "@/lib/authorize";
import { createUserSchema, parseBody } from "@/lib/validations";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

async function authFromCookie(): Promise<AuthTokenPayload | null> {
  const token = await getTokenCookie();
  if (!token) return null;
  return verifyToken(token);
}

// ================= GET USERS =================
export async function GET(req: NextRequest) {
  try {
    const payload = await authFromCookie();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)));
    const skip = (page - 1) * limit;

    const where = { companyId: payload.companyId, deletedAt: null };
    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// ================= CREATE USER =================
export async function POST(req: NextRequest) {
  try {
    const payload = await authFromCookie();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    const parsed = await parseBody(req, createUserSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    const existing = await db.user.findFirst({
      where: { OR: [{ email: data.email }, { phone: data.phone }] },
      select: { email: true, phone: true },
    });
    if (existing) {
      const field = existing.email === data.email ? "email" : "phone";
      return NextResponse.json(
        { error: `User with this ${field} already exists` },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(data.password);

    try {
      const newUser = await db.user.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          password: hashedPassword,
          role: data.role,
          companyId: payload.companyId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      await recordAudit({
        companyId: payload.companyId,
        userId: payload.userId,
        action: "user.create",
        resource: "User",
        resourceId: newUser.id,
        metadata: { role: data.role },
        req,
      });

      return NextResponse.json(newUser, { status: 201 });
    } catch (err: unknown) {
      const prismaErr = err as { code?: string; meta?: { target?: string[] } };
      if (prismaErr?.code === "P2002") {
        const field = prismaErr.meta?.target?.[0] || "field";
        return NextResponse.json(
          { error: `User with this ${field} already exists` },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
