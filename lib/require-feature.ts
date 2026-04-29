/**
 * Server-side feature gate. Use inside an API route to short-circuit when
 * the caller's company doesn't have the requested feature. Pairs with
 * verifyAuth() for identity and lib/entitlements.ts hasFeature() for the
 * resolution logic.
 */

import { NextResponse } from 'next/server';
import { db } from './db';
import { hasFeature } from './entitlements';
import type { FeatureKey } from './plans';

export interface FeatureCheckOk {
  ok: true;
  company: {
    id: string;
    plan: string;
    status: string;
    subscriptionUntil: Date | null;
    featureFlags: unknown;
  };
}

export interface FeatureCheckBlocked {
  ok: false;
  response: NextResponse;
}

export type FeatureCheck = FeatureCheckOk | FeatureCheckBlocked;

/**
 * Look up the company by id and confirm it has the feature enabled.
 *
 * Cache strategy: callers usually already loaded the auth payload, but the
 * payload doesn't carry plan/featureFlags (and shouldn't — it would go
 * stale the moment the superadmin flips a flag). One small DB read per
 * gated request is the right tradeoff.
 */
export async function requireFeature(
  companyId: string,
  feature: FeatureKey
): Promise<FeatureCheck> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      plan: true,
      status: true,
      subscriptionUntil: true,
      featureFlags: true,
    },
  });

  if (!company) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Company not found' }, { status: 404 }),
    };
  }

  if (!hasFeature(company, feature)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Feature not available on your plan',
          feature,
          upgradeRequired: true,
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, company };
}
