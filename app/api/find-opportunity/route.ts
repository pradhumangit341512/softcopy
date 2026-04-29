/**
 * GET /api/find-opportunity — F19
 *
 * Returns the top buyer↔inventory matches for the caller's company.
 * Scoring lives in lib/matcher.ts so a future ML scorer can plug in
 * without touching the API surface.
 *
 *   - Tenant-scoped: companyId from JWT, never the query string.
 *   - Role-aware: team members see matches involving their own clients
 *     and inventory only. Admins see the whole company's pool.
 *   - Read-only — no writes, no audit-log noise.
 *
 * Feature gate: feature.opportunity_matcher.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import { requireFeature } from '@/lib/require-feature';
import { findOpportunities } from '@/lib/matcher';
import type { Client, Property } from '@/lib/types';

export const runtime = 'nodejs';

// Hard caps so a brokerage with 50k clients × 50k properties can't OOM us.
const MAX_CLIENTS = 1000;
const MAX_PROPERTIES = 2000;

export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gate = await requireFeature(payload.companyId, 'feature.opportunity_matcher');
    if (!gate.ok) return gate.response;

    const sp = req.nextUrl.searchParams;
    const minScore = Number(sp.get('minScore') ?? 30);
    const perClient = Number(sp.get('perClient') ?? 5);
    const topN = Number(sp.get('topN') ?? 200);

    const clientWhere: Record<string, unknown> = {
      companyId: payload.companyId,
      deletedAt: null,
      // Only active funnel stages — no point matching DealDone / DeadLead.
      status: { notIn: ['DealDone', 'DeadLead', 'Completed', 'Rejected'] },
    };
    const propertyWhere: Record<string, unknown> = {
      companyId: payload.companyId,
      deletedAt: null,
      status: { notIn: ['Sold', 'Rented'] },
    };

    if (isTeamMember(payload.role)) {
      // Team members only match their own clients and inventory.
      clientWhere.OR = [
        { ownedBy: payload.userId },
        { ownedBy: null, createdBy: payload.userId },
      ];
      propertyWhere.createdBy = payload.userId;
    }

    const [clients, properties] = await Promise.all([
      db.client.findMany({ where: clientWhere, take: MAX_CLIENTS }),
      db.property.findMany({ where: propertyWhere, take: MAX_PROPERTIES }),
    ]);

    const matches = findOpportunities(
      clients as unknown as Client[],
      properties as unknown as Property[],
      {
        minScore: Number.isFinite(minScore) ? minScore : 30,
        perClient: Number.isFinite(perClient) ? Math.min(20, Math.max(1, perClient)) : 5,
        topN: Number.isFinite(topN) ? Math.min(500, Math.max(1, topN)) : 200,
      }
    );

    return NextResponse.json({
      matches,
      counts: {
        clientsScanned: clients.length,
        propertiesScanned: properties.length,
        clientsCapped: clients.length === MAX_CLIENTS,
        propertiesCapped: properties.length === MAX_PROPERTIES,
      },
    });
  } catch (err) {
    console.error('Find opportunity error:', err);
    return NextResponse.json({ error: 'Match failed' }, { status: 500 });
  }
}
