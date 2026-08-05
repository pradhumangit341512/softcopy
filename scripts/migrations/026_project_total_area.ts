/**
 * Migration 026 — Project total area (Phase 2, item 2.4).
 *
 * Adds `totalArea Float?` + `totalAreaUnit String?` to Project. Both nullable,
 * nothing to backfill. Registered as an idempotent no-op per the ledger rule.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '026_project_total_area',

  async up() {
    return { note: 'no-op — totalArea/totalAreaUnit are nullable' };
  },
};
