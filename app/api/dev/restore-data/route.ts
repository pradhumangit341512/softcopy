/**
 * /api/dev/restore-data — DEV-ONLY utility to diagnose and restore
 * soft-deleted records for a given user's company.
 *
 * Triple-gated on NODE_ENV + absence of Vercel env markers. Cannot reach
 * any deployed environment.
 *
 * GET  /api/dev/restore-data?email=...  → counts how many records are
 *   currently soft-deleted vs active for that user's company, broken down
 *   by Client / Property / Commission. Use this to confirm WHY a table
 *   is empty before mutating anything.
 *
 * POST /api/dev/restore-data  { email }  → for that user's company,
 *   UNDELETES every soft-deleted Client, Property, and Commission (sets
 *   deletedAt back to null). Returns counts of what was restored.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { parseBody, emailSchema } from '@/lib/validations';

export const runtime = 'nodejs';

const IS_DEV_LOCAL =
  process.env.NODE_ENV === 'development' &&
  !process.env.VERCEL &&
  !process.env.VERCEL_ENV;

function devOnlyGuard(): NextResponse | null {
  if (!IS_DEV_LOCAL) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return null;
}

async function resolveCompanyId(email: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { email },
    select: { companyId: true },
  });
  return user?.companyId ?? null;
}

// ==================== GET — DIAGNOSTIC ====================

export async function GET(req: NextRequest) {
  const guard = devOnlyGuard();
  if (guard) return guard;

  const email = req.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json(
      { error: 'Missing ?email=... query parameter' },
      { status: 400 }
    );
  }

  const companyId = await resolveCompanyId(email);
  if (!companyId) {
    return NextResponse.json(
      { error: 'No user found with that email', email },
      { status: 404 }
    );
  }

  // For each scoped model, count active (deletedAt: null) vs soft-deleted
  // (deletedAt: { not: null }) so the caller knows whether undeletes are
  // actually needed or the table is genuinely empty.
  const [
    clientsActive, clientsDeleted, clientsTotal,
    propertiesActive, propertiesDeleted, propertiesTotal,
    commissionsActive, commissionsDeleted, commissionsTotal,
  ] = await Promise.all([
    db.client.count({ where: { companyId, deletedAt: null } }),
    db.client.count({ where: { companyId, deletedAt: { not: null } } }),
    db.client.count({ where: { companyId } }),
    db.property.count({ where: { companyId, deletedAt: null } }),
    db.property.count({ where: { companyId, deletedAt: { not: null } } }),
    db.property.count({ where: { companyId } }),
    db.commission.count({ where: { companyId, deletedAt: null } }),
    db.commission.count({ where: { companyId, deletedAt: { not: null } } }),
    db.commission.count({ where: { companyId } }),
  ]);

  return NextResponse.json({
    success: true,
    email,
    companyId,
    counts: {
      clients:     { active: clientsActive,     deleted: clientsDeleted,     total: clientsTotal },
      properties:  { active: propertiesActive,  deleted: propertiesDeleted,  total: propertiesTotal },
      commissions: { active: commissionsActive, deleted: commissionsDeleted, total: commissionsTotal },
    },
    hint:
      clientsDeleted + propertiesDeleted + commissionsDeleted > 0
        ? 'You have soft-deleted rows. POST to this endpoint to restore them.'
        : clientsActive + propertiesActive + commissionsActive === 0
        ? 'No data exists at all — add leads/properties through the UI first.'
        : 'All existing rows are already active. Tables should populate.',
  });
}

// ==================== POST — RESTORE ====================

const bodySchema = z.object({ email: emailSchema });

export async function POST(req: NextRequest) {
  const guard = devOnlyGuard();
  if (guard) return guard;

  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  const companyId = await resolveCompanyId(parsed.data.email);
  if (!companyId) {
    return NextResponse.json(
      { error: 'No user found with that email', email: parsed.data.email },
      { status: 404 }
    );
  }

  // Restore: set deletedAt back to null everywhere it's not null.
  const [clients, properties, commissions] = await Promise.all([
    db.client.updateMany({
      where: { companyId, deletedAt: { not: null } },
      data: { deletedAt: null },
    }),
    db.property.updateMany({
      where: { companyId, deletedAt: { not: null } },
      data: { deletedAt: null },
    }),
    db.commission.updateMany({
      where: { companyId, deletedAt: { not: null } },
      data: { deletedAt: null },
    }),
  ]);

  return NextResponse.json({
    success: true,
    email: parsed.data.email,
    companyId,
    restored: {
      clients: clients.count,
      properties: properties.count,
      commissions: commissions.count,
    },
  });
}
