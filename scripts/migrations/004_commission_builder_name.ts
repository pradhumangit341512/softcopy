/**
 * Migration 004 — introduce the optional `builderName` field on Commission.
 *
 * Why this is needed
 * ──────────────────
 * Real-estate deals always have a builder/developer counterparty. Until now
 * we only stored the client (buyer) on each Commission. The new "Manage Deal"
 * modal surfaces the builder, and the upcoming "deals by builder" report
 * groups commissions by it.
 *
 * What this migration does
 * ────────────────────────
 * Sets `builderName: null` on every Commission doc where the field is
 * missing. The Prisma read path treats missing-field and null identically,
 * but normalising the shape avoids surprises in raw Mongo aggregations
 * (which DO distinguish missing-vs-null) used by future reports.
 *
 * Idempotent via `$exists: false` — safe to re-run.
 */

import { Prisma } from '@prisma/client';
import { db } from '../../lib/db';
import type { Migration } from './_runner';

async function backfillBuilderName(): Promise<number> {
  const cmd = {
    update: 'Commission',
    updates: [
      {
        q: { builderName: { $exists: false } },
        u: { $set: { builderName: null } },
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

export const migration: Migration = {
  name: '004_commission_builder_name',

  async up() {
    const backfilled = await backfillBuilderName();
    return { commissionsBackfilled: backfilled };
  },
};
