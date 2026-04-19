import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth, type AuthTokenPayload } from "@/lib/auth";
import { requireAdmin } from "@/lib/authorize";
import {
  updateUserByAdminSchema,
  updateSelfSchema,
  parseBody,
} from "@/lib/validations";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

/* ================= UPDATE USER ================= */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const payload = (await verifyAuth(req)) as AuthTokenPayload | null;
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const target = await db.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, companyId: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isSelf = target.id === payload.userId;

    // Pick the schema based on who's acting. Self-updates get a STRICT subset
    // that cannot change role or status; admin updates get the full schema.
    if (isSelf) {
      const parsed = await parseBody(req, updateSelfSchema);
      if (!parsed.ok) return parsed.response;

      try {
        const updated = await db.user.update({
          where: { id },
          data: parsed.data,
          select: {
            id: true, name: true, email: true, phone: true,
            role: true, status: true, profilePhoto: true,
          },
        });
        return NextResponse.json(updated);
      } catch (err: unknown) {
        const pe = err as { code?: string; meta?: { target?: string[] } };
        if (pe?.code === "P2002") {
          const field = pe.meta?.target?.[0] || "field";
          return NextResponse.json(
            { error: `That ${field} is already in use.` },
            { status: 409 }
          );
        }
        throw err;
      }
    }

    // Admin updating another user: must be admin + same company.
    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;
    if (target.companyId !== payload.companyId) {
      return NextResponse.json(
        { error: "Forbidden — cross-company update" },
        { status: 403 }
      );
    }

    const parsed = await parseBody(req, updateUserByAdminSchema);
    if (!parsed.ok) return parsed.response;

    try {
      // When deactivating a user, bump tokenVersion so their active
      // sessions die immediately (verifyAuth checks this per-request).
      // When reactivating, no bump needed — they'll log in fresh.
      const updateData = { ...parsed.data } as Record<string, unknown>;
      if (parsed.data.status === 'inactive') {
        updateData.tokenVersion = { increment: 1 };
      }

      const updated = await db.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true, name: true, email: true, phone: true,
          role: true, status: true,
        },
      });

      await recordAudit({
        companyId: payload.companyId,
        userId: payload.userId,
        action: parsed.data.status ? `user.${parsed.data.status === 'inactive' ? 'deactivate' : 'activate'}` : 'user.update',
        resource: "User",
        resourceId: id,
        metadata: { fields: Object.keys(parsed.data) },
        req,
      });

      return NextResponse.json(updated);
    } catch (err: unknown) {
      const pe = err as { code?: string; meta?: { target?: string[] } };
      if (pe?.code === "P2002") {
        const field = pe.meta?.target?.[0] || "field";
        return NextResponse.json(
          { error: `That ${field} is already in use.` },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

/* ================= DELETE USER (soft) ================= */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const payload = (await verifyAuth(req)) as AuthTokenPayload | null;
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    if (id === payload.userId) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const target = await db.user.findFirst({
      where: { id, deletedAt: null },
      select: { companyId: true, email: true },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (target.companyId !== payload.companyId) {
      return NextResponse.json(
        { error: "Forbidden — cross-company delete" },
        { status: 403 }
      );
    }

    // Scrub the unique identifiers so the email/phone slot can be reused
    // by a future signup. Also bump tokenVersion to immediately revoke all
    // sessions for this user.
    const suffix = `.deleted.${Date.now()}`;
    await db.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: "inactive",
        email: `${target.email}${suffix}`,
        tokenVersion: { increment: 1 },
      },
    });

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: "user.delete",
      resource: "User",
      resourceId: id,
      req,
    });

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
