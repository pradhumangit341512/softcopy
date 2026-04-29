/**
 * Migration 014 — initialise the reference_projects collection.
 * F21 introduces ReferenceProject; MongoDB creates the collection on
 * first insert. Registered no-op.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '014_reference_projects_init',
  async up() {
    return { note: 'no-op — reference_projects collection auto-created on first insert' };
  },
};
