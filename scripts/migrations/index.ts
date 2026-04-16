/**
 * Registry of all migrations. Add new ones here in order.
 * Files are discovered explicitly (not via glob) so the build bundles them
 * deterministically — important because the API route runs in a compiled
 * environment where dynamic filesystem reads don't work on Vercel.
 */

import type { Migration } from './_runner';
import { migration as m000 } from './000_backfill_schema_fields';

export const ALL_MIGRATIONS: Migration[] = [
  m000,
  // ADD NEW MIGRATIONS HERE, e.g.:
  // import { migration as m001 } from './001_add_something_field';
  // ...then: m001,
];
