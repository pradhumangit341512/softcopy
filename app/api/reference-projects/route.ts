/**
 * /api/reference-projects — F21
 *
 * GET  → list reference projects (with optional search filter)
 * POST → create a reference project
 *
 * Feature gate: feature.reference_db.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import {
  createReferenceProjectSchema,
  parseBody,
} from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';
import { escapeRegex } from '@/lib/utils';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const gate = await requireFeature(payload.companyId, 'feature.reference_db');
    if (!gate.ok) return gate.response;

    const sp = req.nextUrl.searchParams;
    const search = sp.get('search') || '';

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (isTeamMember(payload.role)) where.createdBy = payload.userId;
    if (search) {
      const safe = escapeRegex(search);
      where.OR = [
        { projectName: { contains: safe, mode: 'insensitive' } },
        { location: { contains: safe, mode: 'insensitive' } },
        { sector: { contains: safe, mode: 'insensitive' } },
      ];
    }

    const items = await db.referenceProject.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return NextResponse.json({ items });
  } catch (err) {
    console.error('Fetch reference-projects error:', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const gate = await requireFeature(payload.companyId, 'feature.reference_db');
    if (!gate.ok) return gate.response;

    const parsed = await parseBody(req, createReferenceProjectSchema);
    if (!parsed.ok) return parsed.response;

    const created = await db.referenceProject.create({
      data: {
        ...parsed.data,
        companyId: payload.companyId,
        createdBy: payload.userId,
        deletedAt: null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('Create reference-project error:', err);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
