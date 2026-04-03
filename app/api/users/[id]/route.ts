import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenCookie, verifyToken } from "@/lib/auth";

type AuthPayload = {
  userId: string;
  companyId: string;
  role: string;
  email: string;
};

/* ================= UPDATE USER ================= */

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const token = await getTokenCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as AuthPayload | null;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch target user to verify company ownership
    const targetUser = await db.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // SECURITY: Company isolation — cannot modify users from other companies
    if (targetUser.companyId !== payload.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isSelfUpdate = id === payload.userId;
    const isAdmin = ["admin", "superadmin"].includes(payload.role);

    // Regular users can only update their OWN profile (name, email, phone only)
    if (!isAdmin && !isSelfUpdate) {
      return NextResponse.json({ error: "Forbidden — you can only edit your own profile" }, { status: 403 });
    }

    const body = await req.json();
    const updateData: Record<string, any> = {};

    // Fields that anyone can update on their own profile
    if (body.name !== undefined)        updateData.name = body.name;
    if (body.email !== undefined)       updateData.email = body.email;
    if (body.phone !== undefined)       updateData.phone = body.phone;

    // Fields that ONLY admins can update (and not on themselves to prevent escalation)
    if (isAdmin) {
      if (body.designation !== undefined) updateData.designation = body.designation || null;

      // Prevent self-role-escalation and self-deactivation
      if (!isSelfUpdate) {
        if (body.status !== undefined) updateData.status = body.status;
        if (body.role !== undefined)   updateData.role = body.role;
      }
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

/* ================= DELETE USER ================= */

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const token = await getTokenCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as AuthPayload | null;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin/superadmin can delete users
    if (!["admin", "superadmin"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cannot delete yourself
    if (id === payload.userId) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    // Fetch target user — verify same company
    const targetUser = await db.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // SECURITY: Company isolation
    if (targetUser.companyId !== payload.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.user.delete({ where: { id } });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
