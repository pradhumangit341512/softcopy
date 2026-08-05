/**
 * POST /api/projects/standalone — Phase 3 (3.3)
 *
 * Find-or-create the caller's "Standalone Properties" bucket: a project flagged
 * isStandalone with a single default block ("Direct"). Loose units that don't
 * belong to a real project live here, so the whole Unit → Tower → Project →
 * Company auth chain (and all existing unit routes) keep working unchanged.
 *
 * Keyed per (company, creator) so it respects the same createdBy visibility the
 * unit routes enforce for team members — every user gets a working bucket.
 * Returns { projectId, towerId } so the client can jump straight to it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const gate = await requireFeature(payload.companyId, 'feature.projects_working');
    if (!gate.ok) return gate.response;

    let project = await db.project.findFirst({
      where: {
        companyId: payload.companyId,
        createdBy: payload.userId,
        isStandalone: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!project) {
      project = await db.project.create({
        data: {
          companyId: payload.companyId,
          name: 'Standalone Properties',
          propertyType: 'Residential',
          constructionStatus: 'ReadyToMove',
          isStandalone: true,
          createdBy: payload.userId,
          deletedAt: null,
        },
        select: { id: true },
      });
    }

    let tower = await db.tower.findFirst({
      where: { projectId: project.id, deletedAt: null },
      select: { id: true },
    });
    if (!tower) {
      tower = await db.tower.create({
        data: { projectId: project.id, name: 'Direct', deletedAt: null },
        select: { id: true },
      });
    }

    return NextResponse.json({ projectId: project.id, towerId: tower.id });
  } catch (err) {
    console.error('Standalone bucket error:', err);
    return NextResponse.json({ error: 'Failed to prepare standalone bucket' }, { status: 500 });
  }
}
