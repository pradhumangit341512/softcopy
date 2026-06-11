/**
 * Migration 018 — PayrollProfile init (Enterprise HR plan).
 *
 * Adds the `payroll_profiles` collection backing per-member salary config
 * (base salary, allowances, absence deduction, commission rate). The model is
 * brand-new and every field has a default or is nullable, so there is nothing
 * to backfill — Mongo creates the collection lazily on first insert.
 *
 * Registered to honour the project rule "every Prisma change ships with a
 * migration entry". Idempotent no-op.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '018_payroll_profile_init',

  async up() {
    return {
      note: 'no-op — payroll_profiles is a new collection; all fields defaulted/nullable',
    };
  },
};
