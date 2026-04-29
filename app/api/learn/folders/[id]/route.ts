/**
 * /api/learn/folders/[id] — F20
 * GET (with files), PUT (rename), DELETE (soft).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import {
  updateLearnFolderSchema,
  parseBody,
} from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

function debugError(err: unknown): string | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const gate = await requireFeature(payload.companyId, 'feature.learn_grow');
    if (!gate.ok) return gate.response;
    const { id } = await ctx.params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const folder = await db.learnFolder.findFirst({
      where: { id, companyId: payload.companyId, deletedAt: null },
      include: { files: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } } },
    });
    if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(folder);
  } catch (err) {
    console.error('Fetch learn folder error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch folder', detail: debugError(err) },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const gate = await requireFeature(payload.companyId, 'feature.learn_grow');
    if (!gate.ok) return gate.response;
    const { id } = await ctx.params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const parsed = await parseBody(req, updateLearnFolderSchema);
    if (!parsed.ok) return parsed.response;
    const result = await db.learnFolder.updateMany({
      where: { id, companyId: payload.companyId, deletedAt: null },
      data: parsed.data,
    });
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated = await db.learnFolder.findUnique({ where: { id } });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Update learn folder error:', err);
    return NextResponse.json(
      { error: 'Update failed', detail: debugError(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const gate = await requireFeature(payload.companyId, 'feature.learn_grow');
    if (!gate.ok) return gate.response;
    const { id } = await ctx.params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const result = await db.learnFolder.updateMany({
      where: { id, companyId: payload.companyId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete learn folder error:', err);
    return NextResponse.json(
      { error: 'Delete failed', detail: debugError(err) },
      { status: 500 }
    );
  }
}
