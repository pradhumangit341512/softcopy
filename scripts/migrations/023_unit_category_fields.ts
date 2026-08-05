/**
 * Migration 023 — Unit category & rental fields (F17c).
 *
 * Adds category-specific attributes so a single Block can hold mixed stock:
 * facing, bathrooms, parking, plotDimensions, cornerPlot (plots), and the
 * rental set (deposit, maintenanceMonthly, availableFrom, preferredTenant,
 * lockInMonths), plus reraId.
 *
 * Every field is nullable with no default, so there is nothing to backfill —
 * Mongo simply has them absent until a unit is edited. Registered as an
 * idempotent no-op per the migration-ledger rule.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '023_unit_category_fields',

  async up() {
    return { note: 'no-op — all F17c unit fields are nullable with no default' };
  },
};
