/**
 * Migration 011 — initialise the broker_requirements collection.
 *
 * F18 introduces the BrokerRequirement model. MongoDB creates the
 * collection on first insert, so this is a no-op registered to keep
 * the migration ledger aligned with schema versions per the project's
 * "every Prisma change ships a migration entry" rule.
 *
 * Idempotent.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '011_broker_requirements_init',

  async up() {
    return {
      note: 'no-op — broker_requirements collection auto-created on first insert',
    };
  },
};
