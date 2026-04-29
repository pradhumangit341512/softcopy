/**
 * /api/feedback — public landing-page feedback.
 *
 * GET  → returns the latest N approved feedback rows for the landing
 *        page testimonials widget. No auth required.
 * POST → public submit endpoint. Rate-limited by IP. New rows land in
 *        `pending` status; a superadmin must approve before they show.
 *
 * Spam strategy
 * ─────────────
 *   - Rate limit (Upstash Redis-backed): 5 submissions / 30 min / IP.
 *   - Optional honeypot field (`website`) — if filled, accept the
 *     submission silently but mark it `rejected`. Real users never see
 *     the field; bots that fill every input get auto-rejected.
 *   - 20–600 char message bound — short noise + giant rants both blocked
 *     at the Zod layer.
 *
 * Tenant model
 * ────────────
 *   Feedback is platform-wide (NOT per-company). The landing page is the
 *   marketing surface for the whole product, not a tenant view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createFeedbackSchema, parseBody } from '@/lib/validations';
import { apiLimiter, getClientIp, rateLimited } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// ==================== GET ====================

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(50, Math.max(1, Number(sp.get('limit') || 12)));

    const items = await db.feedback.findMany({
      where: { status: 'approved' },
      orderBy: [{ approvedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        role: true,
        rating: true,
        message: true,
        approvedAt: true,
      },
    });

    // Aggregate rating shipped alongside the list so the landing's
    // schema.org AggregateRating block can render with one fetch.
    const agg = await db.feedback.aggregate({
      where: { status: 'approved' },
      _avg: { rating: true },
      _count: true,
    });

    return NextResponse.json({
      items,
      summary: {
        count: agg._count,
        averageRating: agg._avg.rating ? Number(agg._avg.rating.toFixed(2)) : null,
      },
    });
  } catch (err) {
    console.error('Fetch feedback error:', err);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

// ==================== POST ====================

interface PostBody {
  // Honeypot — not in Zod schema; checked separately below.
  website?: string;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // 5 submissions per 30 minutes per IP. Tight enough to deter bots,
    // generous enough that a customer fixing a typo doesn't get blocked.
    const limit = await apiLimiter.check(5, `feedback:${ip}`);
    if (!limit.success) {
      return rateLimited('Too many feedback submissions, try again later', limit.retryAfter);
    }

    // Read raw body so we can inspect the honeypot before Zod strips it.
    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown> & PostBody;
    const honeypot = typeof raw.website === 'string' ? raw.website.trim() : '';

    const parsed = createFeedbackSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Invalid feedback payload',
          fields: Object.fromEntries(
            parsed.error.issues.map((i) => [i.path.join('.'), i.message])
          ),
        },
        { status: 400 }
      );
    }

    const userAgent = req.headers.get('user-agent') ?? null;
    // If the honeypot is filled, silently mark as rejected. Returning
    // success keeps bots from learning their submission was caught.
    const status = honeypot ? 'rejected' : 'pending';

    const created = await db.feedback.create({
      data: {
        name: parsed.data.name,
        role: parsed.data.role,
        rating: parsed.data.rating,
        message: parsed.data.message,
        email: parsed.data.email,
        source: parsed.data.source,
        status,
        ipAddress: ip,
        userAgent,
      },
      select: { id: true, status: true },
    });

    return NextResponse.json(
      {
        success: true,
        id: created.id,
        // Don't tell the client whether it was honeypot-rejected — bots
        // would learn to skip the field. Just say "received".
        message: 'Thanks — your feedback has been received and will appear here once approved.',
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Create feedback error:', err);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
