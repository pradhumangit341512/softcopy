'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';

interface FormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  city: string;
  teamSize: string;
  plan: string;
  message: string;
  consent: boolean;
  hp: string; // honeypot
}

const EMPTY_FORM: FormState = {
  name: '',
  company: '',
  email: '',
  phone: '',
  city: '',
  teamSize: '',
  plan: '',
  message: '',
  consent: false,
  hp: '',
};

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, hasFetched, fetchUser } = useAuthStore();

  // Verify auth server-side on mount — do NOT trust any persisted flag.
  // Only redirect to /dashboard after the server confirms a valid session.
  useEffect(() => {
    if (!hasFetched) {
      fetchUser();
    } else if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [hasFetched, isAuthenticated, fetchUser, router]);

  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const closeMenu = () => setMenuOpen(false);

  // Lock background scroll + ESC-to-close while the mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (form.hp.length > 0) return; // bot
    if (!form.name.trim() || !form.email.trim() || !form.company.trim() || !form.consent) {
      setFormError('Please fill your name, company, email, and accept the consent.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFormError('That email doesn’t look right — check and try again.');
      return;
    }
    setFormError('');
    setSubmitting(true);

    const subject = `Broker360 onboarding enquiry — ${form.company || form.name}`;
    const body = [
      `Name: ${form.name}`,
      `Company: ${form.company}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone || '—'}`,
      `City: ${form.city || '—'}`,
      `Team size: ${form.teamSize || '—'}`,
      `Interested plan: ${form.plan || '—'}`,
      '',
      'Message:',
      form.message || '(none)',
      '',
      '—',
      'Sent from broker360.in landing page.',
    ].join('\n');

    window.location.href =
      `mailto:hello@broker360.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    setTimeout(() => {
      setSubmitted(true);
      setSubmitting(false);
    }, 400);
  }

  const tickerItems: string[] = [
    'Elite Estates · 2m 14s avg. response time',
    'Skyline Realty · 1,284 active leads',
    'Urban Nest · ₹48.2 Cr pipeline value',
    'Prime Homes · 37 deals closed this month',
    'Coastal Keys · 92% follow-up adherence',
    'Metro Abode · 18 agents, one dashboard',
    'Ashoka Realty · 500+ listings synced',
    'Green Acres · 6 site visits booked today',
  ];

  const testimonials: { name: string; title: string; quote: string; hue: string }[] = [
    {
      name: 'Meera Pillai',
      title: 'Founder, Pillai & Co · Kochi',
      quote:
        'We stopped losing leads inside WhatsApp threads. Broker360 put every enquiry in one place and the team just moved faster.',
      hue: 'linear-gradient(135deg, #2d5cff, #5b8dff)',
    },
    {
      name: 'Vikram Joshi',
      title: 'Principal Broker, Joshi Realty · Pune',
      quote:
        'The inventory sync alone saves us two hours a day. Pair that with follow-up reminders and our closing rate jumped 27%.',
      hue: 'linear-gradient(135deg, #1a3bd1, #2d5cff)',
    },
    {
      name: 'Sneha Rao',
      title: 'Sales Head, RaoStone Properties · Bengaluru',
      quote:
        'Co-broking used to be a messy spreadsheet. Now a partner agent sees what is shareable and what is not, in real time.',
      hue: 'linear-gradient(135deg, #5b8dff, #ff6a3d)',
    },
  ];

  const pricingTiers: {
    tier: string;
    price: string;
    cadence: string;
    tagline: string;
    features: string[];
    featured?: boolean;
  }[] = [
    {
      tier: 'Solo',
      price: '₹1,499',
      cadence: '/mo',
      tagline: 'Independent brokers finding their rhythm',
      features: [
        '1 seat · OTP sign-in',
        'Unlimited leads & properties',
        'WhatsApp reminders',
        'Mobile-first dashboard',
        'Weekly performance email',
      ],
    },
    {
      tier: 'Team',
      price: '₹4,999',
      cadence: '/mo',
      tagline: 'Growing brokerages with 3–15 agents',
      features: [
        'Up to 15 seats',
        'Pipeline & team-performance analytics',
        'Smart lead assignment',
        'Co-broking with partner agents',
        'Excel export & audit logs',
      ],
      featured: true,
    },
    {
      tier: 'Enterprise',
      price: 'Custom',
      cadence: '',
      tagline: 'Multi-city teams with custom workflows',
      features: [
        'Unlimited seats & superadmin console',
        'SSO + advanced role policies',
        'API & custom integrations',
        'Dedicated success manager',
        'On-site onboarding + training',
      ],
    },
  ];

  const features: {
    title: string;
    copy: string;
    span: string;
    extra?: 'flow' | 'speed' | 'board' | 'filters';
  }[] = [
    {
      title: 'Lead & Client CRM',
      copy:
        'Every enquiry from portals, ads, and WhatsApp lands in one inbox — scored, deduped, and routed to the right agent.',
      span: 'cell--wide',
      extra: 'flow',
    },
    {
      title: 'Property Inventory',
      copy:
        'Filter by BHK, price range, vacate date, rent vs sale, or added-by. Export to Excel in one click.',
      span: 'cell--tall',
      extra: 'filters',
    },
    {
      title: 'Site Visits',
      copy: 'Schedule, track, and log every site visit. Nothing falls through the cracks.',
      span: '',
    },
    {
      title: 'Response Time',
      copy: 'Median first-touch latency across the platform.',
      span: '',
      extra: 'speed',
    },
    {
      title: 'Team Performance',
      copy: 'See who is converting, who is stuck, and why — at a glance.',
      span: 'cell--tall',
      extra: 'board',
    },
    {
      title: 'Commissions',
      copy: 'Split, track, and reconcile broker commissions — including co-broking payouts.',
      span: '',
    },
    {
      title: 'WhatsApp Automation',
      copy:
        'Inbound enquiry capture via webhook, drafted follow-ups, and scheduled nudges delivered where your clients actually reply.',
      span: 'cell--wide',
    },
  ];

  const hotDeals: { name: string; stage: string; value: string; tone: string }[] = [
    { name: 'Raj Kapoor', stage: 'Site Visit', value: '₹1.8 Cr', tone: 'blue' },
    { name: 'Ananya Mehta', stage: 'Negotiation', value: '₹94 L', tone: 'sky' },
    { name: 'Sanjay Verma', stage: 'Docs', value: '₹3.2 Cr', tone: 'coral' },
    { name: 'Priya Nair', stage: 'Follow-up', value: '₹1.1 Cr', tone: 'blue' },
  ];

  // Every actual dashboard screen + API module that ships in the CRM.
  const modules: { icon: string; title: string; copy: string }[] = [
    { icon: '◉', title: 'Dashboard',        copy: 'KPIs, pipeline value, and today’s focus at a glance.' },
    { icon: '◈', title: 'Leads & Clients',  copy: 'Unified enquiry inbox with follow-up scheduling.' },
    { icon: '◇', title: 'Pipeline',         copy: 'Kanban-style funnel from site visit to signed docs.' },
    { icon: '◆', title: 'Properties',       copy: 'Inventory with BHK, rent/sale, price, vacate date filters.' },
    { icon: '◐', title: 'My Work',          copy: 'An agent’s daily to-do distilled from every lead.' },
    { icon: '◧', title: 'Site Visits',      copy: 'Visit calendar with outcome logging and reminders.' },
    { icon: '◰', title: 'Commissions',      copy: 'Split-aware, co-broking friendly payout tracker.' },
    { icon: '◱', title: 'Team Performance', copy: 'Per-agent conversion, response time, active load.' },
    { icon: '◩', title: 'Analytics',        copy: 'Trends, cohorts, and monthly deal breakdowns.' },
    { icon: '▬', title: 'Budget Tracker',   copy: 'Monthly targets, spend, and agent-level allocations.' },
    { icon: '▭', title: 'Notifications',    copy: 'Bell alerts, dashboard banners, and a weekly email report.' },
    { icon: '▮', title: 'WhatsApp',         copy: 'Inbound webhook capture + scheduled reminder automations.' },
    { icon: '▯', title: 'Activity Log',     copy: 'Searchable audit trail for every sensitive action.' },
    { icon: '▰', title: 'Superadmin',       copy: 'Multi-tenant console for seat caps, plans, and resets.' },
    { icon: '▱', title: 'Subscriptions',    copy: 'Plan management, renewals, and billing trail.' },
  ];

  const securityPoints: { title: string; copy: string }[] = [
    {
      title: 'One session, one device',
      copy: 'Active sessions are enforced per account. Log in elsewhere and the older session closes cleanly.',
    },
    {
      title: 'OTP at every sign-in',
      copy: 'Email-verified one-time passwords for every login, plus optional trusted devices for your team.',
    },
    {
      title: 'Role-based access',
      copy: 'Superadmin, admin, and team-member roles with field-level guards across every write path.',
    },
    {
      title: 'Full audit trail',
      copy: 'Every login, export, and sensitive mutation is recorded — readable, searchable, exportable.',
    },
  ];

  // JSON-LD structured data for SEO — organization + software + FAQ
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://broker360.in/#org',
        name: 'Broker360',
        url: 'https://broker360.in',
        email: 'hello@broker360.com',
        description:
          'Invite-only CRM for Indian real estate brokers — leads, inventory, commissions, and team performance on one dashboard.',
        areaServed: 'IN',
        address: [
          { '@type': 'PostalAddress', addressLocality: 'Jaipur', addressCountry: 'IN' },
          { '@type': 'PostalAddress', addressLocality: 'Bengaluru', addressCountry: 'IN' },
        ],
      },
      {
        '@type': 'WebSite',
        '@id': 'https://broker360.in/#site',
        url: 'https://broker360.in',
        name: 'Broker360',
        publisher: { '@id': 'https://broker360.in/#org' },
        inLanguage: 'en-IN',
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Broker360 CRM',
        operatingSystem: 'Web',
        applicationCategory: 'BusinessApplication',
        offers: [
          { '@type': 'Offer', name: 'Solo',  price: '1499', priceCurrency: 'INR' },
          { '@type': 'Offer', name: 'Team',  price: '4999', priceCurrency: 'INR' },
          { '@type': 'Offer', name: 'Enterprise', priceCurrency: 'INR' },
        ],
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          reviewCount: '38',
        },
        description:
          'Broker360 is a multi-tenant CRM for Indian real estate brokerages with lead management, property inventory, pipeline, commissions, WhatsApp automation, team performance, and audit logs.',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Is Broker360 available to anyone?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'No. Broker360 is invite-only. Each brokerage is onboarded personally. Submit the onboarding form and our team will reach out within 24 hours.',
            },
          },
          {
            '@type': 'Question',
            name: 'What does Broker360 include?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'Broker360 includes lead and client management, property inventory with rich filters, site-visit tracking, commissions, a kanban pipeline, team performance analytics, WhatsApp automation, notifications, activity logs, and a superadmin console.',
            },
          },
          {
            '@type': 'Question',
            name: 'How is my brokerage data secured?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'Single-session enforcement, OTP at every sign-in, role-based access with field-level guards, and a full audit trail for every sensitive mutation.',
            },
          },
          {
            '@type': 'Question',
            name: 'What does Broker360 cost?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'Solo is ₹1,499 per month, Team is ₹4,999 per month, Enterprise is custom-priced. All plans include unlimited leads and properties.',
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="b360">
      {/* ── SEO metadata (React 19 hoists these to <head>) ─── */}
      <title>Broker360 — Invite-only CRM for Indian real estate brokers</title>
      <meta
        name="description"
        content="Broker360 is an invite-only CRM for Indian real estate brokerages. Unified leads, property inventory, pipeline, commissions, WhatsApp automation, and team analytics — on one dashboard."
      />
      <meta
        name="keywords"
        content="real estate CRM India, broker CRM, property management software, lead management, WhatsApp CRM, brokerage software, site visit tracker, commission tracker, Broker360"
      />
      <meta name="author" content="Broker360" />
      <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
      <meta name="theme-color" content="#2d5cff" />
      <link rel="canonical" href="https://broker360.in/" />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Broker360" />
      <meta property="og:title" content="Broker360 — Invite-only CRM for Indian real estate brokers" />
      <meta
        property="og:description"
        content="Leads, inventory, commissions, and your team — on one private dashboard. Invite-only access for Indian brokerages."
      />
      <meta property="og:url" content="https://broker360.in/" />
      <meta property="og:locale" content="en_IN" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Broker360 — Invite-only CRM for Indian brokers" />
      <meta
        name="twitter:description"
        content="Leads, inventory, commissions, WhatsApp automation, team analytics. One dashboard. Invite-only."
      />

      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,600&family=Manrope:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
      />

      {/* Bright atmosphere */}
      <div className="aurora aurora--1" aria-hidden />
      <div className="aurora aurora--2" aria-hidden />
      <div className="aurora aurora--3" aria-hidden />
      <div className="gridbg" aria-hidden />

      {/* ── Navbar ─────────────────────────────────── */}
      <header role="banner">
        <nav className="nav" aria-label="Primary navigation">
          <div className="nav__inner">
            <a href="#top" className="brand" onClick={closeMenu} aria-label="Broker360 home">
              <span className="brand__mark">B360</span>
              <span className="brand__wordmark">Broker360</span>
            </a>

            {menuOpen && (
              <button
                type="button"
                aria-label="Close menu"
                className="nav__backdrop"
                onClick={closeMenu}
              />
            )}

            <div
              id="mobile-menu"
              className={`nav__links ${menuOpen ? 'is-open' : ''}`}
            >
              <a href="#features" onClick={closeMenu}>Features</a>
              <a href="#modules" onClick={closeMenu}>Modules</a>
              <a href="#security" onClick={closeMenu}>Security</a>
              <a href="#pricing" onClick={closeMenu}>Pricing</a>
              <a href="#contact" onClick={closeMenu}>Onboarding</a>
              <Link href="/login" className="btn btn--primary nav__cta-mobile" onClick={closeMenu}>
                Subscriber sign-in <span aria-hidden>→</span>
              </Link>
            </div>

            <div className="nav__actions">
              <span className="nav__hint" aria-hidden>
                <span className="nav__hint-dot" /> Invite-only
              </span>
              <Link href="/login" className="btn btn--primary nav__cta">
                Subscriber sign-in <span aria-hidden>→</span>
              </Link>
            </div>

            <button
              type="button"
              aria-label="Toggle menu"
              aria-expanded={menuOpen ? 'true' : 'false'}
              aria-controls="mobile-menu"
              className={`hamburger ${menuOpen ? 'is-open' : ''}`}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span /><span /><span />
            </button>
          </div>
        </nav>
      </header>

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
            Broker360 is a private, subscriber-only CRM for Indian brokerages. Leads, inventory,
            commissions, and your team — on one dashboard that respects how deals really get done.
          </p>

          <div className="hero__ctas fade-up" style={{ animationDelay: '0.55s' }}>
            <Link href="/login" className="btn btn--primary btn--lg">
              Subscriber sign-in <span aria-hidden>→</span>
            </Link>
            <a href="#contact" className="btn btn--ghost btn--lg">
              Request onboarding
            </a>
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

          {/* Dashboard mockup */}
          <div className="mock fade-up" style={{ animationDelay: '1s' }} aria-hidden>
            <div className="mock__bar">
              <span className="mock__light" style={{ background: '#ff5f57' }} />
              <span className="mock__light" style={{ background: '#febc2e' }} />
              <span className="mock__light" style={{ background: '#5b8dff' }} />
              <div className="mock__url">broker360.in/dashboard</div>
            </div>

            <div className="mock__body">
              <aside className="mock__side">
                <div className="mock__logo">B360</div>
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
                    {hotDeals.map((d) => (
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
            {[...tickerItems, ...tickerItems].map((t, i) => (
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
              Ten years of watching good brokers wrestle bad tools. Broker360 is the CRM we wished
              existed when we ran our own teams.
            </p>
          </div>

          <div className="bento">
            {features.map((f, i) => (
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
                          <text x="228" y="86" fill="#1a3bd1">Broker360</text>
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

        {/* ── Modules strip — every CRM area ─────────── */}
        <section id="modules" className="section section--alt" aria-labelledby="modules-title">
          <div className="section__header">
            <span className="eyebrow">◇ Modules</span>
            <h2 id="modules-title" className="section__title">
              Every screen your team actually opens — <em>already shipped.</em>
            </h2>
            <p className="section__sub">
              Fifteen first-class modules ship with Broker360. No add-ons, no app-store, no upgrade paywall.
            </p>
          </div>

          <div className="modules">
            {modules.map((m) => (
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
            {[
              { n: '01', title: 'Capture', copy: 'Every lead channel — portals, ads, referrals, walk-ins — lands in a single inbox.' },
              { n: '02', title: 'Assign',  copy: 'Smart routing based on location, budget, and agent load. Nobody gets forgotten.' },
              { n: '03', title: 'Nurture', copy: 'Drafted follow-ups, WhatsApp nudges, and calendar-booked site visits.' },
              { n: '04', title: 'Close',   copy: 'Docs, commission split, and co-broking payouts tracked in one place.' },
            ].map((s) => (
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
              Broker360 is invite-only for a reason. Every sign-in is verified, every role is scoped,
              every write is logged.
            </p>
          </div>

          <div className="security">
            {securityPoints.map((s) => (
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
            {testimonials.map((t) => (
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
            {pricingTiers.map((p) => (
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
              Already a subscriber? <Link href="/login">Sign in here</Link>. New to Broker360?{' '}
              <a href="#contact">Request onboarding below</a>.
            </p>
          </div>
        </section>

        {/* ── Onboarding Form + CTA ──────────────────── */}
        <section id="contact" className="section" aria-labelledby="contact-title">
          <div className="contact">
            <div className="contact__pitch">
              <span className="eyebrow">◆ Onboarding</span>
              <h2 id="contact-title" className="section__title contact__title">
                Tell us about your brokerage. <em>We&rsquo;ll take it from there.</em>
              </h2>
              <p className="contact__sub">
                Broker360 is invite-only. Submit the form and our team will reach out within 24 hours
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
              {submitted ? (
                <div className="form-success" role="status" aria-live="polite">
                  <span className="form-success__mark" aria-hidden>✓</span>
                  <h3>Thank you, {form.name.split(' ')[0] || 'friend'}.</h3>
                  <p>
                    We&rsquo;ve opened your email client with your enquiry pre-filled. If it didn&rsquo;t
                    open, email us directly at{' '}
                    <a href="mailto:hello@broker360.com">hello@broker360.com</a> and we&rsquo;ll take
                    it from there within 24 hours.
                  </p>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setSubmitted(false);
                      setForm(EMPTY_FORM);
                    }}
                  >
                    Submit another enquiry
                  </button>
                </div>
              ) : (
                <form
                  className="form"
                  onSubmit={handleSubmit}
                  noValidate
                  aria-label="Broker360 onboarding enquiry"
                >
                  <div className="form__head">
                    <span className="form__label">Onboarding enquiry</span>
                    <span className="form__meta">Takes ~60 seconds</span>
                  </div>

                  <div className="form__row">
                    <div className="field">
                      <label htmlFor="f-name">Full name *</label>
                      <input
                        id="f-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        placeholder="Raj Kapoor"
                        value={form.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="f-company">Brokerage / company *</label>
                      <input
                        id="f-company"
                        name="company"
                        type="text"
                        autoComplete="organization"
                        placeholder="Pillai & Co"
                        value={form.company}
                        onChange={(e) => handleChange('company', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form__row">
                    <div className="field">
                      <label htmlFor="f-email">Work email *</label>
                      <input
                        id="f-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@brokerage.com"
                        value={form.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="f-phone">Phone</label>
                      <input
                        id="f-phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="+91 98765 43210"
                        value={form.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form__row">
                    <div className="field">
                      <label htmlFor="f-city">City</label>
                      <input
                        id="f-city"
                        name="city"
                        type="text"
                        autoComplete="address-level2"
                        placeholder="Bengaluru"
                        value={form.city}
                        onChange={(e) => handleChange('city', e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="f-team">Team size</label>
                      <select
                        id="f-team"
                        name="teamSize"
                        value={form.teamSize}
                        onChange={(e) => handleChange('teamSize', e.target.value)}
                      >
                        <option value="">Select…</option>
                        <option value="1">Just me</option>
                        <option value="2-5">2–5 agents</option>
                        <option value="6-15">6–15 agents</option>
                        <option value="16+">16+ agents</option>
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="f-plan">Interested plan</label>
                    <select
                      id="f-plan"
                      name="plan"
                      value={form.plan}
                      onChange={(e) => handleChange('plan', e.target.value)}
                    >
                      <option value="">Not sure yet</option>
                      <option value="Solo">Solo — ₹1,499/mo</option>
                      <option value="Team">Team — ₹4,999/mo</option>
                      <option value="Enterprise">Enterprise — Custom</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="f-msg">What are you trying to solve?</label>
                    <textarea
                      id="f-msg"
                      name="message"
                      rows={4}
                      placeholder="We&rsquo;re losing leads in WhatsApp threads and need one dashboard the whole team can use…"
                      value={form.message}
                      onChange={(e) => handleChange('message', e.target.value)}
                    />
                  </div>

                  {/* Honeypot */}
                  <input
                    type="text"
                    name="website"
                    value={form.hp}
                    onChange={(e) => handleChange('hp', e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    className="form__hp"
                    aria-hidden
                  />

                  <label className="consent">
                    <input
                      type="checkbox"
                      checked={form.consent}
                      onChange={(e) => handleChange('consent', e.target.checked)}
                      required
                    />
                    <span>
                      I agree to be contacted by Broker360 about onboarding. We don&rsquo;t share
                      your details.
                    </span>
                  </label>

                  {formError && (
                    <p className="form__error" role="alert">{formError}</p>
                  )}

                  <button
                    type="submit"
                    className="btn btn--primary btn--lg form__submit"
                    disabled={submitting}
                  >
                    {submitting ? 'Sending…' : 'Request onboarding'}{' '}
                    {!submitting && <span aria-hidden>→</span>}
                  </button>

                  <p className="form__fine">
                    Members-only access · Every sign-in is OTP-verified
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="foot" role="contentinfo">
        <div className="foot__grid">
          <div className="foot__brand">
            <div className="brand">
              <span className="brand__mark">B360</span>
              <span className="brand__wordmark">Broker360</span>
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
            <a href="mailto:hello@broker360.com">Support</a>
          </div>
        </div>

        <div className="foot__watermark" aria-hidden>
          <em>Broker360</em>
        </div>

        <div className="foot__bar">
          <span>© {new Date().getFullYear()} Broker360 · All rights reserved.</span>
          <span>Made with precision · Jaipur · Bengaluru</span>
        </div>
      </footer>

      {/* ── Scoped styles ──────────────────────────── */}
      <style jsx global>{`
        html { scroll-behavior: smooth; }

        .b360 {
          --bg: #f7f8fb;
          --bg-alt: #ffffff;
          --ink: #0b1020;
          --ink-mid: #3a4155;
          --ink-dim: #6b7085;
          --ink-faint: #a4a9b8;
          --line: rgba(11, 16, 32, 0.08);
          --line-soft: rgba(11, 16, 32, 0.04);
          --blue: #2d5cff;
          --blue-deep: #1a3bd1;
          --blue-sky: #5b8dff;
          --blue-pale: #eef2ff;
          --coral: #ff6a3d;
          --coral-pale: #fff1ec;
          --shadow-sm: 0 2px 8px rgba(11, 16, 32, 0.04);
          --shadow-md: 0 12px 32px rgba(11, 16, 32, 0.06);
          --shadow-lg: 0 30px 80px rgba(11, 16, 32, 0.1);

          position: relative;
          min-height: 100vh;
          background: var(--bg);
          color: var(--ink);
          font-family: 'Manrope', system-ui, -apple-system, sans-serif;
          font-size: 16px;
          line-height: 1.55;
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }

        .b360 * { box-sizing: border-box; }
        .b360 a { color: inherit; text-decoration: none; }

        /* ── Safety: long words wrap, grid children can shrink ─── */
        .b360 :where(h1, h2, h3, h4, p, blockquote, li, a) {
          overflow-wrap: break-word;
          word-break: normal;
        }
        .b360 :where(.bento, .modules, .steps, .security, .quotes, .prices, .contact, .foot__grid, .form__row) > * {
          min-width: 0;
        }
        .b360 img, .b360 video { max-width: 100%; height: auto; display: block; }
        .b360 button { font-family: inherit; }

        /* ── Bright atmosphere ─── */
        .b360 .aurora {
          position: fixed;
          pointer-events: none;
          filter: blur(90px);
          opacity: 0.5;
          z-index: 0;
          border-radius: 50%;
        }
        .b360 .aurora--1 {
          top: -15%; left: -8%;
          width: 520px; height: 520px;
          background: radial-gradient(circle at 30% 30%, var(--blue-sky), transparent 60%);
          animation: b360Float1 24s ease-in-out infinite;
        }
        .b360 .aurora--2 {
          top: 25%; right: -12%;
          width: 620px; height: 620px;
          background: radial-gradient(circle at 70% 40%, var(--blue), transparent 60%);
          animation: b360Float2 28s ease-in-out infinite;
          opacity: 0.25;
        }
        .b360 .aurora--3 {
          bottom: -25%; left: 30%;
          width: 540px; height: 540px;
          background: radial-gradient(circle at 50% 50%, var(--coral), transparent 60%);
          animation: b360Float3 26s ease-in-out infinite;
          opacity: 0.18;
        }
        @keyframes b360Float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(60px, 80px) scale(1.12); }
        }
        @keyframes b360Float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-80px, 40px) scale(1.08); }
        }
        @keyframes b360Float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(40px, -60px) scale(1.15); }
        }

        .b360 .gridbg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          opacity: 0.5;
          background-image:
            linear-gradient(rgba(11,16,32,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(11,16,32,0.025) 1px, transparent 1px);
          background-size: 56px 56px;
          background-position: -1px -1px;
          mask-image: radial-gradient(circle at 50% 30%, #000 0%, transparent 70%);
          -webkit-mask-image: radial-gradient(circle at 50% 30%, #000 0%, transparent 70%);
        }

        /* Header must sit ABOVE sections so the mobile menu drop-panel
           is not painted under the hero/features content. */
        .b360 > header { position: relative; z-index: 100; }
        .b360 > main > section,
        .b360 > footer { position: relative; z-index: 2; }

        /* ── Navbar ─── */
        .b360 .nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          background: rgba(255, 255, 255, 0.72);
          border-bottom: 1px solid var(--line);
        }
        .b360 .nav__inner {
          max-width: 1240px;
          margin: 0 auto;
          padding: 16px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
        }
        .b360 .brand { display: inline-flex; align-items: center; gap: 10px; }
        .b360 .brand__mark {
          display: inline-grid;
          place-items: center;
          width: 34px; height: 34px;
          border-radius: 9px;
          background: linear-gradient(135deg, var(--blue-deep), var(--blue));
          color: #ffffff;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: -0.02em;
          box-shadow: 0 6px 18px rgba(45, 92, 255, 0.3);
        }
        .b360 .brand__wordmark {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: 20px;
          letter-spacing: -0.02em;
          color: var(--ink);
        }

        .b360 .nav__links {
          display: flex;
          gap: 32px;
          font-size: 14px;
          color: var(--ink-mid);
          font-weight: 500;
        }
        .b360 .nav__links a { transition: color 0.2s; }
        .b360 .nav__links a:hover { color: var(--blue); }
        .b360 .nav__cta-mobile { display: none; }

        .b360 .nav__actions { display: flex; align-items: center; gap: 14px; }
        .b360 .nav__hint {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--ink-dim);
        }
        .b360 .nav__hint-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--blue);
          box-shadow: 0 0 8px rgba(45, 92, 255, 0.5);
        }

        .b360 .hamburger {
          display: none;
          background: var(--bg-alt);
          border: 1px solid var(--line);
          border-radius: 10px;
          width: 42px; height: 42px;
          padding: 0;
          cursor: pointer;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 4px;
        }
        .b360 .hamburger span {
          width: 18px; height: 1.5px;
          background: var(--ink);
          transition: transform 0.2s, opacity 0.2s;
        }
        .b360 .hamburger.is-open span:nth-child(1) { transform: translateY(5.5px) rotate(45deg); }
        .b360 .hamburger.is-open span:nth-child(2) { opacity: 0; }
        .b360 .hamburger.is-open span:nth-child(3) { transform: translateY(-5.5px) rotate(-45deg); }

        /* ── Buttons ─── */
        .b360 .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 999px;
          font-family: 'Manrope', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: transform 0.15s, background 0.2s, border-color 0.2s, box-shadow 0.2s;
          white-space: nowrap;
        }
        .b360 .btn:hover { transform: translateY(-1px); }
        .b360 .btn:disabled { opacity: 0.6; cursor: wait; transform: none; }
        .b360 .btn--primary {
          background: var(--blue);
          color: #ffffff;
          box-shadow: 0 10px 24px rgba(45, 92, 255, 0.3), 0 2px 6px rgba(45, 92, 255, 0.2);
        }
        .b360 .btn--primary:hover {
          background: var(--blue-deep);
          box-shadow: 0 14px 32px rgba(45, 92, 255, 0.4), 0 3px 8px rgba(45, 92, 255, 0.25);
        }
        .b360 .btn--ghost {
          background: var(--bg-alt);
          color: var(--ink);
          border-color: var(--line);
        }
        .b360 .btn--ghost:hover {
          background: var(--blue-pale);
          border-color: rgba(45, 92, 255, 0.25);
          color: var(--blue-deep);
        }
        .b360 .btn--lg { padding: 14px 26px; font-size: 15px; }

        /* ── Hero ─── */
        .b360 .hero {
          padding: 150px 32px 100px;
          max-width: 1240px;
          margin: 0 auto;
          text-align: center;
        }
        .b360 .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 14px;
          border-radius: 999px;
          border: 1px solid rgba(45, 92, 255, 0.22);
          background: var(--blue-pale);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          color: var(--blue-deep);
        }
        .b360 .pill__dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--blue);
          box-shadow: 0 0 10px rgba(45, 92, 255, 0.6);
        }

        .b360 .hero__headline {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: clamp(42px, 6.6vw, 88px);
          line-height: 1.04;
          letter-spacing: -0.035em;
          margin: 28px auto 24px;
          max-width: 920px;
          color: var(--ink);
        }
        .b360 .hero__headline em {
          font-style: italic;
          font-weight: 400;
          background: linear-gradient(135deg, var(--blue-deep), var(--blue-sky));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .b360 .hero__sub {
          font-size: 18px;
          color: var(--ink-dim);
          max-width: 640px;
          margin: 0 auto 32px;
        }
        .b360 .hero__ctas {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .b360 .hero__note {
          font-size: 13.5px;
          color: var(--ink-dim);
          margin-bottom: 28px;
        }
        .b360 .hero__note-key {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink);
        }
        .b360 .hero__note a {
          color: var(--blue);
          border-bottom: 1px solid rgba(45,92,255,0.3);
        }
        .b360 .hero__note a:hover { color: var(--blue-deep); border-bottom-color: var(--blue-deep); }

        .b360 .hero__meta {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 22px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--ink-dim);
          margin-bottom: 72px;
        }
        .b360 .check { color: var(--blue); margin-right: 6px; font-weight: 700; }

        /* Dashboard mock */
        .b360 .mock {
          margin: 0 auto;
          max-width: 1120px;
          border-radius: 22px;
          overflow: hidden;
          background: var(--bg-alt);
          border: 1px solid var(--line);
          box-shadow: var(--shadow-lg);
          transform: perspective(1800px) rotateX(2deg);
          transform-origin: top center;
        }
        .b360 .mock__bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #fafbfd;
          border-bottom: 1px solid var(--line);
        }
        .b360 .mock__light { width: 11px; height: 11px; border-radius: 50%; }
        .b360 .mock__url {
          margin-left: 16px;
          padding: 5px 14px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid var(--line);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--ink-dim);
          flex: 1;
          max-width: 300px;
        }
        .b360 .mock__body {
          display: grid;
          grid-template-columns: 200px 1fr;
          min-height: 520px;
        }
        .b360 .mock__side {
          border-right: 1px solid var(--line);
          padding: 18px;
          background: #fafbfd;
        }
        .b360 .mock__logo {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--blue);
          margin-bottom: 22px;
          letter-spacing: 0.05em;
          font-weight: 600;
        }
        .b360 .mock__side ul { list-style: none; padding: 0; margin: 0; }
        .b360 .mock__side li {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13px;
          color: var(--ink-dim);
          margin-bottom: 3px;
          cursor: default;
          font-weight: 500;
        }
        .b360 .mock__side li span { color: var(--ink-faint); }
        .b360 .mock__side li.is-active {
          background: var(--blue-pale);
          color: var(--blue-deep);
        }
        .b360 .mock__side li.is-active span { color: var(--blue); }

        .b360 .mock__main { padding: 22px 26px; background: var(--bg-alt); }
        .b360 .mock__topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 22px;
          gap: 16px;
        }
        .b360 .dash-search {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          max-width: 360px;
          padding: 8px 14px;
          border-radius: 10px;
          background: #fafbfd;
          border: 1px solid var(--line);
        }
        .b360 .dash-search span { color: var(--ink-faint); }
        .b360 .dash-search input {
          background: transparent;
          border: none;
          outline: none;
          color: var(--ink-dim);
          font-family: inherit;
          font-size: 12px;
          width: 100%;
        }
        .b360 .dash-avatars { display: flex; }
        .b360 .av {
          display: inline-grid;
          place-items: center;
          width: 28px; height: 28px;
          border-radius: 50%;
          font-size: 10px;
          font-weight: 700;
          color: #ffffff;
          border: 2px solid var(--bg-alt);
          margin-left: -6px;
        }
        .b360 .av:first-child { margin-left: 0; }

        .b360 .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 22px;
        }
        .b360 .stat {
          padding: 14px;
          border-radius: 12px;
          background: #fafbfd;
          border: 1px solid var(--line);
        }
        .b360 .stat__label {
          display: block;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--ink-dim);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .b360 .stat__value {
          display: block;
          font-family: 'Fraunces', serif;
          font-size: 22px;
          font-weight: 600;
          color: var(--ink);
          margin: 6px 0 2px;
          letter-spacing: -0.02em;
        }
        .b360 .stat__delta {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 600;
        }
        .b360 .stat__delta.up { color: var(--blue); }
        .b360 .stat__delta.down { color: var(--coral); }

        .b360 .chart {
          padding: 18px;
          border-radius: 14px;
          background: var(--bg-alt);
          border: 1px solid var(--line);
          margin-bottom: 18px;
          box-shadow: var(--shadow-sm);
        }
        .b360 .chart__head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .b360 .chart__label {
          display: block;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink-dim);
        }
        .b360 .chart__big {
          font-family: 'Fraunces', serif;
          font-size: 26px;
          font-weight: 600;
          color: var(--ink);
          letter-spacing: -0.02em;
        }
        .b360 .chart__tag {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 999px;
          background: var(--blue-pale);
          color: var(--blue-deep);
          border: 1px solid rgba(45,92,255,0.2);
          font-weight: 600;
        }
        .b360 .chart__svg {
          width: 100%;
          height: 120px;
          display: block;
        }

        .b360 .deals {
          padding: 16px;
          border-radius: 14px;
          background: var(--bg-alt);
          border: 1px solid var(--line);
          box-shadow: var(--shadow-sm);
        }
        .b360 .deals__head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .b360 .deals__title {
          font-family: 'Fraunces', serif;
          font-size: 15px;
          font-weight: 600;
          color: var(--ink);
        }
        .b360 .deals__link {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--blue);
          font-weight: 600;
        }
        .b360 .deals__list { list-style: none; padding: 0; margin: 0; }
        .b360 .deal {
          display: grid;
          grid-template-columns: 30px 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
          border-top: 1px solid var(--line-soft);
        }
        .b360 .deal:first-child { border-top: none; }
        .b360 .deal__avatar {
          display: inline-grid;
          place-items: center;
          width: 28px; height: 28px;
          border-radius: 50%;
          font-size: 10px;
          font-weight: 700;
          color: #ffffff;
        }
        .b360 .deal__avatar--blue  { background: linear-gradient(135deg, var(--blue-deep), var(--blue)); }
        .b360 .deal__avatar--sky   { background: linear-gradient(135deg, var(--blue), var(--blue-sky)); }
        .b360 .deal__avatar--coral { background: linear-gradient(135deg, var(--coral), var(--blue-sky)); }
        .b360 .deal__who { display: flex; flex-direction: column; }
        .b360 .deal__name { font-size: 13px; color: var(--ink); font-weight: 500; }
        .b360 .deal__stage {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--ink-dim);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .b360 .deal__value {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: 14px;
          color: var(--blue);
        }

        /* ── Ticker ─── */
        .b360 .ticker {
          padding: 22px 0;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          overflow: hidden;
          background: var(--bg-alt);
        }
        .b360 .ticker__track {
          display: flex;
          gap: 48px;
          white-space: nowrap;
          animation: b360Ticker 50s linear infinite;
          width: max-content;
        }
        .b360 .ticker__item {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--ink-mid);
          letter-spacing: 0.04em;
          font-weight: 500;
        }
        .b360 .ticker__dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--blue);
        }
        @keyframes b360Ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        /* ── Sections ─── */
        .b360 .section {
          max-width: 1240px;
          margin: 0 auto;
          padding: 120px 32px;
        }
        .b360 .section--alt {
          max-width: none;
          background: var(--bg-alt);
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
        }
        .b360 .section--alt > * {
          max-width: 1240px;
          margin-left: auto;
          margin-right: auto;
          padding-left: 32px;
          padding-right: 32px;
        }

        .b360 .section__header {
          max-width: 760px;
          margin: 0 auto 64px;
          text-align: center;
        }
        .b360 .eyebrow {
          display: inline-block;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--blue);
          text-transform: uppercase;
          letter-spacing: 0.14em;
          margin-bottom: 18px;
          font-weight: 600;
        }
        .b360 .section__title {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: clamp(32px, 4.6vw, 58px);
          line-height: 1.08;
          letter-spacing: -0.03em;
          margin: 0 0 16px;
          color: var(--ink);
        }
        .b360 .section__title em {
          font-style: italic;
          font-weight: 400;
          background: linear-gradient(135deg, var(--blue-deep), var(--blue-sky));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .b360 .section__sub {
          font-size: 17px;
          color: var(--ink-dim);
        }

        /* ── Bento ─── */
        .b360 .bento {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 16px;
        }
        .b360 .cell {
          grid-column: span 2;
          padding: 28px;
          border-radius: 20px;
          background: var(--bg-alt);
          border: 1px solid var(--line);
          position: relative;
          overflow: hidden;
          min-height: 220px;
          transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
        }
        .b360 .cell:hover {
          border-color: rgba(45, 92, 255, 0.2);
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }
        .b360 .cell--wide { grid-column: span 4; min-height: 300px; }
        .b360 .cell--tall { grid-column: span 2; grid-row: span 2; min-height: 460px; }

        .b360 .cell__num {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--ink-faint);
          letter-spacing: 0.1em;
          font-weight: 600;
        }
        .b360 .cell__title {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: 24px;
          letter-spacing: -0.02em;
          margin: 8px 0 12px;
          color: var(--ink);
        }
        .b360 .cell__copy {
          color: var(--ink-dim);
          font-size: 14.5px;
          max-width: 42ch;
        }

        .b360 .flow-visual { margin-top: 18px; width: 100%; max-width: 520px; }
        .b360 .flow-visual svg { width: 100%; height: auto; }

        .b360 .chip-cluster {
          margin-top: 22px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .b360 .mini-chip {
          display: inline-flex;
          align-items: center;
          padding: 5px 11px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 999px;
          background: var(--blue-pale);
          color: var(--blue-deep);
          border: 1px solid rgba(45, 92, 255, 0.18);
        }
        .b360 .mini-chip--ghost {
          background: transparent;
          color: var(--ink-dim);
          border-color: var(--line);
        }

        .b360 .speed-big {
          margin-top: 20px;
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .b360 .speed-big span {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: 76px;
          letter-spacing: -0.04em;
          background: linear-gradient(135deg, var(--blue-deep), var(--blue-sky));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .b360 .speed-big em {
          font-style: normal;
          font-family: 'Fraunces', serif;
          font-size: 28px;
          color: var(--ink-dim);
        }

        .b360 .leaderboard { list-style: none; padding: 0; margin: 22px 0 0; }
        .b360 .leaderboard li {
          display: grid;
          grid-template-columns: 22px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 11px 0;
          border-top: 1px solid var(--line-soft);
          font-size: 13.5px;
          color: var(--ink);
        }
        .b360 .leaderboard li:first-child { border-top: none; }
        .b360 .leaderboard li span {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--ink-faint);
          font-weight: 600;
        }
        .b360 .leaderboard li b {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          color: var(--blue);
        }

        /* ── Modules ─── */
        .b360 .modules {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .b360 .module {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 20px 22px;
          border-radius: 16px;
          background: var(--bg);
          border: 1px solid var(--line);
          transition: border-color 0.2s, transform 0.2s;
        }
        .b360 .module:hover {
          border-color: rgba(45, 92, 255, 0.3);
          transform: translateY(-2px);
        }
        .b360 .module__icon {
          display: inline-grid;
          place-items: center;
          width: 38px; height: 38px;
          border-radius: 10px;
          background: var(--blue-pale);
          color: var(--blue);
          font-size: 16px;
          flex-shrink: 0;
        }
        .b360 .module h4 {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: 16px;
          margin: 2px 0 4px;
          color: var(--ink);
          letter-spacing: -0.015em;
        }
        .b360 .module p {
          margin: 0;
          font-size: 13.5px;
          color: var(--ink-dim);
          line-height: 1.5;
        }

        /* ── Steps ─── */
        .b360 .steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
        }
        .b360 .step {
          padding: 28px 24px;
          border-radius: 18px;
          border: 1px solid var(--line);
          background: var(--bg-alt);
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .b360 .step:hover {
          border-color: rgba(45, 92, 255, 0.22);
          box-shadow: var(--shadow-md);
        }
        .b360 .step__n {
          display: block;
          font-family: 'Fraunces', serif;
          font-style: italic;
          font-weight: 400;
          font-size: 62px;
          line-height: 1;
          background: linear-gradient(135deg, var(--blue-deep), var(--blue-sky));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          margin-bottom: 18px;
          letter-spacing: -0.04em;
        }
        .b360 .step__title {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: 22px;
          margin: 0 0 10px;
          letter-spacing: -0.02em;
          color: var(--ink);
        }
        .b360 .step__copy { color: var(--ink-dim); font-size: 14.5px; }

        /* ── Security ─── */
        .b360 .security {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .b360 .sec-card {
          padding: 26px 22px;
          border-radius: 18px;
          border: 1px solid var(--line);
          background: var(--bg);
          position: relative;
          overflow: hidden;
        }
        .b360 .sec-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 60px; height: 3px;
          background: linear-gradient(90deg, var(--blue-deep), var(--blue-sky));
          border-radius: 0 0 8px 0;
        }
        .b360 .sec-card__key {
          display: inline-block;
          font-family: 'JetBrains Mono', monospace;
          font-size: 16px;
          color: var(--blue);
          margin-bottom: 14px;
        }
        .b360 .sec-card h4 {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: 19px;
          margin: 0 0 10px;
          color: var(--ink);
          letter-spacing: -0.015em;
        }
        .b360 .sec-card p { margin: 0; color: var(--ink-dim); font-size: 14px; }

        /* ── Quotes ─── */
        .b360 .quotes {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }
        .b360 .quote {
          padding: 32px;
          border-radius: 20px;
          border: 1px solid var(--line);
          background: var(--bg-alt);
          margin: 0;
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .b360 .quote:hover {
          border-color: rgba(45, 92, 255, 0.2);
          box-shadow: var(--shadow-md);
        }
        .b360 .quote blockquote {
          font-family: 'Fraunces', serif;
          font-weight: 400;
          font-size: 19px;
          line-height: 1.5;
          letter-spacing: -0.01em;
          margin: 0 0 22px;
          color: var(--ink);
        }
        .b360 .quote figcaption { display: flex; align-items: center; gap: 14px; }
        .b360 .quote__avatar {
          display: inline-grid;
          place-items: center;
          width: 42px; height: 42px;
          border-radius: 50%;
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
        }
        .b360 .quote__who { display: flex; flex-direction: column; font-size: 13px; }
        .b360 .quote__who b { color: var(--ink); font-weight: 600; }
        .b360 .quote__who em {
          font-family: 'JetBrains Mono', monospace;
          font-style: normal;
          font-size: 11px;
          color: var(--ink-dim);
        }

        /* ── Pricing ─── */
        .b360 .prices {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          max-width: 1120px;
          margin: 0 auto;
        }
        .b360 .price {
          padding: 36px 28px;
          border-radius: 22px;
          border: 1px solid var(--line);
          background: var(--bg-alt);
          display: flex;
          flex-direction: column;
          position: relative;
          transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
        }
        .b360 .price:hover {
          border-color: rgba(45, 92, 255, 0.2);
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }
        .b360 .price--featured {
          border-color: var(--blue);
          box-shadow: 0 0 0 1px var(--blue), 0 30px 60px rgba(45, 92, 255, 0.18);
          background: linear-gradient(180deg, var(--blue-pale), var(--bg-alt) 45%);
        }
        .b360 .price--featured:hover {
          box-shadow: 0 0 0 1px var(--blue-deep), 0 34px 70px rgba(45, 92, 255, 0.25);
          border-color: var(--blue-deep);
        }
        .b360 .price__badge {
          position: absolute;
          top: -12px; left: 50%;
          transform: translateX(-50%);
          padding: 6px 14px;
          border-radius: 999px;
          background: var(--blue);
          color: #ffffff;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          box-shadow: 0 8px 20px rgba(45, 92, 255, 0.35);
        }
        .b360 .price__tier {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: 26px;
          margin: 0 0 6px;
          letter-spacing: -0.02em;
          color: var(--ink);
        }
        .b360 .price__tag { color: var(--ink-dim); font-size: 13.5px; margin: 0 0 22px; }
        .b360 .price__amount { display: flex; align-items: baseline; gap: 2px; margin-bottom: 24px; }
        .b360 .price__num {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: 48px;
          letter-spacing: -0.03em;
          color: var(--ink);
        }
        .b360 .price__cadence { color: var(--ink-dim); font-size: 14px; }
        .b360 .price__list {
          list-style: none;
          padding: 0;
          margin: 0 0 26px;
          flex: 1;
        }
        .b360 .price__list li {
          padding: 10px 0;
          font-size: 14px;
          color: var(--ink-mid);
          border-top: 1px solid var(--line-soft);
        }
        .b360 .price__list li:first-child { border-top: none; }
        .b360 .prices__foot {
          grid-column: 1 / -1;
          text-align: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--ink-dim);
          margin: 12px 0 0;
        }
        .b360 .prices__foot a { color: var(--blue); }

        /* ── Contact (pitch + form) ─── */
        .b360 .contact {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 56px;
          max-width: 1120px;
          margin: 0 auto;
          align-items: start;
        }
        .b360 .contact__pitch { padding-top: 8px; }
        .b360 .contact__title { margin: 0 0 20px; text-align: left; }
        .b360 .contact__sub {
          color: var(--ink-dim);
          font-size: 16px;
          margin: 0 0 26px;
        }
        .b360 .contact__benefits {
          list-style: none;
          padding: 0;
          margin: 0 0 32px;
          display: grid;
          gap: 10px;
        }
        .b360 .contact__benefits li {
          font-size: 14.5px;
          color: var(--ink);
        }
        .b360 .contact__already {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 20px;
          border-radius: 14px;
          background: var(--blue-pale);
          border: 1px solid rgba(45, 92, 255, 0.2);
        }
        .b360 .contact__already span {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--blue-deep);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
        }

        .b360 .contact__card {
          background: var(--bg-alt);
          border: 1px solid var(--line);
          border-radius: 24px;
          padding: 32px;
          box-shadow: var(--shadow-lg);
          position: relative;
        }
        .b360 .contact__card::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 24px;
          padding: 1px;
          background: linear-gradient(135deg, rgba(45,92,255,0.4), rgba(91,141,255,0.1), transparent 60%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        .b360 .form__head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 22px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--line);
        }
        .b360 .form__label {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: 18px;
          color: var(--ink);
          letter-spacing: -0.015em;
        }
        .b360 .form__meta {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--ink-dim);
          letter-spacing: 0.04em;
        }

        .b360 .form__row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 14px;
        }
        .b360 .field { display: flex; flex-direction: column; margin-bottom: 14px; }
        .b360 .form__row .field { margin-bottom: 0; }
        .b360 .field label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink-mid);
          margin-bottom: 6px;
          font-weight: 600;
        }
        .b360 .field input,
        .b360 .field select,
        .b360 .field textarea {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          padding: 11px 14px;
          border-radius: 10px;
          border: 1px solid var(--line);
          background: var(--bg);
          color: var(--ink);
          font-family: inherit;
          font-size: 14px;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .b360 .field input::placeholder,
        .b360 .field textarea::placeholder {
          color: var(--ink-faint);
        }
        .b360 .field input:focus,
        .b360 .field select:focus,
        .b360 .field textarea:focus {
          outline: none;
          border-color: var(--blue);
          background: var(--bg-alt);
          box-shadow: 0 0 0 3px rgba(45, 92, 255, 0.15);
        }
        .b360 .field textarea { resize: vertical; min-height: 96px; line-height: 1.5; }
        .b360 .field select {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%236b7085' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 36px;
        }

        .b360 .form__hp {
          position: absolute;
          left: -9999px;
          width: 1px;
          height: 1px;
          opacity: 0;
        }

        .b360 .consent {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 12.5px;
          color: var(--ink-mid);
          margin: 10px 0 18px;
          line-height: 1.45;
          cursor: pointer;
        }
        .b360 .consent input {
          margin-top: 2px;
          accent-color: var(--blue);
          width: 15px;
          height: 15px;
          flex-shrink: 0;
        }

        .b360 .form__error {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--coral);
          background: var(--coral-pale);
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255, 106, 61, 0.25);
          margin: 0 0 14px;
        }
        .b360 .form__submit { width: 100%; }
        .b360 .form__fine {
          text-align: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--ink-dim);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 16px 0 0;
        }

        .b360 .form-success {
          text-align: center;
          padding: 20px 8px;
        }
        .b360 .form-success__mark {
          display: inline-grid;
          place-items: center;
          width: 58px; height: 58px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--blue), var(--blue-sky));
          color: #ffffff;
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 20px;
          box-shadow: 0 12px 32px rgba(45, 92, 255, 0.3);
        }
        .b360 .form-success h3 {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: 26px;
          margin: 0 0 12px;
          color: var(--ink);
          letter-spacing: -0.02em;
        }
        .b360 .form-success p {
          color: var(--ink-dim);
          font-size: 14.5px;
          margin: 0 auto 24px;
          max-width: 360px;
        }
        .b360 .form-success p a { color: var(--blue); font-weight: 600; }

        /* ── Footer ─── */
        .b360 .foot {
          border-top: 1px solid var(--line);
          padding: 80px 32px 40px;
          position: relative;
          overflow: hidden;
          background: var(--bg-alt);
        }
        .b360 .foot__grid {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 48px;
        }
        .b360 .foot__brand p {
          color: var(--ink-dim);
          font-size: 14px;
          max-width: 320px;
          margin-top: 16px;
        }
        .b360 .foot__col h4 {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--ink-dim);
          margin: 0 0 16px;
          font-weight: 600;
        }
        .b360 .foot__col a {
          display: block;
          font-size: 14px;
          color: var(--ink);
          padding: 6px 0;
          transition: color 0.2s;
          font-weight: 500;
        }
        .b360 .foot__col a:hover { color: var(--blue); }

        .b360 .foot__watermark {
          text-align: center;
          margin: 40px 0;
          pointer-events: none;
          user-select: none;
        }
        .b360 .foot__watermark em {
          font-family: 'Fraunces', serif;
          font-style: italic;
          font-weight: 400;
          font-size: clamp(80px, 16vw, 220px);
          line-height: 1;
          letter-spacing: -0.05em;
          background: linear-gradient(180deg, rgba(11, 16, 32, 0.08), rgba(11, 16, 32, 0.01));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .b360 .foot__bar {
          max-width: 1240px;
          margin: 0 auto;
          padding-top: 24px;
          border-top: 1px solid var(--line);
          display: flex;
          justify-content: space-between;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--ink-dim);
          flex-wrap: wrap;
          gap: 12px;
        }

        /* ── Fade-up animation ─── */
        .b360 .fade-up {
          opacity: 0;
          transform: translateY(18px);
          animation: b360FadeUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        @keyframes b360FadeUp {
          to { opacity: 1; transform: translateY(0); }
        }

        /* ═══ Laptop ≤1200 — light tightening ═══ */
        @media (max-width: 1200px) {
          .b360 .nav__inner { padding: 16px 24px; gap: 24px; }
          .b360 .nav__links { gap: 26px; }
          .b360 .nav__hint { display: none; }
          .b360 .section { padding: 104px 28px; }
          .b360 .hero { padding: 140px 28px 88px; }
          .b360 .bento { gap: 14px; }
          .b360 .prices { gap: 14px; }
          .b360 .modules { gap: 14px; }
          .b360 .foot { padding: 72px 28px 36px; }
          .b360 .foot__grid { gap: 40px; }
        }

        /* ═══ iPad landscape / small laptop ≤1024 ═══ */
        @media (max-width: 1024px) {
          .b360 .nav__links { gap: 22px; font-size: 13.5px; }
          .b360 .hero__headline { max-width: 780px; }
          .b360 .hero__sub { max-width: 580px; }
          .b360 .cell { padding: 24px; }
          .b360 .step { padding: 26px 22px; }
          .b360 .step__n { font-size: 56px; }
          .b360 .quote { padding: 28px; }
          .b360 .price { padding: 32px 24px; }
          .b360 .contact { gap: 44px; }
        }

        /* ═══ Tablet portrait ≤980 — nav collapses to hamburger ═══ */
        @media (max-width: 980px) {
          /* Tappable dark backdrop behind the open menu */
          .b360 .nav__backdrop {
            position: fixed;
            inset: 67px 0 0 0;
            background: rgba(11, 16, 32, 0.35);
            backdrop-filter: blur(2px);
            -webkit-backdrop-filter: blur(2px);
            z-index: 90;
            border: 0;
            padding: 0;
            cursor: pointer;
            animation: b360BackdropIn 0.2s ease-out;
          }
          @keyframes b360BackdropIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }

          .b360 .nav__links {
            position: fixed;
            top: 67px; left: 0; right: 0;
            z-index: 95;
            flex-direction: column;
            gap: 0;
            background: #ffffff;
            border-bottom: 1px solid var(--line);
            box-shadow: 0 14px 32px rgba(11, 16, 32, 0.08);
            padding: 20px 28px 28px;
            transform: translateY(-10px);
            opacity: 0;
            pointer-events: none;
            transition: transform 0.22s ease-out, opacity 0.22s ease-out;
            max-height: calc(100vh - 67px);
            max-height: calc(100dvh - 67px);
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
          .b360 .nav__links.is-open {
            transform: translateY(0);
            opacity: 1;
            pointer-events: auto;
          }
          .b360 .nav__links a {
            padding: 14px 0;
            border-bottom: 1px solid var(--line-soft);
            font-size: 16px;
            color: var(--ink);
          }
          .b360 .nav__cta-mobile {
            display: inline-flex;
            margin-top: 18px;
            align-self: flex-start;
          }
          .b360 .nav__actions { display: none; }
          .b360 .hamburger { display: inline-flex; }

          .b360 .hero { padding: 128px 24px 72px; }
          .b360 .hero__meta { gap: 16px; }
          .b360 .mock { transform: none; border-radius: 18px; }
          .b360 .mock__side { display: none; }
          .b360 .mock__body { grid-template-columns: 1fr; min-height: 0; }
          .b360 .stats { grid-template-columns: repeat(2, 1fr); }

          .b360 .bento { grid-template-columns: repeat(2, 1fr); }
          .b360 .cell, .b360 .cell--wide, .b360 .cell--tall {
            grid-column: span 2;
            grid-row: auto;
            min-height: 200px;
          }

          .b360 .modules { grid-template-columns: repeat(2, 1fr); }
          .b360 .steps { grid-template-columns: repeat(2, 1fr); gap: 14px; }
          .b360 .security { grid-template-columns: repeat(2, 1fr); gap: 14px; }
          .b360 .quotes { grid-template-columns: 1fr; max-width: 640px; margin: 0 auto; }
          .b360 .prices { grid-template-columns: 1fr; max-width: 520px; }

          .b360 .contact { grid-template-columns: 1fr; gap: 36px; max-width: 620px; }

          .b360 .foot__grid { grid-template-columns: 1fr 1fr; gap: 32px; }

          .b360 .section { padding: 80px 24px; }
          .b360 .section--alt > * { padding-left: 24px; padding-right: 24px; }
          .b360 .section__header { margin-bottom: 52px; }
        }

        /* ═══ Small tablet / large phones ≤768 ═══ */
        @media (max-width: 768px) {
          .b360 .section { padding: 72px 22px; }
          .b360 .section--alt > * { padding-left: 22px; padding-right: 22px; }
          .b360 .section__header { margin-bottom: 44px; }
          .b360 .hero { padding: 118px 22px 64px; }
          .b360 .hero__sub { font-size: 16.5px; }
          .b360 .hero__meta { gap: 14px; font-size: 11.5px; }

          .b360 .mock__bar { padding: 10px 14px; }
          .b360 .mock__url { font-size: 10px; max-width: 200px; }
          .b360 .mock__main { padding: 18px; }
          .b360 .chart { padding: 14px; }
          .b360 .deals { padding: 14px; }

          .b360 .bento { gap: 12px; }
          .b360 .cell { padding: 22px; min-height: 190px; }

          .b360 .modules { gap: 12px; }
          .b360 .module { padding: 18px 20px; }

          .b360 .steps { gap: 12px; }
          .b360 .step { padding: 24px 20px; }
          .b360 .step__n { font-size: 52px; margin-bottom: 14px; }

          .b360 .security { gap: 12px; }
          .b360 .sec-card { padding: 22px 20px; }

          .b360 .quote { padding: 26px; }
          .b360 .quote blockquote { font-size: 17px; }

          .b360 .price { padding: 30px 24px; }
          .b360 .price__num { font-size: 42px; }

          .b360 .contact__card { padding: 28px; }
          .b360 .contact__benefits { gap: 8px; }

          .b360 .cta { padding: 56px 30px; }

          .b360 .foot { padding: 64px 22px 32px; }
          .b360 .foot__grid { gap: 28px; }
        }

        /* ═══ Mobile ≤560 — single column, iOS-safe input sizes ═══ */
        @media (max-width: 560px) {
          .b360 .nav__inner { padding: 14px 20px; gap: 16px; }
          .b360 .brand__wordmark { display: none; }

          .b360 .hero { padding: 108px 20px 56px; }
          .b360 .hero__sub { font-size: 15.5px; }
          .b360 .hero__ctas { flex-direction: column; width: 100%; }
          .b360 .hero__ctas .btn { width: 100%; }
          .b360 .hero__meta { flex-direction: column; gap: 10px; margin-bottom: 56px; }

          .b360 .pill { font-size: 10px; padding: 6px 12px; letter-spacing: 0.06em; }

          .b360 .dash-search { display: none; }
          .b360 .mock__topbar { justify-content: flex-end; }
          .b360 .stats { grid-template-columns: 1fr 1fr; gap: 8px; }
          .b360 .stat { padding: 10px 12px; }
          .b360 .stat__value { font-size: 18px; }
          .b360 .chart__big { font-size: 22px; }

          .b360 .bento { grid-template-columns: 1fr; }
          .b360 .cell, .b360 .cell--wide, .b360 .cell--tall {
            grid-column: span 1;
            min-height: 170px;
            padding: 22px 20px;
          }
          .b360 .cell__title { font-size: 22px; }
          .b360 .cell--wide .flow-visual { display: none; }

          .b360 .modules { grid-template-columns: 1fr; }
          .b360 .steps { grid-template-columns: 1fr; }
          .b360 .security { grid-template-columns: 1fr; }

          .b360 .section { padding: 60px 20px; }
          .b360 .section--alt > * { padding-left: 20px; padding-right: 20px; }
          .b360 .section__header { margin-bottom: 40px; }

          .b360 .contact__card { padding: 22px; border-radius: 20px; }
          .b360 .form__head { margin-bottom: 18px; padding-bottom: 14px; }
          .b360 .form__row { grid-template-columns: 1fr; gap: 0; margin-bottom: 0; }
          .b360 .form__row .field { margin-bottom: 14px; }
          /* iOS zoom-on-focus fix: inputs ≥ 16px */
          .b360 .field input,
          .b360 .field select,
          .b360 .field textarea {
            font-size: 16px;
            padding: 12px 14px;
          }
          .b360 .contact__already { flex-direction: column; align-items: flex-start; gap: 10px; }
          .b360 .contact__already .btn { width: 100%; }

          .b360 .cta { padding: 44px 22px; border-radius: 22px; }
          .b360 .cta__actions { flex-direction: column; width: 100%; }
          .b360 .cta__actions .btn { width: 100%; }

          .b360 .foot { padding: 56px 20px 28px; }
          .b360 .foot__grid { grid-template-columns: 1fr; gap: 28px; }
          .b360 .foot__watermark { margin: 32px 0; }
          .b360 .foot__watermark em { font-size: clamp(64px, 22vw, 140px); }
          .b360 .foot__bar {
            flex-direction: column;
            align-items: flex-start;
            text-align: left;
          }
        }

        /* ═══ Tiny phones ≤380 (Galaxy Fold, old iPhone SE) ═══ */
        @media (max-width: 380px) {
          .b360 .nav__inner { padding: 12px 16px; }
          .b360 .brand__mark { width: 30px; height: 30px; font-size: 11px; }
          .b360 .hamburger { width: 38px; height: 38px; }

          .b360 .section { padding: 52px 16px; }
          .b360 .section--alt > * { padding-left: 16px; padding-right: 16px; }
          .b360 .hero { padding: 96px 16px 48px; }
          .b360 .hero__headline { font-size: clamp(34px, 10vw, 44px); }
          .b360 .hero__sub { font-size: 15px; }

          .b360 .mock__main { padding: 14px; }
          .b360 .stat { padding: 8px 10px; }
          .b360 .stat__value { font-size: 16px; }
          .b360 .stat__label { font-size: 9px; }

          .b360 .cell { padding: 20px 18px; }
          .b360 .step { padding: 22px 18px; }
          .b360 .sec-card { padding: 20px 18px; }
          .b360 .quote { padding: 22px 20px; }
          .b360 .price { padding: 28px 22px; }

          .b360 .contact__card { padding: 20px; border-radius: 18px; }
          .b360 .cta { padding: 36px 18px; }

          .b360 .foot { padding: 48px 16px 24px; }
          .b360 .foot__watermark em { font-size: clamp(56px, 24vw, 110px); }
        }

        /* ═══ Landscape phones (short viewports) ═══ */
        @media (max-width: 900px) and (orientation: landscape) and (max-height: 520px) {
          .b360 .hero { padding-top: 90px; padding-bottom: 40px; }
          .b360 .hero__meta { margin-bottom: 36px; }
        }

        /* ═══ Ultra-wide ≥1600 — cap line length ═══ */
        @media (min-width: 1600px) {
          .b360 .section__header { max-width: 820px; }
        }

        /* ═══ Touch devices — larger tap targets ═══ */
        @media (hover: none) and (pointer: coarse) {
          .b360 .btn { min-height: 44px; }
          .b360 .nav__links a { min-height: 44px; display: inline-flex; align-items: center; }
          .b360 .foot__col a { padding: 9px 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .b360 .aurora,
          .b360 .ticker__track,
          .b360 .fade-up,
          .b360 .cell,
          .b360 .module,
          .b360 .step,
          .b360 .quote,
          .b360 .price,
          .b360 .btn {
            animation: none !important;
            transition: none !important;
          }
          .b360 .fade-up { opacity: 1; transform: none; }
          html { scroll-behavior: auto; }
        }
      `}</style>
    </div>
  );
}
