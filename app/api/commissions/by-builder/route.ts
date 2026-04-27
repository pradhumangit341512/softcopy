import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { requireAdmin } from '@/lib/authorize';

export const runtime = 'nodejs';

/**
 * GET /api/commissions/by-builder?from=&to=
 *
 * Builder-wise rollup of every deal in the date window. Admin-only —
 * builder relationships and totals are firm-level information.
 *
 * Per builder we return:
 *   deals              count of commissions with that builderName
 *   dealAmount         sum of dealAmount
 *   dealAmountPaid     sum of buyer→builder payments received so far
 *   commissionAmount   sum of commission earned by the brokerage
 *   paidAmount         sum of commission already received from the builder
 *
 * Commissions with no `builderName` are bucketed under the literal
 * "Unspecified" — they're shown so the totals reconcile, not silently
 * dropped.
 */
export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({ rows: [], totals: emptyTotals() });
    }

    const { searchParams } = new URL(req.url);
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

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (hasDateRange) where.createdAt = dateRange;

    const commissions = await db.commission.findMany({
      where,
      select: {
        id: true,
        builderName: true,
        dealAmount: true,
        dealAmountPaid: true,
        commissionAmount: true,
        paidAmount: true,
        paidStatus: true,
        dealStatus: true,
      },
    });

    // Bucket in memory — Prisma's groupBy is awkward across multi-aggregate
    // shapes and the dataset is bounded by company size. ~few-thousand
    // rows is well within memory.
    const buckets = new Map<string, BuilderRow>();

    for (const c of commissions) {
      const key = (c.builderName?.trim() || 'Unspecified');
      if (!buckets.has(key)) {
        buckets.set(key, {
          builder: key,
          deals: 0,
          dealAmount: 0,
          dealAmountPaid: 0,
          commissionAmount: 0,
          paidAmount: 0,
          openDeals: 0,
          completedDeals: 0,
          unpaidCommissions: 0,
        });
      }
      const b = buckets.get(key)!;
      b.deals += 1;
      b.dealAmount += c.dealAmount ?? 0;
      b.dealAmountPaid += c.dealAmountPaid ?? 0;
      b.commissionAmount += c.commissionAmount ?? 0;
      b.paidAmount += c.paidAmount ?? 0;
      if (c.dealStatus === 'Completed') b.completedDeals += 1;
      else b.openDeals += 1;
      if (c.paidStatus !== 'Paid') b.unpaidCommissions += 1;
    }

    const rows = [...buckets.values()].sort((a, b) => b.commissionAmount - a.commissionAmount);

    const totals = rows.reduce(
      (acc, r) => {
        acc.deals += r.deals;
        acc.dealAmount += r.dealAmount;
        acc.dealAmountPaid += r.dealAmountPaid;
        acc.commissionAmount += r.commissionAmount;
        acc.paidAmount += r.paidAmount;
        return acc;
      },
      emptyTotals(),
    );

    return NextResponse.json({ rows, totals });
  } catch (error) {
    console.error('By-builder endpoint error:', error);
    return NextResponse.json({ error: 'Failed to load builder rollup' }, { status: 500 });
  }
}

interface BuilderRow {
  builder: string;
  deals: number;
  dealAmount: number;
  dealAmountPaid: number;
  commissionAmount: number;
  paidAmount: number;
  openDeals: number;
  completedDeals: number;
  unpaidCommissions: number;
}

function emptyTotals() {
  return {
    deals: 0,
    dealAmount: 0,
    dealAmountPaid: 0,
    commissionAmount: 0,
    paidAmount: 0,
  };
}
