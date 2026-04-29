/**
 * /api/learn/folders/[id]/files — F20
 * POST → add a file (URL-based) to a folder.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { createLearnFileSchema, parseBody } from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

function debugError(err: unknown): string | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const gate = await requireFeature(payload.companyId, 'feature.learn_grow');
    if (!gate.ok) return gate.response;

    const { id: folderId } = await ctx.params;
    if (!isValidObjectId(folderId)) {
      return NextResponse.json({ error: 'Invalid folder id' }, { status: 400 });
    }

    const folder = await db.learnFolder.findFirst({
      where: { id: folderId, companyId: payload.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

    const parsed = await parseBody(req, createLearnFileSchema);
    if (!parsed.ok) return parsed.response;

    const file = await db.learnFile.create({
      data: {
        folderId,
        name: parsed.data.name,
        url: parsed.data.url,
        kind: parsed.data.kind,
        notes: parsed.data.notes,
        createdBy: payload.userId,
        deletedAt: null,
      },
    });
    return NextResponse.json(file, { status: 201 });
  } catch (err) {
    console.error('Create learn file error:', err);
    return NextResponse.json(
      { error: 'Failed to add file', detail: debugError(err) },
      { status: 500 }
    );
  }
}
