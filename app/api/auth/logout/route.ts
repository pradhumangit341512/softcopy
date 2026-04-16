import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { ErrorCode, apiError, newRequestId } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: "/api/auth/logout", requestId });

  try {
    // Best-effort audit log before clearing the cookie.
    const token = req.cookies.get("auth_token")?.value;
    if (token) {
      const payload = await verifyToken(token);
      if (payload?.companyId) {
        await recordAudit({
          companyId: payload.companyId,
          userId: payload.userId,
          action: "auth.logout",
          resource: "User",
          resourceId: payload.userId,
          req,
        });
      }
    }

    const response = NextResponse.json(
      { message: "Logout successful" },
      { status: 200, headers: { "X-Request-Id": requestId } }
    );

    // Clear with explicit expiry + delete — belt-and-suspenders across browsers.
    response.cookies.set("auth_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    response.cookies.delete("auth_token");

    return response;
  } catch (err) {
    log.error({ err }, "Logout failed");
    return apiError(ErrorCode.SYSTEM_INTERNAL_ERROR, "Logout failed", { requestId });
  }
}
