/**
 * Migration 027 — Unit images & cheque/cash split (Phase 3, items 3.1 / 3.2).
 *
 * Adds `imageUrls String[] @default([])` (public property images) plus the
 * internal price-split fields `splitPrice`, `chequeAmount`, `cashAmount`. All
 * nullable / defaulted, so nothing to backfill. Idempotent no-op per the
 * migration-ledger rule.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '027_unit_images_price_split',

  async up() {
    return { note: 'no-op — imageUrls defaults [] and split fields are nullable' };
  },
};
