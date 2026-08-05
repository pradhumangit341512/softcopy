/**
 * GET /api/projects/[id]/lead-matches — Phase 3 (3.4)
 *
 * Returns a { [unitId]: matchingLeadCount } map for every unit in the project,
 * matching each unit against the company's active buyer/renter leads via
 * clientMatchesUnit. Read-only, company-scoped (and createdBy-scoped for team
 * members, mirroring the unit routes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import { requireFeature } from '@/lib/require-feature';
import { clientMatchesUnit } from '@/lib/lead-match';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const gate = await requireFeature(payload.companyId, 'feature.projects_working');
    if (!gate.ok) return gate.response;

    const { id: projectId } = await ctx.params;
    if (!isValidObjectId(projectId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        companyId: payload.companyId,
        deletedAt: null,
        ...(isTeamMember(payload.role) ? { createdBy: payload.userId } : {}),
      },
      select: {
        location: true,
        sector: true,
        city: true,
        towers: {
          where: { deletedAt: null },
          select: {
            units: {
              where: { deletedAt: null },
              select: { id: true, assetType: true, listingType: true, price: true },
            },
          },
        },
      },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const projectLoc = [project.location, project.sector, project.city].filter(Boolean).join(' ');

    // Active buyer/renter leads for the company (New / Interested).
    const clients = await db.client.findMany({
      where: { companyId: payload.companyId, deletedAt: null, status: { in: ['New', 'Interested'] } },
      select: { inquiryType: true, requirementType: true, budget: true, preferredLocation: true },
    });

    const matches: Record<string, number> = {};
    for (const tower of project.towers) {
      for (const unit of tower.units) {
        matches[unit.id] = clients.reduce(
          (n, c) => (clientMatchesUnit(c, unit, projectLoc) ? n + 1 : n),
          0,
        );
      }
    }

    return NextResponse.json({ matches });
  } catch (err) {
    console.error('Lead matches error:', err);
    return NextResponse.json({ error: 'Failed to compute lead matches' }, { status: 500 });
  }
}
