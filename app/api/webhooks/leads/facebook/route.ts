/**
 * /api/webhooks/leads/facebook — Gap 1 (Facebook Lead Ads)
 *
 * GET  → Meta webhook verification handshake (hub.challenge).
 * POST → leadgen notifications. For each lead we look up the LeadWebhook by
 *        page id, fetch the full lead from the Graph API using that company's
 *        stored page token, normalize, and capture it.
 *
 * Setup (external): create a Meta app, add the WhatsApp/Lead Ads product,
 * subscribe the page to `leadgen`, set FB_LEAD_VERIFY_TOKEN in the env, and
 * store each page's id + long-lived page token on its LeadWebhook (source
 * 'Facebook') from Integrations. Until then this endpoint verifies but receives
 * nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeInboundLead, captureLead } from '@/lib/lead-capture';

export const runtime = 'nodejs';

const GRAPH = 'https://graph.facebook.com/v21.0';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get('hub.mode');
  const token = sp.get('hub.verify_token');
  const challenge = sp.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.FB_LEAD_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

interface LeadgenChange {
  value?: { leadgen_id?: string; page_id?: string };
}
interface LeadgenEntry {
  changes?: LeadgenChange[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { object?: string; entry?: LeadgenEntry[] };
    if (body.object !== 'page') return NextResponse.json({ ok: true });

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const leadgenId = change.value?.leadgen_id;
        const pageId = change.value?.page_id;
        if (!leadgenId || !pageId) continue;

        const webhook = await db.leadWebhook.findFirst({
          where: { source: 'Facebook', fbPageId: pageId, active: true, deletedAt: null },
          select: { id: true, companyId: true, assignTo: true, source: true, fbPageToken: true },
        });
        if (!webhook?.fbPageToken) continue;

        // Fetch the full lead (field_data) from the Graph API.
        const res = await fetch(`${GRAPH}/${leadgenId}?access_token=${encodeURIComponent(webhook.fbPageToken)}`);
        if (!res.ok) {
          console.error('FB lead fetch failed', leadgenId, res.status);
          continue;
        }
        const lead = (await res.json()) as { field_data?: { name: string; values: string[] }[] };
        const payload: Record<string, unknown> = {};
        for (const f of lead.field_data ?? []) payload[f.name] = f.values?.[0] ?? '';

        const normalized = normalizeInboundLead(payload);
        if ('error' in normalized) continue;
        await captureLead(webhook, normalized);
      }
    }

    // Always 200 so Meta doesn't retry-storm on a single bad lead.
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Facebook leadgen error:', err);
    return NextResponse.json({ ok: true }); // swallow — never make Meta retry forever
  }
}
