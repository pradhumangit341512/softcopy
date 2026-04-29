/**
 * /api/learn/files/[id] — F20
 *
 * PUT    — update file metadata (name / url / kind / notes).
 * DELETE — soft-delete (deletedAt timestamp).
 *
 * Tenant safety walks the chain `file → folder.companyId` in a single
 * Prisma query so a caller cannot edit or delete a file in another
 * company's folder by guessing the id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { updateLearnFileSchema, parseBody } from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

function debugError(err: unknown): string | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Verify the caller can act on this file. Returns the payload on success
 * or a ready-to-send fail response. The chain check (file → folder →
 * companyId) is the same on PUT and DELETE so we factor it out. */
async function gate(req: NextRequest, fileId: string) {
  const payload = await verifyAuth(req);
  if (!payload) {
    return { fail: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const f = await requireFeature(payload.companyId, 'feature.learn_grow');
  if (!f.ok) return { fail: f.response };
  if (!isValidObjectId(fileId)) {
    return { fail: NextResponse.json({ error: 'Invalid id' }, { status: 400 }) };
  }
  const file = await db.learnFile.findFirst({
    where: {
      id: fileId,
      deletedAt: null,
      folder: { companyId: payload.companyId, deletedAt: null },
    },
    select: { id: true },
  });
  if (!file) {
    return { fail: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { payload };
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const r = await gate(req, id);
    if ('fail' in r) return r.fail;

    const parsed = await parseBody(req, updateLearnFileSchema);
    if (!parsed.ok) return parsed.response;

    const updated = await db.learnFile.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Update learn file error:', err);
    return NextResponse.json(
      { error: 'Update failed', detail: debugError(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const r = await gate(req, id);
    if ('fail' in r) return r.fail;
    await db.learnFile.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete learn file error:', err);
    return NextResponse.json(
      { error: 'Delete failed', detail: debugError(err) },
      { status: 500 }
    );
  }
}
