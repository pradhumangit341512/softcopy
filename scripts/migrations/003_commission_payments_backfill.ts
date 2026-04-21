/**
 * Migration 003 — introduce the CommissionPayment ledger and backfill the
 * `paidAmount` field on existing Commission documents.
 *
 * Why this is needed
 * ──────────────────
 * Before this change the Commission model only tracked a boolean-ish
 * `paidStatus` (Pending | Paid) and a single `paymentDate`. Real brokerage
 * deals often settle in instalments ("₹10k of ₹50k paid now, rest next
 * month"), so we're moving to a payment-ledger model:
 *
 *   Commission.paidAmount  – denormalized running total
 *   Commission.paidStatus  – derived: Pending / Partial / Paid
 *   commission_payments    – one row per instalment (amount, paidOn, method, …)
 *
 * What this migration does
 * ────────────────────────
 * 1. Sets `paidAmount` on every Commission doc where the field is missing:
 *      - Commissions with paidStatus='Paid' → paidAmount = commissionAmount
 *      - Everything else                    → paidAmount = 0
 * 2. For every "Paid" commission that has no corresponding payment row yet,
 *    inserts a single historical CommissionPayment that represents the
 *    already-received money. This preserves the existing paymentDate and
 *    paymentReference so the new UI's payment history isn't blank for
 *    deals that closed before the ledger existed.
 *
 * Idempotent via `$exists: false` guards on paidAmount, and a
 * "does a payment row already exist for this commission?" check before
 * inserting the historical row.
 */

import { Prisma } from '@prisma/client';
import { db } from '../../lib/db';
import type { Migration } from './_runner';

/**
 * Seed `paidAmount` for commissions missing the field. Uses a single
 * aggregation-pipeline update so every doc gets its own commissionAmount
 * value when paid, 0 otherwise, without round-tripping through Node.
 */
async function backfillPaidAmount(): Promise<number> {
  const cmd = {
    update: 'Commission',
    updates: [
      {
        q: { paidAmount: { $exists: false } },
        u: [
          {
            $set: {
              paidAmount: {
                $cond: [
                  { $eq: ['$paidStatus', 'Paid'] },
                  '$commissionAmount',
                  0,
                ],
              },
            },
          },
        ],
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

/**
 * Create one CommissionPayment per "Paid" commission that doesn't already
 * have a payment row. Runs in Node (rather than a single aggregation) so
 * we can reuse the commission's own companyId, commissionAmount, and
 * — if present — paymentDate/paymentReference/userId as the recorder.
 */
async function seedHistoricalPayments(): Promise<number> {
  const paidCommissions = await db.commission.findMany({
    where: { paidStatus: 'Paid', deletedAt: null },
    select: {
      id: true,
      companyId: true,
      commissionAmount: true,
      paymentDate: true,
      paymentReference: true,
      userId: true,
      createdAt: true,
    },
  });

  if (paidCommissions.length === 0) return 0;

  // Find commissions that ALREADY have a payment row (from a prior run or
  // partial migration) so we don't double-insert.
  const existing = await db.commissionPayment.findMany({
    where: { commissionId: { in: paidCommissions.map((c) => c.id) } },
    select: { commissionId: true },
  });
  const seenCommissionIds = new Set(existing.map((p) => p.commissionId));

  const toInsert = paidCommissions.filter((c) => !seenCommissionIds.has(c.id));
  if (toInsert.length === 0) return 0;

  // Need SOME recorder userId. Prefer the commission.userId (sales person);
  // fall back to any admin in that company so the FK constraint holds.
  const companyIds = Array.from(new Set(toInsert.map((c) => c.companyId)));
  const admins = await db.user.findMany({
    where: { companyId: { in: companyIds }, role: { in: ['admin', 'superadmin'] }, deletedAt: null },
    select: { id: true, companyId: true },
  });
  const adminByCompany = new Map<string, string>();
  for (const a of admins) {
    if (a.companyId && !adminByCompany.has(a.companyId)) {
      adminByCompany.set(a.companyId, a.id);
    }
  }

  let inserted = 0;
  for (const c of toInsert) {
    const recorder = c.userId ?? adminByCompany.get(c.companyId);
    if (!recorder) {
      // No viable recorder in this company (data quality issue). Skip rather
      // than break the FK — the paidAmount was still set in step 1, so the
      // status computation will still work; payment history just won't show
      // for this specific row.
      continue;
    }
    await db.commissionPayment.create({
      data: {
        commissionId: c.id,
        companyId: c.companyId,
        amount: c.commissionAmount,
        paidOn: c.paymentDate ?? c.createdAt,
        method: null,
        reference: c.paymentReference ?? null,
        notes: 'Migrated from legacy paidStatus=Paid — exact method unknown.',
        recordedBy: recorder,
        deletedAt: null,
      },
    });
    inserted++;
  }
  return inserted;
}

export const migration: Migration = {
  name: '003_commission_payments_backfill',

  async up() {
    const paidAmountBackfilled = await backfillPaidAmount();
    const historicalPaymentsCreated = await seedHistoricalPayments();

    return {
      commissions: { paidAmountBackfilled },
      commissionPayments: { historicalPaymentsCreated },
    };
  },
};
