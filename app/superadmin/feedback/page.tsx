'use client';

/**
 * Superadmin → Feedback Moderation
 *
 * Lists incoming landing-page feedback grouped by status. Approve /
 * Reject / Delete each row. Approved rows surface as testimonials on
 * the landing page within seconds (no caching beyond the GET response).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, X, Trash2, Star, RefreshCw } from 'lucide-react';

interface FeedbackRow {
  id: string;
  name: string;
  role: string | null;
  rating: number;
  message: string;
  email: string | null;
  source: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt: string | null;
  ipAddress: string | null;
  createdAt: string;
}

type Tab = 'pending' | 'approved' | 'rejected' | 'all';

export default function FeedbackModerationPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/feedback?status=${tab}`, { credentials: 'include' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to load feedback');
      setItems(j.items ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function moderate(id: string, status: 'approved' | 'rejected' | 'pending') {
    const res = await fetch(`/api/superadmin/feedback/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Update failed');
      return;
    }
    load();
  }

  async function hardDelete(id: string) {
    if (!confirm('Delete this feedback row permanently? This cannot be undone.')) return;
    const res = await fetch(`/api/superadmin/feedback/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Delete failed');
      return;
    }
    load();
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <Link href="/superadmin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Back to superadmin
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Landing-page feedback</h1>
          <p className="text-sm text-gray-500">Review submissions, approve to publish on the landing page.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tab strip */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['pending', 'approved', 'rejected', 'all'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? 'px-4 py-2 text-sm font-semibold text-blue-600 border-b-2 border-blue-600 -mb-px'
                : 'px-4 py-2 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-800 hover:border-gray-300 -mb-px capitalize'
            }
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          No {tab === 'all' ? '' : tab} feedback to show.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li key={row.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{row.name}</p>
                    <span className={
                      row.status === 'approved'
                        ? 'inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize'
                        : row.status === 'rejected'
                        ? 'inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-50 text-red-700 border border-red-200 capitalize'
                        : 'inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 capitalize'
                    }>
                      {row.status}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                      {Array.from({ length: row.rating }).map((_, i) => (
                        <Star key={i} size={12} className="fill-amber-400 stroke-amber-400" />
                      ))}
                    </span>
                  </div>
                  {row.role && <p className="text-xs text-gray-500 mt-0.5">{row.role}</p>}
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">{row.message}</p>
                  <p className="text-[11px] text-gray-400 mt-2">
                    {new Date(row.createdAt).toLocaleString()}
                    {row.email && <> · {row.email}</>}
                    {row.source && <> · via {row.source}</>}
                    {row.ipAddress && <> · {row.ipAddress}</>}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {row.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => moderate(row.id, 'approved')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                    >
                      <Check size={12} /> Approve
                    </button>
                  )}
                  {row.status !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() => moderate(row.id, 'rejected')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg"
                    >
                      <X size={12} /> Reject
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => hardDelete(row.id)}
                    title="Delete permanently"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
