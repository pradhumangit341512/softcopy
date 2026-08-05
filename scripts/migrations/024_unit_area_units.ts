/**
 * Migration 024 — Unit multi-unit area (Phase 1, item 1.3).
 *
 * Adds `areaValue` + `areaUnit` so area can be entered in Gaj/Marla/Kanal/Acre
 * etc. (with exact sq-ft conversion). `areaSqft` remains the derived canonical.
 *
 * Backfill: existing units stored area only as `areaSqft` (implicitly sq ft).
 * Seed `areaValue = areaSqft` and `areaUnit = 'Sq. Feet'` for those rows so the
 * new value+unit UI renders them correctly. Idempotent: only touches rows that
 * have `areaSqft` but no `areaValue` yet.
 */

import { db } from '../../lib/db';
import type { Migration } from './_runner';

export const migration: Migration = {
  name: '024_unit_area_units',

  async up() {
    const candidates = await db.unit.findMany({
      where: { deletedAt: null, areaValue: null, NOT: { areaSqft: null } },
      select: { id: true, areaSqft: true },
    });

    let backfilled = 0;
    for (const u of candidates) {
      await db.unit.update({
        where: { id: u.id },
        data: { areaValue: u.areaSqft, areaUnit: 'Sq. Feet' },
      });
      backfilled += 1;
    }

    return { candidatesScanned: candidates.length, areaValueBackfilled: backfilled };
  },
};
