/**
 * GET /api/payroll/payslips?period=YYYY-MM
 *
 * Admin list of all payslips for a month (summary fields for the table).
 * Admin-only, feature.payroll-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, isValidObjectId } from '@/lib/auth';
import { isAdminRole } from '@/lib/authorize';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

const PERIOD_RE = /^\d{4}-\d{2}$/;
function currentPeriod(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 7);
}

export async function GET(req: NextRequest) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminRole(payload.role)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }
    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({ period: currentPeriod(), payslips: [] });
    }

    const gate = await requireFeature(payload.companyId, 'feature.payroll');
    if (!gate.ok) return gate.response;

    const raw = new URL(req.url).searchParams.get('period');
    const period = raw && PERIOD_RE.test(raw) ? raw : currentPeriod();

    const payslips = await db.payslip.findMany({
      where: { companyId: payload.companyId, period },
      select: {
        id: true, userId: true, employeeName: true, designation: true, slipNo: true,
        baseSalary: true, commissionTotal: true, absenceDeduction: true,
        grossEarnings: true, netPay: true, status: true, finalizedAt: true,
      },
      orderBy: { employeeName: 'asc' },
    });

    return NextResponse.json({ period, payslips });
  } catch (error) {
    console.error('Payslips list error:', error);
    return NextResponse.json({ error: 'Failed to load payslips' }, { status: 500 });
  }
}
