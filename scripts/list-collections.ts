#!/usr/bin/env tsx
/**
 * Ad-hoc diagnostic: list every MongoDB collection in the current DB and
 * show row counts for both PascalCase and lowercase-plural names so we can
 * see which naming convention Prisma actually maps models onto.
 */

import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { db } from '../lib/db';

async function main() {
  const result = (await db.$runCommandRaw({
    listCollections: 1,
    filter: {},
  } as unknown as Prisma.InputJsonObject)) as {
    cursor?: { firstBatch?: Array<{ name: string; type?: string }> };
  };

  const names = (result.cursor?.firstBatch ?? []).map((c) => c.name).sort();
  console.log('[diagnose] Collections in DB:');
  for (const n of names) console.log('  -', n);

  const probe = ['Client', 'clients', 'Property', 'properties', 'Commission', 'commissions', 'User', 'users'];
  console.log('\n[diagnose] Row counts by probe name:');
  for (const coll of probe) {
    try {
      const countRes = (await db.$runCommandRaw({
        count: coll,
      } as unknown as Prisma.InputJsonObject)) as { n?: number; ok?: number };
      console.log(`  ${coll.padEnd(14)} = ${countRes.n ?? 0}`);
    } catch {
      console.log(`  ${coll.padEnd(14)} = (collection not found)`);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('[diagnose] fatal:', e);
  process.exit(1);
});
