/**
 * Migration 002 — no data backfill needed for UserSession.
 *
 * The user_sessions collection was just created by `prisma db push`.
 * It starts empty — sessions are recorded going forward from login events.
 * This migration exists only to document the schema addition and maintain
 * the sequential numbering convention.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '002_add_user_sessions',

  async up() {
    return { note: 'user_sessions collection created by prisma db push; no data backfill needed' };
  },
};
