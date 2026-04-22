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
    title: 'Sales Head, RaoStone Properties · Bengaluru',
    quote:
      'Co-broking used to be a messy spreadsheet. Now a partner agent sees what is shareable and what is not, in real time.',
    hue: 'linear-gradient(135deg, #5b8dff, #ff6a3d)',
  },
];

/**
 * Public pricing — three tiers. Enterprise uses a "Custom" price badge
 * because the fee is quoted per brokerage based on seats, integrations,
 * and onboarding scope. Prospective customers click "Subscriber sign-in"
 * on the card and our team follows up via the onboarding form.
 */
export const PRICING_TIERS: PricingTier[] = [
  {
    tier: 'Solo',
    price: '₹999',
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
    price: '₹2,999',
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
];

export const WORKFLOW_STEPS = [
  { n: '01', title: 'Capture', copy: 'Every lead channel — portals, ads, referrals, walk-ins — lands in a single inbox.' },
  { n: '02', title: 'Assign',  copy: 'Smart routing based on location, budget, and agent load. Nobody gets forgotten.' },
  { n: '03', title: 'Nurture', copy: 'Drafted follow-ups, WhatsApp nudges, and calendar-booked site visits.' },
  { n: '04', title: 'Close',   copy: 'Docs, commission split, and co-broking payouts tracked in one place.' },
] as const;

/**
 * JSON-LD structured data for the landing page.
 *
 * The previous copy hard-coded an `aggregateRating` of 4.9 / 38 reviews
 * despite having no review collection. Google's Search Essentials flag that
 * as spam and can trigger a manual action on the whole site. Removed.
 * Re-add only when you have a real review source to point at.
 */
export const LANDING_JSON_LD = {
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
    {
      '@type': 'SoftwareApplication',
      name: 'Broker365 CRM',
      operatingSystem: 'Web',
      applicationCategory: 'BusinessApplication',
      offers: [
        { '@type': 'Offer', name: 'Solo',       price: '999',  priceCurrency: 'INR' },
        { '@type': 'Offer', name: 'Team',       price: '2999', priceCurrency: 'INR' },
        { '@type': 'Offer', name: 'Enterprise', priceCurrency: 'INR' },
      ],
      description:
        'Broker365 is a multi-tenant CRM for Indian real estate brokerages with lead management, property inventory, pipeline, commissions, WhatsApp automation, team performance, and audit logs.',
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Is Broker365 available to anyone?',
          acceptedAnswer: {
            '@type': 'Answer',
            text:
              'No. Broker365 is invite-only. Each brokerage is onboarded personally. Submit the onboarding form and our team will reach out within 24 hours.',
          },
        },
        {
          '@type': 'Question',
          name: 'What does Broker365 include?',
          acceptedAnswer: {
            '@type': 'Answer',
            text:
              'Broker365 includes lead and client management, property inventory with rich filters, site-visit tracking, commissions, a kanban pipeline, team performance analytics, WhatsApp automation, notifications, activity logs, and a superadmin console.',
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
          name: 'What does Broker365 cost?',
          acceptedAnswer: {
            '@type': 'Answer',
            text:
              'Solo is ₹999 per month, Team is ₹2,999 per month, and Enterprise is custom-priced per brokerage. All plans include unlimited leads and properties.',
          },
        },
      ],
    },
  ],
};
