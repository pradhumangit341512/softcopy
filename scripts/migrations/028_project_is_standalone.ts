/**
 * Migration 028 — Project.isStandalone (Phase 3, item 3.3).
 *
 * `isStandalone` is a REQUIRED Boolean (@default(false)). Prisma's MongoDB
 * connector applies defaults only on create — reading an existing project
 * document that lacks the field throws "Field isStandalone is required". So we
 * must backfill every existing project with `false`.
 *
 * Idempotent: only sets the field where it is absent.
 */

import { db } from '../../lib/db';
import type { Prisma } from '@prisma/client';
import type { Migration } from './_runner';

export const migration: Migration = {
  name: '028_project_is_standalone',

  async up() {
    const res = (await db.$runCommandRaw({
      update: 'projects',
      updates: [
        { q: { isStandalone: { $exists: false } }, u: { $set: { isStandalone: false } }, multi: true },
      ],
    } as unknown as Prisma.InputJsonObject)) as { nModified?: number; n?: number };

    return { projectsBackfilled: res.nModified ?? res.n ?? 0 };
  },
};
