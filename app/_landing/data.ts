/**
 * Static data used by the Broker365 landing page.
 *
 * Lives at module scope (outside the component) so arrays aren't re-created
 * on every render and so the Server Component can include them in the
 * initial HTML payload without shipping a single byte of JS to the client.
 */

export interface TickerItem {
  label: string;
}

export interface Testimonial {
  name: string;
  title: string;
  quote: string;
  hue: string;
}

export interface PricingTier {
  tier: string;
  price: string;
  cadence: string;
  tagline: string;
  features: string[];
  featured?: boolean;
}

export interface BentoFeature {
  title: string;
  copy: string;
  span: string;
  extra?: 'flow' | 'speed' | 'board' | 'filters';
}

export interface HotDeal {
  name: string;
  stage: string;
  value: string;
  tone: 'blue' | 'sky' | 'coral';
}

export interface ModuleItem {
  icon: string;
  title: string;
  copy: string;
}

export interface SecurityPoint {
  title: string;
  copy: string;
}

export const TICKER_ITEMS: string[] = [
  'Elite Estates · 2m 14s avg. response time',
  'Skyline Realty · 1,284 active leads',
  'Urban Nest · ₹48.2 Cr pipeline value',
  'Prime Homes · 37 deals closed this month',
  'Coastal Keys · 92% follow-up adherence',
  'Metro Abode · 18 agents, one dashboard',
  'Ashoka Realty · 500+ listings synced',
  'Green Acres · 6 site visits booked today',
];

// NOTE: these are sample customers used as marketing placeholders. Swap
// for real quotes before public launch to avoid any FTC-style concerns
// about testimonial authenticity.
export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Meera Pillai',
    title: 'Founder, Pillai & Co · Kochi',
    quote:
      'We stopped losing leads inside WhatsApp threads. Broker365 put every enquiry in one place and the team just moved faster.',
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
    title: 'Sales Head, RaoStone Inventory · Bengaluru',
    quote:
      'Co-broking used to be a messy spreadsheet. Now a partner agent sees what is shareable and what is not, in real time.',
    hue: 'linear-gradient(135deg, #5b8dff, #ff6a3d)',
  },
];

/**
 * Public pricing — four tiers, mirroring the in-app PLAN_METADATA in
 * lib/plans.ts. The superadmin assigns one of these per company; each
 * tier unlocks a defined feature set, and per-feature add-ons can be
 * granted on top via Company.featureFlags overrides without changing
 * the visible plan.
 *
 * Enterprise stays "Custom" because the fee scales with seat count
 * and onboarding scope. Prospective customers click "Subscriber sign-in"
 * on the card and our team follows up via the onboarding form.
 */
export const PRICING_TIERS: PricingTier[] = [
  {
    tier: 'Basic',
    price: '₹999',
    cadence: '/user/mo',
    tagline: 'Solo broker / 1–3 users',
    features: [
      'Daily Plan + Lead Transfer',
      'Buyer / Rental / Dead-Leads tabs',
      'Industry-standard statuses + sources',
      'OTP sign-in · audit log',
      'Mobile-first dashboard',
    ],
  },
  {
    tier: 'Standard',
    price: '₹1,499',
    cadence: '/user/mo',
    tagline: 'Active brokerage / 4–15 users',
    features: [
      'Everything in Basic',
      '3-step inventory wizard',
      'Project / Sector / Unit / Tower fields',
      'Multi-phone owners · bulk import',
      'Excel export of leads',
    ],
    featured: true,
  },
  {
    tier: 'Pro',
    price: '₹3,499',
    cadence: '/user/mo',
    tagline: 'Established brokerage / 15–50 users',
    features: [
      'Everything in Standard',
      'Projects → Tower → Unit hierarchy',
      'Brokers Requirements module',
      'Find Opportunity matcher',
      'Bulk projects + broker imports',
      'Reference DB · Learn & Grow',
    ],
  },
  {
    tier: 'Enterprise',
    price: 'Custom',
    cadence: '',
    tagline: 'Large team / 50+ users',
    features: [
      'Everything in Pro',
      'Per-member permission grants/revokes',
      'SSO + advanced role policies',
      'API & custom integrations',
      'Dedicated success manager',
      'On-site onboarding + training',
    ],
  },
];

