/**
 * Migration 001 — backfill the new Company subscription/seat fields
 * introduced in the manual-onboarding pivot (April 2026).
 *
 * Adds to every existing Company doc:
 *   - subscriptionUntil  → mirrored from existing subscriptionExpiry
 *   - seatLimit          → 999 (grandfathered, unlimited until superadmin sets a cap)
 *   - plan               → 'standard'
 *   - monthlyFee         → null (superadmin fills in later)
 *   - notes              → null
 *   - onboardedBy        → null (legacy, unknown)
 *
 * Idempotent: each `$set` is gated on `$exists: false`, so re-runs are no-ops.
 *
 * Why this matters: without this backfill, MongoDB leaves the new fields
 * MISSING on legacy company docs. Any future query like
 * `where: { status: 'active', subscriptionUntil: { gte: now } }`
 * would silently drop those companies — same class of bug we hit with
 * `Client.deletedAt` previously.
 */

import { Prisma } from '@prisma/client';
import { db } from '../../lib/db';
import type { Migration } from './_runner';

async function backfillField(
  collection: string,
  field: string,
  setOp: unknown
): Promise<number> {
  const cmd = {
    update: collection,
    updates: [
      {
        q: { [field]: { $exists: false } },
        u: { $set: { [field]: setOp } },
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
 * Special case: subscriptionUntil seeds from the legacy subscriptionExpiry
 * value (per-document), not a constant. Done in a single aggregation pipeline
 * update so we don't have to round-trip every doc.
 */
async function copySubscriptionExpiryToUntil(): Promise<number> {
  const cmd = {
    update: 'Company',
    updates: [
      {
        q: { subscriptionUntil: { $exists: false } },
        u: [
          {
            $set: {
              subscriptionUntil: '$subscriptionExpiry',
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

export const migration: Migration = {
  name: '001_seed_company_subscription_defaults',

  async up() {
    const [
      companiesSubUntil,
      companiesSeatLimit,
      companiesPlan,
      companiesMonthlyFee,
      companiesNotes,
      companiesOnboardedBy,
    ] = await Promise.all([
      copySubscriptionExpiryToUntil(),
      backfillField('Company', 'seatLimit',   999),
      backfillField('Company', 'plan',        'standard'),
      backfillField('Company', 'monthlyFee',  null),
      backfillField('Company', 'notes',       null),
      backfillField('Company', 'onboardedBy', null),
    ]);

    return {
      companies: {
        subscriptionUntil: companiesSubUntil,
        seatLimit:         companiesSeatLimit,
        plan:              companiesPlan,
        monthlyFee:        companiesMonthlyFee,
        notes:             companiesNotes,
        onboardedBy:       companiesOnboardedBy,
      },
    };
  },
};
