import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenCookie, verifyToken, hashPassword } from "@/lib/auth";
import { z } from "zod";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  password: z.string().min(6),
  role: z.enum(["admin", "user"]),
  designation: z.string().optional(),
});

function generateEmployeeId(companyPrefix: string, count: number): string {
  const num = String(count + 1).padStart(3, "0");
  const prefix = companyPrefix.substring(0, 3).toUpperCase();
  return `${prefix}-${num}`;
}

// ================= GET USERS =================
export async function GET(req: NextRequest) {
  try {
    const token = await getTokenCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // FIX: await verifyToken
    const payload = (await verifyToken(token)) as AuthPayload | null;

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin can view team
    const user = await db.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !["admin", "superadmin"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await db.user.findMany({
      where: { companyId: payload.companyId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        employeeId: true,
        designation: true,
        profilePhoto: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// ================= CREATE USER =================
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

    // Only admin can create users
    const requester = await db.user.findUnique({
      where: { id: payload.userId },
    });

    if (!requester || !["admin", "superadmin"].includes(requester.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validated = createUserSchema.parse(body);

    // Check duplicate
    const existing = await db.user.findFirst({
      where: {
        OR: [{ email: validated.email }, { phone: validated.phone }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(validated.password);

    // Auto-generate employee ID
    const company = await db.company.findUnique({
      where: { id: payload.companyId },
      select: { companyName: true },
    });
    const userCount = await db.user.count({ where: { companyId: payload.companyId } });
    const employeeId = generateEmployeeId(company?.companyName || "EMP", userCount);

    const newUser = await db.user.create({
      data: {
        name: validated.name,
        email: validated.email,
        phone: validated.phone,
        password: hashedPassword,
        role: validated.role,
        designation: validated.designation || null,
        employeeId,
        companyId: payload.companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        employeeId: true,
        designation: true,
        status: true,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
