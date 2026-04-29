'use client';

/**
 * Superadmin → Company → Features
 *
 * Lets the superadmin assign a plan to a company and toggle individual
 * feature overrides on top of the plan. Resolution preview (right column)
 * shows exactly what the company's users will see after Save.
 *
 * Override semantics:
 *   null  → use plan default
 *   true  → grant feature (even if plan doesn't include it)
 *   false → revoke feature (even though plan does include it)
 *
 * Persists via PATCH /api/superadmin/companies/[id]/features.
 */

import { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, RotateCcw, ShieldCheck, Lock } from 'lucide-react';

type PlanId = 'basic' | 'standard' | 'pro' | 'enterprise';

interface PlanOption {
  id: PlanId;
  label: string;
  tagline: string;
  pricePerUserMonth: number;
  features: string[];
}

interface FeatureRow {
  key: string;
  label: string;
  description: string;
  includedInPlan: boolean;
  override: boolean | null;
  enabled: boolean;
}

interface FeaturesResponse {
  company: { id: string; companyName: string; plan: PlanId; status: string; subscriptionUntil: string | null };
  plans: PlanOption[];
  catalogue: FeatureRow[];
  overrides: Record<string, boolean>;
  resolved: string[];
}

const PLAN_BORDER: Record<PlanId, string> = {
  basic: 'border-emerald-300 bg-emerald-50',
  standard: 'border-sky-300 bg-sky-50',
  pro: 'border-violet-300 bg-violet-50',
  enterprise: 'border-amber-300 bg-amber-50',
};

