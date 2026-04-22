import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  TICKER_ITEMS,
  TESTIMONIALS,
  PRICING_TIERS,
  BENTO_FEATURES,
  HOT_DEALS,
  MODULES,
  SECURITY_POINTS,
  WORKFLOW_STEPS,
  LANDING_JSON_LD,
} from './_landing/data';
import { LandingNav } from './_landing/LandingNav';
import { OnboardingForm } from './_landing/OnboardingForm';

/**
 * Broker365 landing page — Server Component.
 *
 * Everything static (hero, features, modules, pricing, testimonials,
 * footer, JSON-LD) is rendered on the server so the initial HTML is fully
 * styled and indexable. A handful of client islands handle the interactive
 * bits (auth redirect, mobile nav menu, onboarding form).
 *
 * Why this structure:
 *   - No FOUC. The old 'use client' page shipped a ~1,400-line blob of JSX
 *     + a 900-line <style jsx global> block. Styles arrived only after
 *     hydration, so the page flashed unstyled on first paint. Now CSS is in
 *     /app/landing.css (static asset) and HTML is rendered server-side.
 *   - SEO. Google's crawler reads the rendered HTML directly — no JS
 *     execution needed to see the hero/pricing/FAQ content. Metadata is
 *     declared via Next's Metadata API so OG/Twitter/canonical tags end up
 *     in the initial response.
 *   - Performance. Static marketing data never ships as JS. Fonts are
 *     self-hosted via next/font/google (zero CLS).
 */

const SITE_URL = 'https://broker365.in';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Broker365 — Invite-only CRM for Indian real estate brokers',
    template: '%s · Broker365',
  },
  description:
    'Broker365 is an invite-only CRM for Indian real estate brokerages. Unified leads, property inventory, pipeline, commissions, WhatsApp automation, and team analytics — on one dashboard.',
  keywords: [
    'real estate CRM India',
    'broker CRM',
    'property management software',
    'lead management',
    'WhatsApp CRM',
    'brokerage software',
    'site visit tracker',
    'commission tracker',
    'Broker365',
  ],
  authors: [{ name: 'Broker365' }],
  creator: 'Broker365',
  publisher: 'Broker365',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: SITE_URL,
    siteName: 'Broker365',
    title: 'Broker365 — Invite-only CRM for Indian real estate brokers',
    description:
      'Leads, inventory, commissions, and your team — on one private dashboard. Invite-only access for Indian brokerages.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Broker365 — Invite-only CRM for Indian brokers',
    description:
      'Leads, inventory, commissions, WhatsApp automation, team analytics. One dashboard. Invite-only.',
  },
  other: {
    'theme-color': '#2d5cff',
  },
};

