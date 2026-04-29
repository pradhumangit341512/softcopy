import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, getTokenFromRequest } from "@/lib/auth";
import { ErrorCode, apiError, newRequestId } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { apiLimiter, getClientIp, rateLimited } from "@/lib/rate-limit";
import { effectiveFeatures } from "@/lib/entitlements";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const requestId = newRequestId();
  const ip = getClientIp(req);
  const log = logger.child({ route: "/api/auth/me", requestId, ip });

  try {
    const limit = await apiLimiter.check(120, `me:ip:${ip}`);
    if (!limit.success) {
      return rateLimited('Too many requests', limit.retryAfter);
    }

    const token = getTokenFromRequest(req);
    if (!token) {
      return apiError(ErrorCode.AUTH_UNAUTHORIZED, "Not authenticated", { requestId });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return apiError(ErrorCode.AUTH_UNAUTHORIZED, "Not authenticated", { requestId });
    }

    // Check user status + tokenVersion against DB
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      include: { company: true },
    });

    if (!user) {
      log.warn({ userId: payload.userId }, "Token valid but user missing (possibly deleted)");
      return apiError(ErrorCode.RESOURCE_NOT_FOUND, "User not found", { requestId });
    }

    if (user.status !== "active") {
      return apiError(ErrorCode.AUTH_ACCOUNT_INACTIVE, "Account is inactive", { requestId });
    }

    if (user.company && user.company.status === 'suspended') {
      return apiError(ErrorCode.AUTH_ACCOUNT_INACTIVE, "Account is suspended", { requestId });
    }

    // Detect session replacement: JWT is valid but tokenVersion doesn't match
    // → someone logged in from another device, which bumped tokenVersion
    const claimedTv = typeof payload.tv === 'number' ? payload.tv : 0;
    if (user.tokenVersion !== claimedTv) {
      log.info({ userId: user.id, claimedTv, currentTv: user.tokenVersion }, "Session replaced by another login");
      return apiError(
        ErrorCode.AUTH_SESSION_REPLACED,
        "You were signed out because your account was accessed from another device.",
        { requestId }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = user;

    // Resolve the company's effective feature list once, server-side.
    // Client code reads this via useFeature() instead of duplicating
    // the entitlement logic in JS.
    const features = user.company
      ? effectiveFeatures({
          plan: user.company.plan,
          status: user.company.status,
          subscriptionUntil: user.company.subscriptionUntil,
          featureFlags: user.company.featureFlags,
        })
      : [];

    return NextResponse.json(
      { user: { ...safeUser, features } },
      { status: 200, headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    log.error({ err }, "Unhandled error");
    return apiError(ErrorCode.SYSTEM_INTERNAL_ERROR, "Internal server error", { requestId });
  }
}
