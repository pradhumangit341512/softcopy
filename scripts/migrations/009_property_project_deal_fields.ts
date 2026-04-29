/**
 * Migration 009 — placeholder for the F10 + F11 Property fields.
 *
 * Why this is needed
 * ──────────────────
 * F10 adds five project-identity fields (projectName / sectorNo / unitNo
 * / towerNo / typology) and F11 adds four deal-flow fields (demand /
 * paymentStatus / caseType / loanStatus) to the `Property` model. All nine
 * fields are optional, so existing rows remain valid without any data
 * touch — Prisma reads them as null when absent.
 *
 * No backfill is required. This migration is registered solely to honour
 * the project rule "every Prisma change ships with a migration entry"
 * (per the user's auto-memory) and to keep the migration ledger aligned
 * with schema versions for audit purposes. It is idempotent and a no-op.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '009_property_project_deal_fields',

  async up() {
    return {
      note: 'no-op — F10/F11 fields are nullable; existing rows are already compatible',
    };
  },
};
