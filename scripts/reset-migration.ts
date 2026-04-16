#!/usr/bin/env tsx
/**
 * One-off utility to remove a stale entry from `_applied_migrations` so a
 * migration re-runs on the next `npm run migrate`. Use this ONLY when a
 * migration's `up()` body has been corrected and the prior run was a no-op.
 * Never use on a migration whose prior run actually mutated data — that
 * would re-apply work and is not what this script is for.
 *
 * Usage: npx tsx scripts/reset-migration.ts <migration_name>
 */

import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { db } from '../lib/db';

async function main() {
  const name = process.argv[2];
  if (!name) {
    console.error('Usage: npx tsx scripts/reset-migration.ts <migration_name>');
    process.exit(1);
  }

  const result = (await db.$runCommandRaw({
    delete: '_applied_migrations',
    deletes: [{ q: { name }, limit: 0 }],
  } as unknown as Prisma.InputJsonObject)) as { n?: number };

  console.log(`[reset-migration] removed ${result.n ?? 0} record(s) for "${name}"`);
  process.exit(0);
}

main().catch((e) => {
  console.error('[reset-migration] fatal:', e);
  process.exit(1);
});
