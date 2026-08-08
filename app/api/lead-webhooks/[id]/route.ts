/**
 * /api/lead-webhooks/[id] — Gap 1 (admin management)
 *
 * PATCH  → toggle active, reassign, or set Facebook page id/token.
 * DELETE → soft-delete the endpoint.
 * Admin-only, company-scoped.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, isValidObjectId } from '@/lib/auth';
import { isAdminRole } from '@/lib/authorize';
import { updateLeadWebhookSchema, parseBody } from '@/lib/validations';

export const runtime = 'nodejs';

async function ownedWebhook(companyId: string, id: string) {
  if (!isValidObjectId(id)) return null;
  return db.leadWebhook.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminRole(payload.role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

    const { id } = await ctx.params;
    if (!(await ownedWebhook(payload.companyId, id))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const parsed = await parseBody(req, updateLeadWebhookSchema);
    if (!parsed.ok) return parsed.response;

    if (parsed.data.assignTo) {
      const assignee = await db.user.findFirst({
        where: { id: parsed.data.assignTo, companyId: payload.companyId, deletedAt: null },
        select: { id: true },
      });
      if (!assignee) return NextResponse.json({ error: 'Assignee not found in your company' }, { status: 400 });
    }

    const updated = await db.leadWebhook.update({ where: { id }, data: parsed.data });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Update lead webhook error:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminRole(payload.role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

    const { id } = await ctx.params;
    if (!(await ownedWebhook(payload.companyId, id))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await db.leadWebhook.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete lead webhook error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
