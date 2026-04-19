/**
 * POST /api/cron/cleanup-sessions
 *
 * Runs daily at 2 AM (via Vercel Cron). Deletes UserSession records
 * older than 7 days to keep the DB lean. Also closes any orphaned
 * sessions (loginAt > 24h ago with no logoutAt) — these happen when
 * a user's browser crashes or they lose connection without logging out.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Delete sessions older than 7 days
    const deleted = await db.userSession.deleteMany({
      where: { loginAt: { lt: sevenDaysAgo } },
    });

    // 2. Close orphaned sessions (open for > 24h — user didn't log out)
    const orphanedSessions = await db.userSession.findMany({
      where: { logoutAt: null, loginAt: { lt: oneDayAgo } },
      select: { id: true, loginAt: true },
    });

    let orphansClosed = 0;
    if (orphanedSessions.length > 0) {
      await Promise.all(
        orphanedSessions.map((s) =>
          db.userSession.update({
            where: { id: s.id },
            data: {
              logoutAt: new Date(s.loginAt.getTime() + 10 * 60 * 60 * 1000), // assume 10h workday
              duration: 600,
            },
          }).catch(() => {})
        )
      );
      orphansClosed = orphanedSessions.length;
    }

    console.log(`[cleanup-sessions] deleted: ${deleted.count}, orphans closed: ${orphansClosed}`);

    return NextResponse.json({
      success: true,
      deleted: deleted.count,
      orphansClosed,
    });
  } catch (error) {
    console.error('[cleanup-sessions] error:', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
