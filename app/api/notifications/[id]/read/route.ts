import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    await db.notification.updateMany({
      where: { id, userId: payload.userId },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
