/**
 * Migration 005 — introduce the buyer→builder deal-payment ledger.
 *
 * Why this is needed
 * ──────────────────
 * Phase 1 of the commission upgrade: alongside the existing builder→broker
 * CommissionPayment ledger, we now also track the buyer's instalments to
 * the BUILDER (the deal amount itself — token, agreement, registry, loan
 * disbursement, possession). Each instalment is a row in the brand-new
 * `deal_payments` collection.
 *
 * On the parent Commission doc we add two denormalized fields kept in sync
 * by the new /api/commissions/:id/deal-payments routes:
 *
 *   Commission.dealAmountPaid  – running total of non-deleted DealPayment.amount
 *   Commission.dealStatus      – Open | InProgress | Completed
 *
 * What this migration does
 * ────────────────────────
 * 1. Backfills `dealAmountPaid: 0` on every Commission doc missing the
 *    field. We don't pull historical numbers — pre-existing deals start
 *    "Open"; the broker can backfill instalments through the UI when they
 *    care about the audit trail.
 * 2. Backfills `dealStatus: "Open"` on every Commission doc missing it.
 *
 * The `deal_payments` collection itself is empty until the first row is
 * written via the API; MongoDB creates collections on first insert.
 *
 * Idempotent via `$exists: false` guards. Safe to re-run.
 */

import { Prisma } from '@prisma/client';
import { db } from '../../lib/db';
import type { Migration } from './_runner';

async function backfillField(
  field: string,
  defaultValue: unknown,
): Promise<number> {
  const cmd = {
    update: 'Commission',
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

export const migration: Migration = {
  name: '005_deal_payments_init',

  async up() {
    const dealAmountPaid = await backfillField('dealAmountPaid', 0);
    const dealStatus = await backfillField('dealStatus', 'Open');
    return {
      commissions_dealAmountPaid: dealAmountPaid,
      commissions_dealStatus: dealStatus,
    };
  },
};
