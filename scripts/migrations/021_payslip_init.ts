/**
 * Migration 021 — Payslip init (Enterprise HR plan, P3).
 *
 * Adds the `payslips` collection (one snapshot per member per month, with
 * embedded PayslipLine[]). Brand-new model, all fields defaulted/nullable, so
 * nothing to backfill — Mongo creates it on first generate and enforces the
 * @@unique([userId, period]) index via the generated client.
 *
 * Idempotent no-op, registered per the migration-ledger rule.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '021_payslip_init',

  async up() {
    return { note: 'no-op — payslips is a new collection; fields defaulted/nullable' };
  },
};
