/**
 * /api/projects — F17
 *
 * GET  → list projects (with optional propertyType / constructionStatus
 *        filters that drive the 4-quadrant tabs on the page).
 * POST → create a project shell. Towers + units are added via nested
 *        endpoints below.
 *
 * Feature gate: feature.projects_working.
 * Tenant-scoped on every read/write.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import {
  createProjectSchema,
  parseBody,
} from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

/**
 * In dev, expose the actual error message in the 500 response so callers
 * can debug from the browser without reading the server terminal. Prod
 * stays opaque to avoid leaking internals.
 */
function debugError(err: unknown): string | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const gate = await requireFeature(payload.companyId, 'feature.projects_working');
    if (!gate.ok) return gate.response;

    const sp = req.nextUrl.searchParams;
    const propertyType = sp.get('propertyType') || '';
    const constructionStatus = sp.get('constructionStatus') || '';

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (propertyType) where.propertyType = propertyType;
    if (constructionStatus) where.constructionStatus = constructionStatus;
    if (isTeamMember(payload.role)) where.createdBy = payload.userId;

    const projects = await db.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        towers: {
          where: { deletedAt: null },
          include: {
            units: { where: { deletedAt: null }, take: 200 },
          },
        },
      },
    });

    return NextResponse.json({ projects });
  } catch (err) {
    console.error('Fetch projects error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch projects', detail: debugError(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Sanity-check the session before letting Prisma reject the insert with
    // a confusing P2023 ("Malformed ObjectID") deep in the stack.
    if (!isValidObjectId(payload.companyId) || !isValidObjectId(payload.userId)) {
      return NextResponse.json(
        { error: 'Invalid session — please log out and log back in.' },
        { status: 400 }
      );
    }

    const gate = await requireFeature(payload.companyId, 'feature.projects_working');
    if (!gate.ok) return gate.response;

    const parsed = await parseBody(req, createProjectSchema);
    if (!parsed.ok) return parsed.response;

    const created = await db.project.create({
      data: {
        ...parsed.data,
        companyId: payload.companyId,
        createdBy: payload.userId,
        deletedAt: null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('Create project error:', err);
    return NextResponse.json(
      { error: 'Failed to create project', detail: debugError(err) },
      { status: 500 }
    );
  }
}
