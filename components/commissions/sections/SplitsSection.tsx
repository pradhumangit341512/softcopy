'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ChevronDown, ChevronUp, Users, Plus, X, Trash2,
  Loader2, Check, Pencil, AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/components/common/Toast';

const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'cash',          label: 'Cash' },
  { value: 'upi',           label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'other',         label: 'Other' },
];

const STATUS_PILL: Record<string, string> = {
  Paid:    'bg-emerald-50 text-emerald-700',
  Partial: 'bg-orange-50 text-orange-700',
  Pending: 'bg-amber-50 text-amber-700',
};

interface Split {
  id: string;
  participantUserId: string | null;
  participantName: string;
  sharePercent: number;
  shareAmount: number;
  paidOut: number;
  status: string;
  participant?: { id: string; name: string } | null;
}

interface Payout {
  id: string;
  amount: number;
  paidOn: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  recorder?: { id: string; name: string } | null;
}

interface CompanyUser {
  id: string;
  name: string;
}

interface SplitsSectionProps {
  commissionId: string;
  commissionAmount: number;
  isAdmin: boolean;
  collapsed: boolean;
  onToggle: () => void;
  /** Notified on every mutation so the parent list refreshes its totals. */
  onChanged: () => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Section [4] of the merged Manage-Deal modal — sub-broker / co-broker
 * payout splits.
 *
 * Two layers:
 *   1. SPLITS — who gets what slice. Inline-editable share% (admin only).
 *      Add / remove participants. Soft warning if shares don't sum to 100%.
 *   2. PAYOUTS — per-split ledger. Anyone with deal-read access can record
 *      a payout (so an admin can hand off "I paid Broker A today" to a team
 *      member). Deleting a payout is admin-only.
 */
export function SplitsSection({
  commissionId,
  commissionAmount,
  isAdmin,
  collapsed,
  onToggle,
  onChanged,
}: SplitsSectionProps) {
  const { addToast } = useToast();

  const [splits, setSplits] = useState<Split[]>([]);
  const [meta, setMeta] = useState<{ totalPercent: number; balanced: boolean }>({
    totalPercent: 0,
    balanced: true,
  });
  const [loading, setLoading] = useState(true);

  // Per-split UI state — which split is currently expanded for payout
  // history / inline payout entry.
  const [expandedSplitId, setExpandedSplitId] = useState<string | null>(null);
  const [payoutsBySplit, setPayoutsBySplit] = useState<Record<string, Payout[]>>({});
  const [payoutsLoading, setPayoutsLoading] = useState<string | null>(null);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    paidOn: todayIso(),
    method: 'bank_transfer',
    reference: '',
    notes: '',
  });

  // Add-split inline form (admin only)
  const [addOpen, setAddOpen] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [submittingSplit, setSubmittingSplit] = useState(false);
  const [splitForm, setSplitForm] = useState({
    participantUserId: '' as string,
    participantName: '',
    sharePercent: '',
  });

  // Inline edit-share state
  const [editingSplitId, setEditingSplitId] = useState<string | null>(null);
  const [editSharePercent, setEditSharePercent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────
  const fetchSplits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/commissions/${commissionId}/splits`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load splits');
      const data: {
        splits: Split[];
        meta: { commissionAmount: number; totalPercent: number; balanced: boolean };
      } = await res.json();
      setSplits(data.splits ?? []);
      setMeta({ totalPercent: data.meta.totalPercent, balanced: data.meta.balanced });
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load splits',
      });
    } finally {
      setLoading(false);
    }
  }, [commissionId, addToast]);

  useEffect(() => {
    fetchSplits();
  }, [fetchSplits]);

  /** Load the team-user list lazily — only when admin opens the add form. */
  const ensureUsersLoaded = async () => {
    if (usersLoaded) return;
    try {
      const res = await fetch('/api/users?limit=100', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load team');
      const data: { users?: Array<{ id: string; name: string }> } = await res.json();
      setCompanyUsers(data.users ?? []);
    } catch {
      // Non-fatal — admin can still type a free-text name.
    } finally {
      setUsersLoaded(true);
    }
  };

  /** Load payout ledger for one split (lazy, on expand). */
  const loadPayouts = useCallback(
    async (splitId: string) => {
      setPayoutsLoading(splitId);
      try {
        const res = await fetch(
          `/api/commissions/${commissionId}/splits/${splitId}/payouts`,
          { credentials: 'include' },
        );
        if (!res.ok) throw new Error('Failed to load payouts');
        const data: { payouts: Payout[] } = await res.json();
        setPayoutsBySplit((prev) => ({ ...prev, [splitId]: data.payouts ?? [] }));
      } catch (err) {
        addToast({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to load payouts',
        });
      } finally {
        setPayoutsLoading(null);
      }
    },
    [commissionId, addToast],
  );

  const toggleExpanded = (splitId: string) => {
    if (expandedSplitId === splitId) {
      setExpandedSplitId(null);
      return;
    }
    setExpandedSplitId(splitId);
    if (!payoutsBySplit[splitId]) loadPayouts(splitId);
  };

  // ── Add split ─────────────────────────────────────────────────────
  const addSplit = async () => {
    const pct = Number(splitForm.sharePercent);
    if (!splitForm.participantName.trim()) {
      addToast({ type: 'error', message: 'Participant name is required' });
      return;
    }
    if (!pct || pct <= 0 || pct > 100) {
      addToast({ type: 'error', message: 'Share % must be between 0 and 100' });
      return;
    }
    setSubmittingSplit(true);
    try {
      const res = await fetch(`/api/commissions/${commissionId}/splits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          participantUserId: splitForm.participantUserId || null,
          participantName: splitForm.participantName.trim(),
          sharePercent: pct,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add participant');

      addToast({ type: 'success', message: 'Participant added.' });
      setAddOpen(false);
      setSplitForm({ participantUserId: '', participantName: '', sharePercent: '' });
      await fetchSplits();
      onChanged();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to add participant',
      });
    } finally {
      setSubmittingSplit(false);
    }
  };

  // ── Edit share% inline ────────────────────────────────────────────
  const startEdit = (s: Split) => {
    setEditingSplitId(s.id);
    setEditSharePercent(String(s.sharePercent));
  };
  const cancelEdit = () => {
    setEditingSplitId(null);
    setEditSharePercent('');
  };
  const saveEdit = async (splitId: string) => {
    const pct = Number(editSharePercent);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      addToast({ type: 'error', message: 'Share % must be between 0 and 100' });
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(
        `/api/commissions/${commissionId}/splits/${splitId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sharePercent: pct }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update share');

      addToast({ type: 'success', message: 'Share updated.' });
      cancelEdit();
      await fetchSplits();
      onChanged();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update share',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Delete split ──────────────────────────────────────────────────
  const deleteSplit = async (split: Split) => {
    if (!confirm(`Remove ${split.participantName}'s split? Payouts will also be removed from reports.`))
      return;
    try {
      const res = await fetch(
        `/api/commissions/${commissionId}/splits/${split.id}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to remove split');
      }
      addToast({ type: 'success', message: 'Participant removed.' });
      if (expandedSplitId === split.id) setExpandedSplitId(null);
      await fetchSplits();
      onChanged();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to remove split',
      });
    }
  };

  // ── Record payout ─────────────────────────────────────────────────
  const recordPayout = async (split: Split) => {
    const amt = Number(payoutForm.amount);
    if (!amt || amt <= 0) {
      addToast({ type: 'error', message: 'Enter a valid amount' });
      return;
    }
    const remaining = Math.max(0, split.shareAmount - split.paidOut);
    if (amt > remaining + 0.005) {
      addToast({
        type: 'error',
        message: `Amount exceeds remaining payout balance (${fmt(remaining)}).`,
      });
      return;
    }
    setSubmittingPayout(true);
    try {
      const res = await fetch(
        `/api/commissions/${commissionId}/splits/${split.id}/payouts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            amount: amt,
            paidOn: payoutForm.paidOn,
            method: payoutForm.method || null,
            reference: payoutForm.reference.trim() || null,
            notes: payoutForm.notes.trim() || null,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to record payout');

      addToast({ type: 'success', message: 'Payout recorded.' });
      setRecordingFor(null);
      setPayoutForm({
        amount: '',
        paidOn: todayIso(),
        method: 'bank_transfer',
        reference: '',
        notes: '',
      });
      await fetchSplits();
      await loadPayouts(split.id);
      onChanged();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to record payout',
      });
    } finally {
      setSubmittingPayout(false);
    }
  };

  // ── Delete payout ─────────────────────────────────────────────────
  const deletePayout = async (splitId: string, payoutId: string) => {
    if (!confirm('Remove this payout? The running total will be recalculated.'))
      return;
    try {
      const res = await fetch(
        `/api/commissions/${commissionId}/splits/${splitId}/payouts/${payoutId}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to remove payout');
      }
      addToast({ type: 'success', message: 'Payout removed.' });
      await fetchSplits();
      await loadPayouts(splitId);
      onChanged();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to remove payout',
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <section className="border border-gray-100 rounded-2xl bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4
          text-left hover:bg-gray-50/60 rounded-2xl transition-colors"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center
            justify-center flex-shrink-0">
            <Users size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-gray-900">Split</h4>
              <span className="text-[11px] text-gray-400">commission share</span>
              {!loading && (
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                    meta.balanced
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {!meta.balanced && <AlertTriangle size={10} />}
                  {meta.totalPercent.toFixed(meta.totalPercent % 1 === 0 ? 0 : 2)}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
              {splits.length} participant{splits.length === 1 ? '' : 's'} · commission {fmt(commissionAmount)}
            </p>
          </div>
        </div>
        {collapsed ? (
          <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 sm:px-5 pb-5 pt-1 space-y-4">
          {!meta.balanced && !loading && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50
              border border-amber-100 text-amber-700">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <p className="text-[11px] leading-relaxed">
                Splits total <strong>{meta.totalPercent.toFixed(2)}%</strong>, not 100%. The
                deal will save anyway, but reports will treat the gap as unallocated.
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="ml-2 text-xs">Loading splits…</span>
            </div>
          ) : splits.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl">
              <Users size={20} className="mx-auto text-gray-300 mb-1.5" />
              <p className="text-xs text-gray-400">No participants yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {splits.map((s) => {
                const remaining = Math.max(0, s.shareAmount - s.paidOut);
                const expanded = expandedSplitId === s.id;
                const editing = editingSplitId === s.id;
                const recording = recordingFor === s.id;
                const payouts = payoutsBySplit[s.id] ?? [];
                return (
                  <li
                    key={s.id}
                    className="border border-gray-100 rounded-xl bg-white overflow-hidden"
                  >
                    {/* Row */}
                    <div className="px-3 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {s.participantName}
                            {s.participant?.name && s.participant.name !== s.participantName && (
                              <span className="text-[11px] text-gray-400 font-normal ml-1">
                                ({s.participant.name})
                              </span>
                            )}
                          </p>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full
                            ${STATUS_PILL[s.status] ?? STATUS_PILL.Pending}`}>
                            {s.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div className="bg-gray-50 rounded-lg px-2 py-1.5">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Share</p>
                            {editing ? (
                              <div className="flex items-center gap-1 mt-0.5">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  max="100"
                                  step="0.5"
                                  value={editSharePercent}
                                  onChange={(e) => setEditSharePercent(e.target.value)}
                                  className="w-14 px-1.5 py-0.5 text-xs border border-gray-200 rounded-md
                                    focus:outline-none focus:ring-2 focus:ring-purple-500/20
                                    focus:border-purple-400 bg-white text-gray-800"
                                  autoFocus
                                />
                                <span className="text-xs text-gray-500">%</span>
                              </div>
                            ) : (
                              <p className="text-xs font-bold text-gray-700 mt-0.5">
                                {s.sharePercent}%
                              </p>
                            )}
                          </div>
                          <div className="bg-gray-50 rounded-lg px-2 py-1.5">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Share ₹</p>
                            <p className="text-xs font-bold text-gray-700 mt-0.5 truncate">
                              {fmt(s.shareAmount)}
                            </p>
                          </div>
                          <div className="bg-emerald-50 rounded-lg px-2 py-1.5">
                            <p className="text-[10px] text-emerald-500 uppercase tracking-wide">Paid out</p>
                            <p className="text-xs font-bold text-emerald-700 mt-0.5 truncate">
                              {fmt(s.paidOut)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {isAdmin && (
                          editing ? (
                            <>
                              <button
                                onClick={() => saveEdit(s.id)}
                                disabled={savingEdit}
                                title="Save share %"
                                className="w-7 h-7 rounded-lg border border-emerald-200 bg-emerald-50
                                  text-emerald-600 hover:bg-emerald-100 flex items-center
                                  justify-center transition-colors disabled:opacity-50"
                              >
                                <Check size={11} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                title="Cancel"
                                className="w-7 h-7 rounded-lg border border-gray-200 bg-white
                                  text-gray-400 hover:text-gray-600 flex items-center
                                  justify-center transition-colors"
                              >
                                <X size={11} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(s)}
                                title="Edit share %"
                                className="w-7 h-7 rounded-lg border border-gray-200 bg-white
                                  text-gray-400 hover:text-purple-600 hover:border-purple-200
                                  flex items-center justify-center transition-colors"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                onClick={() => deleteSplit(s)}
                                title="Remove participant"
                                className="w-7 h-7 rounded-lg border border-gray-200 bg-white
                                  text-gray-400 hover:text-red-600 hover:border-red-200
                                  flex items-center justify-center transition-colors"
                              >
                                <Trash2 size={11} />
                              </button>
                            </>
                          )
                        )}
                      </div>
                    </div>

                    {/* Expand toggle row */}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(s.id)}
                      className="w-full px-3 py-1.5 text-[11px] font-semibold text-purple-600
                        bg-purple-50/40 hover:bg-purple-50 border-t border-gray-100
                        flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {expanded ? (
                        <>
                          Hide payouts <ChevronUp size={11} />
                        </>
                      ) : (
                        <>
                          Payouts ({payouts.length || (payoutsLoading === s.id ? '…' : '0')}) <ChevronDown size={11} />
                        </>
                      )}
                    </button>

                    {/* Expanded panel */}
                    {expanded && (
                      <div className="px-3 py-3 border-t border-gray-100 bg-gray-50/30 space-y-3">
                        {payoutsLoading === s.id ? (
                          <div className="flex items-center justify-center py-3 text-gray-400">
                            <Loader2 size={14} className="animate-spin" />
                            <span className="ml-2 text-[11px]">Loading payouts…</span>
                          </div>
                        ) : payouts.length === 0 ? (
                          <p className="text-[11px] text-gray-400 text-center py-3">
                            No payouts recorded yet.
                          </p>
                        ) : (
                          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg
                            overflow-hidden bg-white">
                            {payouts.map((p) => (
                              <li key={p.id} className="px-3 py-2.5 flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-gray-900">
                                      {fmt(p.amount)}
                                    </span>
                                    <span className="text-[11px] text-gray-400">
                                      {new Date(p.paidOn).toLocaleDateString('en-IN', {
                                        day: 'numeric', month: 'short', year: 'numeric',
                                      })}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5
                                    text-[11px] text-gray-500">
                                    {p.method && (
                                      <span>
                                        {PAYMENT_METHODS.find((m) => m.value === p.method)?.label ?? p.method}
                                      </span>
                                    )}
                                    {p.reference && <span className="truncate">Ref: {p.reference}</span>}
                                    {p.recorder?.name && <span>by {p.recorder.name}</span>}
                                  </div>
                                  {p.notes && (
                                    <p className="text-[11px] text-gray-500 mt-0.5 italic break-words">
                                      “{p.notes}”
                                    </p>
                                  )}
                                </div>
                                {isAdmin && (
                                  <button
                                    onClick={() => deletePayout(s.id, p.id)}
                                    title="Remove payout"
                                    className="w-6 h-6 rounded-lg border border-gray-200 bg-white
                                      flex items-center justify-center text-gray-400
                                      hover:text-red-600 hover:border-red-200 transition-colors
                                      flex-shrink-0"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Record payout form.
                            Admin-only — team members can view payout history but
                            not write to it. */}
                        {remaining > 0 && isAdmin && (
                          <>
                            {!recording ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setRecordingFor(s.id);
                                  setPayoutForm((f) => ({
                                    ...f,
                                    amount: String(Math.round(remaining)),
                                  }));
                                }}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs
                                  font-semibold text-purple-700 bg-white border border-purple-200
                                  hover:bg-purple-50 rounded-lg transition-colors"
                              >
                                <Plus size={11} /> Record payout
                              </button>
                            ) : (
                              <div className="border border-purple-100 rounded-lg p-3 bg-white space-y-2">
                                <div className="flex items-center justify-between">
                                  <h6 className="text-[11px] font-bold text-gray-700">
                                    New payout to {s.participantName}
                                  </h6>
                                  <button
                                    type="button"
                                    onClick={() => setRecordingFor(null)}
                                    className="w-5 h-5 rounded-md text-gray-400 hover:text-gray-600
                                      flex items-center justify-center"
                                    aria-label="Cancel new payout"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-gray-600 mb-1">
                                      Amount (₹) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                                        ₹
                                      </span>
                                      <input
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        step="0.01"
                                        max={remaining}
                                        value={payoutForm.amount}
                                        onChange={(e) =>
                                          setPayoutForm({ ...payoutForm, amount: e.target.value })
                                        }
                                        placeholder="0"
                                        className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded-md
                                          focus:outline-none focus:ring-2 focus:ring-purple-500/20
                                          focus:border-purple-400 bg-white text-gray-800"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-semibold text-gray-600 mb-1">
                                      Paid on <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                      type="date"
                                      value={payoutForm.paidOn}
                                      onChange={(e) =>
                                        setPayoutForm({ ...payoutForm, paidOn: e.target.value })
                                      }
                                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md
                                        focus:outline-none focus:ring-2 focus:ring-purple-500/20
                                        focus:border-purple-400 bg-white text-gray-800"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-gray-600 mb-1">
                                      Method
                                    </label>
                                    <select
                                      value={payoutForm.method}
                                      onChange={(e) =>
                                        setPayoutForm({ ...payoutForm, method: e.target.value })
                                      }
                                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md
                                        focus:outline-none focus:ring-2 focus:ring-purple-500/20
                                        focus:border-purple-400 bg-white text-gray-800"
                                    >
                                      {PAYMENT_METHODS.map((m) => (
                                        <option key={m.value} value={m.value}>
                                          {m.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-semibold text-gray-600 mb-1">
                                      Reference
                                    </label>
                                    <input
                                      type="text"
                                      value={payoutForm.reference}
                                      onChange={(e) =>
                                        setPayoutForm({ ...payoutForm, reference: e.target.value })
                                      }
                                      placeholder="UPI Ref / NEFT id"
                                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md
                                        focus:outline-none focus:ring-2 focus:ring-purple-500/20
                                        focus:border-purple-400 bg-white text-gray-800
                                        placeholder:text-gray-400"
                                    />
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => recordPayout(s)}
                                  disabled={submittingPayout}
                                  className="w-full py-2 text-xs font-semibold text-white bg-purple-600
                                    hover:bg-purple-700 rounded-md transition-colors disabled:opacity-50"
                                >
                                  {submittingPayout ? 'Saving…' : `Record ${fmt(Number(payoutForm.amount) || 0)}`}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Add participant (admin) */}
          {isAdmin && (
            <div className="border border-gray-100 rounded-xl bg-gray-50/60">
              {!addOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(true);
                    ensureUsersLoaded();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm
                    font-semibold text-purple-700 hover:bg-purple-50/60 rounded-xl
                    transition-colors"
                >
                  <Plus size={14} /> Add participant
                </button>
              ) : (
                <div className="p-3 sm:p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-gray-700">New participant</h5>
                    <button
                      type="button"
                      onClick={() => {
                        setAddOpen(false);
                        setSplitForm({
                          participantUserId: '',
                          participantName: '',
                          sharePercent: '',
                        });
                      }}
                      className="w-6 h-6 rounded-lg bg-white border border-gray-200
                        text-gray-400 hover:text-gray-600 flex items-center justify-center"
                      aria-label="Cancel new participant"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Pick from team{' '}
                      <span className="text-gray-400 font-normal">(or type a name below)</span>
                    </label>
                    <select
                      value={splitForm.participantUserId}
                      onChange={(e) => {
                        const id = e.target.value;
                        const matched = companyUsers.find((u) => u.id === id);
                        setSplitForm((p) => ({
                          ...p,
                          participantUserId: id,
                          participantName: matched ? matched.name : p.participantName,
                        }));
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-purple-500/20
                        focus:border-purple-400 bg-white text-gray-800"
                    >
                      <option value="">— External / type a name —</option>
                      {companyUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Display name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={splitForm.participantName}
                      onChange={(e) =>
                        setSplitForm((p) => ({ ...p, participantName: e.target.value }))
                      }
                      placeholder="e.g. Broker A, Owner, Co-broker firm…"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-purple-500/20
                        focus:border-purple-400 bg-white text-gray-800 placeholder:text-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Share % <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="0.5"
                        value={splitForm.sharePercent}
                        onChange={(e) =>
                          setSplitForm((p) => ({ ...p, sharePercent: e.target.value }))
                        }
                        placeholder="e.g. 25"
                        className="w-full px-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg
                          focus:outline-none focus:ring-2 focus:ring-purple-500/20
                          focus:border-purple-400 bg-white text-gray-800"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                        %
                      </span>
                    </div>
                    {Number(splitForm.sharePercent) > 0 && commissionAmount > 0 && (
                      <p className="text-[11px] text-purple-600 mt-1">
                        ≈ {fmt((commissionAmount * Number(splitForm.sharePercent)) / 100)}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={addSplit}
                    disabled={submittingSplit}
                    className="w-full py-2 text-sm font-semibold text-white bg-purple-600
                      hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {submittingSplit ? 'Saving…' : 'Add participant'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