export default async function LandingPage() {
  // Cheap, cookie-only auth probe. If an auth_token cookie exists we assume
  // the visitor already has (or recently had) a session and send them to
  // /dashboard — where middleware will revalidate and bounce them to
  // /login if the token is actually stale. This gives us two wins:
  //   1. No client-side /api/auth/me call on anonymous landing-page loads
  //      → no confusing 401 in the Network tab
  //   2. Signed-in users land on their dashboard without ever seeing the
  //      marketing page (was the old behaviour too, but via a client
  //      redirect that caused a visible flash).
  // We deliberately do NOT verify the JWT here — JWT verify + tokenVersion
  // DB check on every landing-page hit would turn a static marketing page
  // into a DB-bound request.
  const store = await cookies();
  if (store.get('auth_token')?.value) {
    redirect('/dashboard');
  }

  return (
    <div className="b360">
      {/* JSON-LD — Organization + WebSite + SoftwareApplication + FAQPage.
          Fake aggregateRating has been removed to avoid Google Manual
          Action risk; re-add only when backed by a real review source. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LANDING_JSON_LD) }}
      />

      {/* Skip-to-content for keyboard + screen-reader users. */}
      <a href="#main" className="skip-link">Skip to content</a>

      {/* Bright atmosphere — decorative, `aria-hidden` so assistive tech
          skips them, and CSS gates the heavy blur on small screens + for
          prefers-reduced-motion. */}
      <div className="aurora aurora--1" aria-hidden />
      <div className="aurora aurora--2" aria-hidden />
      <div className="aurora aurora--3" aria-hidden />
      <div className="gridbg" aria-hidden />

      {/* Client-side island: hamburger + mobile menu. The auth-redirect
          used to live here as a client component too; it is now handled
          server-side via a cookie probe at the top of this file. */}
      <LandingNav />

      <main id="main" role="main">
        {/* ── Hero ───────────────────────────────────── */}
        <section id="top" className="hero" aria-labelledby="hero-title">
          <span className="pill fade-up" style={{ animationDelay: '0.1s' }}>
            <span className="pill__dot" /> INVITE-ONLY · ACTIVE SUBSCRIBERS ONLY
          </span>

          <h1 id="hero-title" className="hero__headline fade-up" style={{ animationDelay: '0.25s' }}>
            The broker CRM that helps you <em>actually close.</em>
          </h1>

          <p className="hero__sub fade-up" style={{ animationDelay: '0.4s' }}>
            Broker365 is a private, subscriber-only CRM for Indian brokerages. Leads, inventory,
            commissions, and your team — on one dashboard that respects how deals really get done.
          </p>

          {/* Flip the primary hero CTA so new visitors aren't pushed at a
              sign-in wall. The nav still has "Subscriber sign-in" for
              existing customers. */}
          <div className="hero__ctas fade-up" style={{ animationDelay: '0.55s' }}>
            <a href="#contact" className="btn btn--primary btn--lg">
              Request a demo <span aria-hidden>→</span>
            </a>
            <Link href="/login" className="btn btn--ghost btn--lg">
              Subscriber sign-in
            </Link>
          </div>

          <p className="hero__note fade-up" style={{ animationDelay: '0.7s' }}>
            <span className="hero__note-key">Not a subscriber yet?</span>{' '}
            <a href="#contact">Fill the onboarding form below</a> — we respond within 24 hours.
          </p>

          <div className="hero__meta fade-up" style={{ animationDelay: '0.85s' }}>
            <span><span className="check" aria-hidden>✓</span> OTP sign-in</span>
            <span><span className="check" aria-hidden>✓</span> One active session</span>
            <span><span className="check" aria-hidden>✓</span> Built for India</span>
          </div>

          {/* Dashboard mockup (decorative). */}
          <div className="mock fade-up" style={{ animationDelay: '1s' }} aria-hidden>
            <div className="mock__bar">
              <span className="mock__light" style={{ background: '#ff5f57' }} />
              <span className="mock__light" style={{ background: '#febc2e' }} />
              <span className="mock__light" style={{ background: '#5b8dff' }} />
              <div className="mock__url">broker365.in/dashboard</div>
            </div>

            <div className="mock__body">
              <aside className="mock__side">
                <div className="mock__logo">B365</div>
                <ul>
                  <li className="is-active"><span>◆</span> Dashboard</li>
                  <li><span>◇</span> Leads</li>
                  <li><span>◇</span> Pipeline</li>
                  <li><span>◇</span> Properties</li>
                  <li><span>◇</span> Visits</li>
                  <li><span>◇</span> Commissions</li>
                  <li><span>◇</span> Team</li>
                  <li><span>◇</span> Analytics</li>
                </ul>
              </aside>

              <div className="mock__main">
                <div className="mock__topbar">
                  <div className="dash-search">
                    <span aria-hidden>⌕</span>
                    <input type="text" placeholder="Search leads, properties, agents…" readOnly />
                  </div>
                  <div className="dash-avatars">
                    <span className="av" style={{ background: 'linear-gradient(135deg,#2d5cff,#5b8dff)' }}>MP</span>
                    <span className="av" style={{ background: 'linear-gradient(135deg,#1a3bd1,#2d5cff)' }}>VJ</span>
                    <span className="av" style={{ background: 'linear-gradient(135deg,#5b8dff,#ff6a3d)' }}>SR</span>
                  </div>
                </div>

                <div className="stats">
                  <div className="stat">
                    <span className="stat__label">Active Leads</span>
                    <span className="stat__value">1,284</span>
                    <span className="stat__delta up">+12.4%</span>
                  </div>
                  <div className="stat">
                    <span className="stat__label">Pipeline</span>
                    <span className="stat__value">₹48.2 Cr</span>
                    <span className="stat__delta up">+8.1%</span>
                  </div>
                  <div className="stat">
                    <span className="stat__label">Closed MTD</span>
                    <span className="stat__value">37</span>
                    <span className="stat__delta up">+3</span>
                  </div>
                  <div className="stat">
                    <span className="stat__label">Response Time</span>
                    <span className="stat__value">2m 14s</span>
                    <span className="stat__delta down">−38s</span>
                  </div>
                </div>

                <div className="chart">
                  <div className="chart__head">
                    <div>
                      <span className="chart__label">Pipeline value · last 30 days</span>
                      <span className="chart__big">₹48.2 Cr</span>
                    </div>
                    <span className="chart__tag">Live</span>
                  </div>
                  <svg className="chart__svg" viewBox="0 0 600 160" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="b360ChartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2d5cff" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#2d5cff" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="b360ChartStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#1a3bd1" />
                        <stop offset="100%" stopColor="#5b8dff" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,130 L40,118 L80,124 L120,100 L160,108 L200,86 L240,92 L280,70 L320,78 L360,54 L400,62 L440,42 L480,48 L520,30 L560,40 L600,22 L600,160 L0,160 Z"
                      fill="url(#b360ChartGradient)"
                    />
                    <path
                      d="M0,130 L40,118 L80,124 L120,100 L160,108 L200,86 L240,92 L280,70 L320,78 L360,54 L400,62 L440,42 L480,48 L520,30 L560,40 L600,22"
                      fill="none"
                      stroke="url(#b360ChartStroke)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="deals">
                  <div className="deals__head">
                    <span className="deals__title">Hot Deals</span>
                    <span className="deals__link">View all →</span>
                  </div>
                  <ul className="deals__list">
                    {HOT_DEALS.map((d) => (
                      <li key={d.name} className="deal">
                        <span className={`deal__avatar deal__avatar--${d.tone}`}>
                          {d.name.split(' ').map((n) => n[0]).join('')}
                        </span>
                        <div className="deal__who">
                          <span className="deal__name">{d.name}</span>
                          <span className="deal__stage">{d.stage}</span>
                        </div>
                        <span className="deal__value">{d.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Ticker ─────────────────────────────────── */}
        <section className="ticker" aria-hidden>
          <div className="ticker__track">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
              <span key={i} className="ticker__item">
                <span className="ticker__dot" /> {t}
              </span>
            ))}
          </div>
        </section>

        {/* ── Features / bento ───────────────────────── */}
        <section id="features" className="section" aria-labelledby="features-title">
          <div className="section__header">
            <span className="eyebrow">◆ Features</span>
            <h2 id="features-title" className="section__title">
              Everything a brokerage runs on, <em>in one clean dashboard.</em>
            </h2>
            <p className="section__sub">
              Ten years of watching good brokers wrestle bad tools. Broker365 is the CRM we wished
              existed when we ran our own teams.
            </p>
          </div>

          <div className="bento">
            {BENTO_FEATURES.map((f, i) => (
              <article key={f.title} className={`cell ${f.span}`}>
                <span className="cell__num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="cell__title">{f.title}</h3>
                <p className="cell__copy">{f.copy}</p>

                {f.extra === 'flow' && (
                  <div className="flow-visual" aria-hidden>
                    <svg viewBox="0 0 520 180" preserveAspectRatio="xMidYMid meet">
                      <defs>
                        <linearGradient id="b360FlowLine" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#5b8dff" stopOpacity="0.7" />
                          <stop offset="100%" stopColor="#2d5cff" stopOpacity="0.7" />
                        </linearGradient>
                      </defs>
                      <g stroke="url(#b360FlowLine)" strokeWidth="1.5" fill="none">
                        <path d="M60,30 C150,30 180,90 260,90" />
                        <path d="M60,90 C150,90 180,90 260,90" />
                        <path d="M60,150 C150,150 180,90 260,90" />
                        <path d="M260,90 C340,90 370,40 460,40" />
                        <path d="M260,90 C340,90 370,140 460,140" />
                      </g>
                      <g fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#0b1020">
                        <g>
                          <rect x="6" y="18" width="100" height="24" rx="6" fill="#ffffff" stroke="rgba(11,16,32,0.1)" />
                          <text x="18" y="34">99acres</text>
                        </g>
                        <g>
                          <rect x="6" y="78" width="100" height="24" rx="6" fill="#ffffff" stroke="rgba(11,16,32,0.1)" />
                          <text x="18" y="94">Meta Ads</text>
                        </g>
                        <g>
                          <rect x="6" y="138" width="100" height="24" rx="6" fill="#ffffff" stroke="rgba(11,16,32,0.1)" />
                          <text x="18" y="154">WhatsApp</text>
                        </g>
                        <g>
                          <rect x="210" y="70" width="110" height="40" rx="10" fill="#eef2ff" stroke="#2d5cff" />
                          <text x="228" y="86" fill="#1a3bd1">Broker365</text>
                          <text x="228" y="100" fill="#1a3bd1">AI ROUTER</text>
                        </g>
                        <g>
                          <rect x="420" y="28" width="80" height="24" rx="6" fill="#eef2ff" stroke="#2d5cff" />
                          <text x="432" y="44" fill="#1a3bd1">Agent A</text>
                        </g>
                        <g>
                          <rect x="420" y="128" width="80" height="24" rx="6" fill="#fff1ec" stroke="#ff6a3d" />
                          <text x="432" y="144" fill="#ff6a3d">Agent B</text>
                        </g>
                      </g>
                    </svg>
                  </div>
                )}

                {f.extra === 'filters' && (
                  <div className="chip-cluster" aria-hidden>
                    <span className="mini-chip">2 BHK</span>
                    <span className="mini-chip">For Rent</span>
                    <span className="mini-chip">₹25k – ₹60k</span>
                    <span className="mini-chip">Vacate by Jun</span>
                    <span className="mini-chip">Added by Meera</span>
                    <span className="mini-chip mini-chip--ghost">+3 more</span>
                  </div>
                )}

                {f.extra === 'speed' && (
                  <div className="speed-big" aria-hidden>
                    <span>2.1</span><em>s</em>
                  </div>
                )}

                {f.extra === 'board' && (
                  <ul className="leaderboard" aria-label="Top agents this month">
                    <li><span>1</span> Meera P. <b>12</b></li>
                    <li><span>2</span> Vikram J. <b>9</b></li>
                    <li><span>3</span> Sneha R. <b>7</b></li>
                    <li><span>4</span> Arjun K. <b>5</b></li>
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* ── Modules strip ──────────────────────────── */}
        <section id="modules" className="section section--alt" aria-labelledby="modules-title">
          <div className="section__header">
            <span className="eyebrow">◇ Modules</span>
            <h2 id="modules-title" className="section__title">
              Every screen your team actually opens — <em>already shipped.</em>
            </h2>
            <p className="section__sub">
              Fifteen first-class modules ship with Broker365. One login, every workflow covered.
            </p>
          </div>

          <div className="modules">
            {MODULES.map((m) => (
              <div key={m.title} className="module">
                <span className="module__icon" aria-hidden>{m.icon}</span>
                <div>
                  <h4>{m.title}</h4>
                  <p>{m.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Workflow ───────────────────────────────── */}
        <section id="workflow" className="section" aria-labelledby="workflow-title">
          <div className="section__header">
            <span className="eyebrow">◆ Workflow</span>
            <h2 id="workflow-title" className="section__title">
              From first call to <em>signed agreement</em>, in four moves.
            </h2>
          </div>

          <div className="steps">
            {WORKFLOW_STEPS.map((s) => (
              <div key={s.n} className="step">
                <span className="step__n">{s.n}</span>
                <h3 className="step__title">{s.title}</h3>
                <p className="step__copy">{s.copy}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Security ───────────────────────────────── */}
        <section id="security" className="section section--alt" aria-labelledby="security-title">
          <div className="section__header">
            <span className="eyebrow">◇ Security</span>
            <h2 id="security-title" className="section__title">
              Built like a vault. <em>Opens like a door.</em>
            </h2>
            <p className="section__sub">
              Broker365 is invite-only for a reason. Every sign-in is verified, every role is scoped,
              every write is logged.
            </p>
          </div>

          <div className="security">
            {SECURITY_POINTS.map((s) => (
              <article key={s.title} className="sec-card">
                <span className="sec-card__key" aria-hidden>◆</span>
                <h4>{s.title}</h4>
                <p>{s.copy}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Testimonials ───────────────────────────── */}
        <section id="testimonials" className="section" aria-labelledby="testimonials-title">
          <div className="section__header">
            <span className="eyebrow">◆ Customers</span>
            <h2 id="testimonials-title" className="section__title">
              Trusted by brokerages who don&rsquo;t miss <em>a beat.</em>
            </h2>
          </div>

          <div className="quotes">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="quote">
                <blockquote>&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption>
                  <span className="quote__avatar" style={{ background: t.hue }}>
                    {t.name.split(' ').map((n) => n[0]).join('')}
                  </span>
                  <span className="quote__who">
                    <b>{t.name}</b>
                    <em>{t.title}</em>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ── Pricing ────────────────────────────────── */}
        <section id="pricing" className="section section--alt" aria-labelledby="pricing-title">
          <div className="section__header">
            <span className="eyebrow">◇ Pricing</span>
            <h2 id="pricing-title" className="section__title">
              Simple tiers. Real value. <em>No surprises.</em>
            </h2>
            <p className="section__sub">
              Every plan includes unlimited leads and properties. Access is invite-based —
              we onboard each brokerage personally.
            </p>
          </div>

          <div className="prices">
            {PRICING_TIERS.map((p) => (
              <article key={p.tier} className={`price ${p.featured ? 'price--featured' : ''}`}>
                {p.featured && <span className="price__badge">MOST POPULAR</span>}
                <h3 className="price__tier">{p.tier}</h3>
                <p className="price__tag">{p.tagline}</p>
                <div className="price__amount">
                  <span className="price__num">{p.price}</span>
                  <span className="price__cadence">{p.cadence}</span>
                </div>
                <ul className="price__list">
                  {p.features.map((f) => (
                    <li key={f}><span className="check" aria-hidden>✓</span> {f}</li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`btn btn--lg ${p.featured ? 'btn--primary' : 'btn--ghost'}`}
                >
                  Subscriber sign-in
                </Link>
              </article>
            ))}
            <p className="prices__foot">
              Already a subscriber? <Link href="/login">Sign in here</Link>. New to Broker365?{' '}
              <a href="#contact">Request onboarding below</a>.
            </p>
          </div>
        </section>

        {/* ── Onboarding / contact ───────────────────── */}
        <section id="contact" className="section" aria-labelledby="contact-title">
          <div className="contact">
            <div className="contact__pitch">
              <span className="eyebrow">◆ Onboarding</span>
              <h2 id="contact-title" className="section__title contact__title">
                Tell us about your brokerage. <em>We&rsquo;ll take it from there.</em>
              </h2>
              <p className="contact__sub">
                Broker365 is invite-only. Submit the form and our team will reach out within 24 hours
                to schedule a walkthrough, migrate your data, and hand over credentials to your agents.
              </p>

              <ul className="contact__benefits">
                <li><span className="check" aria-hidden>✓</span> Personal onboarding call</li>
                <li><span className="check" aria-hidden>✓</span> Free data migration</li>
                <li><span className="check" aria-hidden>✓</span> Team training included</li>
                <li><span className="check" aria-hidden>✓</span> 14-day money-back guarantee</li>
              </ul>

              <div className="contact__already">
                <span>Already a subscriber?</span>
                <Link href="/login" className="btn btn--ghost">
                  Sign in <span aria-hidden>→</span>
                </Link>
              </div>
            </div>

            <div className="contact__card">
              <OnboardingForm />
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="foot" role="contentinfo">
        <div className="foot__grid">
          <div className="foot__brand">
            <div className="brand brand--logo">
              <Image
                src="/logo.svg"
                alt="Broker365"
                width={720}
                height={160}
                className="brand__image"
              />
            </div>
            <p>The broker CRM that helps you actually close. Built in India, for India.</p>
          </div>
          <div className="foot__col">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#modules">Modules</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="foot__col">
            <h4>Company</h4>
            <a href="#testimonials">Customers</a>
            <a href="#security">Security</a>
            <a href="#contact">Contact</a>
          </div>
          <div className="foot__col">
            <h4>Account</h4>
            <Link href="/login">Sign in</Link>
            <a href="#contact">Request onboarding</a>
            <a href="mailto:hello@broker365.in">Support</a>
          </div>
        </div>

        <div className="foot__watermark" aria-hidden>
          <em>Broker365</em>
        </div>

        <div className="foot__bar">
          <span>© {new Date().getFullYear()} Broker365 · All rights reserved.</span>
          <span>Made with precision · Jaipur · Bengaluru</span>
          <span>
            <Link href="/privacy">Privacy</Link>
            <span aria-hidden> · </span>
            <Link href="/terms">Terms</Link>
          </span>
        </div>
      </footer>

      {/*
        WhatsApp floating action button.
        - Number is read from NEXT_PUBLIC_WHATSAPP_NUMBER (international format,
          no plus / no spaces, e.g. 919876543210) so marketing can rotate it
          without a code change; falls back to a placeholder so dev builds
          still render.
        - rel="noopener noreferrer" is required for `target="_blank"` links.
        - Indian mobile users expect a chat tap-target within thumb reach;
          bottom-right at 22px/22px fits the Material guideline 56px tap.
      */}
      <a
        href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919116346573'}?text=${encodeURIComponent("Hi Broker365 — I'd like to know more about onboarding my brokerage.")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="wa-fab"
        aria-label="Chat with Broker365 on WhatsApp"
      >
        {/* Inline SVG keeps the FAB dependency-free and scale-perfect. */}
        <svg
          width="28"
          height="28"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden
        >
          <path
            d="M16 3C8.82 3 3 8.82 3 16c0 2.29.6 4.53 1.74 6.5L3 29l6.68-1.75A12.94 12.94 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3Zm0 23.6c-2 0-3.97-.54-5.69-1.56l-.41-.24-3.97 1.04 1.06-3.87-.27-.4A10.59 10.59 0 0 1 5.4 16c0-5.85 4.75-10.6 10.6-10.6 5.85 0 10.6 4.75 10.6 10.6 0 5.85-4.75 10.6-10.6 10.6Zm5.82-7.93c-.32-.16-1.9-.94-2.19-1.05-.3-.11-.5-.16-.72.16-.21.32-.83 1.05-1.02 1.26-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.58-1.59-.95-.85-1.6-1.9-1.79-2.21-.19-.32-.02-.5.14-.66.14-.14.32-.37.48-.55.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.55-.08-.16-.72-1.74-.99-2.39-.26-.62-.53-.54-.72-.55-.19 0-.4-.02-.62-.02-.22 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.68 0 1.58 1.15 3.1 1.31 3.32.16.21 2.27 3.47 5.51 4.86.77.33 1.37.53 1.84.68.77.24 1.47.21 2.02.13.62-.1 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.13-.3-.21-.62-.37Z"
            fill="currentColor"
          />
        </svg>
        <span className="wa-fab__label">WhatsApp</span>
      </a>
    </div>
  );
}
