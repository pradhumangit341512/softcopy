/**
 * Attendance API (Enterprise HR plan, P1).
 *
 *   GET  /api/payroll/attendance?period=YYYY-MM
 *        → active members + their attendance rows for the month (admin grid).
 *
 *   POST /api/payroll/attendance   { userId, date, status }
 *        → upsert one member's status for one day. status:null clears the cell.
 *
 * Admin-only, feature.payroll-gated, company-scoped. `date` is a local
 * "YYYY-MM-DD" string so a month is the prefix `YYYY-MM-`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, isValidObjectId } from '@/lib/auth';
import { isAdminRole } from '@/lib/authorize';
import { requireFeature } from '@/lib/require-feature';
import { recordAudit } from '@/lib/audit';
import { ATTENDANCE_VALUES } from '@/lib/attendance';
import { z } from 'zod';

export const runtime = 'nodejs';

const PERIOD_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function currentPeriod(): string {
  // IST-anchored month so the default matches the user's calendar.
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 7);
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
      return NextResponse.json({ members: [], attendance: [], period: currentPeriod() });
    }

    const gate = await requireFeature(payload.companyId, 'feature.payroll');
    if (!gate.ok) return gate.response;

    const raw = new URL(req.url).searchParams.get('period');
    const period = raw && PERIOD_RE.test(raw) ? raw : currentPeriod();

    const [members, attendance] = await Promise.all([
      db.user.findMany({
        where: { companyId: payload.companyId, role: { in: ['admin', 'user'] }, status: 'active' },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
      db.attendance.findMany({
        where: { companyId: payload.companyId, date: { startsWith: `${period}-` } },
        select: { userId: true, date: true, status: true, note: true },
      }),
    ]);

    return NextResponse.json({ period, members, attendance });
  } catch (error) {
    console.error('Attendance list error:', error);
    return NextResponse.json({ error: 'Failed to load attendance' }, { status: 500 });
  }
}

const markSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(DATE_RE, 'date must be YYYY-MM-DD'),
  // null/'' clears the cell; otherwise must be a known status.
  status: z.string().nullable().optional(),
  note: z.string().max(300).nullable().optional(),
});

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
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = markSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }
    const { userId, date, status, note } = parsed.data;

    if (!isValidObjectId(userId)) {
      return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
    }
    if (status && !ATTENDANCE_VALUES.includes(status)) {
      return NextResponse.json({ error: `Unknown status: ${status}` }, { status: 400 });
    }

    // Member must belong to the caller's company.
    const member = await db.user.findFirst({
      where: { id: userId, companyId: payload.companyId },
      select: { id: true },
    });
    if (!member) {
      return NextResponse.json({ error: 'Member not found in this company' }, { status: 404 });
    }

    // No status → clear the cell.
    if (!status) {
      await db.attendance.deleteMany({ where: { userId, date, companyId: payload.companyId } });
      await recordAudit({
        companyId: payload.companyId, userId: payload.userId,
        action: 'attendance.clear', resource: 'Attendance', resourceId: `${userId}:${date}`,
        metadata: { memberId: userId, date }, req,
      });
      return NextResponse.json({ ok: true, cleared: true });
    }

    const record = await db.attendance.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId, companyId: payload.companyId, date, status,
        note: note?.trim() || null, markedBy: payload.userId, source: 'manual',
      },
      update: { status, note: note?.trim() || null, markedBy: payload.userId, source: 'manual' },
    });

    await recordAudit({
      companyId: payload.companyId, userId: payload.userId,
      action: 'attendance.mark', resource: 'Attendance', resourceId: record.id,
      metadata: { memberId: userId, date, status }, req,
    });

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    console.error('Attendance mark error:', error);
    return NextResponse.json({ error: 'Failed to mark attendance' }, { status: 500 });
  }
}
