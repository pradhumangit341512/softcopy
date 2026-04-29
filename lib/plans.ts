/**
 * Plan & feature catalogue — the single source of truth for what each
 * subscription tier unlocks. Update this file to re-tier a feature; no DB
 * migration is needed because plan-default features re-resolve at runtime
 * via lib/entitlements.ts hasFeature().
 *
 * Per-company overrides live on Company.featureFlags and can grant features
 * beyond the plan default OR explicitly revoke a plan-default feature
 * (e.g. for a refund/dispute).
 */

export const PLANS = ['basic', 'standard', 'pro', 'enterprise'] as const;
export type Plan = (typeof PLANS)[number];

/** All known feature keys. Add new keys here as features ship. */
export const FEATURE_KEYS = [
  // ── Basic ──
  'feature.daily_plan',
  'feature.lead_transfer',
  'feature.dead_leads_tab',
  'feature.lead_type_tabs',
  'feature.inventory_tabs',
  'feature.extended_lead_statuses',
  'feature.extended_property_statuses',
  'feature.source_presets',

  // ── Standard ──
  'feature.inventory_wizard',
  'feature.inventory_project_fields',
  'feature.inventory_deal_fields',
  'feature.multi_phone',
  'feature.bulk_inventory',
  'feature.export_leads',

  // ── Pro ──
  'feature.bulk_broker_reqs',
  'feature.bulk_projects',
  'feature.projects_working',
  'feature.broker_reqs',
  'feature.opportunity_matcher',
  'feature.project_wizard',
  'feature.export_broker_reqs',
  'feature.learn_grow',
  'feature.reference_db',

  // ── Enterprise ──
  'feature.granular_permissions',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Human-readable labels for the superadmin UI + upgrade prompts. */
export const FEATURE_LABELS: Record<FeatureKey, { label: string; description: string }> = {
  'feature.daily_plan':                  { label: 'Daily Plan',                       description: 'Morning commitment + evening achievements journal per user' },
  'feature.lead_transfer':               { label: 'Lead Transfer',                    description: 'Transfer leads between teammates' },
  'feature.dead_leads_tab':              { label: 'Dead Leads Tab',                   description: 'Dedicated tab filtering archived/dead leads' },
  'feature.lead_type_tabs':              { label: 'Buyer / Rental Tabs',              description: '"All Buyers" vs "Rental Business" tab split on leads list' },
  'feature.inventory_tabs':              { label: 'Inventory Sales / Rent Tabs',      description: 'Sales vs Rent tab split inside inventory' },
  'feature.extended_lead_statuses':      { label: 'Extended Lead Statuses',           description: 'Hot / NotConnected / Serious / Potential / LongTerm / DeadLead / Completed' },
  'feature.extended_property_statuses':  { label: 'Extended Property Statuses',       description: 'Vacant / Self-Occupied / Rental / For-Sale taxonomy' },
  'feature.source_presets':              { label: 'Source Preset Dropdown',           description: '99acres / Magicbricks / Housing.com / Meta Ads / WhatsApp / Facebook / Google / Website / Direct / Referral' },

  'feature.inventory_wizard':            { label: 'Inventory 3-Step Wizard',          description: 'Seller → Property → Source/Assignment guided flow' },
  'feature.inventory_project_fields':    { label: 'Project / Sector / Unit Fields',   description: 'Structured property identification (project, sector, unit, tower, typology)' },
  'feature.inventory_deal_fields':       { label: 'Demand / Payment / Loan Fields',   description: 'Registry vs Transfer case toggle, loan status, payment status, owner demand' },
  'feature.multi_phone':                 { label: 'Multiple Mobile Numbers',          description: 'Repeating mobile-number input per owner' },
  'feature.bulk_inventory':              { label: 'Bulk Inventory Upload',            description: 'Excel/CSV import + sample template for properties' },
  'feature.export_leads':                { label: 'Export Leads to Excel',            description: 'One-click Excel export of the leads list' },

  'feature.bulk_broker_reqs':            { label: 'Bulk Broker Requirements Upload',  description: 'Excel/CSV import for broker requirements' },
  'feature.bulk_projects':               { label: 'Bulk Projects Upload',             description: 'Excel/CSV import for whole projects + units' },
  'feature.projects_working':            { label: 'Projects Working Module',          description: 'Project → Tower → Floor → Unit hierarchy (Commercial/Residential × Ready/Under-Construction)' },
  'feature.broker_reqs':                 { label: 'Brokers Requirements Module',      description: 'Tracker for incoming broker-side requirements' },
  'feature.opportunity_matcher':         { label: 'Find Opportunity (Matcher)',       description: 'Auto-match buyers (leads) ↔ sellers (inventory) by BHK / sector / budget' },
  'feature.project_wizard':              { label: 'Add New Project Wizard',           description: '2-step Project + Units wizard' },
  'feature.export_broker_reqs':          { label: 'Export Broker Requirements',       description: 'Excel export for broker requirements list' },
  'feature.learn_grow':                  { label: 'Learn & Grow',                     description: 'Folder + file resource library — paste links to PDFs, videos, decks (URL-based for now)' },
  'feature.reference_db':                { label: 'Reference Database',               description: 'Curated public-project catalogue with brochure links — share externally' },

  'feature.granular_permissions':        { label: 'Per-Member Permissions',           description: 'Per-user permission toggles beyond fixed role tiers' },
};

/** Plan → feature-key list. Higher tiers extend lower tiers. */
const BASIC_FEATURES: FeatureKey[] = [
  'feature.daily_plan',
  'feature.lead_transfer',
  'feature.dead_leads_tab',
  'feature.lead_type_tabs',
  'feature.inventory_tabs',
  'feature.extended_lead_statuses',
  'feature.extended_property_statuses',
  'feature.source_presets',
];

const STANDARD_FEATURES: FeatureKey[] = [
  ...BASIC_FEATURES,
  'feature.inventory_wizard',
  'feature.inventory_project_fields',
  'feature.inventory_deal_fields',
  'feature.multi_phone',
  'feature.bulk_inventory',
  'feature.export_leads',
];

const PRO_FEATURES: FeatureKey[] = [
  ...STANDARD_FEATURES,
  'feature.bulk_broker_reqs',
  'feature.bulk_projects',
  'feature.projects_working',
  'feature.broker_reqs',
  'feature.opportunity_matcher',
  'feature.project_wizard',
  'feature.export_broker_reqs',
  'feature.learn_grow',
  'feature.reference_db',
];

const ENTERPRISE_FEATURES: FeatureKey[] = [
  ...PRO_FEATURES,
  'feature.granular_permissions',
];

export const PLAN_FEATURES: Record<Plan, ReadonlyArray<FeatureKey>> = {
  basic: BASIC_FEATURES,
  standard: STANDARD_FEATURES,
  pro: PRO_FEATURES,
  enterprise: ENTERPRISE_FEATURES,
};

/** Marketing-friendly metadata shown on plan-picker UIs. */
export const PLAN_METADATA: Record<Plan, { label: string; tagline: string; pricePerUserMonth: number }> = {
  basic:      { label: 'Basic',      tagline: 'Solo broker / 1–3 users',         pricePerUserMonth: 999  },
  standard:   { label: 'Standard',   tagline: 'Active brokerage / 4–15 users',   pricePerUserMonth: 1499 },
  pro:        { label: 'Pro',        tagline: 'Established / 15–50 users',       pricePerUserMonth: 3499 },
  enterprise: { label: 'Enterprise', tagline: 'Large team / 50+ users',          pricePerUserMonth: 7999 },
};

export function isValidPlan(value: unknown): value is Plan {
  return typeof value === 'string' && (PLANS as ReadonlyArray<string>).includes(value);
}

export function isValidFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === 'string' && (FEATURE_KEYS as ReadonlyArray<string>).includes(value);
}

/** Features included in the plan by default (ignoring per-company overrides). */
export function planDefaultFeatures(plan: Plan): ReadonlyArray<FeatureKey> {
  return PLAN_FEATURES[plan];
}
