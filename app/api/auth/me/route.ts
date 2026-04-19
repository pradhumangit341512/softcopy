import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth } from "@/lib/auth";
import { ErrorCode, apiError, newRequestId } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { apiLimiter, getClientIp, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const requestId = newRequestId();
  const ip = getClientIp(req);
  const log = logger.child({ route: "/api/auth/me", requestId, ip });

  try {
    // Generous per-IP cap to stop trivially scripted scraping/probing.
    const limit = await apiLimiter.check(120, `me:ip:${ip}`);
    if (!limit.success) {
      return rateLimited('Too many requests', limit.retryAfter);
    }

    const decoded = await verifyAuth(req);
    if (!decoded) {
      return apiError(ErrorCode.AUTH_UNAUTHORIZED, "Not authenticated", { requestId });
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
