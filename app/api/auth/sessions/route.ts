import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, generateToken } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { ErrorCode, apiError, newRequestId } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getClientIp } from '@/lib/rate-limit';
import { clearDeviceCookie } from '@/lib/trusted-device';

export const runtime = 'nodejs';

/**
 * GET /api/auth/sessions
 *
 * Returns active sessions for the current user. With single-session
 * enforcement this should always be exactly 1 (the current device).
 *
 * Safety net: if stale sessions exist from before the latest tokenVersion
 * bump (ghost sessions whose JWTs are already invalid), close them on read
 * so the UI stays accurate.
 */
export async function GET(req: NextRequest) {
  const requestId = newRequestId();

  const { authorized, payload } = await requireAuth();
  if (!authorized || !payload) {
    return apiError(ErrorCode.AUTH_UNAUTHORIZED, 'Not authenticated', { requestId });
  }

  const openSessions = await db.userSession.findMany({
    where: { userId: payload.userId, logoutAt: { isSet: false } },
    orderBy: { loginAt: 'desc' },
    select: {
      id: true,
      loginAt: true,
      ipAddress: true,
      userAgent: true,
    },
  });

  // The most recent session is the valid one (created during the latest login
  // which bumped tokenVersion). Any older open sessions are ghosts — their
  // JWTs were invalidated by the tokenVersion bump but the UserSession record
  // was never closed (e.g. created before single-session enforcement).
  const now = new Date();
  const validSession = openSessions[0]; // most recent by loginAt desc
  const ghostSessions = openSessions.slice(1);

  if (ghostSessions.length > 0) {
    await Promise.all(
      ghostSessions.map((s) =>
        db.userSession.update({
          where: { id: s.id },
          data: {
            logoutAt: now,
            duration: Math.round((now.getTime() - s.loginAt.getTime()) / 60000),
          },
        }).catch(() => {})
      )
    );
  }

  const currentIp = getClientIp(req);
  const currentUa = req.headers.get('user-agent') ?? '';

  const sessions = validSession
    ? [{
        id: validSession.id,
        loginAt: validSession.loginAt.toISOString(),
        ipAddress: validSession.ipAddress ?? null,
        device: parseDevice(validSession.userAgent),
        isCurrent: validSession.ipAddress === currentIp && validSession.userAgent === currentUa,
      }]
    : [];

  return NextResponse.json(
    { sessions },
    { status: 200, headers: { 'X-Request-Id': requestId } }
  );
}

/**
 * DELETE /api/auth/sessions
 *
 * Revoke all sessions: closes ALL open session records, bumps tokenVersion,
 * then re-issues a fresh JWT and creates a new session for the current caller.
 * No IP/UA matching — close everything, start fresh.
 */
export async function DELETE(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: '/api/auth/sessions', requestId, scope: 'revoke-others' });

  const { authorized, payload } = await requireAuth();
  if (!authorized || !payload) {
    return apiError(ErrorCode.AUTH_UNAUTHORIZED, 'Not authenticated', { requestId });
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: { company: { select: { subscriptionExpiry: true } } },
  });
  if (!user) {
    return apiError(ErrorCode.AUTH_UNAUTHORIZED, 'User not found', { requestId });
  }

  const now = new Date();

  // 1. Bump tokenVersion → every existing JWT becomes invalid
  const updated = await db.user.update({
    where: { id: user.id },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });

  // 2. Revoke all trusted devices
  await db.trustedDevice.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: now },
  });

  // 3. Close ALL open sessions — no exceptions, no IP matching
  const openSessions = await db.userSession.findMany({
    where: { userId: user.id, logoutAt: { isSet: false } },
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
        }).catch(() => {})
      )
    );
  }

  // 4. Create a fresh session for the current caller
  const companyId = user.companyId ?? '';
  if (companyId) {
    await db.userSession.create({
      data: {
        userId: user.id,
        companyId,
        loginAt: now,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get('user-agent') ?? undefined,
      },
    }).catch(() => {});
  }

  // 5. Re-issue JWT with new tokenVersion
  const newToken = await generateToken(
    user.id,
    companyId,
    user.role,
    user.email,
    {
      subscriptionExpiry: user.company?.subscriptionExpiry ?? null,
      tokenVersion: updated.tokenVersion,
    }
  );

  if (payload.companyId) {
    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'auth.revoke_other_sessions',
      resource: 'User',
      resourceId: payload.userId,
      req,
    });
  }

  log.info({ userId: user.id, closedCount: openSessions.length }, 'All sessions revoked, fresh session created');

  const response = NextResponse.json(
    { message: 'All other sessions have been revoked' },
    { status: 200, headers: { 'X-Request-Id': requestId } }
  );

  response.cookies.set('auth_token', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  clearDeviceCookie(response);
  return response;
}

function parseDevice(ua: string | null): string {
  if (!ua) return 'Unknown device';

  let browser = 'Unknown browser';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';

  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}
