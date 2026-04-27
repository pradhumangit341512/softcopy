import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { isTeamMember, requireAdmin } from '@/lib/authorize';
import { createCommissionSplitSchema, parseBody } from '@/lib/validations';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * Authorization: GET is open to anyone in the same company who can read
 * the commission (team members get to see their own deal's splits).
 * POST/PATCH/DELETE on splits is admin-only — sub-broker cuts are sensitive.
 */

interface AuthContext {
  companyId: string;
  userId: string;
  role: string;
}

async function loadCommission(commissionId: string, payload: AuthContext) {
  const commission = await db.commission.findFirst({
    where: { id: commissionId, companyId: payload.companyId, deletedAt: null },
    include: { client: { select: { createdBy: true } } },
  });
  if (!commission) return { error: 'Commission not found', status: 404 as const };
  if (isTeamMember(payload.role) && commission.client?.createdBy !== payload.userId) {
    return { error: 'Forbidden — not your commission', status: 403 as const };
  }
  return { commission };
}

/**
 * GET /api/commissions/:id/splits — list non-deleted splits + each split's
 * payout history summary. Returns the running shareAmount + paidOut +
 * status as currently denormalized on each split row.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const access = await loadCommission(id, payload);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const splits = await db.commissionSplit.findMany({
      where: { commissionId: id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { participant: { select: { id: true, name: true } } },
    });

    const totalPercent = splits.reduce((s, x) => s + x.sharePercent, 0);

    return NextResponse.json({
      splits,
      meta: {
        commissionAmount: access.commission.commissionAmount,
        totalPercent,
        // Soft signal — frontend renders a warning chip if not 100.
        balanced: Math.abs(totalPercent - 100) < 0.01,
      },
    });
  } catch (error) {
    console.error('List commission splits error:', error);
    return NextResponse.json({ error: 'Failed to list splits' }, { status: 500 });
  }
}

/**
 * POST /api/commissions/:id/splits — admin only. Add a participant.
 * The route does NOT enforce that splits sum to 100% — soft signal only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    const { id } = await params;

    const access = await loadCommission(id, payload);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const parsed = await parseBody(req, createCommissionSplitSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    // If a participantUserId is provided, verify the user belongs to this
    // company. Cross-tenant write protection.
    if (data.participantUserId) {
      const exists = await db.user.findFirst({
        where: { id: data.participantUserId, companyId: payload.companyId, deletedAt: null },
        select: { id: true },
      });
      if (!exists) {
        return NextResponse.json(
          { error: 'Participant user not found in this company.' },
          { status: 400 },
        );
      }
    }

    const shareAmount = (access.commission.commissionAmount * data.sharePercent) / 100;

    const created = await db.commissionSplit.create({
      data: {
        commissionId: id,
        companyId: payload.companyId,
        participantUserId: data.participantUserId ?? null,
        participantName: data.participantName,
        sharePercent: data.sharePercent,
        shareAmount,
        paidOut: 0,
        status: 'Pending',
        deletedAt: null,
      },
      include: { participant: { select: { id: true, name: true } } },
    });

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'commission.split.create',
      resource: 'CommissionSplit',
      resourceId: created.id,
      metadata: {
        commissionId: id,
        participantName: data.participantName,
        sharePercent: data.sharePercent,
      },
      req,
    });

    return NextResponse.json({ split: created }, { status: 201 });
  } catch (error) {
    console.error('Create commission split error:', error);
    return NextResponse.json({ error: 'Failed to create split' }, { status: 500 });
  }
}
