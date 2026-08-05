/**
 * Migration 025 — Unit deal source & tags (Phase 2, items 2.1 / 2.2).
 *
 * Adds `tags String[] @default([])` (public location/feature tags) plus the
 * internal deal-source fields `dealType`, `dealerName`, `dealerPhone`,
 * `brokerageSharePct`. All nullable / defaulted, so nothing to backfill —
 * Mongo has them absent until a unit is edited. Registered as an idempotent
 * no-op per the migration-ledger rule.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '025_unit_deal_tags',

  async up() {
    return { note: 'no-op — tags default [] and deal fields are nullable' };
  },
};
