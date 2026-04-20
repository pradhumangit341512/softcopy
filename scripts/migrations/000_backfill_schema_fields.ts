/**
 * Migration 000 — backfill fields added to existing collections.
 *
 * This captures every schema addition made during the production-hardening
 * session in April 2026 that needed a data-level migration:
 *
 *   - `Client.deletedAt`    (nullable soft-delete timestamp)
 *   - `Property.deletedAt`
 *   - `Commission.deletedAt`
 *   - `User.deletedAt`
 *   - `User.tokenVersion`    (for session revocation)
 *   - `User.emailVerified`   (Option-A email verification flow)
 *
 * Without this migration, documents predating the field additions have the
 * field MISSING entirely (MongoDB does not auto-migrate schema). Prisma's
 * `where: { deletedAt: null }` does not match missing fields, so legacy
 * rows silently vanish from list endpoints.
 *
 * Idempotent: uses `$exists: false` guards. Safe to re-run.
 */

import { Prisma } from '@prisma/client';
import { db } from '../../lib/db';
import type { Migration } from './_runner';

async function backfillField(
  collection: string,
  field: string,
  defaultValue: unknown
): Promise<number> {
  const cmd = {
    update: collection,
    updates: [
      {
        q: { [field]: { $exists: false } },
        u: { $set: { [field]: defaultValue } },
        multi: true,
      },
    ],
  } as unknown as Prisma.InputJsonObject;

  const result = (await db.$runCommandRaw(cmd)) as {
    nModified?: number;
    n?: number;
  };
  return result.nModified ?? result.n ?? 0;
}

export const migration: Migration = {
  name: '000_backfill_schema_fields',

  async up() {
    const now = new Date().toISOString();

    // IMPORTANT: Prisma-for-MongoDB uses PascalCase collection names by
    // default (model `Client` → collection `Client`), NOT lowercase-plural.
    // Only explicitly `@@map`-annotated models deviate. Run
    // `npx tsx scripts/list-collections.ts` to verify if unsure.
    const [
      clientsDeletedAt,
      propertiesDeletedAt,
      commissionsDeletedAt,
      usersDeletedAt,
      usersTokenVersion,
      usersEmailVerified,
    ] = await Promise.all([
      backfillField('Client',     'deletedAt',     null),
      backfillField('Property',   'deletedAt',     null),
      backfillField('Commission', 'deletedAt',     null),
      backfillField('User',       'deletedAt',     null),
      backfillField('User',       'tokenVersion',  0),
      // Legacy users (created before email verification existed) are
      // treated as already-verified — they had functional accounts under
      // the prior regime.
      backfillField('User',       'emailVerified', { $date: now }),
    ]);

    return {
      clients:     { deletedAt: clientsDeletedAt },
      properties:  { deletedAt: propertiesDeletedAt },
      commissions: { deletedAt: commissionsDeletedAt },
      users: {
        deletedAt:     usersDeletedAt,
        tokenVersion:  usersTokenVersion,
        emailVerified: usersEmailVerified,
      },
    };
  },
};
