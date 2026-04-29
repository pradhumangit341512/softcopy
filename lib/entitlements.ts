/**
 * Entitlement resolver — decides whether a company can use a given feature
 * RIGHT NOW. Use this everywhere a feature is gated: API routes, page guards,
 * sidebar filters, and conditional UI.
 *
 * Resolution order (lowest layer wins):
 *   1. Subscription window — if Company.subscriptionUntil is past or status
 *      != 'active', deny everything.
 *   2. Per-company override — Company.featureFlags[key] === true grants;
 *      Company.featureFlags[key] === false revokes (override beats plan).
 *   3. Plan default — feature included in PLAN_FEATURES[company.plan].
 *   4. Otherwise deny.
 */

import {
  PLAN_FEATURES,
  type FeatureKey,
  type Plan,
  isValidPlan,
  isValidFeatureKey,
  FEATURE_KEYS,
} from './plans';

export interface CompanyEntitlementInput {
  plan: string;
  status: string;
  subscriptionUntil: Date | null;
  featureFlags: unknown;
}

/** Type guard around the JSON shape stored on Company.featureFlags. */
export function asFlagMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/** True if the company's billing window is still open. */
export function isSubscriptionActive(company: Pick<CompanyEntitlementInput, 'status' | 'subscriptionUntil'>): boolean {
  if (company.status !== 'active') return false;
  if (!company.subscriptionUntil) return true; // legacy companies without explicit cutoff stay active
  return company.subscriptionUntil.getTime() > Date.now();
}

/**
 * Decide if a feature is enabled for this company.
 *
 * Pass a Company-shaped object — the field set above (plan, status,
 * subscriptionUntil, featureFlags) is enough. Passing the whole row is fine.
 */
export function hasFeature(
  company: CompanyEntitlementInput,
  key: FeatureKey
): boolean {
  if (!isSubscriptionActive(company)) return false;

  const overrides = asFlagMap(company.featureFlags);
  if (Object.prototype.hasOwnProperty.call(overrides, key)) {
    return overrides[key] === true;
  }

  const plan: Plan = isValidPlan(company.plan) ? company.plan : 'standard';
  return PLAN_FEATURES[plan].includes(key);
}

/** Compute the full allowed feature set for a company — useful for client-side hydration. */
export function effectiveFeatures(company: CompanyEntitlementInput): FeatureKey[] {
  if (!isSubscriptionActive(company)) return [];

  const plan: Plan = isValidPlan(company.plan) ? company.plan : 'standard';
  const planFeatures = new Set<FeatureKey>(PLAN_FEATURES[plan]);
  const overrides = asFlagMap(company.featureFlags);

  for (const [key, enabled] of Object.entries(overrides)) {
    if (!isValidFeatureKey(key)) continue;
    if (enabled) planFeatures.add(key);
    else planFeatures.delete(key);
  }

  return FEATURE_KEYS.filter((k) => planFeatures.has(k));
}
