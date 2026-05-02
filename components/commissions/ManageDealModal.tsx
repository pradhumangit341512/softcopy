'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { X, CheckCircle2, Wallet2 } from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import { DealSection, type DealSectionState } from './sections/DealSection';
import { DealPaymentsSection } from './sections/DealPaymentsSection';
import { CommissionPaymentsSection } from './sections/CommissionPaymentsSection';
import { SplitsSection } from './sections/SplitsSection';
import type { SelectedClient } from '@/components/common/ClientSearchInput';

const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'cash',          label: 'Cash' },
  { value: 'upi',           label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'other',         label: 'Other' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Subset of the parent's Commission row needed to populate the modal in
 * `manage` mode. The page-level type is wider; this is the contract.
 */
export interface ManagedCommission {
  id: string;
  clientId: string;
  client: { clientName: string; phone?: string };
  salesPersonName?: string | null;
  builderName?: string | null;
  dealAmount: number;
  /** Phase-1 fields — buyer→builder ledger summary, kept in sync via API. */
  dealAmountPaid?: number;
  dealStatus?: string;
  commissionPercentage: number;
  commissionAmount: number;
  paidAmount: number;
  paidStatus: string;
  paymentReference?: string;
}

interface ManageDealModalProps {
  open: boolean;
  mode: 'add' | 'manage';
  /** Required when `mode === 'manage'`. */
  commission?: ManagedCommission | null;
  isAdmin: boolean;
  onClose: () => void;
  /**
   * Fired after a successful create / update / payment-mutation. The page
   * uses this to refetch its commissions list + totals.
   */
  onChanged: () => void;
}

interface AddInitialPayment {
  amount: string;
  paidOn: string;
  method: string;
  reference: string;
  notes: string;
}

const emptyDealState = (): DealSectionState => ({
  selectedClient: null,
  builderName: '',
  salesPersonName: '',
  dealAmount: '',
  commissionMode: 'percent',
  commissionPercentage: '5',
  commissionFlatAmount: '',
  paymentReference: '',
});

const emptyInitial = (): AddInitialPayment => ({
  amount: '',
  paidOn: todayIso(),
  method: 'cash',
  reference: '',
  notes: '',
});

/**
 * Single popup that replaces the legacy Add / Edit / Record Payment / History
 * quartet. Two modes:
 *
 *   `add`    — blank deal section + optional initial-payment block. Submit
 *              button at the modal footer creates the commission (and its
 *              first payment in one round-trip if the broker filled it in).
 *
 *   `manage` — pre-populated deal section with its OWN save button (admin
 *              only) plus the full payment ledger section that can record /
 *              delete payments inline. No global save button — each action
 *              persists itself.
 *
 * Sections are collapsible; on mobile (<640px) they collapse by default to
 * keep the modal scannable on small screens.
 */
export function ManageDealModal({
  open,
  mode,
  commission,
  isAdmin,
  onClose,
  onChanged,
}: ManageDealModalProps) {
  const { addToast } = useToast();

  // ── Deal section form state ───────────────────────────────────────
  const [deal, setDeal] = useState<DealSectionState>(emptyDealState());

  // ── Add-mode initial payment state ─────────────────────────────────
  const [initial, setInitial] = useState<AddInitialPayment>(emptyInitial());

  // ── Manage-mode local commission summary (kept in sync as payments
  //    are added / removed so totals don't lag). ────────────────────
  const [summary, setSummary] = useState<{
    commissionAmount: number;
    paidAmount: number;
    paidStatus: string;
  } | null>(null);

  // ── Phase-1 deal-payment summary (buyer→builder running total). ──
  const [dealSummary, setDealSummary] = useState<{
    dealAmount: number;
    dealAmountPaid: number;
    dealStatus: string;
  } | null>(null);

  // ── Section collapse state (default collapsed on small viewports) ──
  const isSmallViewport = typeof window !== 'undefined' && window.innerWidth < 640;
  const [dealCollapsed, setDealCollapsed] = useState(false);
  const [dealPaymentsCollapsed, setDealPaymentsCollapsed] = useState(false);
  const [paymentsCollapsed, setPaymentsCollapsed] = useState(false);
  const [splitsCollapsed, setSplitsCollapsed] = useState(false);

  // ── Submit-flight flags ────────────────────────────────────────────
  const [creating, setCreating] = useState(false);
  const [savingDeal, setSavingDeal] = useState(false);

  /** Hydrate the form whenever a fresh `commission` is passed in manage mode. */
  useEffect(() => {
    if (!open) return;
    if (mode === 'manage' && commission) {
      setDeal({
        selectedClient: {
          id: commission.clientId,
          clientName: commission.client.clientName,
          phone: commission.client.phone ?? '',
        },
        builderName: commission.builderName ?? '',
        salesPersonName: commission.salesPersonName ?? '',
        dealAmount: String(commission.dealAmount),
        // Existing rows always opened in percent mode — pct + commissionAmount
        // are already in sync on the server, and the user can flip the toggle
        // to Flat ₹ if they want to edit the rupee amount directly.
        commissionMode: 'percent',
        commissionPercentage: String(commission.commissionPercentage),
        commissionFlatAmount: String(commission.commissionAmount),
        paymentReference: commission.paymentReference ?? '',
      });
      setSummary({
        commissionAmount: commission.commissionAmount,
        paidAmount: commission.paidAmount ?? 0,
        paidStatus: commission.paidStatus,
      });
      setDealSummary({
        dealAmount: commission.dealAmount,
        dealAmountPaid: commission.dealAmountPaid ?? 0,
        dealStatus: commission.dealStatus ?? 'Open',
      });
      // On a real phone the modal is tall — start with payments expanded
      // (the section the user usually came here for) and the others
      // collapsed so they don't bury the action below.
      setDealCollapsed(isSmallViewport);
      setDealPaymentsCollapsed(isSmallViewport);
      setPaymentsCollapsed(false);
      setSplitsCollapsed(isSmallViewport);
    } else if (mode === 'add') {
      setDeal(emptyDealState());
      setInitial(emptyInitial());
      setSummary(null);
      setDealSummary(null);
      setDealCollapsed(false);
      setDealPaymentsCollapsed(false);
      setPaymentsCollapsed(false);
      setSplitsCollapsed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, commission?.id]);

  /** Esc to close. Body scroll lock while open. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  /**
   * Resolve the deal section's commission inputs into the canonical pair
   * (commissionPercentage, commissionAmount) the API expects. Flat-mode
   * back-computes pct from (flat / deal × 100); percent-mode passes through.
   */
  const resolvedCommission = useMemo(() => {
    const dealAmt = Number(deal.dealAmount) || 0;
    if (deal.commissionMode === 'flat') {
      const flat = Number(deal.commissionFlatAmount) || 0;
      const pct = dealAmt > 0 ? (flat / dealAmt) * 100 : 0;
      return { amount: flat, pct };
    }
    const pct = Number(deal.commissionPercentage) || 0;
    return { amount: (dealAmt * pct) / 100, pct };
  }, [deal.commissionMode, deal.dealAmount, deal.commissionPercentage, deal.commissionFlatAmount]);

  /** Whether the deal section diverges from its initial loaded state. */
  const dealDirty = useMemo(() => {
    if (mode !== 'manage' || !commission) return false;
    return (
      (deal.builderName || '') !== (commission.builderName ?? '') ||
      (deal.salesPersonName || '') !== (commission.salesPersonName ?? '') ||
      Number(deal.dealAmount) !== commission.dealAmount ||
      Math.abs(resolvedCommission.amount - commission.commissionAmount) > 0.005 ||
      (deal.paymentReference || '') !== (commission.paymentReference ?? '')
    );
  }, [deal, commission, mode, resolvedCommission.amount]);

  /** Computed commission ₹ for the add-mode initial-payment guards. */
  const computedCommission = resolvedCommission.amount;

  const initialAmt = Number(initial.amount) || 0;
  const initialOverMax =
    computedCommission > 0 && initialAmt > computedCommission + 0.005;
  const initialWillBeFull =
    computedCommission > 0 &&
    initialAmt > 0 &&
    initialAmt + 0.005 >= computedCommission;

  // ── Field setters ──────────────────────────────────────────────────
  const setDealField = useCallback(
    <K extends keyof Omit<DealSectionState, 'selectedClient'>>(
      key: K,
      value: DealSectionState[K],
    ) => {
      setDeal((d) => ({ ...d, [key]: value }));
    },
    [],
  );
  const setClient = useCallback((c: SelectedClient | null) => {
    setDeal((d) => ({ ...d, selectedClient: c }));
  }, []);

  // ── Submit: create commission ──────────────────────────────────────
  const handleCreate = async () => {
    if (!deal.selectedClient) {
      addToast({ type: 'error', message: 'Please pick a client.' });
      return;
    }
    if (!deal.dealAmount || Number(deal.dealAmount) <= 0) {
      addToast({ type: 'error', message: 'Deal Amount is required.' });
      return;
    }
    if (resolvedCommission.amount > Number(deal.dealAmount) + 0.005) {
      addToast({
        type: 'error',
        message: "Commission can't exceed the deal amount.",
      });
      return;
    }
    if (initialOverMax) {
      addToast({
        type: 'error',
        message: `Initial payment can't exceed the commission (${fmt(computedCommission)}).`,
      });
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        clientId: deal.selectedClient.id,
        salesPersonName: deal.salesPersonName.trim() || null,
        builderName: deal.builderName.trim() || null,
        dealAmount: Number(deal.dealAmount),
        commissionPercentage: resolvedCommission.pct,
        paymentReference: deal.paymentReference.trim() || undefined,
      };
      if (initialAmt > 0) {
        body.initialPayment = {
          amount: initialAmt,
          paidOn: initial.paidOn,
          method: initial.method || null,
          reference: initial.reference.trim() || undefined,
          notes: initial.notes.trim() || undefined,
        };
      }
      const res = await fetch('/api/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add commission');

      addToast({
        type: 'success',
        message:
          initialAmt > 0
            ? `Commission added. ${fmt(initialAmt)} recorded as first payment.`
            : 'Commission added successfully.',
      });
      onChanged();
      onClose();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to add commission',
      });
    } finally {
      setCreating(false);
    }
  };

  // ── Submit: save deal section (manage mode) ────────────────────────
  const handleSaveDeal = async () => {
    if (!commission) return;
    if (!deal.dealAmount || Number(deal.dealAmount) <= 0) {
      addToast({ type: 'error', message: 'Deal Amount is required.' });
      return;
    }
    if (resolvedCommission.amount > Number(deal.dealAmount) + 0.005) {
      addToast({
        type: 'error',
        message: "Commission can't exceed the deal amount.",
      });
      return;
    }
    setSavingDeal(true);
    try {
      const res = await fetch(`/api/commissions/${commission.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          salesPersonName: deal.salesPersonName.trim() || null,
          builderName: deal.builderName.trim() || null,
          dealAmount: Number(deal.dealAmount),
          commissionPercentage: resolvedCommission.pct,
          paymentReference: deal.paymentReference.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save deal');

      addToast({ type: 'success', message: 'Deal updated.' });

      // Sync the local summaries so both ledger sections reflect any
      // recomputed totals immediately (e.g. dealAmount changed → deal-paid
      // status may flip; commissionAmount changed → paid status may flip).
      if (data.commission) {
        setSummary((s) =>
          s
            ? {
                commissionAmount: data.commission.commissionAmount ?? s.commissionAmount,
                paidAmount: data.commission.paidAmount ?? s.paidAmount,
                paidStatus: data.commission.paidStatus ?? s.paidStatus,
              }
            : s,
        );
        setDealSummary((d) =>
          d
            ? {
                dealAmount: data.commission.dealAmount ?? d.dealAmount,
                dealAmountPaid: data.commission.dealAmountPaid ?? d.dealAmountPaid,
                dealStatus: data.commission.dealStatus ?? d.dealStatus,
              }
            : d,
        );
      }
      onChanged();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save deal',
      });
    } finally {
      setSavingDeal(false);
    }
  };

  /** Bubbled from CommissionPaymentsSection on every ledger mutation. */
  const handleSummaryChange = useCallback(
    (next: { commissionAmount: number; paidAmount: number; paidStatus: string }) => {
      setSummary(next);
      onChanged();
    },
    [onChanged],
  );

  /** Bubbled from DealPaymentsSection on every buyer→builder mutation. */
  const handleDealSummaryChange = useCallback(
    (next: { dealAmount: number; dealAmountPaid: number; dealStatus: string }) => {
      setDealSummary(next);
      onChanged();
    },
    [onChanged],
  );

  if (!open) return null;

  // Team members never get into 'add' mode (the page hides the button) but
  // we guard here too in case the modal is opened programmatically.
  if (mode === 'add' && !isAdmin) return null;

  // ── Render ─────────────────────────────────────────────────────────
  const headerTitle =
    mode === 'add' ? 'Add Commission' : isAdmin ? 'Manage Deal' : 'View Deal';
  const headerSub =
    mode === 'manage' && commission
      ? `${commission.client.clientName}${
          commission.builderName ? ` · ${commission.builderName}` : ''
        }`
      : 'Capture a new deal and (optionally) the first payment.';

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center
        justify-center p-0 sm:p-4 lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-deal-title"
    >
      <div
        className="bg-white w-full sm:max-w-2xl lg:max-w-3xl h-[100dvh] sm:h-auto
          sm:max-h-[92dvh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4
          border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <h3 id="manage-deal-title"
              className="text-base sm:text-lg font-bold text-gray-900 truncate">
              {headerTitle}
            </h3>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 truncate">
              {headerSub}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center
              justify-center text-gray-500 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-3 bg-gray-50/30">
          {mode === 'manage' && !isAdmin && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5
              flex items-start gap-2">
              <span className="text-amber-600 text-base leading-none">●</span>
              <p className="text-[12px] text-amber-700 leading-relaxed">
                <strong>View only.</strong> Commission edits, payments, and payouts are
                admin-only. Ask an admin to record changes for this deal.
              </p>
            </div>
          )}
          <DealSection
            mode={mode}
            isAdmin={isAdmin}
            collapsed={dealCollapsed}
            onToggle={() => setDealCollapsed((c) => !c)}
            state={deal}
            onClientChange={setClient}
            onFieldChange={setDealField}
            saving={savingDeal}
            dirty={dealDirty}
            onSave={handleSaveDeal}
          />

          {mode === 'manage' && commission && dealSummary && (
            <DealPaymentsSection
              commissionId={commission.id}
              summary={dealSummary}
              isAdmin={isAdmin}
              collapsed={dealPaymentsCollapsed}
              onToggle={() => setDealPaymentsCollapsed((c) => !c)}
              onSummaryChange={handleDealSummaryChange}
            />
          )}

          {mode === 'manage' && commission && summary && (
            <CommissionPaymentsSection
              commissionId={commission.id}
              summary={summary}
              isAdmin={isAdmin}
              collapsed={paymentsCollapsed}
              onToggle={() => setPaymentsCollapsed((c) => !c)}
              onSummaryChange={handleSummaryChange}
            />
          )}

          {mode === 'manage' && commission && summary && (
            <SplitsSection
              commissionId={commission.id}
              commissionAmount={summary.commissionAmount}
              isAdmin={isAdmin}
              collapsed={splitsCollapsed}
              onToggle={() => setSplitsCollapsed((c) => !c)}
              onChanged={onChanged}
            />
          )}

          {/* ADD-MODE: optional initial-payment block ─────────────────── */}
          {mode === 'add' && (
            <section className="border border-gray-100 rounded-2xl bg-white p-4 sm:p-5
              space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex
                    items-center justify-center">
                    <Wallet2 size={15} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">
                      First Payment
                      <span className="text-xs text-gray-400 font-normal ml-1.5">
                        (optional)
                      </span>
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Got money on the spot? Log it now in the same step.
                    </p>
                  </div>
                </div>
                {initialAmt > 0 && (
                  <button
                    type="button"
                    onClick={() => setInitial(emptyInitial())}
                    className="text-[11px] font-semibold text-gray-500 hover:text-gray-700
                      bg-white border border-gray-200 hover:bg-gray-50 px-2 py-0.5 rounded-md
                      transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Amount received (₹)
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
                    value={initial.amount}
                    onChange={(e) => setInitial((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-emerald-500/20
                      focus:border-emerald-400 bg-white text-gray-800"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setInitial((p) => ({ ...p, amount: '' }))}
                    className="text-[11px] font-semibold text-gray-600 bg-white
                      border border-gray-200 hover:bg-gray-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    None
                  </button>
                  <button
                    type="button"
                    disabled={computedCommission <= 0}
                    onClick={() =>
                      setInitial((p) => ({
                        ...p,
                        amount: String(Math.round(computedCommission / 2)),
                      }))
                    }
                    className="text-[11px] font-semibold text-blue-600 bg-blue-50
                      hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Half ({fmt(Math.round(computedCommission / 2))})
                  </button>
                  <button
                    type="button"
                    disabled={computedCommission <= 0}
                    onClick={() =>
                      setInitial((p) => ({ ...p, amount: String(computedCommission) }))
                    }
                    className="text-[11px] font-semibold text-emerald-600 bg-emerald-50
                      hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Full ({fmt(computedCommission)})
                  </button>
                </div>
                {initialOverMax && (
                  <p className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
                    <X size={12} /> Cannot exceed commission ({fmt(computedCommission)}).
                  </p>
                )}
                {initialWillBeFull && !initialOverMax && (
                  <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Will be created as fully Paid.
                  </p>
                )}
              </div>

              {initialAmt > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Paid on
                      </label>
                      <input
                        type="date"
                        value={initial.paidOn}
                        onChange={(e) =>
                          setInitial((p) => ({ ...p, paidOn: e.target.value }))
                        }
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                          focus:outline-none focus:ring-2 focus:ring-emerald-500/20
                          focus:border-emerald-400 bg-white text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Method
                      </label>
                      <select
                        value={initial.method}
                        onChange={(e) =>
                          setInitial((p) => ({ ...p, method: e.target.value }))
                        }
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                          focus:outline-none focus:ring-2 focus:ring-emerald-500/20
                          focus:border-emerald-400 bg-white text-gray-800"
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
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Reference
                      <span className="text-gray-400 font-normal ml-1">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={initial.reference}
                      onChange={(e) =>
                        setInitial((p) => ({ ...p, reference: e.target.value }))
                      }
                      placeholder="Cheque no., UPI Ref, Transaction ID…"
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                        focus:outline-none focus:ring-2 focus:ring-emerald-500/20
                        focus:border-emerald-400 bg-white text-gray-800 placeholder:text-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Notes
                      <span className="text-gray-400 font-normal ml-1">(optional)</span>
                    </label>
                    <textarea
                      value={initial.notes}
                      onChange={(e) => setInitial((p) => ({ ...p, notes: e.target.value }))}
                      rows={2}
                      placeholder="Any context about this payment…"
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                        focus:outline-none focus:ring-2 focus:ring-emerald-500/20
                        focus:border-emerald-400 bg-white text-gray-800 placeholder:text-gray-400
                        resize-none"
                    />
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 flex gap-2 sm:gap-3
          flex-shrink-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border
              border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {mode === 'add' ? 'Cancel' : 'Close'}
          </button>
          {mode === 'add' && (
            <button
              onClick={handleCreate}
              disabled={creating || !deal.selectedClient || initialOverMax}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600
                hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-60
                disabled:cursor-not-allowed"
            >
              {creating ? 'Saving…' : 'Add Commission'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
