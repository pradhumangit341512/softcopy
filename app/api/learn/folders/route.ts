/**
 * /api/learn/folders — F20
 *
 * GET  → list folders for the company (admins see all; team members see
 *        every folder too — Learn & Grow is a shared library, not a
 *        per-user one). Includes file counts.
 * POST → create a folder.
 *
 * Feature gate: feature.learn_grow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import {
  createLearnFolderSchema,
  parseBody,
} from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

/** Surface the real error in dev so callers can see what broke without
 *  hunting through the server log. Stays opaque in prod. */
function debugError(err: unknown): string | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const gate = await requireFeature(payload.companyId, 'feature.learn_grow');
    if (!gate.ok) return gate.response;

    const folders = await db.learnFolder.findMany({
      where: { companyId: payload.companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        files: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });
    return NextResponse.json({
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        createdAt: f.createdAt,
        fileCount: f.files.length,
      })),
    });
  } catch (err) {
    console.error('Fetch learn folders error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch folders', detail: debugError(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const gate = await requireFeature(payload.companyId, 'feature.learn_grow');
    if (!gate.ok) return gate.response;

    const parsed = await parseBody(req, createLearnFolderSchema);
    if (!parsed.ok) return parsed.response;

    const created = await db.learnFolder.create({
      data: {
        companyId: payload.companyId,
        name: parsed.data.name,
        createdBy: payload.userId,
        deletedAt: null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('Create learn folder error:', err);
    return NextResponse.json(
      { error: 'Failed to create folder', detail: debugError(err) },
      { status: 500 }
    );
  }
}
