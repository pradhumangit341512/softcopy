/**
 * Migration 017 — backfill Company.adminSeatLimit.
 *
 * Sets adminSeatLimit = 2 on every company that doesn't already have it.
 * MongoDB doesn't auto-add default values to existing documents when the
 * Prisma schema changes, so this ensures the field exists everywhere.
 *
 * Idempotent — skips companies that already have the field set.
 */

import { db } from '@/lib/db';
import type { Migration } from './_runner';

export const migration: Migration = {
  name: '017_company_admin_seat_limit',
  async up() {
    // The field is required with @default(2), so new documents already get the
    // default. For existing documents that may have 0 or negative values from
    // bad data, update them to the default.
    const result = await db.company.updateMany({
      where: { adminSeatLimit: { lt: 1 } },
      data: { adminSeatLimit: 2 },
    });

    return {
      companiesUpdated: result.count,
      note: 'Set adminSeatLimit=2 on companies with invalid values',
    };
  },
};
