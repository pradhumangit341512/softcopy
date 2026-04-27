'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ChevronDown, ChevronUp, Banknote, Plus, X,
  Trash2, Loader2, CheckCircle2,
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

const STAGES: { value: string; label: string; tone: string }[] = [
  { value: 'Token',          label: 'Token',          tone: 'bg-amber-50 text-amber-700' },
  { value: 'Agreement',      label: 'Agreement',      tone: 'bg-blue-50 text-blue-700' },
  { value: 'Registry',       label: 'Registry',       tone: 'bg-purple-50 text-purple-700' },
  { value: 'LoanDisbursed',  label: 'Loan Disbursed', tone: 'bg-indigo-50 text-indigo-700' },
  { value: 'Possession',     label: 'Possession',     tone: 'bg-emerald-50 text-emerald-700' },
  { value: 'Other',          label: 'Other',          tone: 'bg-gray-100 text-gray-700' },
];

const stageMeta = (v: string) =>
  STAGES.find((s) => s.value === v) ?? { label: v, tone: 'bg-gray-100 text-gray-700' };

const DEAL_STATUS_PILL: Record<string, string> = {
  Open:       'bg-amber-50 text-amber-700',
  InProgress: 'bg-blue-50 text-blue-700',
  Completed:  'bg-emerald-50 text-emerald-700',
};

const DEAL_STATUS_LABEL: Record<string, string> = {
  Open:       'Open',
  InProgress: 'In progress',
  Completed:  'Completed',
};

interface DealPaymentRow {
  id: string;
  amount: number;
  paidOn: string;
  stage: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  recorder?: { id: string; name: string } | null;
}

interface DealSummary {
  dealAmount: number;
  dealAmountPaid: number;
  dealStatus: string;
}

interface DealPaymentsSectionProps {
  commissionId: string;
  /** Latest known summary — kept in sync with each ledger mutation. */
  summary: DealSummary;
  isAdmin: boolean;
  collapsed: boolean;
  onToggle: () => void;
  /** Bubbled to the modal so the parent list / surrounding sections refresh. */
  onSummaryChange: (next: DealSummary) => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  amount: '',
  paidOn: todayIso(),
  stage: 'Token',
  method: 'bank_transfer',
  reference: '',
  notes: '',
});

/**
 * Section [2] of the merged Manage-Deal modal — the buyer→builder payment
 * ledger. Tracks the deal amount itself flowing in stages from the buyer
 * to the developer (token, agreement, registry, loan disbursement,
 * possession, etc.). Distinct from Section [3] which tracks money flowing
 * from the builder TO the brokerage.
 *
 * Owns its own ledger fetch, inline "Record stage payment" form, and
 * delete flow. Notifies the parent on every mutation so list-level totals
 * (and the by-builder report later) stay honest.
 */
