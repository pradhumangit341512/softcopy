/**
 * /api/dev/backfill-fields  — DEV-ONLY one-shot migration.
 *
 * Older documents in MongoDB don't have the `deletedAt` / `tokenVersion` /
 * `emailVerified` fields because they predate the Prisma schema additions.
 * MongoDB doesn't auto-add new fields to existing documents — Prisma's
 * `{deletedAt: null}` filter then doesn't match them, and they vanish from
 * every list endpoint.
 *
 * This endpoint uses raw MongoDB `$runCommandRaw` to find documents where
 * the field doesn't exist (`$exists: false`) and SET it to its default —
 * effectively backfilling the schema additions onto legacy data.
 *
 * Triple-gated on dev-local. Returns 404 in any deployed env.
 *
 * GET  → reports how many docs are missing each field (read-only diagnostic)
 * POST → runs the backfill (sets deletedAt: null on missing docs, etc.)
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const IS_DEV_LOCAL =
  process.env.NODE_ENV === 'development' &&
  !process.env.VERCEL &&
  !process.env.VERCEL_ENV;

function devOnlyGuard(): NextResponse | null {
  if (!IS_DEV_LOCAL) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return null;
}

/**
 * Run a raw MongoDB updateMany. Prisma's typed filters don't expose
 * `$exists`, so we drop to the raw command for the missing-field case.
 */
async function backfillCollection(
  collection: string,
  field: string,
  defaultValue: unknown
): Promise<number> {
  // Prisma's $runCommandRaw types InputJsonValue narrowly and rejects
  // nested operator objects ($set). The MongoDB protocol accepts them
  // fine — cast through Prisma.InputJsonObject.
  const cmd = {
    update: collection,
    updates: [
      {
        q: { [field]: { $exists: false } },
        u: { $set: { [field]: defaultValue } },
        multi: true,
      },
    ],
  } as unknown as Prisma.InputJsonObject;

  const result = (await db.$runCommandRaw(cmd)) as {
    nModified?: number;
    n?: number;
  };

  return result.nModified ?? result.n ?? 0;
}

async function countMissing(collection: string, field: string): Promise<number> {
  const cmd = {
    count: collection,
    query: { [field]: { $exists: false } },
  } as unknown as Prisma.InputJsonObject;

  const result = (await db.$runCommandRaw(cmd)) as { n?: number };
  return result.n ?? 0;
}

// ==================== GET — diagnostic ====================

export async function GET() {
  const guard = devOnlyGuard();
  if (guard) return guard;

  const checks = await Promise.all([
    countMissing('clients', 'deletedAt'),
    countMissing('properties', 'deletedAt'),
    countMissing('commissions', 'deletedAt'),
    countMissing('users', 'deletedAt'),
    countMissing('users', 'tokenVersion'),
    countMissing('users', 'emailVerified'),
  ]);

  const [clientsDeletedAt, propsDeletedAt, comsDeletedAt, usersDeletedAt, usersTokenVersion, usersEmailVerified] = checks;

  const total = checks.reduce((s, n) => s + n, 0);

  return NextResponse.json({
    success: true,
    missing: {
      clients:     { deletedAt: clientsDeletedAt },
      properties:  { deletedAt: propsDeletedAt },
      commissions: { deletedAt: comsDeletedAt },
      users:       {
        deletedAt:     usersDeletedAt,
        tokenVersion:  usersTokenVersion,
        emailVerified: usersEmailVerified,
      },
    },
    total,
    hint:
      total > 0
        ? `Found ${total} documents missing required fields. POST to this endpoint to backfill.`
        : 'All documents have the expected fields. No backfill needed.',
  });
}

// ==================== POST — execute backfill ====================

export async function POST() {
  const guard = devOnlyGuard();
  if (guard) return guard;

  const now = new Date();

  // Run all backfills in parallel — each is a single atomic MongoDB updateMany.
  const [
    clientsDeletedAt,
    propsDeletedAt,
    comsDeletedAt,
    usersDeletedAt,
    usersTokenVersion,
    usersEmailVerified,
  ] = await Promise.all([
    backfillCollection('clients',     'deletedAt',     null),
    backfillCollection('properties',  'deletedAt',     null),
    backfillCollection('commissions', 'deletedAt',     null),
    backfillCollection('users',       'deletedAt',     null),
    backfillCollection('users',       'tokenVersion',  0),
    // For users that predate email verification, treat them as already
    // verified — they were active in the system before this gate existed.
    backfillCollection('users',       'emailVerified', { $date: now.toISOString() }),
  ]);

  return NextResponse.json({
    success: true,
    backfilled: {
      clients:     { deletedAt: clientsDeletedAt },
      properties:  { deletedAt: propsDeletedAt },
      commissions: { deletedAt: comsDeletedAt },
      users:       {
        deletedAt:     usersDeletedAt,
        tokenVersion:  usersTokenVersion,
        emailVerified: usersEmailVerified,
      },
    },
    total:
      clientsDeletedAt +
      propsDeletedAt +
      comsDeletedAt +
      usersDeletedAt +
      usersTokenVersion +
      usersEmailVerified,
    nextStep:
      'Reload /dashboard/all-leads, /dashboard/inventory, /dashboard/commissions — the data should now appear.',
  });
}
