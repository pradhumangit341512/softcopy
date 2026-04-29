/**
 * Migration 010 — backfill Property.ownerPhones from ownerPhone.
 *
 * Why this is needed
 * ──────────────────
 * F12 introduces multi-mobile-number support on inventory rows. The new
 * field `ownerPhones String[]` is the canonical source going forward;
 * `ownerPhone` is kept for back-compat (search routes, exports, legacy
 * reports). New writes always set both fields so a future "drop legacy"
 * pass can be done without coordinating reads.
 *
 * Without this migration, every existing row has `ownerPhones: []` →
 * the multi-phone UI would render empty for legacy properties. We seed
 * a single-element array per row, so behaviour stays identical until a
 * user explicitly adds another number.
 *
 * Idempotent: only writes rows where `ownerPhones` is empty AND
 * `ownerPhone` is non-empty. Safe to re-run.
 */

import { db } from '../../lib/db';
import type { Migration } from './_runner';

export const migration: Migration = {
  name: '010_property_owner_phones',

  async up() {
    const candidates = await db.property.findMany({
      where: {
        OR: [
          { ownerPhones: { isEmpty: true } },
          { ownerPhones: { equals: [] } },
        ],
      },
      select: { id: true, ownerPhone: true, ownerPhones: true },
    });

    let backfilled = 0;
    let skippedEmpty = 0;
    for (const p of candidates) {
      // Defensive: skip rows that already have a populated array
      // (shouldn't happen given the where clause, but the API for
      // Prisma's MongoDB connector has had quirks with isEmpty).
      if (Array.isArray(p.ownerPhones) && p.ownerPhones.length > 0) continue;

      const phone = (p.ownerPhone ?? '').trim();
      if (!phone) {
        skippedEmpty += 1;
        continue;
      }

      await db.property.update({
        where: { id: p.id },
        data: { ownerPhones: [phone] },
      });
      backfilled += 1;
    }

    return {
      candidatesScanned: candidates.length,
      ownerPhonesBackfilled: backfilled,
      skippedEmptyPhone: skippedEmpty,
    };
  },
};
