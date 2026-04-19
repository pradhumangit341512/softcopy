#!/usr/bin/env tsx
/** Quick diag: list all users so we can pick which one to promote. */
import 'dotenv/config';
import { db } from '../lib/db';

async function main() {
  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, role: true, companyId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`[users] ${users.length} total\n`);
  for (const u of users) {
    console.log(`  ${u.role.padEnd(11)} ${u.email.padEnd(40)} ${u.name}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
