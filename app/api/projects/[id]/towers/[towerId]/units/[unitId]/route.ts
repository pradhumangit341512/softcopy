/**
 * /api/projects/[id]/towers/[towerId]/units/[unitId] — F17
 *
 * PUT    → update unit fields (floor, unit no, typology, size, status,
 *          owner, phones, remarks, assignment).
 * DELETE → soft-delete (deletedAt). Recoverable from the database, not
 *          from the app UI.
 *
 * Authorization walks the chain unit → tower → project → company in a
 * single Prisma query so a team member cannot edit another teammate's
 * unit even if they guess the IDs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import { updateUnitSchema, parseBody } from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

async function gate(
  req: NextRequest,
  projectId: string,
  towerId: string,
  unitId: string
) {
  const payload = await verifyAuth(req);
  if (!payload) {
    return { fail: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const f = await requireFeature(payload.companyId, 'feature.projects_working');
  if (!f.ok) return { fail: f.response };
  if (!isValidObjectId(projectId) || !isValidObjectId(towerId) || !isValidObjectId(unitId)) {
    return { fail: NextResponse.json({ error: 'Invalid id' }, { status: 400 }) };
  }
  const unit = await db.unit.findFirst({
    where: {
      id: unitId,
      towerId,
      deletedAt: null,
      tower: {
        projectId,
        deletedAt: null,
        project: {
          companyId: payload.companyId,
          deletedAt: null,
          ...(isTeamMember(payload.role) ? { createdBy: payload.userId } : {}),
        },
      },
    },
    select: { id: true },
  });
  if (!unit) {
    return { fail: NextResponse.json({ error: 'Unit not found' }, { status: 404 }) };
  }
  return { payload };
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; towerId: string; unitId: string }> }
) {
  try {
    const { id, towerId, unitId } = await ctx.params;
    const r = await gate(req, id, towerId, unitId);
    if ('fail' in r) return r.fail;

    const parsed = await parseBody(req, updateUnitSchema);
    if (!parsed.ok) return parsed.response;

    const updated = await db.unit.update({
      where: { id: unitId },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Update unit error:', err);
    return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; towerId: string; unitId: string }> }
) {
  try {
    const { id, towerId, unitId } = await ctx.params;
    const r = await gate(req, id, towerId, unitId);
    if ('fail' in r) return r.fail;

    await db.unit.update({
      where: { id: unitId },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete unit error:', err);
    return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 });
  }
}
