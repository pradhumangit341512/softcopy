/**
 * /api/lead-webhooks — Gap 1 (admin management)
 *
 * GET  → list this company's lead-capture webhooks.
 * POST → create one for a source, generating an unguessable token that goes in
 *        the public inbound URL. Admin-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { isAdminRole } from '@/lib/authorize';
import { createLeadWebhookSchema, parseBody } from '@/lib/validations';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const payload = await verifyAuth(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminRole(payload.role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  const webhooks = await db.leadWebhook.findMany({
    where: { companyId: payload.companyId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ webhooks });
}

export async function POST(req: NextRequest) {
  const payload = await verifyAuth(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminRole(payload.role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  const parsed = await parseBody(req, createLeadWebhookSchema);
  if (!parsed.ok) return parsed.response;

  // The assignee must be an active teammate in this company.
  const assignee = await db.user.findFirst({
    where: { id: parsed.data.assignTo, companyId: payload.companyId, deletedAt: null },
    select: { id: true },
  });
  if (!assignee) {
    return NextResponse.json({ error: 'Assignee not found in your company' }, { status: 400 });
  }

  const webhook = await db.leadWebhook.create({
    data: {
      companyId: payload.companyId,
      source: parsed.data.source,
      token: randomBytes(24).toString('hex'),
      assignTo: parsed.data.assignTo,
      createdBy: payload.userId,
      active: true,
      capturedCount: 0,
      deletedAt: null,
    },
  });
  return NextResponse.json(webhook, { status: 201 });
}
