/**
 * /api/projects/[id] — F17
 * GET / PUT / DELETE a single project (with nested towers + units on GET).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import { updateProjectSchema, parseBody } from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

async function resolve(req: NextRequest, id: string) {
  const payload = await verifyAuth(req);
  if (!payload) {
    return { fail: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const gate = await requireFeature(payload.companyId, 'feature.projects_working');
  if (!gate.ok) return { fail: gate.response };
  if (!isValidObjectId(id)) {
    return { fail: NextResponse.json({ error: 'Invalid id' }, { status: 400 }) };
  }
  return { payload };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await resolve(req, id);
  if ('fail' in r) return r.fail;
  const where: Record<string, unknown> = {
    id,
    companyId: r.payload.companyId,
    deletedAt: null,
  };
  if (isTeamMember(r.payload.role)) where.createdBy = r.payload.userId;
  const project = await db.project.findFirst({
    where,
    include: {
      towers: {
        where: { deletedAt: null },
        include: { units: { where: { deletedAt: null } } },
      },
    },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await resolve(req, id);
  if ('fail' in r) return r.fail;
  const parsed = await parseBody(req, updateProjectSchema);
  if (!parsed.ok) return parsed.response;
  const where: Record<string, unknown> = {
    id,
    companyId: r.payload.companyId,
    deletedAt: null,
  };
  if (isTeamMember(r.payload.role)) where.createdBy = r.payload.userId;
  const result = await db.project.updateMany({ where, data: parsed.data });
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const updated = await db.project.findUnique({ where: { id } });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await resolve(req, id);
  if ('fail' in r) return r.fail;
  const where: Record<string, unknown> = {
    id,
    companyId: r.payload.companyId,
    deletedAt: null,
  };
  if (isTeamMember(r.payload.role)) where.createdBy = r.payload.userId;
  const result = await db.project.updateMany({ where, data: { deletedAt: new Date() } });
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
