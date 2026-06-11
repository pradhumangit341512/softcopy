/**
 * Payroll geo settings (Enterprise HR plan, P2). Admin-only, feature.payroll.
 *
 *   GET /api/payroll/settings  → { geoCheckInEnabled, officeLocations }
 *   PUT /api/payroll/settings  → save geo check-in toggle + office geofences
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { isAdminRole } from '@/lib/authorize';
import { requireFeature } from '@/lib/require-feature';
import { recordAudit } from '@/lib/audit';
import { z } from 'zod';

export const runtime = 'nodejs';

const officeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(10).max(5000),
});

const settingsSchema = z.object({
  geoCheckInEnabled: z.boolean(),
  officeLocations: z.array(officeSchema).max(20),
});

export async function GET() {
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

    const company = await db.company.findUnique({
      where: { id: payload.companyId },
      select: { geoCheckInEnabled: true, officeLocations: true },
    });

    return NextResponse.json({
      geoCheckInEnabled: company?.geoCheckInEnabled ?? false,
      officeLocations: company?.officeLocations ?? [],
    });
  } catch (error) {
    console.error('Payroll settings get error:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
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

    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ') },
        { status: 400 }
      );
    }
    const { geoCheckInEnabled, officeLocations } = parsed.data;

    await db.company.update({
      where: { id: payload.companyId },
      data: { geoCheckInEnabled, officeLocations },
    });

    await recordAudit({
      companyId: payload.companyId, userId: payload.userId,
      action: 'payroll.settings.update', resource: 'Company', resourceId: payload.companyId,
      metadata: { geoCheckInEnabled, offices: officeLocations.length }, req,
    });

    return NextResponse.json({ geoCheckInEnabled, officeLocations });
  } catch (error) {
    console.error('Payroll settings update error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
