import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { ErrorCode, apiError, newRequestId } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: "/api/auth/me", requestId });

  try {
    const token = req.cookies.get("auth_token")?.value;
    if (!token) {
      return apiError(ErrorCode.AUTH_UNAUTHORIZED, "Not authenticated", { requestId });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return apiError(ErrorCode.AUTH_TOKEN_INVALID, "Invalid or expired token", { requestId });
    }

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      include: { company: true },
    });

    if (!user) {
      log.warn({ userId: decoded.userId }, "Token valid but user missing (possibly deleted)");
      return apiError(ErrorCode.RESOURCE_NOT_FOUND, "User not found", { requestId });
    }

    if (user.status !== "active") {
      return apiError(ErrorCode.AUTH_ACCOUNT_INACTIVE, "Account is inactive", { requestId });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = user;
    return NextResponse.json(
      { user: safeUser },
      { status: 200, headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    log.error({ err }, "Unhandled error");
    return apiError(ErrorCode.SYSTEM_INTERNAL_ERROR, "Internal server error", { requestId });
  }
}
