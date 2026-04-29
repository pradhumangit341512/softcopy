/**
 * /api/superadmin/feedback — moderation queue.
 *
 * GET → list feedback rows for moderation. Supports `status=pending`
 *       (default) / `approved` / `rejected` / `all` and pagination.
 *
 * No POST here — public POST lives at /api/feedback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/superadmin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status') ?? 'pending';
  const page = Math.max(1, Number(sp.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit') || 20)));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status !== 'all') {
    where.status = status;
  }

  const [items, total] = await Promise.all([
    db.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.feedback.count({ where }),
  ]);

  return NextResponse.json({
    items,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}
