/**
 * /api/reference-projects/[id] — F21
 * PUT / DELETE one reference project. Tenant + ownership scoped.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import {
  updateReferenceProjectSchema,
  parseBody,
} from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

async function gate(req: NextRequest, id: string) {
  const payload = await verifyAuth(req);
  if (!payload) return { fail: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const f = await requireFeature(payload.companyId, 'feature.reference_db');
  if (!f.ok) return { fail: f.response };
  if (!isValidObjectId(id)) {
    return { fail: NextResponse.json({ error: 'Invalid id' }, { status: 400 }) };
  }
  return { payload };
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const r = await gate(req, id);
    if ('fail' in r) return r.fail;
    const parsed = await parseBody(req, updateReferenceProjectSchema);
    if (!parsed.ok) return parsed.response;
    const where: Record<string, unknown> = {
      id, companyId: r.payload.companyId, deletedAt: null,
    };
    if (isTeamMember(r.payload.role)) where.createdBy = r.payload.userId;
    const result = await db.referenceProject.updateMany({ where, data: parsed.data });
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated = await db.referenceProject.findUnique({ where: { id } });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Update reference-project error:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const r = await gate(req, id);
    if ('fail' in r) return r.fail;
    const where: Record<string, unknown> = {
      id, companyId: r.payload.companyId, deletedAt: null,
    };
    if (isTeamMember(r.payload.role)) where.createdBy = r.payload.userId;
    const result = await db.referenceProject.updateMany({
      where,
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete reference-project error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
