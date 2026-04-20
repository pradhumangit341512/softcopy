/**
 * SuperAdmin helpers — auth gate + utilities used only by /superadmin routes.
 *
 * Middleware already guards /api/superadmin/* at the edge, but we re-check
 * inside each handler too. Defense in depth: middleware can be bypassed by
 * direct internal calls or future framework changes.
 */

import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, type AuthTokenPayload } from './auth';

export async function requireSuperAdmin(
  req: NextRequest
): Promise<{ ok: true; payload: AuthTokenPayload } | { ok: false; response: NextResponse }> {
  const payload = await verifyAuth(req);
  if (!payload) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  if (payload.role !== 'superadmin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { ok: true, payload };
}

/**
 * Generates a human-readable temp password meeting passwordSchema (6+ chars,
 * upper + lower + digit). Uses node:crypto for unpredictable randomness.
 *
 * Pool: 20 adjectives × 8 nouns × 9000 numbers ≈ 1.44M combinations.
 * Format: AdjectiveNoun-####  (e.g. "BraveTiger-4821")
 */
export function generateTempPassword(): string {
  const adj = [
    'Brave', 'Crisp', 'Fleet', 'Grand', 'Happy', 'Lucky', 'Mango', 'Noble',
    'Pearl', 'Quiet', 'Rapid', 'Royal', 'Sharp', 'Sleek', 'Spark', 'Stern',
    'Sunny', 'Swift', 'Vivid', 'Wider',
  ];
  const noun = ['Tiger', 'Cedar', 'Flint', 'Maple', 'Prism', 'Quartz', 'River', 'Stone'];
  const word = adj[randomInt(adj.length)] + noun[randomInt(noun.length)];
  const digits = randomInt(1000, 10000).toString();
  return `${word}-${digits}`;
}
