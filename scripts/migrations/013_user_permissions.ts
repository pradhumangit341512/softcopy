/**
 * Migration 013 — initialise User.permissions for F24.
 *
 * Adds a nullable Json field. No backfill needed — null reads as "no
 * overrides" in lib/permissions.ts and behaviour falls back to role
 * defaults. Registered to keep the migration ledger aligned with schema
 * versions per the project's "every Prisma change ships a migration" rule.
 *
 * Idempotent.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '013_user_permissions',
  async up() {
    return {
      note: 'no-op — User.permissions is nullable and defaults to no-overrides',
    };
  },
};
