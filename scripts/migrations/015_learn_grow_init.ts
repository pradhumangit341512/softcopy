/**
 * Migration 015 — initialise Learn & Grow collections (F20).
 * MongoDB creates learn_folders / learn_files on first insert. No-op.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '015_learn_grow_init',
  async up() {
    return { note: 'no-op — learn_folders/learn_files auto-created on first insert' };
  },
};
