/**
 * GET /api/notifications
 *
 * Returns the current user's notifications. Triggers compute on each call
 * (idempotent — no duplicates thanks to unique constraint).
 * Sorted: unread first, then newest. Limit 20.
 *
 * POST /api/notifications/mark-all-read — marks all as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { computeNotifications } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Compute fresh notifications (idempotent upsert)
    await computeNotifications(payload.userId, payload.companyId);

    // Fetch latest 20, unread first
    const notifications = await db.notification.findMany({
      where: { userId: payload.userId },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 20,
    });

    const unreadCount = await db.notification.count({
      where: { userId: payload.userId, isRead: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await db.notification.updateMany({
      where: { userId: payload.userId, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
