import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '@/lib/db';
import { onboardingEnquirySchema, parseBody } from '@/lib/validations';
import { apiLimiter, getClientIp, rateLimited } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * POST /api/onboarding-enquiry
 *
 * Public landing-page lead capture. Replaces the old client-side mailto:
 * flow which silently dropped leads whenever the user had no mail client
 * configured.
 *
 * Guarantees:
 *   - Every well-formed submission is persisted to `onboarding_enquiries`
 *     BEFORE the email is attempted. If the mail send fails we still have
 *     the lead in the DB and a superadmin can follow up.
 *   - IP + per-email rate-limited so a bored user (or a bot) can't dump
 *     thousands of rows.
 *   - Honeypot field `hp` — anything non-empty is silently accepted and
 *     dropped. Bots get a 200, we don't alert them they were detected.
 *   - On any error we still return a generic 500 — never leak internals.
 */

const ADMIN_NOTIFY_TO = process.env.ONBOARDING_NOTIFY_EMAIL || 'hello@broker365.in';

/** Best-effort notify to the admin inbox. Logs and swallows errors —
 *  we never fail the user's submission because the SMTP is slow. */
async function notifyAdmin(data: {
  name: string;
  company: string;
  email: string;
  phone: string | null;
  city: string | null;
  teamSize: string | null;
  plan: string | null;
  message: string | null;
}) {
  const from = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!from || !pass) {
    console.warn('[onboarding-enquiry] GMAIL_USER/GMAIL_APP_PASSWORD missing — skipping admin notify');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: from, pass },
    connectionTimeout: 5000,
    greetingTimeout:   5000,
    socketTimeout:     10000,
  });

  // Plain-text body — keeps it deliverable, no open-rate pixel, nothing
  // the spam filter dislikes. Values are pre-validated so safe to interpolate.
  const bodyLines = [
    'New Broker365 onboarding enquiry',
    '================================',
    `Name:      ${data.name}`,
    `Company:   ${data.company}`,
    `Email:     ${data.email}`,
    `Phone:     ${data.phone ?? '—'}`,
    `City:      ${data.city ?? '—'}`,
    `Team size: ${data.teamSize ?? '—'}`,
    `Plan:      ${data.plan ?? '—'}`,
    '',
    'Message:',
    data.message ?? '(none)',
    '',
    '—',
    'Sent via broker365.in landing page.',
  ];

  await transporter.sendMail({
    from: `"Broker365 leads" <${from}>`,
    to: ADMIN_NOTIFY_TO,
    replyTo: data.email,
    subject: `[Broker365] Onboarding enquiry — ${data.company}`,
    text: bodyLines.join('\n'),
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const ipLimit = await apiLimiter.check(20, `onboarding:ip:${ip}`);
    if (!ipLimit.success) {
      return rateLimited('Too many requests. Try again later.', ipLimit.retryAfter);
    }

    const parsed = await parseBody(req, onboardingEnquirySchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    // Honeypot: a bot filled the hidden `website` field. Return success so
    // the bot thinks it worked and moves on, but don't touch the DB or mail.
    if (data.hp && data.hp.length > 0) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Per-email rate limit — slows down someone who ticks the form in
    // a loop. 5 submissions per hour per address is plenty for a real lead.
    const emailLimit = await apiLimiter.check(5, `onboarding:email:${data.email}`);
    if (!emailLimit.success) {
      return rateLimited('You have already sent several enquiries. We will reply soon.', emailLimit.retryAfter);
    }

    const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null;

    // Persist first, email second. If the DB write throws we bail with
    // 500; if the email throws we still return 200 because the lead is
    // safely stored and a human can follow up.
    const row = await db.onboardingEnquiry.create({
      data: {
        name:     data.name,
        company:  data.company,
        email:    data.email,
        phone:    data.phone,
        city:     data.city,
        teamSize: data.teamSize,
        plan:     data.plan,
        message:  data.message,
        source:   'landing',
        ipAddress: ip,
        userAgent,
        handled:  false,
      },
      select: { id: true },
    });

    // Fire the admin email without blocking the response on slow SMTP.
    // We wait up to ~5s for it (via transporter timeouts); longer than
    // that and the user has already seen the Thank-You screen anyway.
    notifyAdmin({
      name:     data.name,
      company:  data.company,
      email:    data.email,
      phone:    data.phone,
      city:     data.city,
      teamSize: data.teamSize,
      plan:     data.plan,
      message:  data.message,
    }).catch((err) => {
      console.error('[onboarding-enquiry] admin notify failed:', err);
    });

    return NextResponse.json({ success: true, id: row.id }, { status: 201 });
  } catch (error) {
    console.error('[onboarding-enquiry] failure:', error);
    return NextResponse.json(
      { error: 'We could not record your enquiry. Please email broker365.support@gmail.com instead.' },
      { status: 500 }
    );
  }
}
