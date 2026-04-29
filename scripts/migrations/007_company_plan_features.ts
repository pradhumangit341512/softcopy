/**
 * Migration 007 — initialize plan + featureFlags on every Company row.
 *
 * Why this is needed
 * ──────────────────
 * Phase 0 of the entitlement system rollout. Two new fields drive feature
 * gating going forward:
 *
 *   Company.plan            – string in ['basic','standard','pro','enterprise'].
 *                              Drives the default feature set via
 *                              lib/plans.ts PLAN_FEATURES.
 *   Company.featureFlags    – Json map of per-company overrides. `true`
 *                              grants beyond plan, `false` revokes despite
 *                              plan. Read by lib/entitlements.ts hasFeature().
 *
 * The schema already had a free-text `plan` field defaulting to "standard",
 * but real rows in production may carry legacy values like "Premium" or
 * empty strings. We coerce anything we don't recognise to "standard" so the
 * resolver never has to defensively re-validate.
 *
 * Idempotent: only writes rows that need a coercion or are missing
 * featureFlags. Safe to re-run.
 */

import { db } from '../../lib/db';
import type { Migration } from './_runner';

const VALID_PLANS = new Set(['basic', 'standard', 'pro', 'enterprise']);

export const migration: Migration = {
  name: '007_company_plan_features',

  async up() {
    const companies = await db.company.findMany({
      select: { id: true, plan: true, featureFlags: true },
    });

    let coercedPlans = 0;
    let initFlags = 0;

    for (const c of companies) {
      const data: Record<string, unknown> = {};

      const normalized = (c.plan ?? '').toLowerCase().trim();
      if (!VALID_PLANS.has(normalized)) {
        data.plan = 'standard';
        coercedPlans += 1;
      } else if (normalized !== c.plan) {
        // Same intent, just normalize casing/whitespace.
        data.plan = normalized;
        coercedPlans += 1;
      }

      if (c.featureFlags === null || c.featureFlags === undefined) {
        data.featureFlags = {};
        initFlags += 1;
      }

      if (Object.keys(data).length > 0) {
        await db.company.update({ where: { id: c.id }, data });
      }
    }

    return {
      companiesScanned: companies.length,
      plansCoerced: coercedPlans,
      featureFlagsInitialized: initFlags,
    };
  },
};
