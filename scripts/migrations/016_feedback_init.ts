/**
 * Migration 016 — initialise the feedback collection.
 *
 * Adds the public landing-page Feedback model. MongoDB creates the
 * collection on first insert. Registered no-op so the migration ledger
 * stays aligned with schema versions.
 *
 * Idempotent.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '016_feedback_init',
  async up() {
    return { note: 'no-op — feedback collection auto-created on first insert' };
  },
};
