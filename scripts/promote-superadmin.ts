#!/usr/bin/env tsx
/**
 * One-off CLI: promote a User to role=superadmin.
 *
 * Usage:
 *   npx tsx scripts/promote-superadmin.ts <email>
 *
 * Notes:
 *   - There is no public signup any more. This script is the ONLY way to
 *     mint the very first superadmin (you). Subsequent superadmins, if any,
 *     can also be promoted via this script. There is intentionally no UI for
 *     "make this user a superadmin" — too dangerous.
 *   - Bumps tokenVersion so any existing JWT for this user is invalidated;
 *     the user must re-login to receive a JWT that carries role=superadmin.
 */

import 'dotenv/config';
import { db } from '../lib/db';

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  if (!email) {
    console.error('Usage: npx tsx scripts/promote-superadmin.ts <email>');
    process.exit(1);
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, tokenVersion: true },
  });

  if (!user) {
    console.error(`[promote] No user found with email "${email}".`);
    console.error('[promote] Create the user first (in Admin → Team), then re-run.');
    process.exit(1);
  }

  if (user.role === 'superadmin') {
    console.log(`[promote] ${email} is already superadmin. No-op.`);
    process.exit(0);
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      role: 'superadmin',
      tokenVersion: { increment: 1 }, // invalidates current sessions
      // companyId stays as-is — superadmin can have a "home" company or none
    },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });

  console.log('[promote] ✔ promoted to superadmin:');
  console.log('  ', updated);
  console.log('[promote] User must log out + log back in for new role to take effect.');
  process.exit(0);
}

main().catch((e) => {
  console.error('[promote] fatal:', e);
  process.exit(1);
});
