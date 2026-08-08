'use client';

/**
 * Integrations → Lead Capture (Gap 1).
 *
 * Admin page to create per-source inbound webhooks. Each row exposes the public
 * URL to paste into the portal / website form / Facebook, a source badge, the
 * teammate captured leads go to, an active toggle, a live capture count, and
 * delete. Facebook rows also collect the page id + page token used to fetch
 * leads from the Graph API.
 */

import { useCallback, useEffect, useState } from 'react';
import { Webhook, Plus, Copy, Check, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { Button } from '@/components/common/Button';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { LEAD_CAPTURE_SOURCES } from '@/lib/lead-capture';
import type { LeadWebhook } from '@/lib/types';

interface Teammate { id: string; name: string }

const SELECT_CLASS =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function IntegrationsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [webhooks, setWebhooks] = useState<LeadWebhook[]>([]);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [newSource, setNewSource] = useState<string>(LEAD_CAPTURE_SOURCES[0]);
  const [newAssignee, setNewAssignee] = useState<string>('');
  const [creating, setCreating] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const assigneeOptions: Teammate[] = user
    ? [{ id: user.id, name: `${user.name} (you)` }, ...teammates]
    : teammates;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wRes, tRes] = await Promise.all([
        fetch('/api/lead-webhooks', { credentials: 'include' }),
        fetch('/api/users/teammates', { credentials: 'include' }),
      ]);
      const wJson = await wRes.json();
      if (!wRes.ok) throw new Error(wJson.error || 'Failed to load webhooks');
      setWebhooks(wJson.webhooks ?? []);
      if (tRes.ok) setTeammates((await tRes.json()).teammates ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    load();
  }, [authLoading, isAdmin, load]);

  useEffect(() => {
    if (!newAssignee && user) setNewAssignee(user.id);
  }, [user, newAssignee]);

  async function createWebhook() {
    if (!newAssignee) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/lead-webhooks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: newSource, assignTo: newAssignee }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(w: LeadWebhook) {
    await fetch(`/api/lead-webhooks/${w.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !w.active }),
    });
    load();
  }

  async function remove(w: LeadWebhook) {
    const ok = await confirm({
      title: `Delete ${w.source} webhook?`,
      message: 'The inbound URL stops working immediately. Existing leads are kept.',
      tone: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    await fetch(`/api/lead-webhooks/${w.id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }

  const teammateName = (id: string) => assigneeOptions.find((t) => t.id === id)?.name ?? '—';

  if (authLoading) return <Loader />;
  if (!isAdmin) {
    return (
      <div className="py-16 text-center text-gray-500 text-sm">
        Lead-capture integrations are managed by your admin.
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight flex items-center gap-2">
          <Webhook size={24} className="text-blue-600" /> Lead Capture
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
          Auto-capture leads from 99acres, MagicBricks, Housing, Facebook, or your website. Create an
          endpoint, then paste its URL into the portal — new leads land in your CRM, deduped and scored.
        </p>
      </div>

      {error && <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />}

      {/* Create */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 sm:items-end">
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">Source</label>
          <select value={newSource} onChange={(e) => setNewSource(e.target.value)} className={SELECT_CLASS}>
            {LEAD_CAPTURE_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">Assign new leads to</label>
          <select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} className={SELECT_CLASS}>
            {assigneeOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <Button type="button" onClick={createWebhook} disabled={creating || !newAssignee} icon={<Plus size={15} />}>
          {creating ? 'Creating…' : 'Create endpoint'}
        </Button>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12"><Loader message="Loading endpoints…" /></div>
        ) : webhooks.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">No capture endpoints yet.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {webhooks.map((w) => {
              const url = w.source === 'Facebook'
                ? `${origin}/api/webhooks/leads/facebook`
                : `${origin}/api/webhooks/leads/${w.token}`;
              return (
                <li key={w.id} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">{w.source}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${w.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {w.active ? 'Active' : 'Paused'}
                      </span>
                      <span className="text-xs text-gray-400">→ {teammateName(w.assignTo)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{w.capturedCount ?? 0} captured</span>
                      <button type="button" onClick={() => toggleActive(w)} className="text-xs font-medium text-blue-600 hover:text-blue-800">
                        {w.active ? 'Pause' : 'Resume'}
                      </button>
                      <button type="button" onClick={() => remove(w)} aria-label="Delete" className="w-7 h-7 rounded-lg border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 truncate text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700">{url}</code>
                    <button type="button" onClick={() => copy(url, w.id)} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg">
                      {copied === w.id ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                    </button>
                  </div>

                  {w.source === 'Facebook' && (
                    <p className="text-[11px] text-gray-400">
                      Use this as the Meta webhook callback URL (with your verify token in <code>FB_LEAD_VERIFY_TOKEN</code>),
                      then set this endpoint&apos;s Page ID and Page token from the API to receive leads.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
