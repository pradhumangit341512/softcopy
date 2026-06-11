/**
 * GET /api/payroll/payslips/me
 *
 * The signed-in member's own FINALIZED payslips (drafts are hidden until the
 * admin finalizes them). feature.payroll-gated; any role may read their own.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gate = await requireFeature(payload.companyId, 'feature.payroll');
    if (!gate.ok) return gate.response;

    const payslips = await db.payslip.findMany({
      where: { userId: payload.userId, status: { in: ['Finalized', 'Paid'] } },
      select: { id: true, period: true, slipNo: true, netPay: true, status: true, finalizedAt: true },
      orderBy: { period: 'desc' },
    });

    return NextResponse.json({ payslips });
  } catch (error) {
    console.error('My payslips error:', error);
    return NextResponse.json({ error: 'Failed to load payslips' }, { status: 500 });
  }
}
