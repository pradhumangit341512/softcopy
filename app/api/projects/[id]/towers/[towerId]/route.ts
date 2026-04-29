/**
 * /api/projects/[id]/towers/[towerId] — F17
 *
 * PUT    → rename a tower (and any future tower-level fields).
 * DELETE → soft-delete the tower. Units underneath are NOT also marked
 *          deleted — the cascade rule in schema only applies to hard
 *          delete, which we don't perform. The detail page filters by
 *          `tower.deletedAt: null` so a soft-deleted tower hides its
 *          units from the UI; raw collection data is preserved for
 *          recovery.
 *
 * Tenant + role enforcement walks the chain in a single Prisma query:
 * tower → project → company. A team member can never edit a tower whose
 * parent project belongs to another teammate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import { updateTowerSchema, parseBody } from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

async function gate(
  req: NextRequest,
  projectId: string,
  towerId: string
) {
  const payload = await verifyAuth(req);
  if (!payload) {
    return { fail: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const f = await requireFeature(payload.companyId, 'feature.projects_working');
  if (!f.ok) return { fail: f.response };
  if (!isValidObjectId(projectId) || !isValidObjectId(towerId)) {
    return { fail: NextResponse.json({ error: 'Invalid id' }, { status: 400 }) };
  }
  // Verify tower belongs to a project owned by this company (and the
  // current user, if a team member).
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
  if (!tower) {
    return { fail: NextResponse.json({ error: 'Tower not found' }, { status: 404 }) };
  }
  return { payload };
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; towerId: string }> }
) {
  try {
    const { id, towerId } = await ctx.params;
    const r = await gate(req, id, towerId);
    if ('fail' in r) return r.fail;

    const parsed = await parseBody(req, updateTowerSchema);
    if (!parsed.ok) return parsed.response;

    const updated = await db.tower.update({
      where: { id: towerId },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Update tower error:', err);
    return NextResponse.json({ error: 'Failed to update tower' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; towerId: string }> }
) {
  try {
    const { id, towerId } = await ctx.params;
    const r = await gate(req, id, towerId);
    if ('fail' in r) return r.fail;

    await db.tower.update({
      where: { id: towerId },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete tower error:', err);
    return NextResponse.json({ error: 'Failed to delete tower' }, { status: 500 });
  }
}
