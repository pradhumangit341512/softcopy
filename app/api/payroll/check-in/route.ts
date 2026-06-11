/**
 * Member geo check-in (Enterprise HR plan, P2).
 *
 *   GET  /api/payroll/check-in  → { geoEnabled, mode, today, checkedIn }
 *   POST /api/payroll/check-in  { lat, lng, accuracy? }
 *        → server validates distance to an office geofence and marks the
 *          member Present for today (source 'geo').
 *
 * Any authenticated member acts on THEIR OWN attendance only. Distance is
 * always computed server-side — the client is never trusted to enforce it.
 *
 * Modes (Member's PayrollProfile.attendanceMode):
 *   - office : must be within radiusMeters of an office → else rejected.
 *   - field  : any location accepted (logged with distance for audit).
 *   - manual : self check-in disabled (admin marks only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { requireFeature } from '@/lib/require-feature';
import { recordAudit } from '@/lib/audit';
import { nearestOffice, isValidLatLng, type OfficeLocation } from '@/lib/geo';
import { z } from 'zod';

export const runtime = 'nodejs';

function istToday(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

async function loadContext(companyId: string, userId: string) {
  const [company, profile] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { geoCheckInEnabled: true, officeLocations: true } }),
    db.payrollProfile.findUnique({ where: { userId }, select: { attendanceMode: true } }),
  ]);
  return {
    geoEnabled: company?.geoCheckInEnabled ?? false,
    offices: (company?.officeLocations ?? []) as OfficeLocation[],
    mode: profile?.attendanceMode ?? 'office',
  };
}

export async function GET() {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const gate = await requireFeature(payload.companyId, 'feature.payroll');
    if (!gate.ok) return gate.response;

    const today = istToday();
    const { geoEnabled, mode } = await loadContext(payload.companyId, payload.userId);
    const checkedIn = await db.attendance.findUnique({
      where: { userId_date: { userId: payload.userId, date: today } },
      select: { status: true, source: true, checkInAt: true, withinGeofence: true },
    });

    return NextResponse.json({ geoEnabled, mode, today, checkedIn });
  } catch (error) {
    console.error('Check-in status error:', error);
    return NextResponse.json({ error: 'Failed to load check-in status' }, { status: 500 });
  }
}

const schema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number().nonnegative().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    if (!parsed.success || !isValidLatLng(parsed.data.lat, parsed.data.lng)) {
      return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
    }
    const { lat, lng, accuracy } = parsed.data;

    const { geoEnabled, offices, mode } = await loadContext(payload.companyId, payload.userId);
    if (!geoEnabled) {
      return NextResponse.json({ error: 'Geo check-in is not enabled' }, { status: 403 });
    }
    if (mode === 'manual') {
      return NextResponse.json({ error: 'Self check-in is not enabled for your account' }, { status: 403 });
    }

    const today = istToday();

    // Idempotent — don't overwrite an existing mark (e.g. admin-set) for today.
    const existing = await db.attendance.findUnique({
      where: { userId_date: { userId: payload.userId, date: today } },
      select: { status: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, alreadyMarked: true, status: existing.status });
    }

    const near = nearestOffice(lat, lng, offices);

    if (mode === 'office') {
      if (offices.length === 0) {
        return NextResponse.json({ error: 'No office location configured. Contact your admin.' }, { status: 400 });
      }
      if (!near.within) {
        return NextResponse.json(
          {
            error: `You're ${Math.round(near.distance)}m from ${near.office?.name ?? 'the office'} — check-in needs you within ${near.office?.radiusMeters ?? 0}m.`,
            distance: Math.round(near.distance),
            within: false,
          },
          { status: 422 }
        );
      }
    }

    const now = new Date();
    const record = await db.attendance.create({
      data: {
        userId: payload.userId,
        companyId: payload.companyId,
        date: today,
        status: 'present',
        source: 'geo',
        markedBy: payload.userId,
        checkInAt: now,
        checkInLat: lat,
        checkInLng: lng,
        checkInAccuracy: accuracy ?? null,
        checkInDistance: Number.isFinite(near.distance) ? Math.round(near.distance) : null,
        withinGeofence: near.within,
      },
    });

    await recordAudit({
      companyId: payload.companyId, userId: payload.userId,
      action: 'attendance.checkin', resource: 'Attendance', resourceId: record.id,
      metadata: { date: today, mode, within: near.within, distance: Math.round(near.distance) }, req,
    });

    return NextResponse.json({
      ok: true,
      status: 'present',
      within: near.within,
      distance: Number.isFinite(near.distance) ? Math.round(near.distance) : null,
      office: near.office?.name ?? null,
    });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json({ error: 'Check-in failed' }, { status: 500 });
  }
}
