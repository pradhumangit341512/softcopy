/**
 * POST /api/payroll/payslips/[id]/finalize
 *
 * Lock a Draft payslip into an immutable Finalized snapshot. Once finalized,
 * later edits to deals/attendance never change it, and the member can download
 * it. Admin-only, feature.payroll-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, isValidObjectId } from '@/lib/auth';
import { isAdminRole } from '@/lib/authorize';
import { requireFeature } from '@/lib/require-feature';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminRole(payload.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { id } = await context.params;
    if (!id || !isValidObjectId(id)) return NextResponse.json({ error: 'Invalid payslip ID' }, { status: 400 });

    const gate = await requireFeature(payload.companyId, 'feature.payroll');
    if (!gate.ok) return gate.response;

    const slip = await db.payslip.findFirst({ where: { id, companyId: payload.companyId }, select: { id: true, status: true } });
    if (!slip) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    if (slip.status !== 'Draft') {
      return NextResponse.json({ error: 'Payslip is already finalized' }, { status: 409 });
    }

    const updated = await db.payslip.update({
      where: { id },
      data: { status: 'Finalized', finalizedAt: new Date(), finalizedBy: payload.userId },
      select: { id: true, status: true, finalizedAt: true },
    });

    await recordAudit({
      companyId: payload.companyId, userId: payload.userId,
      action: 'payslip.finalize', resource: 'Payslip', resourceId: id, metadata: {}, req,
    });

    return NextResponse.json({ payslip: updated });
  } catch (error) {
    console.error('Payslip finalize error:', error);
    return NextResponse.json({ error: 'Failed to finalize payslip' }, { status: 500 });
  }
}
