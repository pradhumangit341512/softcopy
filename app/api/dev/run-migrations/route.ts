/**
 * /api/dev/run-migrations
 *
 * Dev-local endpoint that runs all pending migrations against the current
 * database. Returns a report of what was applied, what was skipped (already
 * applied), and which (if any) failed.
 *
 * Triple-gated on dev-local. On Vercel or any other deployed env, returns
 * 404 so the endpoint looks nonexistent.
 *
 * GET  → list status (applied + pending) — read-only
 * POST → execute pending migrations
 *
 * For production, use `npm run migrate` instead (see scripts/migrate.ts).
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { ALL_MIGRATIONS } from '../../../../scripts/migrations';
import { runPendingMigrations } from '../../../../scripts/migrations/_runner';

export const runtime = 'nodejs';

const IS_DEV_LOCAL =
  process.env.NODE_ENV === 'development' &&
  !process.env.VERCEL &&
  !process.env.VERCEL_ENV;

function devOnlyGuard(): NextResponse | null {
  if (!IS_DEV_LOCAL) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return null;
}

// ==================== GET — status ====================

export async function GET() {
  const guard = devOnlyGuard();
  if (guard) return guard;

  // List applied migration records directly from the tracking collection.
  const raw = (await db.$runCommandRaw({
    find: '_applied_migrations',
    filter: {},
    projection: { name: 1, appliedAt: 1 },
    sort: { name: 1 },
  } as unknown as Prisma.InputJsonObject)) as {
    cursor?: { firstBatch?: Array<{ name: string; appliedAt?: unknown }> };
  };

  const applied = raw.cursor?.firstBatch ?? [];
  const appliedNames = new Set(applied.map((r) => r.name));
  const pending = ALL_MIGRATIONS.filter((m) => !appliedNames.has(m.name)).map(
    (m) => m.name
  );

  return NextResponse.json({
    success: true,
    applied,
    pending,
    hint:
      pending.length > 0
        ? `${pending.length} migration(s) pending. POST to this endpoint to run them.`
        : 'All migrations applied.',
  });
}

// ==================== POST — run pending ====================

export async function POST() {
  const guard = devOnlyGuard();
  if (guard) return guard;

  const report = await runPendingMigrations(ALL_MIGRATIONS);

  return NextResponse.json({
    success: report.failed === null,
    ...report,
  });
}
