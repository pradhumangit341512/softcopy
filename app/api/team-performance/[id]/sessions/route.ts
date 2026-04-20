/**
 * GET /api/team-performance/[id]/sessions
 *
 * Returns last 7 days of login/logout sessions for a specific team member.
 * Admin/superadmin only. Company-scoped via JWT.
 *
 * Response:
 * {
 *   sessions: UserSession[],
 *   dailySummary: { date, sessions, totalMinutes, isToday }[],
 *   weekSummary: { totalDays, totalMinutes, totalHours, avgHoursPerDay }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (payload.role !== 'admin' && payload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }

    // Verify the target user belongs to the same company
    const targetUser = await db.user.findFirst({
      where: { id, companyId: payload.companyId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Last 7 days boundary
    const now = new Date();
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const sessions = await db.userSession.findMany({
      where: {
        userId: id,
        loginAt: { gte: sevenDaysAgo },
      },
      select: {
        id: true,
        loginAt: true,
        logoutAt: true,
        duration: true,
        ipAddress: true,
      },
      orderBy: { loginAt: 'desc' },
      take: 100,
    });

    // Group sessions by date and compute per-day summary
    const dayMap = new Map<string, {
      date: string;
      dayLabel: string;
      sessions: typeof sessions;
      totalMinutes: number;
      isToday: boolean;
    }>();

    // Pre-fill all 7 days (so days with no login show as empty)
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const isToday = i === 0;
      const isYesterday = i === 1;

      let dayLabel: string;
      if (isToday) dayLabel = 'Today';
      else if (isYesterday) dayLabel = 'Yesterday';
      else dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });

      dayMap.set(key, { date: key, dayLabel, sessions: [], totalMinutes: 0, isToday });
    }

    // Place sessions into their day buckets
    for (const s of sessions) {
      const key = s.loginAt.toISOString().slice(0, 10);
      const bucket = dayMap.get(key);
      if (bucket) {
        bucket.sessions.push(s);
        if (s.duration) {
          bucket.totalMinutes += s.duration;
        } else if (s.logoutAt) {
          bucket.totalMinutes += Math.round((s.logoutAt.getTime() - s.loginAt.getTime()) / 60000);
        } else {
          // Still online — count from login to now
          bucket.totalMinutes += Math.round((now.getTime() - s.loginAt.getTime()) / 60000);
        }
      }
    }

    const dailySummary = Array.from(dayMap.values());

    // Week summary
    const activeDays = dailySummary.filter((d) => d.sessions.length > 0).length;
    const totalMinutes = dailySummary.reduce((sum, d) => sum + d.totalMinutes, 0);
    const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

    return NextResponse.json({
      sessions,
      dailySummary,
      weekSummary: {
        totalDays: activeDays,
        totalMinutes,
        totalHours,
        avgHoursPerDay: activeDays > 0 ? Math.round(totalHours / activeDays * 10) / 10 : 0,
      },
    });
  } catch (error) {
    console.error('Session history error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
