/**
 * Migration 008 — initialize Client.ownedBy from Client.createdBy.
 *
 * Why this is needed
 * ──────────────────
 * F2 introduces lead transfer between teammates. Three new fields go on
 * Client:
 *
 *   ownedBy          – current owner of the lead (defaults to createdBy)
 *   transferredFrom  – previous owner, set on every transfer
 *   transferredAt    – when the last transfer happened
 *
 * `createdBy` stays as the historical "who captured this lead" anchor and
 * never changes once set. List/detail endpoints filter on `ownedBy` so a
 * transferred lead disappears from the original captor's view and shows up
 * in the new owner's view immediately.
 *
 * Without this migration, every existing lead has `ownedBy = null` →
 * routes that filter `where.ownedBy = userId` would return zero rows for
 * everyone after the deploy. We backfill `ownedBy = createdBy` so behavior
 * is identical to today until a transfer actually happens.
 *
 * Idempotent: only writes rows where ownedBy is still null. Safe to re-run.
 */

import { db } from '../../lib/db';
import type { Migration } from './_runner';

export const migration: Migration = {
  name: '008_client_owned_by',

  async up() {
    const candidates = await db.client.findMany({
      where: { ownedBy: null },
      select: { id: true, createdBy: true },
    });

    let updated = 0;
    for (const c of candidates) {
      await db.client.update({
        where: { id: c.id },
        data: { ownedBy: c.createdBy },
      });
      updated += 1;
    }

    return {
      candidatesScanned: candidates.length,
      ownedByBackfilled: updated,
    };
  },
};
