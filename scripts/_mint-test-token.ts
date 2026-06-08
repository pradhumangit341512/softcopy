/* TEMP — throwaway helper to mint a read-only test session for local QA. Delete after use. */
import './_loadenv';
import { SignJWT } from 'jose';
import { db } from '../lib/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
async function generateToken(userId: string, companyId: string, role: string, email: string, opts: { tokenVersion: number }) {
  return new SignJWT({ userId, companyId, role, email, tv: opts.tokenVersion })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

async function main() {
  // Rank companies by data volume so the test pages actually render content.
  const companies = await db.company.findMany({
    where: { status: 'active' },
    select: { id: true, companyName: true, status: true },
  });

  let best: { companyId: string; name: string; clients: number; props: number } | null = null;
  for (const c of companies) {
    const [clients, props] = await Promise.all([
      db.client.count({ where: { companyId: c.id } }),
      db.property.count({ where: { companyId: c.id } }),
    ]);
    if (!best || clients + props > best.clients + best.props) {
      best = { companyId: c.id, name: c.companyName, clients, props };
    }
  }
  if (!best) throw new Error('no active company found');

  const admin = await db.user.findFirst({
    where: { companyId: best.companyId, role: 'admin', status: 'active' },
    select: { id: true, email: true, role: true, companyId: true, tokenVersion: true },
  });
  if (!admin) throw new Error('no active admin in best company');

  const token = await generateToken(admin.id, admin.companyId!, admin.role, admin.email, {
    tokenVersion: admin.tokenVersion,
  });

  const { writeFileSync } = await import('node:fs');
  writeFileSync('/tmp/test-token.txt', token);
  console.error(`[mint] company=${best.name} clients=${best.clients} props=${best.props} email=${admin.email} → token written to /tmp/test-token.txt`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
