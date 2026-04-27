/**
 * Migration 006 — introduce commission splits + payouts.
 *
 * Why this is needed
 * ──────────────────
 * Phase 2 of the commission upgrade. We've already separated the buyer→
 * builder ledger (DealPayment, migration 005) from the builder→brokerage
 * ledger (CommissionPayment, migration 003). Now we add the third
 * money-flow: the brokerage→sub-broker ledger.
 *
 *   CommissionSplit         – the share each participant gets (50% you,
 *                              30% Broker A, 20% Broker B …)
 *   CommissionSplitPayout   – the ledger of when each share is actually
 *                              paid out
 *
 * What this migration does
 * ────────────────────────
 * For every existing Commission, create exactly one default 100% split
 * pointing to the commission's recorded `userId` (the salesperson who
 * closed it) — or the literal text "Owner" with `participantUserId: null`
 * if no userId is on the commission. This way historical deals show a
 * populated splits list immediately rather than blank, and the running
 * `paidOut` is correctly 0 from day one.
 *
 * The new collections themselves are empty until the broker either
 * records a payout or edits the default split — MongoDB creates the
 * collections on first insert.
 *
 * Idempotent: only seeds a split when none exists for that commission.
 * Safe to re-run.
 */

import { db } from '../../lib/db';
import type { Migration } from './_runner';

export const migration: Migration = {
  name: '006_commission_splits_init',

  async up() {
    // Pull every non-deleted commission with the minimum fields needed to
    // seed its default split. We do NOT scope by company here — this is a
    // platform-wide migration that should touch every tenant exactly once.
    const commissions = await db.commission.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        companyId: true,
        commissionAmount: true,
        userId: true,
        salesPersonName: true,
      },
    });

    let createdSplits = 0;
    let alreadyHadSplit = 0;

    for (const c of commissions) {
      // Idempotency guard: skip commissions that already have any non-deleted split.
      const existing = await db.commissionSplit.count({
        where: { commissionId: c.id, deletedAt: null },
      });
      if (existing > 0) {
        alreadyHadSplit += 1;
        continue;
      }

      // Pick the most descriptive label available. We deliberately fall
      // back to "Owner" (not "Unknown") for legacy rows missing both a
      // userId and a salesPersonName, since the brokerage admin is the
      // implicit owner before sub-broker tracking existed.
      const participantName =
        (c.salesPersonName?.trim()) ||
        (c.userId ? 'Salesperson' : 'Owner');

      await db.commissionSplit.create({
        data: {
          commissionId: c.id,
          companyId: c.companyId,
          participantUserId: c.userId ?? null,
          participantName,
          sharePercent: 100,
          shareAmount: c.commissionAmount,
          paidOut: 0,
          status: 'Pending',
          deletedAt: null,
        },
      });
      createdSplits += 1;
    }

    return {
      commissionsScanned: commissions.length,
      defaultSplitsCreated: createdSplits,
      alreadyHadSplit,
    };
  },
};