const TIER_LABEL: Record<PlanId, string> = {
  basic: 'Basic',
  standard: 'Standard',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export default function CompanyFeaturesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [data, setData] = useState<FeaturesResponse | null>(null);
  const [draftPlan, setDraftPlan] = useState<PlanId>('standard');
  const [draftFlags, setDraftFlags] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function load() {
    setError(null);
    fetch(`/api/superadmin/companies/${id}/features`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j: FeaturesResponse | { error: string }) => {
        if ('error' in j) throw new Error(j.error);
        setData(j);
        setDraftPlan(j.company.plan);
        setDraftFlags({ ...j.overrides });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const planFor = useMemo(
    () => Object.fromEntries((data?.plans ?? []).map((p) => [p.id, p])) as Record<PlanId, PlanOption>,
    [data?.plans]
  );

  // Compute the resolved feature set on the client so the preview reacts
  // immediately as the superadmin toggles. Mirrors lib/entitlements.ts
  // logic except we assume subscription is active (matches what the user
  // will see at billing-active state, which is the only state that matters here).
  const previewResolved = useMemo<Set<string>>(() => {
    if (!data) return new Set();
    const planFeatures = planFor[draftPlan]?.features ?? [];
    const out = new Set<string>(planFeatures);
    for (const [k, v] of Object.entries(draftFlags)) {
      if (v) out.add(k);
      else out.delete(k);
    }
    return out;
  }, [data, draftPlan, draftFlags, planFor]);

  function setOverride(key: string, value: boolean | null) {
    setDraftFlags((prev) => {
      const next = { ...prev };
      if (value === null) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/companies/${id}/features`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: draftPlan,
          featureFlags: draftFlags,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Save failed');
      setSavedAt(Date.now());
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (!data) return;
    setDraftPlan(data.company.plan);
    setDraftFlags({ ...data.overrides });
  }

  // ── Render ──
  if (error && !data) {
    return <div className="p-6 text-red-600">Error: {error}</div>;
  }
  if (!data) {
    return <div className="p-6 text-gray-500">Loading…</div>;
  }

  // Group catalogue by the lowest plan tier that includes each feature.
  // We compute this from PLAN options provided by the API so the UI never
  // needs to know plan-tier mapping.
  const tierOf = (key: string): PlanId => {
    if (planFor.basic?.features.includes(key)) return 'basic';
    if (planFor.standard?.features.includes(key)) return 'standard';
    if (planFor.pro?.features.includes(key)) return 'pro';
    return 'enterprise';
  };

  const groups: Record<PlanId, FeatureRow[]> = {
    basic: [],
    standard: [],
    pro: [],
    enterprise: [],
  };
  for (const row of data.catalogue) {
    groups[tierOf(row.key)].push(row);
  }

  const dirty =
    draftPlan !== data.company.plan ||
    JSON.stringify(draftFlags) !== JSON.stringify(data.overrides);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/superadmin/companies/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={14} /> Back to company
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Features &amp; Plan</h1>
          <p className="text-sm text-gray-500">
            {data.company.companyName} ·{' '}
            <span className="capitalize">{data.company.plan}</span> plan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {savedAt && !dirty && (
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1">
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={reset}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border
              border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold
              bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Plan picker */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Subscription plan
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.plans.map((p) => {
            const selected = p.id === draftPlan;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setDraftPlan(p.id)}
                className={`text-left p-4 rounded-xl border-2 transition-colors ${
                  selected
                    ? `${PLAN_BORDER[p.id]} ring-2 ring-offset-1 ring-blue-500`
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{p.label}</span>
                  {selected && (
                    <ShieldCheck className="w-4 h-4 text-blue-600" aria-hidden />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{p.tagline}</p>
                <p className="text-sm text-gray-700 mt-2">
                  ₹{p.pricePerUserMonth.toLocaleString('en-IN')}
                  <span className="text-xs text-gray-500"> / user / month</span>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {p.features.length} features included
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Feature matrix */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {(['basic', 'standard', 'pro', 'enterprise'] as PlanId[]).map((tier) => {
            const rows = groups[tier];
            if (rows.length === 0) return null;
            return (
              <div key={tier} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className={`px-4 py-3 border-b ${PLAN_BORDER[tier]} border-b-gray-200`}>
                  <h3 className="font-semibold text-gray-900">{TIER_LABEL[tier]} tier features</h3>
                  <p className="text-xs text-gray-600">
                    Default-included from the {TIER_LABEL[tier]} plan up
                  </p>
                </div>
                <ul className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <li key={row.key} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{row.label}</p>
                        <p className="text-xs text-gray-500">{row.description}</p>
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-1">
                          {row.key}
                        </p>
                      </div>
                      <OverrideToggle
                        included={planFor[draftPlan]?.features.includes(row.key) ?? false}
                        override={draftFlags[row.key] ?? null}
                        onChange={(v) => setOverride(row.key, v)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Resolution preview */}
        <aside className="lg:sticky lg:top-4 self-start">
          <div className="bg-white border border-gray-200 rounded-xl">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Effective access</h3>
              <p className="text-xs text-gray-500">What this company will see after save</p>
            </div>
            <ul className="px-2 py-2 max-h-[60vh] overflow-y-auto">
              {data.catalogue.map((row) => {
                const enabled = previewResolved.has(row.key);
                return (
                  <li
                    key={row.key}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                      enabled ? 'text-emerald-700' : 'text-gray-400'
                    }`}
                  >
                    {enabled ? (
                      <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                    ) : (
                      <Lock className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                    )}
                    <span className="truncate">{row.label}</span>
                  </li>
                );
              })}
            </ul>
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
              <span>Total enabled</span>
              <span className="font-medium text-gray-700">
                {previewResolved.size} / {data.catalogue.length}
              </span>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function OverrideToggle({
  included,
  override,
  onChange,
}: {
  included: boolean;
  override: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  const value: 'plan' | 'grant' | 'revoke' =
    override === true ? 'grant' : override === false ? 'revoke' : 'plan';

  const planLabel = included ? 'Plan: ON' : 'Plan: OFF';

  return (
    <div className="inline-flex shrink-0 rounded-lg border border-gray-200 overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`px-2.5 py-1.5 ${
          value === 'plan'
            ? 'bg-gray-900 text-white'
            : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        {planLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-2.5 py-1.5 border-l border-gray-200 ${
          value === 'grant'
            ? 'bg-emerald-600 text-white'
            : 'bg-white text-emerald-700 hover:bg-emerald-50'
        }`}
      >
        Grant
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-2.5 py-1.5 border-l border-gray-200 ${
          value === 'revoke'
            ? 'bg-red-600 text-white'
            : 'bg-white text-red-700 hover:bg-red-50'
        }`}
      >
        Revoke
      </button>
    </div>
  );
}
