import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth, isValidObjectId } from "@/lib/auth";
import { createCommissionSchema, parseBody } from "@/lib/validations";
import { isTeamMember } from "@/lib/authorize";

export const runtime = "nodejs";

// ── GET: List commissions with filters, search, pagination ──
export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({
        commissions: [],
        totals: { totalCommission: 0, pendingCommission: 0 },
        pagination: { page: 1, limit: 10, total: 0, pages: 1 },
      });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "10")));
    const paidStatus = searchParams.get("paidStatus") || undefined;
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    // Optional date range — commissions whose createdAt falls inside
    // [from, to]. Both bounds are inclusive; invalid ISO strings are
    // silently ignored so a bad URL param never breaks the listing.
    const fromRaw = searchParams.get("from");
    const toRaw   = searchParams.get("to");
    const fromDate = fromRaw ? new Date(fromRaw) : null;
    const toDate   = toRaw   ? new Date(toRaw)   : null;
    const dateRange: { gte?: Date; lte?: Date } = {};
    if (fromDate && !isNaN(fromDate.getTime())) dateRange.gte = fromDate;
    if (toDate && !isNaN(toDate.getTime())) {
      // Bump `to` to end-of-day so a filter like "2026-04-01 → 2026-04-01"
      // actually includes everything created that day.
      toDate.setHours(23, 59, 59, 999);
      dateRange.lte = toDate;
    }
    const hasDateRange = dateRange.gte !== undefined || dateRange.lte !== undefined;

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
      deletedAt: null,
    };

    if (isTeamMember(payload.role)) {
      where.client = { createdBy: payload.userId };
    }
    if (paidStatus) where.paidStatus = paidStatus;
    if (hasDateRange) where.createdAt = dateRange;
    if (search) {
      where.OR = [
        { client: { clientName: { contains: search, mode: "insensitive" } } },
        { salesPersonName: { contains: search, mode: "insensitive" } },
      ];
    }

    // Totals respect team-member scoping AND the date range (so the stat
    // cards match what's visible in the list), but NOT the paidStatus/search
    // filters — those narrow the rows a user is looking at, whereas totals
    // describe the whole period.
    const totalsWhere: Record<string, unknown> = {
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (isTeamMember(payload.role)) {
      totalsWhere.client = { createdBy: payload.userId };
    }
    if (hasDateRange) totalsWhere.createdAt = dateRange;

    // Totals come from the ledger-aware fields so Partial rows are split
    // correctly: the paid portion counts as paid, the unpaid portion as
    // pending. The previous implementation grouped by paidStatus and
    // treated a whole Partial commission as either fully paid or fully
    // pending — wrong for every partial-payment case.
    const [commissions, total, sums] = await Promise.all([
      db.commission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { clientName: true } },
          user: { select: { name: true } },
        },
      }),
      db.commission.count({ where }),
      db.commission.aggregate({
        where: totalsWhere,
        _sum: { commissionAmount: true, paidAmount: true },
      }),
    ]);

    const totalCommission   = sums._sum.commissionAmount ?? 0;
    const paidCommission    = sums._sum.paidAmount ?? 0;
    const pendingCommission = Math.max(0, totalCommission - paidCommission);

    return NextResponse.json({
      commissions,
      // `paidCommission` is sent explicitly so the client doesn't have to
      // derive it (total − pending), which would drift if either value
      // rounded differently. Keep both keys so older consumers keep working.
      totals: { totalCommission, pendingCommission, paidCommission },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Get commissions error:", error);
    return NextResponse.json({ error: "Failed to fetch commissions" }, { status: 500 });
  }
}

// ── POST: Create commission ──
export async function POST(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json(
        { error: "Invalid session. Please log out and log in again." },
        { status: 400 }
      );
    }

    const parsed = await parseBody(req, createCommissionSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    // Verify the client belongs to this company (prevents cross-company writes)
    const client = await db.client.findFirst({
      where: { id: data.clientId, companyId: payload.companyId, deletedAt: null },
      select: { id: true, createdBy: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    if (
      isTeamMember(payload.role) &&
      client.createdBy !== payload.userId
    ) {
      return NextResponse.json(
        { error: "Forbidden — not your client" },
        { status: 403 }
      );
    }

    const commissionAmount = (data.dealAmount * data.commissionPercentage) / 100;
    const now = new Date();

    // Normalise the optional initial-payment block. Amount is clamped to
    // commissionAmount so a caller typo can't leave paidAmount > total.
    const initial = data.initialPayment;
    const initialAmount = initial
      ? Math.min(initial.amount, commissionAmount)
      : 0;

    // Derive status from what was paid at creation time.
    const EPS = 0.005;
    const paidStatus =
      initialAmount <= 0
        ? 'Pending'
        : initialAmount + EPS >= commissionAmount
          ? 'Paid'
          : 'Partial';

    const newCommission = await db.commission.create({
      data: {
        clientId: data.clientId,
        companyId: payload.companyId,
        salesPersonName: data.salesPersonName,
        dealAmount: data.dealAmount,
        commissionPercentage: data.commissionPercentage,
        commissionAmount,
        paidAmount: initialAmount,
        paidStatus,
        paymentReference: data.paymentReference,
        paymentDate: paidStatus === 'Paid' ? (initial?.paidOn ?? now) : null,
        deletedAt: null,
      },
      include: {
        client: { select: { clientName: true } },
        user: { select: { name: true } },
      },
    });

    // If the caller recorded an initial payment, write a matching ledger
    // row so the History modal and running totals stay consistent. Failing
    // this shouldn't roll back the commission itself — the worst case is
    // a paidAmount that briefly doesn't have a ledger row, which the next
    // payment action reconciles. Still, log hard failures so we notice.
    if (initial && initialAmount > 0) {
      try {
        await db.commissionPayment.create({
          data: {
            commissionId: newCommission.id,
            companyId: payload.companyId,
            amount: initialAmount,
            paidOn: initial.paidOn,
            method: initial.method ?? null,
            reference: initial.reference ?? data.paymentReference ?? null,
            notes: initial.notes ?? null,
            recordedBy: payload.userId,
            deletedAt: null,
          },
        });
      } catch (err) {
        console.error('Initial commission payment create failed:', err);
      }
    }

    return NextResponse.json({ commission: newCommission }, { status: 201 });
  } catch (error) {
    console.error("Create commission error:", error);
    return NextResponse.json({ error: "Failed to create commission" }, { status: 500 });
  }
}
