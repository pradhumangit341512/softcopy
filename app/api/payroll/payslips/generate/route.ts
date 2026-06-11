/**
 * POST /api/payroll/payslips/generate   { period: "YYYY-MM" }
 *
 * Generate/refresh Draft payslips for every member on payroll for the month:
 *   base + allowances + commission − absence deduction.
 *
 * - Commission accrual rule (v1): a commission counts when it is COLLECTED —
 *   paidStatus = 'Paid' and paymentDate falls in the month. Split deals pay
 *   each participant their CommissionSplit.shareAmount (status 'Paid'); a deal
 *   with no splits pays its owner (userId) the full commissionAmount.
 * - Finalized/Paid payslips are NEVER overwritten (immutable). Only Drafts are
 *   (re)generated, so this is safe to re-run.
 *
 * Admin-only, feature.payroll-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { isAdminRole } from '@/lib/authorize';
import { requireFeature } from '@/lib/require-feature';
import { recordAudit } from '@/lib/audit';
import { computePayslip, type CommissionLine } from '@/lib/payroll';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/, 'period must be YYYY-MM') });

/** Company slip-number prefix from the company name (alnum, ≤4 chars). */
function slipPrefix(name: string | null | undefined): string {
  const letters = (name ?? 'CO').replace(/[^A-Za-z]/g, '').toUpperCase();
  return (letters.slice(0, 4) || 'CO');
}

export async function POST(req: NextRequest) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminRole(payload.role)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const gate = await requireFeature(payload.companyId, 'feature.payroll');
    if (!gate.ok) return gate.response;

    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, { status: 400 });
    }
    const { period } = parsed.data;
    const [y, m] = period.split('-').map(Number);
    const start = new Date(y, m - 1, 1, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);

    const [company, profiles, attendance, commissions, existing] = await Promise.all([
      db.company.findUnique({ where: { id: payload.companyId }, select: { companyName: true } }),
      db.payrollProfile.findMany({
        where: { companyId: payload.companyId, active: true },
        include: { user: { select: { name: true } } },
      }),
      db.attendance.findMany({
        where: { companyId: payload.companyId, date: { startsWith: `${period}-` } },
        select: { userId: true, status: true },
      }),
      db.commission.findMany({
        where: { companyId: payload.companyId, paidStatus: 'Paid', paymentDate: { gte: start, lte: end }, deletedAt: null },
        select: {
          userId: true, commissionAmount: true, paymentDate: true,
          client: { select: { clientName: true } },
          splits: { where: { deletedAt: null }, select: { participantUserId: true, shareAmount: true, status: true } },
        },
      }),
      db.payslip.findMany({ where: { companyId: payload.companyId, period }, select: { userId: true, status: true } }),
    ]);

    // Group attendance statuses per member.
    const statusByUser = new Map<string, string[]>();
    for (const a of attendance) {
      const arr = statusByUser.get(a.userId) ?? [];
      arr.push(a.status);
      statusByUser.set(a.userId, arr);
    }

    // Distribute paid commissions into per-member lines.
    const commByUser = new Map<string, CommissionLine[]>();
    const pushComm = (uid: string, line: CommissionLine) => {
      const arr = commByUser.get(uid) ?? [];
      arr.push(line);
      commByUser.set(uid, arr);
    };
    for (const c of commissions) {
      const dateStr = c.paymentDate ? c.paymentDate.toISOString().slice(0, 10) : null;
      const clientName = c.client?.clientName ?? null;
      const paidSplits = c.splits.filter((s) => s.participantUserId && s.status === 'Paid');
      if (paidSplits.length > 0) {
        for (const s of paidSplits) {
          pushComm(s.participantUserId as string, { label: 'Commission', amount: s.shareAmount, clientName, date: dateStr });
        }
      } else if (c.splits.length === 0 && c.userId) {
        pushComm(c.userId, { label: 'Commission', amount: c.commissionAmount, clientName, date: dateStr });
      }
    }

    const finalized = new Set(existing.filter((p) => p.status !== 'Draft').map((p) => p.userId));
    const prefix = slipPrefix(company?.companyName);

    let generated = 0;
    let skipped = 0;
    let i = 0;
    for (const profile of profiles) {
      i += 1;
      if (finalized.has(profile.userId)) { skipped += 1; continue; }

      const computed = computePayslip({
        period,
        baseSalary: profile.baseSalary,
        travelAllowance: profile.travelAllowance,
        otherAllowance: profile.otherAllowance,
        perAbsentDeduction: profile.perAbsentDeduction,
        paidLeavesPerMonth: profile.paidLeavesPerMonth,
        attendanceStatuses: statusByUser.get(profile.userId) ?? [],
        commissionLines: commByUser.get(profile.userId) ?? [],
      });

      const slipNo = `${prefix}/${y}/${String(m).padStart(2, '0')}/${String(i).padStart(4, '0')}`;
      const snapshot = {
        companyId: payload.companyId, period,
        companyName: company?.companyName ?? null,
        employeeName: profile.user?.name ?? 'Member',
        designation: profile.designation ?? null,
        pan: profile.pan ?? null,
        slipNo,
        baseSalary: computed.baseSalary,
        allowancesTotal: computed.allowancesTotal,
        commissionTotal: computed.commissionTotal,
        additions: computed.additions,
        grossEarnings: computed.grossEarnings,
        presentDays: computed.presentDays,
        absentUnits: computed.absentUnits,
        paidLeaves: computed.paidLeaves,
        absenceDeduction: computed.absenceDeduction,
        otherDeductions: computed.otherDeductions,
        netPay: computed.netPay,
        lines: computed.lines,
        status: 'Draft',
        generatedAt: new Date(),
      };

      await db.payslip.upsert({
        where: { userId_period: { userId: profile.userId, period } },
        create: { userId: profile.userId, ...snapshot },
        update: snapshot,
      });
      generated += 1;
    }

    await recordAudit({
      companyId: payload.companyId, userId: payload.userId,
      action: 'payslip.generate', resource: 'Payslip', resourceId: period,
      metadata: { period, generated, skipped }, req,
    });

    return NextResponse.json({ period, generated, skipped, members: profiles.length });
  } catch (error) {
    console.error('Payslip generate error:', error);
    return NextResponse.json({ error: 'Failed to generate payslips' }, { status: 500 });
  }
}
