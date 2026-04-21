import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { requireAdmin } from '@/lib/authorize';

export const runtime = 'nodejs';

/**
 * GET /api/commissions/breakdown?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Admin-only accounting view. Returns the selected window aggregated three ways:
 *   - monthly:     one bucket per calendar month containing that month's deals,
 *                  gross deal value, commission earned, amount collected,
 *                  and amount still pending.
 *   - byPerformer: per-salesperson rollup (userId-linked rows first,
 *                  name-only rows second, merged and sorted desc by commission).
 *   - totals:      whole-window summary.
 *
 * Hard constraints:
 *   - Company-scoped — cross-tenant leakage is impossible because every match
 *     stage filters by `companyId`.
 *   - Soft-deletes excluded — `deletedAt: null` everywhere.
 *   - Team members are blocked. `hisab` is admin territory; the dashboard
 *     never calls this for role='user'.
 *   - Invalid date params are silently dropped rather than 400-ing, so a bad
 *     URL never breaks the report view.
 */
export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const forbidden = requireAdmin(payload);
    if (forbidden) return forbidden;

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({
        monthly: [],
        byPerformer: [],
        totals: { deals: 0, revenue: 0, commission: 0, paid: 0, pending: 0 },
      });
    }

    const { searchParams } = new URL(req.url);
    const fromRaw = searchParams.get('from');
    const toRaw   = searchParams.get('to');
    const fromDate = fromRaw ? new Date(fromRaw) : null;
    const toDate   = toRaw   ? new Date(toRaw)   : null;
    const validFrom = fromDate && !isNaN(fromDate.getTime()) ? fromDate : null;
    const validTo = (() => {
      if (!toDate || isNaN(toDate.getTime())) return null;
      // Include everything created on the `to` day, not just midnight.
      const t = new Date(toDate);
      t.setHours(23, 59, 59, 999);
      return t;
    })();

    // Build the shared $match stage. All three aggregations use the same
    // base so the numbers reconcile — the table totals must equal the
    // sum of the monthly rows must equal the sum of the performer rows.
    // Typed as InputJsonValue so Prisma's aggregateRaw accepts it without
    // a broad `as any` escape hatch.
    type JV = Prisma.InputJsonValue;
    const matchStage: Record<string, JV> = {
      companyId: { $oid: payload.companyId },
      deletedAt: null as unknown as JV,
    };
    if (validFrom || validTo) {
      const range: Record<string, JV> = {};
      if (validFrom) range.$gte = { $date: validFrom.toISOString() };
      if (validTo)   range.$lte = { $date: validTo.toISOString()   };
      matchStage.createdAt = range;
    }

    // ── MONTHLY BUCKETS ──────────────────────────────────────────────
    // Group by `YYYY-MM` of createdAt. Sums use the same fields the list
    // endpoint exposes so monthly totals equal list totals for the same
    // window.
    const monthlyRaw = (await db.commission.aggregateRaw({
      pipeline: [
        { $match: matchStage },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: '$createdAt' },
            },
            deals:      { $sum: 1 },
            revenue:    { $sum: '$dealAmount' },
            commission: { $sum: '$commissionAmount' },
            paid:       { $sum: '$paidAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ],
    })) as unknown as Array<{
      _id: string;
      deals: number;
      revenue: number;
      commission: number;
      paid: number;
    }>;

    const monthly = monthlyRaw.map((m) => ({
      month:      m._id,               // 'YYYY-MM'
      deals:      m.deals ?? 0,
      revenue:    m.revenue ?? 0,
      commission: m.commission ?? 0,
      paid:       m.paid ?? 0,
      pending:    Math.max(0, (m.commission ?? 0) - (m.paid ?? 0)),
    }));

    // ── PER-PERFORMER (userId-linked) ────────────────────────────────
    const userPerfRaw = (await db.commission.aggregateRaw({
      pipeline: [
        { $match: { ...matchStage, userId: { $ne: null } } },
        {
          $group: {
            _id:        '$userId',
            deals:      { $sum: 1 },
            revenue:    { $sum: '$dealAmount' },
            commission: { $sum: '$commissionAmount' },
            paid:       { $sum: '$paidAmount' },
          },
        },
      ],
    })) as unknown as Array<{
      _id: { $oid: string } | string;
      deals: number;
      revenue: number;
      commission: number;
      paid: number;
    }>;

    // Resolve user names for the id-linked bucket. One findMany round-trip,
    // not N queries. Falls back to "Unknown" for users that have been
    // hard-deleted (shouldn't happen with soft delete, but defensive).
    const userIds = userPerfRaw
      .map((r) => (typeof r._id === 'string' ? r._id : r._id?.$oid))
      .filter((x): x is string => !!x);
    const userRows = userIds.length
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameByUserId = new Map(userRows.map((u) => [u.id, u.name]));

    const userPerformers = userPerfRaw.map((r) => {
      const userId = typeof r._id === 'string' ? r._id : r._id?.$oid ?? '';
      return {
        userId,
        name:       nameByUserId.get(userId) ?? 'Unknown',
        deals:      r.deals ?? 0,
        revenue:    r.revenue ?? 0,
        commission: r.commission ?? 0,
        paid:       r.paid ?? 0,
        pending:    Math.max(0, (r.commission ?? 0) - (r.paid ?? 0)),
      };
    });

    // ── PER-PERFORMER (name-only, no userId) ─────────────────────────
    // Legacy commissions logged with a free-text salesPersonName and no
    // linked user. Merge them into the same list so admins see every
    // contributor for the period.
    const namedPerfRaw = (await db.commission.aggregateRaw({
      pipeline: [
        {
          $match: {
            ...matchStage,
            userId: null,
            salesPersonName: { $ne: null },
          },
        },
        {
          $group: {
            _id:        '$salesPersonName',
            deals:      { $sum: 1 },
            revenue:    { $sum: '$dealAmount' },
            commission: { $sum: '$commissionAmount' },
            paid:       { $sum: '$paidAmount' },
          },
        },
      ],
    })) as unknown as Array<{
      _id: string;
      deals: number;
      revenue: number;
      commission: number;
      paid: number;
    }>;

    const namedPerformers = namedPerfRaw.map((r) => ({
      userId:     null as string | null,
      name:       r._id || 'Unknown',
      deals:      r.deals ?? 0,
      revenue:    r.revenue ?? 0,
      commission: r.commission ?? 0,
      paid:       r.paid ?? 0,
      pending:    Math.max(0, (r.commission ?? 0) - (r.paid ?? 0)),
    }));

    const byPerformer = [...userPerformers, ...namedPerformers].sort(
      (a, b) => b.commission - a.commission
    );

    // ── TOTALS (re-derived from monthly so the numbers are provably
    // consistent with the monthly rows shown to the user) ────────────
    const totals = monthly.reduce(
      (acc, m) => {
        acc.deals      += m.deals;
        acc.revenue    += m.revenue;
        acc.commission += m.commission;
        acc.paid       += m.paid;
        acc.pending    += m.pending;
        return acc;
      },
      { deals: 0, revenue: 0, commission: 0, paid: 0, pending: 0 }
    );

    return NextResponse.json({
      monthly,
      byPerformer,
      totals,
      // Echo the window back so the client can label "Feb 2026 (partial)"
      // if the user picked a partial-month custom range.
      range: {
        from: validFrom?.toISOString() ?? null,
        to:   validTo?.toISOString() ?? null,
      },
    });
  } catch (error) {
    // Do not leak raw Mongo/Prisma errors to the client — they can contain
    // internal field names. Log to the server, send a stable string out.
    console.error(
      'Commission breakdown error:',
      error instanceof Prisma.PrismaClientKnownRequestError
        ? { code: error.code, meta: error.meta }
        : error
    );
    return NextResponse.json(
      { error: 'Failed to compute commission breakdown' },
      { status: 500 }
    );
  }
}
