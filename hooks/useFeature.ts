'use client';

import { useAuthStore } from '@/store/authStore';
import type { FeatureKey } from '@/lib/plans';

/**
 * Returns true if the caller's company has the feature unlocked. Reads from
 * the pre-resolved `features` array on the auth user — populated by
 * /api/auth/me using lib/entitlements.ts effectiveFeatures().
 *
 * Use this for UI gating (hide buttons, hide nav, conditional fields).
 * Server-side gating still goes through requireFeature() in API routes —
 * never trust the client to enforce entitlements.
 */
export function useFeature(key: FeatureKey): boolean {
  const user = useAuthStore((s) => s.user);
  return Array.isArray(user?.features) && user.features.includes(key);
}

/** Returns the full feature set — useful for rendering a list of unlocks. */
export function useFeatureSet(): ReadonlyArray<string> {
  const user = useAuthStore((s) => s.user);
  return user?.features ?? [];
}