export function DealPaymentsSection({
  commissionId,
  summary,
  isAdmin,
  collapsed,
  onToggle,
  onSummaryChange,
}: DealPaymentsSectionProps) {
  const { addToast } = useToast();

  const [payments, setPayments] = useState<DealPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordOpen, setRecordOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const remaining = Math.max(0, summary.dealAmount - summary.dealAmountPaid);
  const enteredAmount = Number(form.amount) || 0;
  const willComplete =
    enteredAmount > 0 && enteredAmount + 0.005 >= remaining;
  const overMax = enteredAmount > remaining + 0.005;

  /** Fetch ledger + freshly-computed summary. Called on mount + after mutations. */
  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/commissions/${commissionId}/deal-payments`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load deal payments');
      const data: {
        payments: DealPaymentRow[];
        commission: DealSummary;
      } = await res.json();
      setPayments(data.payments ?? []);
      if (data.commission) onSummaryChange(data.commission);
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load deal payments',
      });
    } finally {
      setLoading(false);
    }
  }, [commissionId, addToast, onSummaryChange]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const recordPayment = async () => {
    if (!enteredAmount || enteredAmount <= 0) {
      addToast({ type: 'error', message: 'Enter a valid amount' });
      return;
    }
    if (overMax) {
      addToast({
        type: 'error',
        message: `Amount exceeds remaining deal balance (${fmt(remaining)}).`,
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/commissions/${commissionId}/deal-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: enteredAmount,
          paidOn: form.paidOn,
          stage: form.stage,
          method: form.method || null,
          reference: form.reference.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to record deal payment');

      addToast({
        type: 'success',
        message:
          data.commission?.dealStatus === 'Completed'
            ? 'Deal is now fully paid by the buyer.'
            : `${stageMeta(form.stage).label} payment of ${fmt(enteredAmount)} recorded.`,
      });
      setForm(emptyForm());
      setRecordOpen(false);
      await fetchLedger();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to record deal payment',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deletePayment = async (paymentId: string) => {
    if (!confirm('Remove this deal payment? The running total will be recalculated.')) return;
    try {
      const res = await fetch(
        `/api/commissions/${commissionId}/deal-payments/${paymentId}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to remove deal payment');
      }
      addToast({ type: 'success', message: 'Deal payment removed' });
      await fetchLedger();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to remove deal payment',
      });
    }
  };

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
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center
            justify-center flex-shrink-0">
            <Banknote size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-gray-900">Deal Payments</h4>
              <span className="text-[11px] text-gray-400">buyer → builder</span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full
                ${DEAL_STATUS_PILL[summary.dealStatus] ?? DEAL_STATUS_PILL.Open}`}>
                {DEAL_STATUS_LABEL[summary.dealStatus] ?? summary.dealStatus}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
              {fmt(summary.dealAmountPaid)} of {fmt(summary.dealAmount)} received
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
          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-xl px-3 py-2.5">
              <p className="text-[11px] text-gray-400">Deal price</p>
              <p className="text-sm font-bold text-gray-800 mt-0.5 truncate">
                {fmt(summary.dealAmount)}
              </p>
            </div>
            <div className="bg-indigo-50 rounded-xl px-3 py-2.5">
              <p className="text-[11px] text-indigo-500">Received</p>
              <p className="text-sm font-bold text-indigo-700 mt-0.5 truncate">
                {fmt(summary.dealAmountPaid)}
              </p>
            </div>
            <div className="bg-orange-50 rounded-xl px-3 py-2.5">
              <p className="text-[11px] text-orange-500">Remaining</p>
              <p className="text-sm font-bold text-orange-700 mt-0.5 truncate">
                {fmt(remaining)}
              </p>
            </div>
          </div>

          {/* Inline record-payment form.
              Admin-only — team members can read the ledger but not write to it. */}
          {remaining > 0 && isAdmin && (
            <div className="border border-gray-100 rounded-xl bg-gray-50/60">
              {!recordOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setRecordOpen(true);
                    setForm((f) => ({ ...f, amount: f.amount || '' }));
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm
                    font-semibold text-indigo-700 hover:bg-indigo-50/60 rounded-xl
                    transition-colors"
                >
                  <Plus size={14} /> Record stage payment
                </button>
              ) : (
                <div className="p-3 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-gray-700">New deal payment</h5>
                    <button
                      type="button"
                      onClick={() => {
                        setRecordOpen(false);
                        setForm(emptyForm());
                      }}
                      className="w-6 h-6 rounded-lg bg-white border border-gray-200
                        text-gray-400 hover:text-gray-600 flex items-center justify-center"
                      aria-label="Cancel new deal payment"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Stage <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.stage}
                        onChange={(e) => setForm({ ...form, stage: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                          focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                          focus:border-indigo-400 bg-white text-gray-800"
                      >
                        {STAGES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Amount (₹) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          ₹
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          max={remaining}
                          value={form.amount}
                          onChange={(e) => setForm({ ...form, amount: e.target.value })}
                          placeholder="0"
                          className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                            focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                            focus:border-indigo-400 bg-white text-gray-800"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setForm({ ...form, amount: String(Math.round(remaining / 2)) })
                      }
                      className="text-[11px] font-semibold text-indigo-600 bg-indigo-50
                        hover:bg-indigo-100 px-2 py-0.5 rounded-md transition-colors"
                    >
                      Half ({fmt(Math.round(remaining / 2))})
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, amount: String(remaining) })}
                      className="text-[11px] font-semibold text-indigo-700 bg-indigo-100
                        hover:bg-indigo-200 px-2 py-0.5 rounded-md transition-colors"
                    >
                      Full remaining ({fmt(remaining)})
                    </button>
                  </div>
                  {overMax && (
                    <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                      <X size={10} /> Cannot exceed remaining deal balance.
                    </p>
                  )}
                  {willComplete && !overMax && (
                    <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 size={10} /> This will complete the deal.
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Paid on <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={form.paidOn}
                        onChange={(e) => setForm({ ...form, paidOn: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                          focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                          focus:border-indigo-400 bg-white text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Method
                      </label>
                      <select
                        value={form.method}
                        onChange={(e) => setForm({ ...form, method: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                          focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                          focus:border-indigo-400 bg-white text-gray-800"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Reference <span className="text-gray-400 font-normal ml-1">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={form.reference}
                      onChange={(e) => setForm({ ...form, reference: e.target.value })}
                      placeholder="Cheque no., UPI Ref, NEFT id…"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                        focus:border-indigo-400 bg-white text-gray-800 placeholder:text-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Notes <span className="text-gray-400 font-normal ml-1">(optional)</span>
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={2}
                      placeholder="Any context about this instalment…"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                        focus:border-indigo-400 bg-white text-gray-800 placeholder:text-gray-400
                        resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={recordPayment}
                    disabled={submitting || !enteredAmount || enteredAmount <= 0 || overMax}
                    className="w-full py-2.5 text-sm font-semibold text-white bg-indigo-600
                      hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50
                      disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? 'Saving…'
                      : willComplete
                        ? 'Settle & mark Completed'
                        : 'Record Payment'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Ledger */}
          <div>
            <h5 className="text-xs font-bold text-gray-700 mb-2">History</h5>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 size={16} className="animate-spin" />
                <span className="ml-2 text-xs">Loading deal payments…</span>
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl">
                <Banknote size={20} className="mx-auto text-gray-300 mb-1.5" />
                <p className="text-xs text-gray-400">
                  No deal payments recorded yet.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {payments.map((p) => {
                  const meta = stageMeta(p.stage);
                  return (
                    <li key={p.id} className="px-3 py-3 flex items-start gap-3 bg-white">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                            uppercase tracking-wide ${meta.tone}`}>
                            {meta.label}
                          </span>
                          <span className="text-sm font-bold text-gray-900">{fmt(p.amount)}</span>
                          <span className="text-[11px] text-gray-400 ml-auto">
                            {new Date(p.paidOn).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1
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
                          <p className="text-[11px] text-gray-500 mt-1 italic break-words">
                            “{p.notes}”
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => deletePayment(p.id)}
                          title="Remove this deal payment (admin only)"
                          className="w-7 h-7 rounded-lg border border-gray-200 bg-white
                            flex items-center justify-center text-gray-400 hover:text-red-600
                            hover:border-red-200 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
