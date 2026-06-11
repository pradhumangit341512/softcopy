/**
 * Migration 019 — Attendance init (Enterprise HR plan, P1).
 *
 * Adds the `attendance` collection (one row per member per day). Brand-new
 * model; every field has a default or is nullable, so there is nothing to
 * backfill — Mongo creates the collection on first insert and enforces the
 * @@unique([userId, date]) index via the generated Prisma client.
 *
 * Registered per the "every Prisma change ships with a migration" rule.
 * Idempotent no-op.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '019_attendance_init',

  async up() {
    return { note: 'no-op — attendance is a new collection; fields defaulted/nullable' };
  },
};
