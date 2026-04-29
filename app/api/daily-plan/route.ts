/**
 * /api/daily-plan
 *
 * GET   ?date=YYYY-MM-DD → today's (or a specific day's) plan for the caller
 * PUT                    → upsert morning and/or evening for the given day
 *
 * One row per (userId, dateKey). Morning and evening are JSON blobs so we
 * can evolve the form fields without migrations.
 *
 * Feature gate: `feature.daily_plan`. Anyone in the company with the feature
 * enabled may save their own row — admins do not write on behalf of users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { parseBody, upsertDailyPlanSchema } from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

/** Compute today's dateKey in the server's local timezone. */
function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKeyToDate(key: string): Date {
  // Anchor to UTC midnight so the date column sorts predictably.
  return new Date(`${key}T00:00:00.000Z`);
}

// ==================== GET ====================

export async function GET(req: NextRequest) {
  const payload = await verifyAuth(req);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const gate = await requireFeature(payload.companyId, 'feature.daily_plan');
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const dateKey = searchParams.get('date') ?? todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const plan = await db.dailyPlan.findUnique({
    where: { userId_dateKey: { userId: payload.userId, dateKey } },
  });

  return NextResponse.json({
    dateKey,
    plan: plan ?? null,
  });
}

// ==================== PUT (upsert) ====================

export async function PUT(req: NextRequest) {
  const payload = await verifyAuth(req);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const gate = await requireFeature(payload.companyId, 'feature.daily_plan');
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, upsertDailyPlanSchema);
  if (!parsed.ok) return parsed.response;

  const dateKey = parsed.data.dateKey ?? todayKey();
  const date = parseDateKeyToDate(dateKey);

  // Merge into existing row so a morning-only PUT doesn't wipe evening,
  // and vice versa. Prisma upsert handles the create case; the merge
  // happens via spread in the update branch.
  const existing = await db.dailyPlan.findUnique({
    where: { userId_dateKey: { userId: payload.userId, dateKey } },
  });

  const morning = parsed.data.morning ?? (existing?.morning as object | null) ?? null;
  const evening = parsed.data.evening ?? (existing?.evening as object | null) ?? null;

  const saved = await db.dailyPlan.upsert({
    where: { userId_dateKey: { userId: payload.userId, dateKey } },
    create: {
      userId: payload.userId,
      companyId: payload.companyId,
      dateKey,
      date,
      morning: morning ?? undefined,
      evening: evening ?? undefined,
    },
    update: {
      morning: morning ?? undefined,
      evening: evening ?? undefined,
    },
  });

  return NextResponse.json({ success: true, plan: saved });
}
