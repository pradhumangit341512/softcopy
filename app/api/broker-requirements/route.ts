/**
 * /api/broker-requirements — F18
 *
 * GET  → list. Filterable by status, search (name/company/contact),
 *        date range, paginated.
 * POST → create. Stamps companyId + createdBy from the JWT.
 *
 * Feature gate: feature.broker_reqs.
 *
 * Tenant safety: every query is scoped by `companyId = payload.companyId`
 * — a team member can never see another company's broker list.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { isAdminRole, isTeamMember } from '@/lib/authorize';
import {
  createBrokerRequirementSchema,
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

// ==================== GET ====================

export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gate = await requireFeature(payload.companyId, 'feature.broker_reqs');
    if (!gate.ok) return gate.response;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
      deletedAt: null,
    };

    // Team members only see broker requirements they captured. Admins see all.
    if (isTeamMember(payload.role)) {
      where.createdBy = payload.userId;
    } else if (isAdminRole(payload.role)) {
      const createdByFilter = searchParams.get('createdBy');
      if (createdByFilter && isValidObjectId(createdByFilter)) {
        where.createdBy = createdByFilter;
      }
    }

    if (status) {
      const statuses = status.split(',').filter(Boolean);
      if (statuses.length === 1) where.status = statuses[0];
      else if (statuses.length > 1) where.status = { in: statuses };
    }

    if (search) {
      where.OR = [
        { brokerName: { contains: search, mode: 'insensitive' } },
        { brokerCompany: { contains: search, mode: 'insensitive' } },
        { contact: { contains: search } },
        { requirement: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(dateTo);
      where.createdAt = createdAt;
    }

    const [items, total] = await Promise.all([
      db.brokerRequirement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.brokerRequirement.count({ where }),
    ]);

    return NextResponse.json({
      items,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Fetch broker-requirements error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch broker requirements', detail: debugError(err) },
      { status: 500 }
    );
  }
}

// ==================== POST ====================

export async function POST(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Defensive — Prisma + MongoDB throws P2023 ("Malformed ObjectID") deep
    // in the stack if either session id isn't a 24-hex-char string. Catch it
    // here so the user sees a clear "log out and log back in" message.
    if (!isValidObjectId(payload.companyId) || !isValidObjectId(payload.userId)) {
      return NextResponse.json(
        { error: 'Invalid session — please log out and log back in.' },
        { status: 400 }
      );
    }

    const gate = await requireFeature(payload.companyId, 'feature.broker_reqs');
    if (!gate.ok) return gate.response;

    const parsed = await parseBody(req, createBrokerRequirementSchema);
    if (!parsed.ok) return parsed.response;

    const data = parsed.data;
    const created = await db.brokerRequirement.create({
      data: {
        brokerName: data.brokerName,
        brokerCompany: data.brokerCompany,
        contact: data.contact,
        email: data.email,
        status: data.status,
        requirement: data.requirement,
        source: data.source,
        followUpDate: data.followUpDate,
        remark: data.remark,
        companyId: payload.companyId,
        createdBy: payload.userId,
        deletedAt: null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('Create broker-requirement error:', err);
    return NextResponse.json(
      { error: 'Failed to create broker requirement', detail: debugError(err) },
      { status: 500 }
    );
  }
}
