/**
 * Migration 029 — Client lead score (Gap 3, Phase A).
 *
 * Adds leadScore / leadScoreBand / leadScoreReasons to Client. The fields are
 * nullable / defaulted so reads don't break, but we backfill real scores here
 * so every existing lead ranks immediately (instead of showing blank until its
 * next edit). Idempotent: recomputing is deterministic, so re-runs are safe.
 */

import { db } from '../../lib/db';
import { scoreLead } from '../../lib/lead-score';
import type { Migration } from './_runner';

export const migration: Migration = {
  name: '029_client_lead_score',

  async up() {
    const clients = await db.client.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        status: true,
        inquiryType: true,
        requirementType: true,
        budget: true,
        preferredLocation: true,
        email: true,
        propertyVisited: true,
        followUps: true,
        lastContactDate: true,
        followUpDate: true,
      },
    });

    let scored = 0;
    for (const c of clients) {
      const s = scoreLead(c);
      await db.client.update({
        where: { id: c.id },
        data: { leadScore: s.score, leadScoreBand: s.band, leadScoreReasons: s.reasons },
      });
      scored += 1;
    }

    return { clientsScored: scored };
  },
};
