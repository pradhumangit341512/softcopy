/**
 * PUT /api/payroll/profiles/[userId]
 *
 * Admin/HR upserts a team member's payroll config (base salary, allowances,
 * absence deduction, paid leaves, default commission rate, etc.).
 *
 * - Gated by feature.payroll (Enterprise HR plan), admin-only.
 * - The target member must belong to the caller's company (no cross-tenant writes).
 * - companyId is stamped from the JWT, never from the body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, isValidObjectId } from '@/lib/auth';
import { isAdminRole } from '@/lib/authorize';
import { requireFeature } from '@/lib/require-feature';
import { recordAudit } from '@/lib/audit';
import { z } from 'zod';

export const runtime = 'nodejs';

const MAX_MONEY = 100_000_000; // ₹10 crore upper bound — guards typos/overflow.

const schema = z.object({
  baseSalary: z.number().min(0).max(MAX_MONEY),
  travelAllowance: z.number().min(0).max(MAX_MONEY).default(0),
  otherAllowance: z.number().min(0).max(MAX_MONEY).default(0),
  // null = pro-rate from base salary at payslip time; a number = fixed ₹/day.
  perAbsentDeduction: z.number().min(0).max(MAX_MONEY).nullable().optional(),
  paidLeavesPerMonth: z.number().int().min(0).max(31).default(1),
  defaultCommissionRate: z.number().min(0).max(100).default(0),
  attendanceMode: z.enum(['office', 'field', 'manual']).default('office'),
  designation: z.string().trim().max(100).nullable().optional(),
  joiningDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'joiningDate must be YYYY-MM-DD')
    .nullable()
    .optional()
    .or(z.literal('')),
  pan: z.string().trim().max(20).nullable().optional(),
  active: z.boolean().default(true),
});

export async function PUT(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminRole(payload.role)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { userId } = await context.params;
    if (!userId || !isValidObjectId(userId)) {
      return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
    }

    const gate = await requireFeature(payload.companyId, 'feature.payroll');
    if (!gate.ok) return gate.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ') },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // The member must exist in the caller's company.
    const member = await db.user.findFirst({
      where: { id: userId, companyId: payload.companyId },
      select: { id: true },
    });
    if (!member) {
      return NextResponse.json({ error: 'Member not found in this company' }, { status: 404 });
    }

    const joiningDate = data.joiningDate ? new Date(`${data.joiningDate}T00:00:00`) : null;
    const fields = {
      baseSalary: data.baseSalary,
      travelAllowance: data.travelAllowance,
      otherAllowance: data.otherAllowance,
      perAbsentDeduction: data.perAbsentDeduction ?? null,
      paidLeavesPerMonth: data.paidLeavesPerMonth,
      defaultCommissionRate: data.defaultCommissionRate,
      attendanceMode: data.attendanceMode,
      designation: data.designation?.trim() || null,
      joiningDate,
      pan: data.pan?.trim() || null,
      active: data.active,
    };

    const profile = await db.payrollProfile.upsert({
      where: { userId },
      create: { userId, companyId: payload.companyId, ...fields },
      update: fields,
    });

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'payroll.profile.upsert',
      resource: 'PayrollProfile',
      resourceId: profile.id,
      metadata: { memberId: userId, baseSalary: data.baseSalary, active: data.active },
      req,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Payroll profile upsert error:', error);
    return NextResponse.json({ error: 'Failed to save payroll profile' }, { status: 500 });
  }
}
