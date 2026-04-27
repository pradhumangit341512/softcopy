import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { requireAdmin } from '@/lib/authorize';

export const runtime = 'nodejs';

/**
 * GET /api/commissions/statement?userId=&from=&to=
 *
 * Per-broker / per-participant statement for a date range. Admin-only —
 * sub-broker payout figures are not visible to other team members.
 *
 * Returns every CommissionSplit the participant is on, with the parent
 * commission context (client, builder, deal amount, status). Filters by
 * commission `createdAt` so the report aligns with how brokerage admins
 * think about reporting periods (the deal closed in this window).
 *
 * The frontend uses this for: pick a sub-broker, pick a date range, see
 * every deal they had a stake in with their share %, share ₹, paid out
 * and outstanding totals.
 *
 * `userId` may be the literal string `external` to filter to splits with
 * `participantUserId: null` (external co-brokers / pre-team-tracking
 * legacy splits).
 */
export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({
        rows: [],
        totals: {
          deals: 0,
          dealAmount: 0,
          shareAmount: 0,
          paidOut: 0,
          outstanding: 0,
        },
      });
    }

    const { searchParams } = new URL(req.url);
    const userIdParam = searchParams.get('userId') || '';
    const fromRaw = searchParams.get('from');
    const toRaw   = searchParams.get('to');

    const fromDate = fromRaw ? new Date(fromRaw) : null;
    const toDate   = toRaw   ? new Date(toRaw)   : null;
    const dateRange: { gte?: Date; lte?: Date } = {};
    if (fromDate && !isNaN(fromDate.getTime())) dateRange.gte = fromDate;
    if (toDate && !isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      dateRange.lte = toDate;
    }
    const hasDateRange = dateRange.gte !== undefined || dateRange.lte !== undefined;

    // Build the splits filter. `external` = any split with no userId.
    // A specific objectId = that participant only. Empty = every split
    // (admin checking the firm-wide payout pipeline).
    const splitWhere: Record<string, unknown> = {
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (userIdParam === 'external') {
      splitWhere.participantUserId = null;
    } else if (userIdParam && isValidObjectId(userIdParam)) {
      splitWhere.participantUserId = userIdParam;
    }
    // Date range filters on the parent commission's createdAt — we want
    // "deals closed in this window", not "splits modified in this window".
    if (hasDateRange) {
      splitWhere.commission = {
        deletedAt: null,
        createdAt: dateRange,
      };
    } else {
      splitWhere.commission = { deletedAt: null };
    }

    const splits = await db.commissionSplit.findMany({
      where: splitWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        commission: {
          select: {
            id: true,
            dealAmount: true,
            commissionAmount: true,
            commissionPercentage: true,
            paidStatus: true,
            builderName: true,
            createdAt: true,
            client: { select: { clientName: true } },
          },
        },
        participant: { select: { id: true, name: true } },
      },
    });

    const rows = splits.map((s) => {
      const outstanding = Math.max(0, s.shareAmount - s.paidOut);
      return {
        splitId: s.id,
        commissionId: s.commissionId,
        participantUserId: s.participantUserId,
        participantName: s.participantName,
        client: s.commission?.client?.clientName ?? '—',
        builder: s.commission?.builderName ?? '',
        dealAmount: s.commission?.dealAmount ?? 0,
        commissionAmount: s.commission?.commissionAmount ?? 0,
        commissionPercentage: s.commission?.commissionPercentage ?? 0,
        sharePercent: s.sharePercent,
        shareAmount: s.shareAmount,
        paidOut: s.paidOut,
        outstanding,
        status: s.status,
        commissionPaidStatus: s.commission?.paidStatus ?? 'Pending',
        createdAt: s.commission?.createdAt ?? s.createdAt,
      };
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.deals += 1;
        acc.dealAmount += r.dealAmount;
        acc.shareAmount += r.shareAmount;
        acc.paidOut += r.paidOut;
        acc.outstanding += r.outstanding;
        return acc;
      },
      { deals: 0, dealAmount: 0, shareAmount: 0, paidOut: 0, outstanding: 0 },
    );

    return NextResponse.json({ rows, totals });
  } catch (error) {
    console.error('Statement endpoint error:', error);
    return NextResponse.json({ error: 'Failed to load statement' }, { status: 500 });
  }
}
