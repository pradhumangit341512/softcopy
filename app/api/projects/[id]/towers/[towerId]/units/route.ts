/**
 * POST /api/projects/[id]/towers/[towerId]/units — F17
 * Create a unit under a tower under a project. Verifies the whole chain
 * belongs to the caller's company before insert.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import { createUnitSchema, parseBody } from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; towerId: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const gate = await requireFeature(payload.companyId, 'feature.projects_working');
    if (!gate.ok) return gate.response;

    const { id: projectId, towerId } = await ctx.params;
    if (!isValidObjectId(projectId) || !isValidObjectId(towerId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    // Single round-trip walks the chain: tower → project → companyId match.
    // We use findFirst with the project filter inline so we never trust a
    // tower whose parent project belongs to another company.
    const tower = await db.tower.findFirst({
      where: {
        id: towerId,
        projectId,
        deletedAt: null,
        project: {
          companyId: payload.companyId,
          deletedAt: null,
          ...(isTeamMember(payload.role) ? { createdBy: payload.userId } : {}),
        },
      },
      select: { id: true },
    });
    if (!tower) return NextResponse.json({ error: 'Tower not found' }, { status: 404 });

    const parsed = await parseBody(req, createUnitSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    const unit = await db.unit.create({
      data: {
        towerId,
        floor: data.floor,
        unitNo: data.unitNo,
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        ownerPhones: data.ownerPhones ?? [],
        typology: data.typology,
        size: data.size,
        status: data.status,
        remarks: data.remarks,
        assignedTo: data.assignedTo ?? null,
        deletedAt: null,
      },
    });
    return NextResponse.json(unit, { status: 201 });
  } catch (err) {
    console.error('Create unit error:', err);
    return NextResponse.json({ error: 'Failed to create unit' }, { status: 500 });
  }
}
