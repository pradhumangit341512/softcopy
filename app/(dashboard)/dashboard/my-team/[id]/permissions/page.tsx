'use client';

/**
 * Per-Member Permissions — F24
 *
 * Admin-only page for editing one teammate's permission overrides.
 * Three-state per row: Role default / Grant / Revoke. Grouped by domain
 * (Clients, Inventory, Projects, …) so admins scan top-down by area.
 *
 * Server enforces gate; client also gates and renders FeatureLocked
 * when the company doesn't have the feature.
 */

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCcw, Save, ShieldCheck, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { Button } from '@/components/common/Button';
import { FeatureLocked } from '@/components/common/FeatureLocked';
import type { PermissionKey } from '@/lib/permissions';

interface ApiResponse {
  user: { id: string; name: string; email: string; role: string };
  catalogue: PermissionKey[];
  groups: Record<string, PermissionKey[]>;
  baseline: PermissionKey[];
  overrides: Record<string, boolean>;
}

const PRETTY: Record<string, string> = {
  // Lightweight humanised labels — falls back to the key itself.
  'clients.read.all':       'See all teammates\' leads',
  'clients.create':         'Create leads',
  'clients.update.all':     'Edit any lead',
  'clients.delete':         'Delete leads',
  'clients.export':         'Export leads',
  'clients.bulk_import':    'Bulk import leads',
  'properties.read.all':    'See all teammates\' inventory',
  'properties.create':      'Create inventory',
  'properties.update.all':  'Edit any inventory',
  'properties.delete':      'Delete inventory',
  'properties.export':      'Export inventory',
  'properties.bulk_import': 'Bulk import inventory',
  'projects.read.all':      'See all projects',
  'projects.create':        'Create projects',
  'projects.update.all':    'Edit any project',
  'projects.delete':        'Delete projects',
  'broker_reqs.read.all':   'See all broker requirements',
  'broker_reqs.create':     'Create broker requirements',
  'broker_reqs.update.all': 'Edit any broker requirement',
  'broker_reqs.delete':     'Delete broker requirements',
  'commissions.read.all':   'See all commissions',
  'commissions.create':     'Create commissions',
  'commissions.update.all': 'Edit any commission',
  'commissions.delete':     'Delete commissions',
  'team.read':              'View team',
  'team.invite':            'Invite teammates',
  'team.update':            'Update teammates',
  'analytics.read':         'View analytics',
  'settings.update':        'Change company settings',
};

export default function MemberPermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, isLoading: authLoading } = useAuth();
  const enabled = useFeature('feature.granular_permissions');

  const [data, setData] = useState<ApiResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  function load() {
    setError(null);
    fetch(`/api/users/${id}/permissions`, { credentials: 'include' })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed to load');
        return j as ApiResponse;
      })
      .then((j) => {
        setData(j);
        setDraft({ ...j.overrides });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }

  useEffect(() => {
    if (authLoading || !enabled || !isAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, authLoading, enabled, isAdmin]);

  async function save() {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}/permissions`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: draft }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Save failed');
      setSavedAt(Date.now());
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (!data) return;
    setDraft({ ...data.overrides });
  }

  function setOverride(key: PermissionKey, value: boolean | null) {
    setDraft((prev) => {
      const next = { ...prev };
      if (value === null) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  if (authLoading) return <Loader />;
  if (!enabled) return <FeatureLocked feature="feature.granular_permissions" />;
  if (!isAdmin) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        Admin access required.
      </div>
    );
  }
  if (error && !data) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!data) return <Loader />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.overrides);

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5 max-w-4xl">
      <Link
        href="/dashboard/my-team"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} /> Back to team
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
            Permissions — {data.user.name}
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            {data.user.email} · <span className="capitalize">{data.user.role}</span>
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {savedAt && !dirty && (
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1">
              Saved
            </span>
          )}
          <Button type="button" variant="outline" onClick={reset} disabled={!dirty || saving} icon={<RotateCcw size={14} />}>
            Reset
          </Button>
          <Button type="button" onClick={save} disabled={!dirty || saving} icon={<Save size={14} />}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      <p className="text-xs text-gray-500">
        Each row defaults to the role baseline. <strong>Grant</strong> adds a capability;
        <strong className="ml-1">Revoke</strong> takes one away. Use sparingly — most teams
        only need 2–3 overrides per senior teammate.
      </p>

      <div className="space-y-4">
        {Object.entries(data.groups).map(([groupName, keys]) => (
          <section key={groupName} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">{groupName}</h2>
            </header>
            <ul className="divide-y divide-gray-100">
              {keys.map((key) => {
                const baseAllowed = data.baseline.includes(key);
                const override = draft[key] ?? null;
                return (
                  <li key={key} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {PRETTY[key] ?? key}
                      </p>
                      <p className="text-[11px] uppercase tracking-wide text-gray-400 mt-0.5 flex items-center gap-1">
                        {baseAllowed ? (
                          <>
                            <ShieldCheck size={11} className="text-emerald-500" /> Role baseline: ON
                          </>
                        ) : (
                          <>
                            <Lock size={11} className="text-gray-400" /> Role baseline: OFF
                          </>
                        )}
                      </p>
                    </div>
                    <OverrideToggle
                      baseAllowed={baseAllowed}
                      override={override}
                      onChange={(v) => setOverride(key, v)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function OverrideToggle({
  baseAllowed,
  override,
  onChange,
}: {
  baseAllowed: boolean;
  override: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  const value: 'role' | 'grant' | 'revoke' =
    override === true ? 'grant' : override === false ? 'revoke' : 'role';
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-gray-200 overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={
          value === 'role'
            ? 'px-2.5 py-1.5 bg-gray-900 text-white'
            : 'px-2.5 py-1.5 bg-white text-gray-600 hover:bg-gray-50'
        }
      >
        Role: {baseAllowed ? 'ON' : 'OFF'}
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={
          value === 'grant'
            ? 'px-2.5 py-1.5 border-l border-gray-200 bg-emerald-600 text-white'
            : 'px-2.5 py-1.5 border-l border-gray-200 bg-white text-emerald-700 hover:bg-emerald-50'
        }
      >
        Grant
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={
          value === 'revoke'
            ? 'px-2.5 py-1.5 border-l border-gray-200 bg-red-600 text-white'
            : 'px-2.5 py-1.5 border-l border-gray-200 bg-white text-red-700 hover:bg-red-50'
        }
      >
        Revoke
      </button>
    </div>
  );
}
