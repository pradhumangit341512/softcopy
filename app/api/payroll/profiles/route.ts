/**
 * GET /api/payroll/profiles
 *
 * Admin/HR view: every team member in the company alongside their payroll
 * profile (salary, allowances, absence policy, commission rate). Members
 * without a profile yet come back with `profile: null`.
 *
 * Gated by feature.payroll (Enterprise HR plan) and admin-only.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, isValidObjectId } from '@/lib/auth';
import { isAdminRole } from '@/lib/authorize';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminRole(payload.role)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }
    if (!isValidObjectId(payload.companyId)) {
      return NextResponse.json({ members: [] });
    }

    const gate = await requireFeature(payload.companyId, 'feature.payroll');
    if (!gate.ok) return gate.response;

    const [users, profiles] = await Promise.all([
      db.user.findMany({
        where: { companyId: payload.companyId, role: { in: ['admin', 'user'] }, status: 'active' },
        select: { id: true, name: true, email: true, role: true, status: true },
        orderBy: { name: 'asc' },
      }),
      db.payrollProfile.findMany({ where: { companyId: payload.companyId } }),
    ]);

    const byUser = new Map(profiles.map((p) => [p.userId, p]));
    const members = users.map((u) => ({ ...u, profile: byUser.get(u.id) ?? null }));

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Payroll profiles list error:', error);
    return NextResponse.json({ error: 'Failed to load payroll profiles' }, { status: 500 });
  }
}
