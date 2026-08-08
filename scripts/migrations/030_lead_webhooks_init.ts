/**
 * Migration 030 — Lead webhooks init (Gap 1).
 *
 * Brand-new `lead_webhooks` collection for inbound lead capture. All fields are
 * defaulted or set on create, so there is nothing to backfill — Mongo creates
 * the collection on first insert and the @unique index on `token` is enforced
 * by the generated client. Idempotent no-op per the migration-ledger rule.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '030_lead_webhooks_init',

  async up() {
    return { note: 'no-op — lead_webhooks is a new collection; fields defaulted' };
  },
};
