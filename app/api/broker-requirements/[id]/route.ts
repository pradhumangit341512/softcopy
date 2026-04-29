/**
 * /api/broker-requirements/[id] — F18
 *
 * GET    → load detail
 * PUT    → update (admin: any row in their company; user: only own rows)
 * DELETE → soft delete (deletedAt timestamp)
 *
 * Feature gate: feature.broker_reqs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import {
  updateBrokerRequirementSchema,
  parseBody,
} from '@/lib/validations';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

// ==================== GET ====================

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const gate = await requireFeature(payload.companyId, 'feature.broker_reqs');
    if (!gate.ok) return gate.response;

    const { id } = await context.params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      id,
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (isTeamMember(payload.role)) where.createdBy = payload.userId;

    const item = await db.brokerRequirement.findFirst({ where });
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (err) {
    console.error('Fetch broker-requirement error:', err);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}

// ==================== PUT ====================

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const gate = await requireFeature(payload.companyId, 'feature.broker_reqs');
    if (!gate.ok) return gate.response;

    const { id } = await context.params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const parsed = await parseBody(req, updateBrokerRequirementSchema);
    if (!parsed.ok) return parsed.response;

    const where: Record<string, unknown> = {
      id,
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (isTeamMember(payload.role)) where.createdBy = payload.userId;

    const result = await db.brokerRequirement.updateMany({
      where,
      data: parsed.data,
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Broker requirement not found or not authorized' },
        { status: 404 }
      );
    }
    const updated = await db.brokerRequirement.findUnique({ where: { id } });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Update broker-requirement error:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

// ==================== DELETE (soft) ====================

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const gate = await requireFeature(payload.companyId, 'feature.broker_reqs');
    if (!gate.ok) return gate.response;

    const { id } = await context.params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      id,
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (isTeamMember(payload.role)) where.createdBy = payload.userId;

    const result = await db.brokerRequirement.updateMany({
      where,
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Broker requirement not found or not authorized' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete broker-requirement error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
