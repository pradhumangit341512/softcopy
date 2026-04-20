#!/usr/bin/env tsx
/**
 * CLI entry point for running migrations. Invoke via `npm run migrate`.
 *
 * Usage:
 *   npm run migrate         # run all pending migrations
 *
 * In production, this should be called BEFORE the new code goes live — either
 * as a pre-deploy step in CI or as a manual one-off against the production DB
 * when rolling out a schema change. The runner is idempotent so re-runs are
 * safe.
 *
 * Exits with code 0 on success, 1 on any failure (fails fast in CI).
 */

import 'dotenv/config';
import { ALL_MIGRATIONS } from './migrations';
import { runPendingMigrations } from './migrations/_runner';

async function main() {
  console.log(`[migrate] ${ALL_MIGRATIONS.length} migration(s) registered`);

  const report = await runPendingMigrations(ALL_MIGRATIONS);

  console.log(`[migrate] applied:  ${report.applied.length}`);
  console.log(`[migrate] skipped:  ${report.skipped.length}`);

  for (const a of report.applied) {
    console.log(`[migrate]   ✔ ${a.name}`, a.summary);
  }
  for (const s of report.skipped) {
    console.log(`[migrate]   ⏭  ${s} (already applied)`);
  }

  if (report.failed) {
    console.error(`[migrate]   ✖ ${report.failed.name}: ${report.failed.error}`);
    process.exit(1);
  }

  console.log('[migrate] done');
  process.exit(0);
}

main().catch((err) => {
  console.error('[migrate] fatal:', err);
  process.exit(1);
});
