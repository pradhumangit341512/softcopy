/**
 * GET /api/payroll/payslips/[id]   — full payslip (admin: any in company; member: own, finalized).
 * PUT /api/payroll/payslips/[id]   — admin edits Draft adjustments (additions / other deductions).
 *
 * feature.payroll-gated. Finalized payslips are read-only (PUT → 409).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, isValidObjectId } from '@/lib/auth';
import { isAdminRole } from '@/lib/authorize';
import { requireFeature } from '@/lib/require-feature';
import { recordAudit } from '@/lib/audit';
import { inr, type PayslipLine } from '@/lib/payroll';
import { z } from 'zod';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    if (!id || !isValidObjectId(id)) return NextResponse.json({ error: 'Invalid payslip ID' }, { status: 400 });

    const gate = await requireFeature(payload.companyId, 'feature.payroll');
    if (!gate.ok) return gate.response;

    const payslip = await db.payslip.findFirst({ where: { id, companyId: payload.companyId } });
    if (!payslip) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });

    const isOwner = payslip.userId === payload.userId;
    const isAdmin = isAdminRole(payload.role);
    // Members may only read their own, and only once finalized.
    if (!isAdmin && (!isOwner || payslip.status === 'Draft')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ payslip });
  } catch (error) {
    console.error('Payslip get error:', error);
    return NextResponse.json({ error: 'Failed to load payslip' }, { status: 500 });
  }
}

const putSchema = z.object({
  additions: z.number().min(0).max(100_000_000).default(0),
  otherDeductions: z.number().min(0).max(100_000_000).default(0),
});

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminRole(payload.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { id } = await context.params;
    if (!id || !isValidObjectId(id)) return NextResponse.json({ error: 'Invalid payslip ID' }, { status: 400 });

    const gate = await requireFeature(payload.companyId, 'feature.payroll');
    if (!gate.ok) return gate.response;

    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, { status: 400 });
    }
    const additions = inr(parsed.data.additions);
    const otherDeductions = inr(parsed.data.otherDeductions);

    const slip = await db.payslip.findFirst({ where: { id, companyId: payload.companyId } });
    if (!slip) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    if (slip.status !== 'Draft') {
      return NextResponse.json({ error: 'Finalized payslips cannot be edited' }, { status: 409 });
    }

    const grossEarnings = slip.baseSalary + slip.allowancesTotal + slip.commissionTotal + additions;
    const netPay = grossEarnings - slip.absenceDeduction - otherDeductions;

    // Rebuild lines: keep computed earnings/absence lines, replace adjustment lines.
    const kept = (slip.lines as PayslipLine[]).filter((l) => l.sourceType !== 'adjustment');
    const lines: PayslipLine[] = [...kept];
    if (additions > 0) lines.push({ sourceType: 'adjustment', label: 'Additions / bonus', amount: additions });
    if (otherDeductions > 0) lines.push({ sourceType: 'adjustment', label: 'Other deductions', amount: -otherDeductions });

    const updated = await db.payslip.update({
      where: { id },
      data: { additions, otherDeductions, grossEarnings, netPay, lines },
    });

    await recordAudit({
      companyId: payload.companyId, userId: payload.userId,
      action: 'payslip.adjust', resource: 'Payslip', resourceId: id,
      metadata: { additions, otherDeductions, netPay }, req,
    });

    return NextResponse.json({ payslip: updated });
  } catch (error) {
    console.error('Payslip update error:', error);
    return NextResponse.json({ error: 'Failed to update payslip' }, { status: 500 });
  }
}