export const BENTO_FEATURES: BentoFeature[] = [
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

export const HOT_DEALS: HotDeal[] = [
  { name: 'Raj Kapoor',    stage: 'Site Visit',  value: '₹1.8 Cr', tone: 'blue' },
  { name: 'Ananya Mehta',  stage: 'Negotiation', value: '₹94 L',   tone: 'sky' },
  { name: 'Sanjay Verma',  stage: 'Docs',        value: '₹3.2 Cr', tone: 'coral' },
  { name: 'Priya Nair',    stage: 'Follow-up',   value: '₹1.1 Cr', tone: 'blue' },
];

export const MODULES: ModuleItem[] = [
  { icon: '◉', title: 'Dashboard',           copy: 'KPIs, pipeline value, and today’s focus at a glance.' },
  { icon: '◈', title: 'Leads',               copy: 'Unified enquiry inbox with follow-up scheduling, transfer, and tabs by intent.' },
  { icon: '◇', title: 'Pipeline',            copy: 'Kanban-style funnel from site visit to signed docs.' },
  { icon: '◆', title: 'Inventory',           copy: 'Project / sector / unit / tower / typology fields, with rent vs sale tabs.' },
  { icon: '◫', title: 'Projects Working',    copy: 'Project → Tower → Unit hierarchy. Commercial vs Residential, Ready vs Under-Construction.' },
  { icon: '◐', title: 'Daily Plan',          copy: 'Morning commitment + evening achievements journal per teammate.' },
  { icon: '◑', title: 'Brokers Requirements',copy: 'Track outside-broker asks. Status, follow-up, source, bulk import + export.' },
  { icon: '◒', title: 'Find Opportunity',    copy: 'Auto-match buyer leads ↔ inventory by location, BHK, budget, intent — explainable scoring.' },
  { icon: '◓', title: 'My Work',             copy: 'An agent’s daily to-do distilled from every lead.' },
  { icon: '◧', title: 'Site Visits',         copy: 'Visit calendar with outcome logging and reminders.' },
  { icon: '◰', title: 'Commissions',         copy: 'Split-aware, co-broking-friendly payout tracker with monthly + per-builder views.' },
  { icon: '◱', title: 'Team Performance',    copy: 'Per-agent conversion, response time, active load.' },
  { icon: '◩', title: 'Analytics',           copy: 'Trends, cohorts, and monthly deal breakdowns.' },
  { icon: '▦', title: 'Reference Database',  copy: 'Curated public-project catalogue with brochure links — share externally.' },
  { icon: '▧', title: 'Learn & Grow',        copy: 'Folder + file resource library so onboarding decks live in one place.' },
  { icon: '▬', title: 'Budget Tracker',      copy: 'Monthly targets, spend, and agent-level allocations.' },
  { icon: '▭', title: 'Notifications',       copy: 'Bell alerts, dashboard banners, and a weekly email report.' },
  { icon: '▮', title: 'WhatsApp',            copy: 'Inbound webhook capture + scheduled reminder automations.' },
  { icon: '▯', title: 'Activity Log',        copy: 'Searchable audit trail for every sensitive action.' },
  { icon: '▱', title: 'Subscriptions',       copy: 'Plan management, renewals, and billing trail.' },
  { icon: '◙', title: 'Permissions',         copy: 'Role baseline plus per-member grants and revokes (Enterprise).' },
];

export const SECURITY_POINTS: SecurityPoint[] = [
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
  {
    title: 'Plan-aware feature gating',
    copy: 'Triple-gated capabilities: hidden in nav, blocked at the page guard, and rejected at the API. Per-company overrides let you grant add-ons without changing tiers.',
  },
];

export const WORKFLOW_STEPS = [
  { n: '01', title: 'Capture', copy: 'Every lead channel — portals, ads, referrals, walk-ins — lands in a single inbox.' },
  { n: '02', title: 'Assign',  copy: 'Smart routing based on location, budget, and agent load. Nobody gets forgotten.' },
  { n: '03', title: 'Nurture', copy: 'Drafted follow-ups, WhatsApp nudges, and calendar-booked site visits.' },
  { n: '04', title: 'Close',   copy: 'Docs, commission split, and co-broking payouts tracked in one place.' },
] as const;

/**
 * Landing-page FAQs. Answers are written short enough to fit an
 * AI-Overview / featured-snippet card (~55 words max) and are the SOLE
 * source of truth — the visible <details> accordion, the JSON-LD
 * FAQPage schema, and /llms.txt all reference these same strings so
 * Google's "answers must match schema" rule can never be violated
 * by a copy edit drifting one side out of sync.
 */
export interface FAQ { q: string; a: string; }

export const FAQS: FAQ[] = [
  {
    q: 'What is Broker365?',
    a: 'Broker365 is a browser-based CRM built for Indian real-estate brokerages. It keeps leads, property inventory, site visits, pipeline stages, commissions, and team performance in one dashboard — designed around how Indian brokers actually close deals.',
  },
  {
    q: 'How much does Broker365 cost?',
    a: 'Solo is ₹999 per month for one broker. Team is ₹2,999 per month for up to 15 agents and is the most popular plan. Enterprise is custom-priced for multi-city teams with SSO and custom integrations. All paid plans include unlimited leads and properties.',
  },
  {
    q: 'Is Broker365 only for Indian brokerages?',
    a: 'Yes. Every feature is tuned for Indian real estate — INR currency, Indian Financial Year accounting (April to March), WhatsApp as a first-class channel, Hindi-English CSV imports from 99acres and MagicBricks, and hosting in Mumbai for local data residency.',
  },
  {
    q: 'Does Broker365 integrate with WhatsApp?',
    a: 'Yes. Incoming enquiries from WhatsApp Business are captured via webhook into the leads inbox. Follow-up reminders, visit confirmations, and scheduled nudges are delivered over WhatsApp so clients reply where they already chat.',
  },
  {
    q: 'How is Broker365 different from Sell.Do or LeadSquared?',
    a: 'Sell.Do and LeadSquared are horizontal sales tools that real-estate brokers adapt to. Broker365 is built only for brokerages — co-broking commission splits, BHK-aware inventory filters, site-visit logs, and Indian Financial Year commission reports ship by default, not as add-ons.',
  },
  {
    q: 'How are co-broking commissions handled?',
    a: 'Each commission row supports a payment ledger — record the deal amount and commission percentage, then log every instalment (cash, UPI, bank, cheque) as it comes in. Partial, fully-paid, and split commissions with co-broker payouts are tracked per deal and per salesperson.',
  },
  {
    q: 'How long does onboarding take?',
    a: 'Most brokerages are live within 48 hours. Our team schedules a 30-minute walkthrough, migrates your existing leads and inventory from Excel or any portal CSV for free, and hands over credentials for every agent. Training is included.',
  },
  {
    q: 'Can I export my data if I leave?',
    a: 'Yes. Every module supports one-click Excel and CSV export. If you cancel, we provide a full JSON export of your leads, properties, commissions, and payment history within 24 hours. Your data is yours.',
  },
  {
    q: 'How secure is my brokerage data?',
    a: 'Every sign-in requires an email OTP, sessions are enforced one-device-per-account, and role-based access scopes field-level writes. Every sensitive mutation is written to a searchable audit log. Data is encrypted at rest on MongoDB Atlas in Mumbai.',
  },
  {
    q: 'Is there a trial or money-back guarantee?',
    a: 'New brokerages get a 14-day money-back guarantee from their first paid invoice — email us and we refund in full, no questions asked. Beyond that window, partial-month refunds are discretionary.',
  },
  {
    q: 'How does inventory data structure work?',
    a: 'Each inventory row carries Project, Sector, Tower, Unit No, and Typology fields alongside the usual BHK / area / price. Add a Project once and reuse it across every unit — bulk-import a flat sheet and the system groups rows automatically into Project → Tower → Unit hierarchies.',
  },
  {
    q: 'What is Find Opportunity?',
    a: 'A rule-based matcher that scores buyer leads against your live inventory using location, BHK, budget, and intent (Buy vs Rent). Each match shows the reasons it scored — brokers see explainable suggestions, not a black-box recommendation.',
  },
  {
    q: 'Do you support multiple subscription tiers?',
    a: 'Yes — Basic, Standard, Pro, and Enterprise. Each tier unlocks a defined feature set and you can add or revoke individual features per company. Team members inherit whatever the company is entitled to; no per-user purchasing.',
  },
  {
    q: 'Can I bulk-import existing data?',
    a: 'Yes — every list module (Leads, Inventory, Brokers Requirements, Projects) supports Excel/CSV import with a downloadable sample template. Headers are forgiving — “Property Name”, “Inventory Name”, or “Name” all map to the right field.',
  },
];

/**
 * JSON-LD structured data for the landing page.
 *
 * The previous copy hard-coded an `aggregateRating` of 4.9 / 38 reviews
 * despite having no review collection. Google's Search Essentials flag that
 * as spam and can trigger a manual action on the whole site. Removed.
 * Re-add only when you have a real review source to point at.
 */
/**
 * JSON-LD payload — built fresh on each request because AggregateRating
 * needs real numbers from the feedback collection, not stale constants.
 *
 *   - Pass `aggregateRating: { ratingValue, reviewCount }` only when
 *     reviewCount > 0; otherwise omit the field. Faking it triggers a
 *     Google Manual Action on the whole site.
 *   - Pass `reviews` to embed the latest approved reviews so AI overviews
 *     can quote from them with attribution. Limited to 5 to keep the
 *     payload small.
 *
 * Returning a JS object (not stringified) so the caller decides how to
 * embed it (we use a script tag with JSON.stringify inside).
 */
export interface AggregateRatingInput {
  ratingValue: number;
  reviewCount: number;
}
export interface ReviewInput {
  name: string;
  role?: string | null;
  rating: number;
  message: string;
  /** ISO date string when the review was approved/published */
  datePublished?: string | null;
}

export function buildLandingJsonLd(opts: {
  aggregateRating?: AggregateRatingInput;
  reviews?: ReviewInput[];
} = {}) {
  const softwareApp: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': 'https://broker365.in/#app',
    name: 'Broker365 CRM',
    operatingSystem: 'Web',
    applicationCategory: 'BusinessApplication',
    // Per-user/month pricing aligned with PLAN_METADATA in lib/plans.ts.
    offers: [
      { '@type': 'Offer', name: 'Basic',      price: '999',  priceCurrency: 'INR' },
      { '@type': 'Offer', name: 'Standard',   price: '1499', priceCurrency: 'INR' },
      { '@type': 'Offer', name: 'Pro',        price: '3499', priceCurrency: 'INR' },
      { '@type': 'Offer', name: 'Enterprise', priceCurrency: 'INR' },
    ],
    description:
      'Broker365 is a multi-tenant CRM for Indian real estate brokerages with lead management, property inventory hierarchy, brokers requirements, find-opportunity matcher, commissions, WhatsApp automation, team performance, and audit logs.',
  };

  if (opts.aggregateRating && opts.aggregateRating.reviewCount > 0) {
    softwareApp.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: opts.aggregateRating.ratingValue,
      reviewCount: opts.aggregateRating.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (opts.reviews && opts.reviews.length > 0) {
    softwareApp.review = opts.reviews.slice(0, 5).map((r) => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { '@type': 'Person', name: r.name, ...(r.role ? { jobTitle: r.role } : {}) },
      reviewBody: r.message,
      ...(r.datePublished ? { datePublished: r.datePublished } : {}),
    }));
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://broker365.in/#org',
        name: 'Broker365',
        url: 'https://broker365.in',
        email: 'hello@broker365.in',
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
        '@id': 'https://broker365.in/#site',
        url: 'https://broker365.in',
        name: 'Broker365',
        publisher: { '@id': 'https://broker365.in/#org' },
        inLanguage: 'en-IN',
      },
      softwareApp,
      {
        '@type': 'FAQPage',
        // Entries sourced from FAQS so the DOM <details> accordion and
        // the FAQPage schema answers stay word-for-word identical — a
        // hard Google requirement for FAQPage rich results to stay valid.
        mainEntity: FAQS.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}

/**
 * Backwards-compatible static export — used when no feedback data is
 * available. Calls `buildLandingJsonLd()` with no arguments so it
 * matches the old shape (no AggregateRating, no Review nodes).
 */
export const LANDING_JSON_LD = buildLandingJsonLd();
