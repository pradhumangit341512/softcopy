/**
 * POST /api/projects/[id]/towers — F17
 * Create a tower under a project. The project must belong to the caller's
 * company (and must be the caller's own row for team members).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import { createTowerSchema, parseBody } from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const gate = await requireFeature(payload.companyId, 'feature.projects_working');
    if (!gate.ok) return gate.response;

    const { id: projectId } = await ctx.params;
    if (!isValidObjectId(projectId)) {
      return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });
    }

    const projectWhere: Record<string, unknown> = {
      id: projectId,
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (isTeamMember(payload.role)) projectWhere.createdBy = payload.userId;

    const project = await db.project.findFirst({ where: projectWhere, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const parsed = await parseBody(req, createTowerSchema);
    if (!parsed.ok) return parsed.response;

    const tower = await db.tower.create({
      data: { projectId, name: parsed.data.name, deletedAt: null },
    });
    return NextResponse.json(tower, { status: 201 });
  } catch (err) {
    console.error('Create tower error:', err);
    return NextResponse.json({ error: 'Failed to create tower' }, { status: 500 });
  }
}
