'use client';

import Link from 'next/link';
import { Lock, ArrowUpCircle } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { FEATURE_LABELS, type FeatureKey } from '@/lib/plans';

interface FeatureLockedProps {
  feature: FeatureKey;
  /** Override the default label/description from FEATURE_LABELS. */
  title?: string;
  description?: string;
  /** Where the "Contact admin" CTA points. Defaults to settings. */
  contactHref?: string;
}

/**
 * Empty-state shown to admin/user when they hit a page or click an action
 * gated behind a plan they don't have. The actual entitlement check should
 * already have happened server-side; this is the UI consequence.
 */
export function FeatureLocked({
  feature,
  title,
  description,
  contactHref = '/dashboard/settings',
}: FeatureLockedProps) {
  const meta = FEATURE_LABELS[feature];
  const heading = title ?? meta?.label ?? 'Feature not available';
  const body =
    description ??
    meta?.description ??
    'This feature is not included in your current subscription plan.';

  return (
    <div className="flex items-center justify-center py-12 px-4">
      <Card className="max-w-lg w-full text-center p-8">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <Lock className="w-7 h-7 text-amber-600" aria-hidden />
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {heading} requires an upgrade
        </h2>
        <p className="text-sm text-gray-600 mb-6">{body}</p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link href={contactHref}>
            <Button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
              <ArrowUpCircle className="w-4 h-4" aria-hidden />
              Contact admin to upgrade
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium">
              Back to dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
