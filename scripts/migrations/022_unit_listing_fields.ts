/**
 * Migration 022 — Unit inventory fields (F17b).
 *
 * F17b adds richer per-unit attributes: assetType, listingType, furnishing,
 * interiorStatus, pricePerSqft, price, and a structured numeric `areaSqft`.
 *
 * All new fields are nullable with no default, so there is nothing to seed for
 * the enum/price columns — Mongo simply has them absent until a unit is edited.
 *
 * The one real backfill: derive numeric `areaSqft` from the legacy free-text
 * `size` string (e.g. "1850 sqft", "1,850 sq.ft") so existing units are
 * immediately usable for per-sqft pricing, sorting, and the share message
 * without anyone re-typing the area.
 *
 * Idempotent: only touches units whose `areaSqft` is still null AND whose
 * `size` parses to a positive number. Safe to re-run.
 */

import { db } from '../../lib/db';
import type { Migration } from './_runner';

/** Pull the first positive number out of a free-text size like "1850 sqft". */
function parseSqft(size: string | null | undefined): number | null {
  if (!size) return null;
  const match = size.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const migration: Migration = {
  name: '022_unit_listing_fields',

  async up() {
    const candidates = await db.unit.findMany({
      where: { deletedAt: null, areaSqft: null, NOT: { size: null } },
      select: { id: true, size: true },
    });

    let backfilled = 0;
    let skippedUnparseable = 0;
    for (const u of candidates) {
      const sqft = parseSqft(u.size);
      if (sqft == null) {
        skippedUnparseable += 1;
        continue;
      }
      await db.unit.update({ where: { id: u.id }, data: { areaSqft: sqft } });
      backfilled += 1;
    }

    return {
      candidatesScanned: candidates.length,
      areaSqftBackfilled: backfilled,
      skippedUnparseable,
      note: 'assetType/listingType/furnishing/interiorStatus/pricePerSqft/price are nullable — no seed needed',
    };
  },
};
