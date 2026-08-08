/**
 * POST /api/webhooks/leads/[token] — Gap 1 (generic inbound capture)
 *
 * Public, token-authenticated endpoint. A portal / website form / Zapier-style
 * relay POSTs a JSON lead payload here; the token in the path identifies the
 * company + source (via LeadWebhook). The payload is normalized, deduped by
 * phone, scored, and stored as a Client assigned to the webhook's owner.
 *
 * No session auth — the unguessable token IS the credential, so keep the URL
 * secret (regenerate it from Integrations if leaked).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeInboundLead, captureLead } from '@/lib/lead-capture';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await ctx.params;
    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const webhook = await db.leadWebhook.findFirst({
      where: { token, active: true, deletedAt: null },
      select: { id: true, companyId: true, assignTo: true, source: true },
    });
    if (!webhook) {
      return NextResponse.json({ error: 'Unknown or inactive endpoint' }, { status: 404 });
    }

    // Accept JSON or form-encoded bodies (portals vary).
    let payload: Record<string, unknown> = {};
    const contentType = req.headers.get('content-type') || '';
    try {
      if (contentType.includes('application/json')) {
        payload = (await req.json()) as Record<string, unknown>;
      } else {
        const form = await req.formData();
        payload = Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '']));
      }
    } catch {
      return NextResponse.json({ error: 'Could not parse body' }, { status: 400 });
    }

    const normalized = normalizeInboundLead(payload);
    if ('error' in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 422 });
    }

    const result = await captureLead(webhook, normalized);
    return NextResponse.json(
      { ok: true, deduped: result.deduped, clientId: result.clientId },
      { status: result.deduped ? 200 : 201 },
    );
  } catch (err) {
    console.error('Lead capture error:', err);
    return NextResponse.json({ error: 'Capture failed' }, { status: 500 });
  }
}
