/**
 * POST /api/clients/bulk-follow-up
 *
 * Apply a follow-up action to many leads at once. Three actions:
 *
 *   - set_date : set/reschedule followUpDate to a fixed date on all selected.
 *   - snooze   : push each lead's followUpDate by N days (base = today if none).
 *   - complete : record an outcome on each (append history, smart-link status,
 *                roll forward via explicit nextDate or the outcome's cadence).
 *
 * Mirrors /api/clients/bulk-transfer: max 100 ids, company-scoped, team
 * members only act on leads they own, per-lead audit, and a {updated, skipped}
 * summary so partial results are visible.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, isValidObjectId } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import { recordAudit } from '@/lib/audit';
import { getDisposition, suggestedNextDate } from '@/lib/follow-up';
import { z } from 'zod';

export const runtime = 'nodejs';

const MAX_BULK = 100;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const schema = z.object({
  clientIds: z.array(z.string()).min(1).max(MAX_BULK),
  action: z.enum(['set_date', 'snooze', 'complete']),
  date: z.string().regex(DATE_RE).optional(),
  snoozeDays: z.number().int().min(1).max(365).optional(),
  outcome: z.string().optional(),
  note: z.string().max(1000).optional(),
  nextDate: z.string().regex(DATE_RE).optional().or(z.literal('')),
});

/** Local YYYY-MM-DD → Date at local midnight. */
function toDate(d: string): Date {
  return new Date(`${d}T00:00:00`);
}

export async function POST(req: NextRequest) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }
    const { clientIds, action, date, snoozeDays, outcome, note, nextDate } = parsed.data;

    for (const cid of clientIds) {
      if (!isValidObjectId(cid)) {
        return NextResponse.json({ error: `Invalid client id: ${cid}` }, { status: 400 });
      }
    }

    // Per-action required-field validation.
    const disp = action === 'complete' ? getDisposition(outcome ?? '') : undefined;
    if (action === 'set_date' && !date) {
      return NextResponse.json({ error: 'A date is required to set follow-ups' }, { status: 400 });
    }
    if (action === 'snooze' && !snoozeDays) {
      return NextResponse.json({ error: 'snoozeDays is required to snooze' }, { status: 400 });
    }
    if (action === 'complete' && !disp) {
      return NextResponse.json({ error: 'A valid outcome is required to complete' }, { status: 400 });
    }

    // Load the candidate leads under the caller's ownership scope. Anything not
    // returned (not owned / not found / deleted) is implicitly skipped.
    const where: Record<string, unknown> = {
      id: { in: clientIds },
      companyId: payload.companyId,
      deletedAt: null,
    };
    if (isTeamMember(payload.role)) {
      where.OR = [
        { ownedBy: payload.userId },
        { ownedBy: null, createdBy: payload.userId },
      ];
    }
    const leads = await db.client.findMany({
      where,
      select: { id: true, followUpDate: true },
    });
    if (leads.length === 0) {
      return NextResponse.json({ error: 'No matching leads found' }, { status: 404 });
    }

    const now = new Date();
    const actor = await db.user.findUnique({
      where: { id: payload.userId },
      select: { name: true },
    });

    let updated = 0;
    const updatedIds: string[] = [];

    // ── set_date: one fixed date for all → single updateMany ──
    if (action === 'set_date') {
      const res = await db.client.updateMany({
        where: { id: { in: leads.map((l) => l.id) } },
        data: { followUpDate: toDate(date!) },
      });
      updated = res.count;
      updatedIds.push(...leads.map((l) => l.id));
    }

    // ── snooze: per-lead (existing date or today) + N days ──
    else if (action === 'snooze') {
      for (const lead of leads) {
        const base = lead.followUpDate ? new Date(lead.followUpDate) : new Date(now);
        base.setDate(base.getDate() + snoozeDays!);
        await db.client.update({ where: { id: lead.id }, data: { followUpDate: base } });
        updated++;
        updatedIds.push(lead.id);
      }
    }

    // ── complete: record outcome on each ──
    else {
      // Explicit next date wins; otherwise use the outcome's cadence default.
      const next = nextDate
        ? toDate(nextDate)
        : (() => {
            const s = suggestedNextDate(outcome!, now);
            return s ? toDate(s) : null;
          })();

      for (const lead of leads) {
        await db.client.update({
          where: { id: lead.id },
          data: {
            followUps: {
              push: {
                date: now,
                outcome: disp!.value,
                label: disp!.label,
                note: note?.trim() || null,
                byUserId: payload.userId,
                byName: actor?.name ?? null,
                nextDate: next,
              },
            },
            lastFollowUpOutcome: disp!.value,
            lastFollowUpLabel: disp!.label,
            lastFollowUpAt: now,
            followUpDate: next,
            lastContactDate: now,
            ...(disp!.status ? { status: disp!.status } : {}),
            ...(disp!.setsVisited ? { propertyVisited: true, visitStatus: 'Visited' } : {}),
          },
        });
        updated++;
        updatedIds.push(lead.id);
      }
    }

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'client.bulk_followup',
      resource: 'Client',
      resourceId: updatedIds[0] ?? 'bulk',
      metadata: { action, count: updated, outcome: outcome ?? null, date: date ?? null, snoozeDays: snoozeDays ?? null, bulk: true },
      req,
    });

    return NextResponse.json({
      success: true,
      updated,
      skipped: clientIds.length - updated,
      total: clientIds.length,
    });
  } catch (error) {
    console.error('Bulk follow-up error:', error);
    return NextResponse.json({ error: 'Bulk follow-up failed' }, { status: 500 });
  }
}
