/**
 * Migration runner — idempotent, resumable, production-safe.
 *
 * HOW IT WORKS
 * ────────────
 * 1. Each migration is a file in this directory named `NNN_description.ts`
 *    that exports a `Migration` object: `{ name, up() }`.
 * 2. Applied migrations are tracked in the `_applied_migrations` MongoDB
 *    collection (created on first run). This is a plain raw collection —
 *    NOT a Prisma model — to avoid circularity (migrations can't depend on
 *    the very schema they're migrating).
 * 3. `runPendingMigrations()` discovers all migration files, sorts by name,
 *    skips any already applied, and runs the rest in order.
 * 4. If a migration's `up()` throws, we bail without marking it applied,
 *    so a re-run will retry it.
 *
 * SAFETY PROPERTIES
 * ─────────────────
 * - Idempotent: re-running is a no-op once a migration is recorded.
 * - Ordered: files sorted by name → timestamp-prefixed filenames run oldest first.
 * - Atomic-per-migration: partial failure leaves that migration un-marked
 *   so the next run retries it. Be sure each `up()` is itself idempotent
 *   (use `$exists: false` guards etc.) so retries don't double-apply work.
 * - Never destructive: migrations should SET missing fields, not DELETE rows.
 *
 * ADDING A MIGRATION
 * ──────────────────
 * 1. Create `scripts/migrations/NNN_what_it_does.ts` where NNN is the next
 *    sequential number (see existing files).
 * 2. Export a `Migration` — see `000_backfill_schema_fields.ts` as template.
 * 3. Run locally via POST /api/dev/run-migrations.
 * 4. In production, run via `npm run migrate` as part of deploy.
 */

import { Prisma } from '@prisma/client';
import { db } from '../../lib/db';

export interface Migration {
  /** Unique, immutable name. Convention: NNN_snake_case (e.g. '000_backfill_schema_fields'). */
  name: string;
  /** Idempotent migration body. Returns a summary object the runner echoes back. */
  up: () => Promise<Record<string, unknown>>;
}

const APPLIED_COLLECTION = '_applied_migrations';

/** Ensure the tracking collection exists. Creating is implicit on first insert,
 *  so nothing to do here — left as a hook for future index creation. */
async function ensureAppliedCollection(): Promise<void> {
  // No-op for now. Could add an index on `name` for faster lookups if this
  // collection ever grows large.
}

/** Has this migration already been applied? */
async function isApplied(name: string): Promise<boolean> {
  const result = (await db.$runCommandRaw({
    count: APPLIED_COLLECTION,
    query: { name },
  } as unknown as Prisma.InputJsonObject)) as { n?: number };
  return (result.n ?? 0) > 0;
}

/** Mark a migration as applied. Called AFTER `up()` completes successfully. */
async function markApplied(name: string, summary: Record<string, unknown>): Promise<void> {
  await db.$runCommandRaw({
    insert: APPLIED_COLLECTION,
    documents: [
      {
        name,
        summary,
        appliedAt: { $date: new Date().toISOString() },
      },
    ],
  } as unknown as Prisma.InputJsonObject);
}

export interface RunReport {
  applied: Array<{ name: string; summary: Record<string, unknown> }>;
  skipped: string[];
  failed: { name: string; error: string } | null;
}

/**
 * Run all pending migrations in order. Stops at the first failure so the
 * caller can inspect the error and retry.
 */
export async function runPendingMigrations(
  migrations: Migration[]
): Promise<RunReport> {
  await ensureAppliedCollection();

  const report: RunReport = { applied: [], skipped: [], failed: null };

  // Sort by name so number prefixes enforce order.
  const ordered = [...migrations].sort((a, b) => a.name.localeCompare(b.name));

  for (const m of ordered) {
    if (await isApplied(m.name)) {
      report.skipped.push(m.name);
      continue;
    }

    try {
      const summary = await m.up();
      await markApplied(m.name, summary);
      report.applied.push({ name: m.name, summary });
    } catch (err) {
      report.failed = {
        name: m.name,
        error: err instanceof Error ? err.message : String(err),
      };
      return report; // Stop on first failure — leave remaining unapplied.
    }
  }

  return report;
}
