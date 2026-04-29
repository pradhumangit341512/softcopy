/**
 * /api/superadmin/companies/[id]/features
 *
 * GET   → company plan + per-feature override map + resolved feature list
 * PATCH → set plan and/or featureFlags overrides
 *
 * The resolved feature list returned here is purely advisory for the UI;
 * actual gating still goes through lib/entitlements.ts hasFeature() at
 * request time so a flag flip takes effect on the next request without
 * any cache invalidation dance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidObjectId } from '@/lib/auth';
import { requireSuperAdmin } from '@/lib/superadmin';
import { updateCompanyFeatureFlagsSchema, parseBody } from '@/lib/validations';
import { recordAudit } from '@/lib/audit';
import { effectiveFeatures, asFlagMap } from '@/lib/entitlements';
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  PLAN_FEATURES,
  PLAN_METADATA,
  PLANS,
  isValidFeatureKey,
  isValidPlan,
} from '@/lib/plans';

export const runtime = 'nodejs';

// ==================== GET ====================

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid company id' }, { status: 400 });
  }

  const company = await db.company.findUnique({
    where: { id },
    select: {
      id: true,
      companyName: true,
      plan: true,
      status: true,
      subscriptionUntil: true,
      featureFlags: true,
    },
  });

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const resolvedPlan = isValidPlan(company.plan) ? company.plan : 'standard';
  const planDefaults = PLAN_FEATURES[resolvedPlan];
  const overrides = asFlagMap(company.featureFlags);
  const resolved = effectiveFeatures(company);

  return NextResponse.json({
    company: {
      id: company.id,
      companyName: company.companyName,
      plan: resolvedPlan,
      status: company.status,
      subscriptionUntil: company.subscriptionUntil,
    },
    plans: PLANS.map((p) => ({
      id: p,
      ...PLAN_METADATA[p],
      features: PLAN_FEATURES[p],
    })),
    catalogue: FEATURE_KEYS.map((key) => ({
      key,
      ...FEATURE_LABELS[key],
      includedInPlan: planDefaults.includes(key),
      override:
        Object.prototype.hasOwnProperty.call(overrides, key)
          ? overrides[key]
          : null,
      enabled: resolved.includes(key),
    })),
    overrides,
    resolved,
  });
}

// ==================== PATCH ====================

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid company id' }, { status: 400 });
  }

  const parsed = await parseBody(req, updateCompanyFeatureFlagsSchema);
  if (!parsed.ok) return parsed.response;

  // Sanitize featureFlags: drop any keys we don't know about so a typo
  // doesn't quietly create dead entries the UI can never show.
  const cleanedFlags: Record<string, boolean> | undefined = parsed.data.featureFlags
    ? Object.fromEntries(
        Object.entries(parsed.data.featureFlags).filter(([k]) =>
          isValidFeatureKey(k)
        )
      )
    : undefined;

  const data: Record<string, unknown> = {};
  if (parsed.data.plan) data.plan = parsed.data.plan;
  if (cleanedFlags !== undefined) data.featureFlags = cleanedFlags;

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: 'No changes' },
      { status: 400 }
    );
  }

  const updated = await db.company.update({
    where: { id },
    data,
    select: {
      id: true,
      plan: true,
      status: true,
      subscriptionUntil: true,
      featureFlags: true,
    },
  });

  await recordAudit({
    companyId: id,
    userId: auth.payload.userId,
    action: 'superadmin.company.features.update',
    resource: 'Company',
    resourceId: id,
    metadata: {
      plan: parsed.data.plan ?? null,
      featureFlags: cleanedFlags ?? null,
    },
    req,
  });

  return NextResponse.json({
    success: true,
    plan: updated.plan,
    featureFlags: updated.featureFlags,
    resolved: effectiveFeatures(updated),
  });
}
