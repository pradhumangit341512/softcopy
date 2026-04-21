import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { ErrorCode, apiError, newRequestId } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  getDeviceCookie,
  revokeDeviceByToken,
  clearDeviceCookie,
} from "@/lib/trusted-device";

export const runtime = "nodejs";

/**
 * POST /api/auth/logout
 *
 * Clears the auth_token cookie + revokes the trusted-device cookie.
 *
 * NOTE: We do NOT bump User.tokenVersion here — that would invalidate
 * sessions on ALL devices. Logging out on one laptop shouldn't kick the
 * user off their phone. To revoke ALL sessions everywhere (e.g. after a
 * password change or a "log out everywhere" button), increment
 * user.tokenVersion explicitly. The middleware checks `tv` claim against
 * current user.tokenVersion on every request — bumping it once forces
 * every JWT to fail verification.
 *
 * For per-device revocation: the trusted-device row IS revoked here,
 * which means even if the auth_token JWT is stolen and reused, the
 * attacker can't bypass OTP from this device on next login.
 */
export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: "/api/auth/logout", requestId });

  try {
    // Best-effort: identify the user so we can audit + revoke device.
    const token = req.cookies.get("auth_token")?.value;
    const payload = token ? await verifyToken(token) : null;

    if (payload?.companyId) {
      await recordAudit({
        companyId: payload.companyId,
        userId: payload.userId,
        action: "auth.logout",
        resource: "User",
        resourceId: payload.userId,
        req,
      });

      // Close ALL open sessions for this user (handles multi-device + orphans)
      const now = new Date();
      const openSessions = await db.userSession.findMany({
        where: { userId: payload.userId, logoutAt: { isSet: false } },
        select: { id: true, loginAt: true },
      });
      if (openSessions.length > 0) {
        await Promise.all(
          openSessions.map((s) =>
            db.userSession.update({
              where: { id: s.id },
              data: {
                logoutAt: now,
                duration: Math.round((now.getTime() - s.loginAt.getTime()) / 60000),
              },
            }).catch((err) => console.error('Session close failed:', err))
          )
        );
      }
    }

    const response = NextResponse.json(
      { message: "Logout successful" },
      { status: 200, headers: { "X-Request-Id": requestId } }
    );

    // Clear auth_token cookie
    response.cookies.set("auth_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    response.cookies.delete("auth_token");

    // Revoke + clear trusted-device cookie so this browser can't skip OTP
    // on next login. Important for shared/public computers.
    const deviceToken = getDeviceCookie(req);
    if (deviceToken) {
      await revokeDeviceByToken(deviceToken);
    }
    clearDeviceCookie(response);

    return response;
  } catch (err) {
    log.error({ err }, "Logout failed");
    return apiError(ErrorCode.SYSTEM_INTERNAL_ERROR, "Logout failed", { requestId });
  }
}

/**
 * POST /api/auth/logout?everywhere=1
 *
 * Optional: log out from EVERY device. Bumps tokenVersion + revokes all
 * trusted devices for this user. Useful for password changes or breach
 * response.
 */
async function logoutEverywhere(userId: string): Promise<void> {
  await Promise.all([
    db.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    }),
    db.trustedDevice.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export async function DELETE(req: NextRequest) {
  // DELETE = "log out everywhere". Convention: same auth, broader scope.
  const requestId = newRequestId();
  const log = logger.child({ route: "/api/auth/logout", requestId, scope: "everywhere" });

  try {
    const token = req.cookies.get("auth_token")?.value;
    if (!token) {
      return apiError(ErrorCode.AUTH_UNAUTHORIZED, "Not authenticated", { requestId });
    }
    const payload = await verifyToken(token);
    if (!payload) {
      return apiError(ErrorCode.AUTH_TOKEN_INVALID, "Invalid token", { requestId });
    }

    await logoutEverywhere(payload.userId);

    if (payload.companyId) {
      await recordAudit({
        companyId: payload.companyId,
        userId: payload.userId,
        action: "auth.logout_everywhere",
        resource: "User",
        resourceId: payload.userId,
        req,
      });
    }

    log.info({ userId: payload.userId }, "Logout-everywhere succeeded");

    const response = NextResponse.json(
      { message: "All sessions revoked" },
      { status: 200, headers: { "X-Request-Id": requestId } }
    );
    response.cookies.set("auth_token", "", { path: "/", maxAge: 0 });
    response.cookies.delete("auth_token");
    clearDeviceCookie(response);
    return response;
  } catch (err) {
    log.error({ err }, "Logout-everywhere failed");
    return apiError(ErrorCode.SYSTEM_INTERNAL_ERROR, "Logout failed", { requestId });
  }
}
