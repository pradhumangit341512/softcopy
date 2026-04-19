#!/usr/bin/env tsx
/**
 * One-off CLI: set a user's password directly. Bumps tokenVersion so any
 * existing JWT for this user is invalidated — they MUST log in fresh with
 * the new password.
 *
 * Usage:
 *   npx tsx scripts/set-password.ts <email> <newPassword>
 *
 * Use cases:
 *   - You forgot your own superadmin password and need to reset without
 *     going through the OTP flow.
 *   - Bootstrapping the very first superadmin after promotion.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db';

// Inline because importing from lib/auth pulls in a top-level `await` that
// tsx (CJS mode) can't compile. Same bcrypt cost as production code.
const BCRYPT_COST = 12;
async function hashPassword(p: string) {
  return bcrypt.hash(p, BCRYPT_COST);
}

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error('Usage: npx tsx scripts/set-password.ts <email> <newPassword>');
    process.exit(1);
  }

  // Sanity-check against passwordSchema rules so we fail HERE rather than
  // surprising the user at next login.
  if (newPassword.length < 6) {
    console.error('[set-password] Password must be at least 6 characters.');
    process.exit(1);
  }
  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    console.error('[set-password] Password must contain uppercase, lowercase, and number.');
    process.exit(1);
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    console.error(`[set-password] No user found with email "${email}".`);
    process.exit(1);
  }

  const hashed = await hashPassword(newPassword);

  await db.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      tokenVersion: { increment: 1 }, // kill any active sessions
      // pre-verify the email so the login flow doesn't block on it
      emailVerified: new Date(),
      status: 'active',
    },
  });

  console.log(`[set-password] ✔ password updated for ${user.email} (role: ${user.role})`);
  console.log('[set-password] All previous sessions invalidated. Log in fresh with the new password.');
  process.exit(0);
}

main().catch((e) => {
  console.error('[set-password] fatal:', e);
  process.exit(1);
});
