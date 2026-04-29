/**
 * GET /api/dev/diagnose — admin/superadmin only, dev mode only.
 *
 * Probes every Prisma model the recent build cycle introduced and
 * reports whether each one is reachable on the running client.
 * Use this to isolate whether a 500 is a stale Prisma client issue
 * (model present at build time but `undefined` at runtime) versus a
 * real query/data bug.
 *
 *   GET → JSON
 *   {
 *     env: 'development',
 *     models: {
 *       company: { ok: true, count: 1 },
 *       brokerRequirement: { ok: false, error: 'is not a function' },
 *       project: { ok: true, count: 0 },
 *       …
 *     }
 *   }
 *
 * If any model has `ok: false`, the dev server hasn't picked up the
 * regenerated Prisma client yet — kill it and rerun `npm run reset:dev`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { isAdminRole } from '@/lib/authorize';

export const runtime = 'nodejs';

type ProbeResult = { ok: true; count: number } | { ok: false; error: string };

async function probe(label: string, fn: () => Promise<number>): Promise<ProbeResult> {
  try {
    const count = await fn();
    return { ok: true, count };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

export async function GET(req: NextRequest) {
  // Hard-block in production. The diagnostic is only useful while
  // hunting bugs locally, and shipping it would expose model names.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const payload = await verifyAuth(req);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminRole(payload.role)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  // Cast `db` so TS doesn't trip on optional new models that may legitimately
  // not exist yet on the running client — that's exactly what we're checking.
  const c = db as unknown as Record<string, { count: () => Promise<number> } | undefined>;

  const models = {
    // ── Existing baseline (these should always work) ────────────
    company:        await probe('company',         () => c.company?.count() ?? Promise.reject(new Error('db.company is undefined'))),
    user:           await probe('user',            () => c.user?.count() ?? Promise.reject(new Error('db.user is undefined'))),
    client:         await probe('client',          () => c.client?.count() ?? Promise.reject(new Error('db.client is undefined'))),
    property:       await probe('property',        () => c.property?.count() ?? Promise.reject(new Error('db.property is undefined'))),

    // ── Recent build cycle (the suspects) ──────────────────────
    dailyPlan:           await probe('dailyPlan',           () => c.dailyPlan?.count() ?? Promise.reject(new Error('db.dailyPlan is undefined'))),
    brokerRequirement:   await probe('brokerRequirement',   () => c.brokerRequirement?.count() ?? Promise.reject(new Error('db.brokerRequirement is undefined'))),
    project:             await probe('project',             () => c.project?.count() ?? Promise.reject(new Error('db.project is undefined'))),
    tower:               await probe('tower',               () => c.tower?.count() ?? Promise.reject(new Error('db.tower is undefined'))),
    unit:                await probe('unit',                () => c.unit?.count() ?? Promise.reject(new Error('db.unit is undefined'))),
    learnFolder:         await probe('learnFolder',         () => c.learnFolder?.count() ?? Promise.reject(new Error('db.learnFolder is undefined'))),
    learnFile:           await probe('learnFile',           () => c.learnFile?.count() ?? Promise.reject(new Error('db.learnFile is undefined'))),
    referenceProject:    await probe('referenceProject',    () => c.referenceProject?.count() ?? Promise.reject(new Error('db.referenceProject is undefined'))),
  };

  // Roll up an actionable summary so the user doesn't have to read
  // each row.
  const broken = Object.entries(models)
    .filter(([, r]) => !r.ok)
    .map(([name]) => name);
  const verdict =
    broken.length === 0
      ? 'All models reachable. If you still see 500s, the bug is in the route or Zod, not the Prisma client.'
      : `Stale Prisma client — these models are missing at runtime: ${broken.join(', ')}. Kill the dev server and run: npm run reset:dev`;

  return NextResponse.json({
    env: process.env.NODE_ENV,
    session: { userId: payload.userId, role: payload.role, companyId: payload.companyId },
    verdict,
    models,
  });
}
