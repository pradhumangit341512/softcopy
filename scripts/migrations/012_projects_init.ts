/**
 * Migration 012 — initialise the projects / towers / units collections.
 *
 * F17 introduces the Project → Tower → Unit hierarchy. MongoDB creates
 * each collection on first insert, so this is a registered no-op that
 * keeps the migration ledger aligned with schema versions.
 *
 * Idempotent.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '012_projects_init',
  async up() {
    return {
      note: 'no-op — projects/towers/units collections auto-created on first insert',
    };
  },
};
