/**
 * POST /api/clients/[id]/follow-up
 *
 * Complete the lead's current follow-up with an outcome ("what the client
 * said"). This is the single source of the follow-up lifecycle:
 *
 *   1. Appends a timeline entry to Client.followUps (append-only history).
 *   2. Denormalizes the latest outcome → lastFollowUpOutcome/Label/At.
 *   3. Rolls the active follow-up forward: nextDate → followUpDate, or clears
 *      it when no next date (the lead's follow-ups are finished).
 *   4. Stamps lastContactDate = now.
 *   5. Smart-links Status (e.g. "Not interested" → Rejected) and flips
 *      propertyVisited for "Site visit done" — per lib/follow-up.ts config.
 *
 * A dedicated endpoint (not the generic PUT) so the history append + status
 * link are atomic and explicit — the generic PUT has a contact-event side
 * effect we deliberately avoid here.
 *
 * - Admins act on any lead in their company; team members only on leads they own.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, isValidObjectId } from '@/lib/auth';
import { isTeamMember } from '@/lib/authorize';
import { recordAudit } from '@/lib/audit';
import { getDisposition } from '@/lib/follow-up';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  outcome: z.string().min(1),
  note: z.string().max(1000).optional(),
  // Optional next follow-up date as YYYY-MM-DD. Empty/absent = finish.
  nextDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'nextDate must be YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
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
    const { outcome, note, nextDate } = parsed.data;

    const disp = getDisposition(outcome);
    if (!disp) {
      return NextResponse.json({ error: `Unknown outcome: ${outcome}` }, { status: 400 });
    }

    // Load the lead with the same ownership scope the list/PUT use.
    const where: Record<string, unknown> = { id, companyId: payload.companyId, deletedAt: null };
    if (isTeamMember(payload.role)) {
      where.OR = [
        { ownedBy: payload.userId },
        { ownedBy: null, createdBy: payload.userId },
      ];
    }
    const lead = await db.client.findFirst({ where, select: { id: true, clientName: true } });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found or not authorized' }, { status: 404 });
    }

    const actor = await db.user.findUnique({
      where: { id: payload.userId },
      select: { name: true },
    });

    const now = new Date();
    const next = nextDate ? new Date(`${nextDate}T00:00:00`) : null;

    await db.client.update({
      where: { id: lead.id },
      data: {
        followUps: {
          push: {
            date: now,
            outcome,
            label: disp.label,
            note: note?.trim() || null,
            byUserId: payload.userId,
            byName: actor?.name ?? null,
            nextDate: next,
          },
        },
        lastFollowUpOutcome: outcome,
        lastFollowUpLabel: disp.label,
        lastFollowUpAt: now,
        // Model A — roll forward to the next active follow-up, or clear it.
        followUpDate: next,
        lastContactDate: now,
        ...(disp.status ? { status: disp.status } : {}),
        ...(disp.setsVisited ? { propertyVisited: true, visitStatus: 'Visited' } : {}),
      },
    });

    await recordAudit({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'client.followup',
      resource: 'Client',
      resourceId: lead.id,
      metadata: { outcome, statusSet: disp.status ?? null, nextDate: nextDate || null },
      req,
    });

    const updated = await db.client.findUnique({
      where: { id: lead.id },
      include: { creator: { select: { id: true, name: true } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Complete follow-up error:', error);
    return NextResponse.json({ error: 'Failed to complete follow-up' }, { status: 500 });
  }
}
