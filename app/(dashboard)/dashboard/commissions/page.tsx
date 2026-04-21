'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/common/Toast';
import { Pagination } from '@/components/common/Pagination';
import {
  IndianRupee, Clock, CheckCircle2, TrendingUp,
  ChevronRight, Plus, FileSpreadsheet,
  FileText, Pencil, X, Target,
  Search, Wallet, Wallet2, History, Trash2, Loader2,
  Calendar,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import type { CustomTooltipProps } from '@/lib/utils';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface Commission {
  id: string;
  clientId: string;
  client: { clientName: string };
  user?: { name: string } | null;
  salesPersonName?: string | null;
  dealAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  /** Running total from the payment ledger. 0 = Pending, < full = Partial, >= full = Paid. */
  paidAmount: number;
  paidStatus: string; // 'Pending' | 'Partial' | 'Paid'
  createdAt: string;
  paymentReference?: string;
}

interface CommissionPaymentRow {
  id: string;
  amount: number;
  paidOn: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  recorder?: { id: string; name: string } | null;
}

/** One month's rollup from /api/commissions/breakdown. */
interface MonthlyBucket {
  month: string;       // 'YYYY-MM'
  deals: number;
  revenue: number;     // sum of dealAmount
  commission: number;  // sum of commissionAmount
  paid: number;        // sum of paidAmount
  pending: number;     // commission - paid
}

interface PerformerBucket {
  userId: string | null;
  name: string;
  deals: number;
  revenue: number;
  commission: number;
  paid: number;
  pending: number;
}

interface BreakdownResponse {
  monthly: MonthlyBucket[];
  byPerformer: PerformerBucket[];
  totals: {
    deals: number;
    revenue: number;
    commission: number;
    paid: number;
    pending: number;
  };
}

interface Client { id: string; clientName: string; }

interface MonthlyBudget {
  id?: string;
  month: string;
  targetAmount: number;
}

type FilterType = 'all' | 'Pending' | 'Partial' | 'Paid';

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'cash',          label: 'Cash' },
  { value: 'upi',           label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'other',         label: 'Other' },
];

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Convert a 'YYYY-MM' breakdown key into a short human label like
 * `Feb '26`. Used on the chart x-axis and the monthly table rows so the
 * dates stay scannable even on narrow screens.
 */
const formatMonthShort = (yyyyMm: string): string => {
  const [y, m] = yyyyMm.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  if (isNaN(date.getTime())) return yyyyMm;
  return `${date.toLocaleString('en-US', { month: 'short' })} '${String(y).slice(-2)}`;
};

const getSalesPerson = (c: Commission) =>
  c.salesPersonName || c.user?.name || '—';

// ─────────────────────────────────────────
// Stat color map (replaces inline styles)
// ─────────────────────────────────────────
const STAT_COLORS = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   icon: 'text-blue-500'   },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-600',  icon: 'text-amber-500'  },
  emerald:{ bg: 'bg-emerald-50',text: 'text-emerald-600',icon: 'text-emerald-500'},
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-500' },
};

// ─────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────
const StatCard = ({
  label, value, colorKey, icon: Icon, sub,
}: {
  label: string; value: string;
  colorKey: keyof typeof STAT_COLORS;
  icon: LucideIcon; sub?: string;
}) => {
  const c = STAT_COLORS[colorKey];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-medium text-gray-500">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.bg}`}>
          <Icon size={18} className={c.icon} />
        </div>
      </div>
      <p className={`text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight ${c.text}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
};

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  Paid:    { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Partial: { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500'  },
  Pending: { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
      ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
};

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
        <p className="text-sm font-bold text-gray-800">{fmt(Number(payload[0]?.value))}</p>
      </div>
    );
  }
  return null;
};

// ─────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────
export default function CommissionsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  // Team members (role='user') can create commissions and record payments
  // but cannot edit commission meta, delete commissions, or reverse
  // payments. The UI hides those actions; the API enforces the rule too.
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [commissions, setCommissions]     = useState<Commission[]>([]);
  const [clients, setClients]             = useState<Client[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  // paidCommission comes straight from the server (sum of CommissionPayment
  // ledger), so Partial rows split correctly — no more "total − pending"
  // client-side math that loses the unpaid portion of partial commissions.
  const [totals, setTotals] = useState({
    totalCommission: 0,
    pendingCommission: 0,
    paidCommission: 0,
  });
  const [filter, setFilter]               = useState<FilterType>('all');
  const [search, setSearch]               = useState('');
  const [page, setPage]                   = useState(1);
  const [totalPages, setTotalPages]       = useState(1);

  // Time filter — accounting-period presets backed by an explicit (from, to)
  // pair. Both bounds are sent to the API as YYYY-MM-DD; the server treats
  // `to` as inclusive up to end-of-day. 'all' sends no bounds at all.
  type TimePreset = 'all' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisFY' | 'custom';
  const [timePreset, setTimePreset] = useState<TimePreset>('all');
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [budget, setBudget]               = useState<MonthlyBudget>({ month: currentMonthKey(), targetAmount: 0 });
  const [budgetInput, setBudgetInput]     = useState('');
  const [editingBudget, setEditingBudget] = useState(false);
  const [savingBudget, setSavingBudget]   = useState(false);

  type ModalMode = 'add' | 'edit' | 'recordPayment' | 'history' | null;
  const [modalMode, setModalMode]         = useState<ModalMode>(null);
  const [selectedCommission, setSelected] = useState<Commission | null>(null);
  const [submitting, setSubmitting]       = useState(false);

  // All fields for the Add/Edit Commission modal — now includes an
  // OPTIONAL initial-payment block so brokers can log "I closed the deal
  // AND received ₹X on the spot" in a single submission. Fields prefixed
  // `initial*` are only sent to the API when `initialAmount > 0`.
  const emptyForm = {
    clientId: '', salesPersonName: '', dealAmount: '',
    commissionPercentage: '5', paymentReference: '',
    initialAmount: '',
    initialPaidOn: new Date().toISOString().slice(0, 10),
    initialMethod: 'cash',
    initialReference: '',
    initialNotes: '',
  };
  const [form, setForm] = useState(emptyForm);

  const emptyPaymentForm = {
    amount: '',
    paidOn: new Date().toISOString().slice(0, 10),
    method: 'cash',
    reference: '',
    notes: '',
  };
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);

  // Payment history cache — loaded on demand when user opens the history modal.
  const [history, setHistory]                 = useState<CommissionPaymentRow[]>([]);
  const [historyLoading, setHistoryLoading]   = useState(false);

  // Admin-only monthly + per-salesperson breakdown for the selected window.
  const [breakdown, setBreakdown]             = useState<BreakdownResponse | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [showPerformers, setShowPerformers]   = useState(false);

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
    setForm(emptyForm);
    setPaymentForm(emptyPaymentForm);
    setHistory([]);
  };

  // Debounced copy of `search` — keeps typing snappy by issuing one fetch
  // per ~250ms of idle instead of one per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  /**
   * Map a time preset to concrete (from, to) dates in YYYY-MM-DD.
   * Presets match typical Indian-accounting periods; FY runs Apr 1 → Mar 31.
   * Memoized so the chart / fetch effect doesn't rebuild on every render.
   */
  const dateRange = useMemo<{ from?: string; to?: string }>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth(); // 0-indexed
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const startOfMonth = (yy: number, mm: number) => new Date(yy, mm, 1);
    const endOfMonth   = (yy: number, mm: number) => new Date(yy, mm + 1, 0);

    switch (timePreset) {
      case 'thisMonth':
        return { from: iso(startOfMonth(y, m)), to: iso(endOfMonth(y, m)) };
      case 'lastMonth': {
        const prev = new Date(y, m - 1, 1);
        return {
          from: iso(startOfMonth(prev.getFullYear(), prev.getMonth())),
          to:   iso(endOfMonth(prev.getFullYear(), prev.getMonth())),
        };
      }
      case 'thisQuarter': {
        const qStart = Math.floor(m / 3) * 3;
        return { from: iso(startOfMonth(y, qStart)), to: iso(endOfMonth(y, qStart + 2)) };
      }
      case 'thisFY': {
        // Indian financial year: April → March. If today is Jan–Mar, the FY
        // started LAST calendar year; otherwise it started this year.
        const fyStartYear = m >= 3 ? y : y - 1;
        return {
          from: `${fyStartYear}-04-01`,
          to:   `${fyStartYear + 1}-03-31`,
        };
      }
      case 'custom':
        return {
          from: customRange.from || undefined,
          to:   customRange.to   || undefined,
        };
      case 'all':
      default:
        return {};
    }
  }, [timePreset, customRange]);

  // Human label for the active time filter — shown on the Time chip.
  const timeLabel = useMemo(() => {
    switch (timePreset) {
      case 'thisMonth':  return 'This month';
      case 'lastMonth':  return 'Last month';
      case 'thisQuarter':return 'This quarter';
      case 'thisFY':     return 'This FY';
      case 'custom': {
        const { from, to } = customRange;
        if (from && to) return `${from} → ${to}`;
        if (from)       return `From ${from}`;
        if (to)         return `Until ${to}`;
        return 'Custom';
      }
      case 'all':
      default:           return 'All time';
    }
  }, [timePreset, customRange]);

  // ─── Fetch ───
  const fetchCommissions = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        ...(filter !== 'all' && { paidStatus: filter }),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(dateRange.from && { from: dateRange.from }),
        ...(dateRange.to   && { to:   dateRange.to   }),
      });
      const res = await fetch(`/api/commissions?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCommissions(data.commissions || []);
      setTotals(
        data.totals || { totalCommission: 0, pendingCommission: 0, paidCommission: 0 }
      );
      setTotalPages(data.pagination?.pages || 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch commissions';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filter, page, debouncedSearch, dateRange]);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients?limit=200', { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setClients(d.clients || []); }
    } catch {}
  };

  const fetchBudget = async () => {
    try {
      const res = await fetch(`/api/budget?month=${currentMonthKey()}`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        if (d.budget) { setBudget(d.budget); setBudgetInput(String(d.budget.targetAmount)); }
      }
    } catch {}
  };

  useEffect(() => { fetchCommissions(); }, [fetchCommissions]);
  useEffect(() => { fetchClients(); fetchBudget(); }, []);

  /**
   * Load the admin-only monthly + per-salesperson breakdown. Re-runs
   * whenever the active date range changes so the tables stay in sync
   * with the stat cards and list.
   *
   * Team members never call this endpoint — the server would 403, and
   * more importantly `hisab` data (per-salesperson totals) isn't theirs
   * to see.
   */
  const fetchBreakdown = useCallback(async () => {
    if (!isAdmin) {
      setBreakdown(null);
      return;
    }
    setBreakdownLoading(true);
    try {
      const params = new URLSearchParams({
        ...(dateRange.from && { from: dateRange.from }),
        ...(dateRange.to   && { to:   dateRange.to   }),
      });
      const url = `/api/commissions/breakdown${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('breakdown fetch failed');
      const data = (await res.json()) as BreakdownResponse;
      setBreakdown(data);
    } catch {
      // Breakdown is a secondary view — if it fails we degrade silently
      // to the old list-only layout rather than taking down the page.
      setBreakdown(null);
    } finally {
      setBreakdownLoading(false);
    }
  }, [isAdmin, dateRange]);

  useEffect(() => { fetchBreakdown(); }, [fetchBreakdown]);

  // ─── Budget ───
  const saveBudget = async () => {
    setSavingBudget(true);
    try {
      const res = await fetch('/api/budget', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ month: currentMonthKey(), targetAmount: Number(budgetInput) }),
      });
      if (!res.ok) throw new Error('Failed to save budget');
      const d = await res.json();
      setBudget(d.budget); setEditingBudget(false);
      addToast({ type: 'success', message: 'Budget target saved' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save budget';
      addToast({ type: 'error', message: msg });
    } finally {
      setSavingBudget(false);
    }
  };

  // ─── Add ───
  // Submits commission meta + (optionally) the first payment as a single
  // request. The server creates the commission and the matching ledger
  // row atomically, so the running total / status badge reflect reality
  // the moment the modal closes.
  const handleAdd = async () => {
    if (!form.clientId) { addToast({ type: 'error', message: 'Client is required' }); return; }
    if (!form.dealAmount) { addToast({ type: 'error', message: 'Deal Amount is required' }); return; }

    const deal = Number(form.dealAmount);
    const pct  = Number(form.commissionPercentage);
    const commissionAmount = (deal * pct) / 100;
    const initialAmount    = Number(form.initialAmount) || 0;

    if (initialAmount < 0) {
      addToast({ type: 'error', message: 'Initial payment cannot be negative' });
      return;
    }
    if (initialAmount > commissionAmount + 0.005) {
      addToast({
        type: 'error',
        message: `Initial payment can't exceed the commission (${fmt(commissionAmount)}).`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        clientId: form.clientId,
        salesPersonName: form.salesPersonName?.trim() || null,
        dealAmount: deal,
        commissionPercentage: pct,
        paymentReference: form.paymentReference || undefined,
      };
      if (initialAmount > 0) {
        body.initialPayment = {
          amount: initialAmount,
          paidOn: form.initialPaidOn,
          method: form.initialMethod || null,
          reference: form.initialReference?.trim() || undefined,
          notes: form.initialNotes?.trim() || undefined,
        };
      }

      const res = await fetch('/api/commissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      addToast({
        type: 'success',
        message: initialAmount > 0
          ? `Commission added. ${fmt(initialAmount)} recorded as first payment.`
          : 'Commission added successfully',
      });
      closeModal(); fetchCommissions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add commission';
      addToast({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Edit ───
  // Edit mode edits only the commission's meta (deal amount, %, ref,
  // salesperson). Payments are managed exclusively from the History
  // modal, so the initial-payment fields stay blank/empty here.
  const openEdit = (c: Commission) => {
    setSelected(c);
    setForm({
      ...emptyForm,
      clientId: c.clientId,
      salesPersonName: c.salesPersonName || '',
      dealAmount: String(c.dealAmount),
      commissionPercentage: String(c.commissionPercentage),
      paymentReference: c.paymentReference || '',
    });
    setModalMode('edit');
  };

  // paidStatus is intentionally not sent — it's derived from the payment
  // ledger. Use the Record Payment modal to change payment state.
  const handleEdit = async () => {
    if (!selectedCommission) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/commissions/${selectedCommission.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          salesPersonName: form.salesPersonName?.trim() || null,
          dealAmount: Number(form.dealAmount),
          commissionPercentage: Number(form.commissionPercentage),
          paymentReference: form.paymentReference || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      addToast({ type: 'success', message: 'Commission updated' });
      closeModal(); fetchCommissions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update commission';
      addToast({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Record a (partial or full) payment ───
  const handleRecordPayment = async () => {
    if (!selectedCommission) return;
    const amt = Number(paymentForm.amount);
    if (!amt || amt <= 0) {
      addToast({ type: 'error', message: 'Enter a valid amount' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/commissions/${selectedCommission.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: amt,
          paidOn: paymentForm.paidOn,
          method: paymentForm.method || null,
          reference: paymentForm.reference?.trim() || null,
          notes: paymentForm.notes?.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');

      const isPaid = data.commission?.paidStatus === 'Paid';
      addToast({
        type: 'success',
        message: isPaid
          ? 'Commission is now fully paid.'
          : `Payment of ${fmt(amt)} recorded. Remaining: ${fmt(
              (data.commission?.commissionAmount ?? 0) - (data.commission?.paidAmount ?? 0)
            )}`,
      });
      closeModal();
      fetchCommissions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record payment';
      addToast({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  /** Load the payment history for the currently-selected commission. */
  const loadHistory = async (commissionId: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/commissions/${commissionId}/payments`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load payment history');
      const data = await res.json();
      setHistory(data.payments || []);
    } catch (err: unknown) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load payment history',
      });
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  /** Remove a previously-recorded payment (soft delete). */
  const deletePayment = async (paymentId: string) => {
    if (!selectedCommission) return;
    if (!confirm('Remove this payment? The running total will be recalculated.')) return;
    try {
      const res = await fetch(
        `/api/commissions/${selectedCommission.id}/payments/${paymentId}`,
        { method: 'DELETE', credentials: 'include' }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to remove payment');
      }
      addToast({ type: 'success', message: 'Payment removed' });
      await loadHistory(selectedCommission.id);
      fetchCommissions();
    } catch (err: unknown) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to remove payment',
      });
    }
  };

  // ─── Export PDF ───
  const exportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Commissions Report', 14, 18);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 26);
      doc.text(`Total: ${fmt(totals.totalCommission)}  |  Pending: ${fmt(totals.pendingCommission)}  |  Paid: ${fmt(totals.paidCommission)}`, 14, 33);
      autoTable(doc, {
        startY: 40,
        head: [['Client', 'Sales Person', 'Deal Amount', 'Commission %', 'Amount', 'Status', 'Date']],
        body: commissions.map(c => [
          c.client.clientName, getSalesPerson(c), fmt(c.dealAmount),
          `${c.commissionPercentage}%`, fmt(c.commissionAmount),
          c.paidStatus, new Date(c.createdAt).toLocaleDateString('en-IN'),
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      doc.save(`commissions-${currentMonthKey()}.pdf`);
      addToast({ type: 'success', message: 'PDF downloaded' });
    } catch {
      addToast({ type: 'error', message: 'PDF export failed.' });
    }
  };

  // ─── Export Excel (exceljs — no vulnerabilities) ───
  const exportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();

      const ws = workbook.addWorksheet('Commissions');
      ws.columns = [
        { header: 'Client',                  key: 'client', width: 22 },
        { header: 'Sales Person',            key: 'sales',  width: 20 },
        { header: 'Deal Amount (₹)',         key: 'deal',   width: 18 },
        { header: 'Commission %',            key: 'pct',    width: 15 },
        { header: 'Commission Amount (₹)',   key: 'amount', width: 22 },
        { header: 'Status',                  key: 'status', width: 12 },
        { header: 'Payment Ref',             key: 'ref',    width: 22 },
        { header: 'Date',                    key: 'date',   width: 14 },
      ];
      ws.getRow(1).eachCell(cell => {
        cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      commissions.forEach(c => {
        ws.addRow({
          client: c.client.clientName, sales: getSalesPerson(c),
          deal: c.dealAmount, pct: c.commissionPercentage,
          amount: c.commissionAmount, status: c.paidStatus,
          ref: c.paymentReference || '',
          date: new Date(c.createdAt).toLocaleDateString('en-IN'),
        });
      });

      const ws2 = workbook.addWorksheet('Summary');
      ws2.columns = [
        { header: 'Metric', key: 'metric', width: 28 },
        { header: 'Value (₹)', key: 'value', width: 18 },
      ];
      ws2.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      });
      ws2.addRows([
        { metric: 'Total Commission',      value: totals.totalCommission },
        { metric: 'Pending Commission',    value: totals.pendingCommission },
        { metric: 'Paid Commission',       value: totals.paidCommission },
        { metric: 'Monthly Budget Target', value: budget.targetAmount },
      ]);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob   = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url; a.download = `commissions-${currentMonthKey()}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      addToast({ type: 'success', message: 'Excel downloaded' });
    } catch (err) {
      console.error(err);
      addToast({ type: 'error', message: 'Excel export failed.' });
    }
  };

  // ─── Derived ───
  const paidAmount      = totals.paidCommission;
  const budgetProgress  = budget.targetAmount > 0
    ? Math.min(Math.round((totals.totalCommission / budget.targetAmount) * 100), 100) : 0;
  const budgetRemaining = Math.max(budget.targetAmount - totals.totalCommission, 0);

  // Is the active window multi-month? Drives the chart mode and whether
  // we render the Monthly Breakdown table below the list.
  const isMultiMonth = (breakdown?.monthly.length ?? 0) >= 2;

  /**
   * Chart data.
   *   - ≥2 months in breakdown → month-over-month Paid+Pending stacked bars
   *   - otherwise             → simple Pending/Paid/Target summary
   * Memoized so Recharts keeps a stable identity across unrelated rerenders.
   */
  const chartData = useMemo(() => {
    if (isMultiMonth && breakdown) {
      return breakdown.monthly.map((m) => ({
        status: formatMonthShort(m.month),
        paid: m.paid,
        pending: m.pending,
        // Keep `amount` too so the old single-series bar still works if a
        // consumer (export, screenshot) reads it.
        amount: m.commission,
      }));
    }
    return [
      { status: 'Pending', amount: totals.pendingCommission, paid: 0, pending: totals.pendingCommission },
      { status: 'Paid',    amount: paidAmount,              paid: paidAmount, pending: 0 },
      ...(budget.targetAmount > 0 ? [{ status: 'Target', amount: budget.targetAmount, paid: 0, pending: 0 }] : []),
    ];
  }, [isMultiMonth, breakdown, totals.pendingCommission, paidAmount, budget.targetAmount]);

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all',     label: 'All'     },
    { key: 'Pending', label: 'Pending' },
    { key: 'Partial', label: 'Partial' },
    { key: 'Paid',    label: 'Paid'    },
  ];

  const TIME_PRESETS: { key: TimePreset; label: string }[] = [
    { key: 'all',        label: 'All time'     },
    { key: 'thisMonth',  label: 'This month'   },
    { key: 'lastMonth',  label: 'Last month'   },
    { key: 'thisQuarter',label: 'This quarter' },
    { key: 'thisFY',     label: 'This FY'      },
    { key: 'custom',     label: 'Custom…'      },
  ];

  /** Apply a preset and reset to first page. */
  const applyTimePreset = (key: TimePreset) => {
    setTimePreset(key);
    setPage(1);
    if (key !== 'custom') {
      setShowTimePicker(false);
      setCustomRange({ from: '', to: '' });
    }
  };

  /** Convenience: open the Record Payment modal for a commission. */
  const openRecordPayment = (c: Commission) => {
    setSelected(c);
    const remaining = Math.max(0, c.commissionAmount - (c.paidAmount ?? 0));
    setPaymentForm({
      ...emptyPaymentForm,
      amount: remaining > 0 ? String(remaining) : '',
    });
    setModalMode('recordPayment');
  };

  /** Convenience: open the Payment History modal and load rows. */
  const openHistory = (c: Commission) => {
    setSelected(c);
    setModalMode('history');
    loadHistory(c.id);
  };

  const computedCommission = form.dealAmount && form.commissionPercentage
    ? (Number(form.dealAmount) * Number(form.commissionPercentage)) / 100 : 0;

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">
            Commissions
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Track, manage and export all your earnings
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
              text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl
              hover:bg-emerald-100 transition-colors">
            <FileSpreadsheet size={15} />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
              text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors">
            <FileText size={15} />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button onClick={() => setModalMode('add')}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-semibold
              text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors">
            <Plus size={16} />
            <span>Add Payment</span>
          </button>
        </div>
      </div>

      {error && <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />}

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Commission"  value={fmt(totals.totalCommission)}  colorKey="blue"    icon={TrendingUp}  sub="All time" />
        <StatCard label="Pending Amount"    value={fmt(totals.pendingCommission)} colorKey="amber"   icon={Clock}       sub="Awaiting payment" />
        <StatCard label="Paid Amount"       value={fmt(paidAmount)}              colorKey="emerald" icon={CheckCircle2} sub="Collected" />
        <StatCard label="Monthly Target"    value={fmt(budget.targetAmount)}     colorKey="purple"  icon={Target}      sub={`${budgetProgress}% achieved`} />
      </div>

      {/* BUDGET + CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Wallet size={15} className="text-purple-500" />
                Monthly Budget
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <button onClick={() => setEditingBudget(v => !v)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700
                bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors">
              {editingBudget ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {editingBudget ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                <input type="number" value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)}
                  placeholder="Enter target amount"
                  className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-gray-800" />
              </div>
              <button onClick={saveBudget} disabled={savingBudget}
                className="px-3 py-2 text-sm font-semibold text-white bg-blue-600
                  hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-60">
                {savingBudget ? '...' : 'Save'}
              </button>
            </div>
          ) : (
            <div className="text-2xl font-bold text-purple-600">{fmt(budget.targetAmount)}</div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Progress</span>
              <span className="font-semibold text-gray-700">{budgetProgress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-700
                  ${budgetProgress >= 100 ? 'bg-emerald-500' :
                    budgetProgress >= 70  ? 'bg-blue-500'    :
                    budgetProgress >= 40  ? 'bg-amber-500'   : 'bg-red-400'}`}
                style={{ width: `${budgetProgress}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-blue-50 rounded-xl p-2.5">
                <p className="text-xs text-blue-500">Achieved</p>
                <p className="text-xs font-bold text-blue-700 mt-0.5">{fmt(totals.totalCommission)}</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-2.5">
                <p className="text-xs text-orange-500">Remaining</p>
                <p className="text-xs font-bold text-orange-700 mt-0.5">{fmt(budgetRemaining)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Commission Overview</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {isMultiMonth
                ? `Paid vs Pending · ${breakdown?.monthly.length ?? 0} months`
                : 'Pending · Paid · Target'}
            </p>
          </div>
          <ResponsiveContainer width="100%" height={isMultiMonth ? 220 : 180}>
            <BarChart data={chartData} barCategoryGap={isMultiMonth ? '20%' : '35%'}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              {isMultiMonth ? (
                <>
                  <Bar dataKey="paid"    stackId="m" name="Paid (₹)"    radius={[0, 0, 0, 0]} fill="#10b981" />
                  <Bar dataKey="pending" stackId="m" name="Pending (₹)" radius={[6, 6, 0, 0]} fill="#f59e0b" />
                </>
              ) : (
                <Bar dataKey="amount" name="Amount (₹)" radius={[6, 6, 0, 0]} fill="#3b82f6" />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* MONTHLY BREAKDOWN — admin-only, only when window spans >=2 months */}
      {isAdmin && isMultiMonth && breakdown && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Calendar size={14} className="text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-800">Monthly breakdown</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {breakdown.monthly.length} month{breakdown.monthly.length !== 1 ? 's' : ''} in {timeLabel}
                {breakdownLoading && <span className="ml-1.5 text-gray-300">· refreshing…</span>}
              </p>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Month','Deals','Revenue','Commission','Collected','Pending','Collection %'].map(h => (
                    <th key={h}
                      className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide
                        ${h === 'Month' ? 'text-left' : 'text-right'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {breakdown.monthly.map(m => {
                  const pct = m.commission > 0 ? Math.round((m.paid / m.commission) * 100) : 0;
                  return (
                    <tr key={m.month} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-800">{formatMonthShort(m.month)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{m.deals}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{fmt(m.revenue)}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{fmt(m.commission)}</td>
                      <td className="px-4 py-3 text-sm text-right text-emerald-600 font-semibold">{fmt(m.paid)}</td>
                      <td className="px-4 py-3 text-sm text-right text-orange-600 font-semibold">{fmt(m.pending)}</td>
                      <td className="px-4 py-3 text-xs text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-semibold
                          ${pct >= 80 ? 'bg-emerald-50 text-emerald-700'
                            : pct >= 40 ? 'bg-amber-50 text-amber-700'
                            :            'bg-red-50 text-red-600'}`}>
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row — pulled from the server's `totals` block
                    so rounding in the table cells can't drift. */}
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                  <td className="px-4 py-3 text-sm text-gray-900">Totals</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{breakdown.totals.deals}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{fmt(breakdown.totals.revenue)}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{fmt(breakdown.totals.commission)}</td>
                  <td className="px-4 py-3 text-sm text-right text-emerald-700">{fmt(breakdown.totals.paid)}</td>
                  <td className="px-4 py-3 text-sm text-right text-orange-700">{fmt(breakdown.totals.pending)}</td>
                  <td className="px-4 py-3 text-xs text-right text-gray-900">
                    {breakdown.totals.commission > 0
                      ? `${Math.round((breakdown.totals.paid / breakdown.totals.commission) * 100)}%`
                      : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {breakdown.monthly.map(m => {
              const pct = m.commission > 0 ? Math.round((m.paid / m.commission) * 100) : 0;
              return (
                <div key={m.month} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">{formatMonthShort(m.month)}</span>
                    <span className="text-xs text-gray-400">{m.deals} deal{m.deals !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-400">Revenue</p>
                      <p className="font-semibold text-gray-700">{fmt(m.revenue)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-400">Commission</p>
                      <p className="font-bold text-gray-900">{fmt(m.commission)}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2">
                      <p className="text-emerald-500">Collected</p>
                      <p className="font-bold text-emerald-700">{fmt(m.paid)}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2">
                      <p className="text-orange-500">Pending</p>
                      <p className="font-bold text-orange-700">{fmt(m.pending)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold
                      ${pct >= 80 ? 'bg-emerald-50 text-emerald-700'
                        : pct >= 40 ? 'bg-amber-50 text-amber-700'
                        :            'bg-red-50 text-red-600'}`}>
                      {pct}% collected
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PER-SALESPERSON BREAKDOWN — admin-only, collapsible */}
      {isAdmin && breakdown && breakdown.byPerformer.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button type="button"
            onClick={() => setShowPerformers(v => !v)}
            aria-expanded={showPerformers}
            className="w-full px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center gap-2
              hover:bg-gray-50/60 transition-colors text-left">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
              <TrendingUp size={14} className="text-purple-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-800">
                Salesperson breakdown{' '}
                <span className="text-xs text-gray-400 font-normal">({breakdown.byPerformer.length})</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Per-person rollup for {timeLabel}</p>
            </div>
            <ChevronRight
              size={16}
              className={`text-gray-400 transition-transform ${showPerformers ? 'rotate-90' : ''}`}
            />
          </button>

          {showPerformers && (
            <>
              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Salesperson','Deals','Revenue','Commission','Collected','Pending','Share %'].map(h => (
                        <th key={h}
                          className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide
                            ${h === 'Salesperson' ? 'text-left' : 'text-right'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {breakdown.byPerformer.map(p => {
                      const share = breakdown.totals.commission > 0
                        ? Math.round((p.commission / breakdown.totals.commission) * 100)
                        : 0;
                      return (
                        <tr key={`${p.userId ?? 'name'}-${p.name}`} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                            {p.name}
                            {!p.userId && (
                              <span className="ml-1.5 text-[10px] font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                name only
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{p.deals}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">{fmt(p.revenue)}</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{fmt(p.commission)}</td>
                          <td className="px-4 py-3 text-sm text-right text-emerald-600 font-semibold">{fmt(p.paid)}</td>
                          <td className="px-4 py-3 text-sm text-right text-orange-600 font-semibold">{fmt(p.pending)}</td>
                          <td className="px-4 py-3 text-xs text-right text-gray-600 font-semibold">{share}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="sm:hidden divide-y divide-gray-100">
                {breakdown.byPerformer.map(p => {
                  const share = breakdown.totals.commission > 0
                    ? Math.round((p.commission / breakdown.totals.commission) * 100)
                    : 0;
                  return (
                    <div key={`${p.userId ?? 'name'}-${p.name}`} className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900">{p.name}</span>
                        <span className="text-xs text-gray-500 font-semibold">{share}% share</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-gray-400">Deals · Revenue</p>
                          <p className="font-semibold text-gray-700">{p.deals} · {fmt(p.revenue)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-gray-400">Commission</p>
                          <p className="font-bold text-gray-900">{fmt(p.commission)}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-2">
                          <p className="text-emerald-500">Collected</p>
                          <p className="font-bold text-emerald-700">{fmt(p.paid)}</p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-2">
                          <p className="text-orange-500">Pending</p>
                          <p className="font-bold text-orange-700">{fmt(p.pending)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100
          flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-800">Commission Details</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {commissions.length} record{commissions.length !== 1 ? 's' : ''}
              {timePreset !== 'all' && (
                <span className="ml-1 text-gray-500">· {timeLabel}</span>
              )}
            </p>
          </div>

          {/* Search — debounced via `debouncedSearch`, so typing stays smooth */}
          <div className="relative w-full sm:w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search client..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl
                bg-gray-50 focus:bg-white focus:outline-none focus:ring-2
                focus:ring-blue-500/20 focus:border-blue-400 text-gray-700" />
          </div>

          {/* Time preset chip — opens a popover of accounting-period options.
              Uses a plain <details>-less approach so the dropdown can hold a
              custom date range without fighting focus. */}
          <div className="relative">
            <button type="button"
              onClick={() => setShowTimePicker(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                rounded-xl border transition-all
                ${timePreset !== 'all'
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
              <Calendar size={13} />
              {timeLabel}
              {timePreset !== 'all' && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Clear time filter"
                  onClick={(e) => { e.stopPropagation(); applyTimePreset('all'); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      applyTimePreset('all');
                    }
                  }}
                  className="ml-1 text-blue-400 hover:text-blue-700 cursor-pointer
                    rounded hover:bg-blue-100 px-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
                >
                  <X size={12} />
                </span>
              )}
            </button>
            {showTimePicker && (
              <>
                <button
                  type="button"
                  aria-label="Close time filter"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setShowTimePicker(false)}
                />
                <div className="absolute right-0 mt-1.5 z-50 w-60 bg-white border border-gray-100
                  rounded-xl shadow-xl p-2 space-y-1">
                  {TIME_PRESETS.map(({ key, label }) => (
                    <button key={key} type="button"
                      onClick={() => applyTimePreset(key)}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg
                        transition-colors ${
                          timePreset === key
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}>
                      {label}
                    </button>
                  ))}
                  {timePreset === 'custom' && (
                    <div className="border-t border-gray-100 pt-2 mt-1 space-y-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">From</label>
                        <input type="date"
                          value={customRange.from}
                          onChange={e => { setCustomRange({ ...customRange, from: e.target.value }); setPage(1); }}
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg
                            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">To</label>
                        <input type="date"
                          value={customRange.to}
                          onChange={e => { setCustomRange({ ...customRange, to: e.target.value }); setPage(1); }}
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg
                            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                      </div>
                      <button type="button"
                        onClick={() => setShowTimePicker(false)}
                        className="w-full px-3 py-1.5 text-xs font-semibold text-white bg-blue-600
                          hover:bg-blue-700 rounded-lg transition-colors">
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Payment-status chips */}
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl w-fit shrink-0 overflow-x-auto">
            {FILTERS.map(({ key, label }) => (
              <button key={key} onClick={() => { setFilter(key); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap
                  ${filter === key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 sm:py-16">
            <Loader size="md" message="Loading commissions..." />
          </div>
        ) : commissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
              <IndianRupee size={24} className="text-gray-300" />
            </div>
            <p className="text-gray-400 text-sm font-medium">No commissions found</p>
            <button onClick={() => setModalMode('add')}
              className="text-xs text-blue-600 hover:underline font-semibold">
              + Add first commission
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Client','Sales Person','Deal Amount','Comm %','Amount','Status','Date','Actions'].map(h => (
                      <th key={h}
                        className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide
                          ${['Deal Amount','Comm %','Amount'].includes(h) ? 'text-right' : 'text-left'}
                          ${['Status','Actions'].includes(h) ? 'text-center' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {commissions.map(c => {
                    const paid = c.paidAmount ?? 0;
                    const remaining = Math.max(0, c.commissionAmount - paid);
                    const isFullyPaid = c.paidStatus === 'Paid';
                    return (
                      <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3.5 text-sm font-semibold text-gray-800">{c.client.clientName}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-600">{getSalesPerson(c)}</td>
                        <td className="px-4 py-3.5 text-sm text-right text-gray-700">{fmt(c.dealAmount)}</td>
                        <td className="px-4 py-3.5 text-sm text-right text-gray-700">{c.commissionPercentage}%</td>
                        <td className="px-4 py-3.5 text-sm text-right font-bold text-gray-900">
                          <div>{fmt(c.commissionAmount)}</div>
                          {paid > 0 && !isFullyPaid && (
                            <div className="text-xs font-medium text-orange-600 mt-0.5">
                              Paid {fmt(paid)} · {fmt(remaining)} left
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center"><StatusBadge status={c.paidStatus} /></td>
                        <td className="px-4 py-3.5 text-xs text-gray-400">
                          {new Date(c.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {isAdmin && (
                              <button onClick={() => openEdit(c)}
                                title="Edit commission (admin only)"
                                className="w-7 h-7 rounded-lg border border-gray-200 bg-white
                                  flex items-center justify-center text-gray-400 hover:text-blue-600
                                  hover:border-blue-200 transition-colors">
                                <Pencil size={12} />
                              </button>
                            )}
                            <button onClick={() => openHistory(c)}
                              title="Payment history"
                              className="w-7 h-7 rounded-lg border border-gray-200 bg-white
                                flex items-center justify-center text-gray-400 hover:text-purple-600
                                hover:border-purple-200 transition-colors">
                              <History size={12} />
                            </button>
                            {!isFullyPaid && (
                              <button onClick={() => openRecordPayment(c)}
                                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700
                                  border border-emerald-200 bg-emerald-50 hover:bg-emerald-100
                                  px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap">
                                Record Payment
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {commissions.map(c => {
                const paid = c.paidAmount ?? 0;
                const remaining = Math.max(0, c.commissionAmount - paid);
                const isFullyPaid = c.paidStatus === 'Paid';
                const isPartial   = c.paidStatus === 'Partial';
                return (
                  <div key={c.id} className="px-4 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{c.client.clientName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{getSalesPerson(c)}</p>
                        <p className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString('en-IN')}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <StatusBadge status={c.paidStatus} />
                        <p className="text-sm font-bold text-gray-900">{fmt(c.commissionAmount)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-gray-50 rounded-xl p-2.5">
                        <p className="text-xs text-gray-400">Deal</p>
                        <p className="text-xs font-bold text-gray-700 mt-0.5">{fmt(c.dealAmount)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-2.5">
                        <p className="text-xs text-gray-400">Rate</p>
                        <p className="text-xs font-bold text-gray-700 mt-0.5">{c.commissionPercentage}%</p>
                      </div>
                      {isPartial ? (
                        <div className="bg-orange-50 rounded-xl p-2.5">
                          <p className="text-xs text-orange-500">Remaining</p>
                          <p className="text-xs font-bold text-orange-700 mt-0.5">{fmt(remaining)}</p>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 rounded-xl p-2.5">
                          <p className="text-xs text-emerald-500">{isFullyPaid ? 'Paid' : 'Earned'}</p>
                          <p className="text-xs font-bold text-emerald-700 mt-0.5">
                            {fmt(isFullyPaid ? paid : c.commissionAmount)}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isAdmin && (
                        <button onClick={() => openEdit(c)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs
                            font-semibold text-gray-600 border border-gray-200 bg-gray-50
                            hover:bg-gray-100 rounded-xl transition-colors">
                          <Pencil size={11} /> Edit
                        </button>
                      )}
                      <button onClick={() => openHistory(c)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs
                          font-semibold text-purple-600 border border-purple-200 bg-purple-50
                          hover:bg-purple-100 rounded-xl transition-colors">
                        <History size={11} /> History
                      </button>
                      {!isFullyPaid && (
                        <button onClick={() => openRecordPayment(c)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs
                            font-semibold text-emerald-600 border border-emerald-200 bg-emerald-50
                            hover:bg-emerald-100 rounded-xl transition-colors">
                          Record Payment <ChevronRight size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-gray-100">
                <Pagination currentPage={page} totalPages={totalPages}
                  onPageChange={setPage} isLoading={loading} />
              </div>
            )}
          </>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center
          justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  {modalMode === 'add' ? 'Add New Payment' : 'Edit Commission'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {modalMode === 'add' ? 'Record a new commission entry' : 'Update commission details'}
                </p>
              </div>
              <button onClick={closeModal}
                className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center
                  justify-center text-gray-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 sm:px-6 py-5 space-y-4">
              {modalMode === 'add' && (
                <div>
                  <label htmlFor="client-select" className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Client <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="client-select"
                    aria-label="Select client"
                    value={form.clientId}
                    onChange={e => setForm({ ...form, clientId: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                      bg-white text-gray-800">
                    <option value="">Select client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.clientName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Sales Person <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <input type="text" value={form.salesPersonName}
                  onChange={e => setForm({ ...form, salesPersonName: e.target.value })}
                  placeholder="Enter sales person name..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                    text-gray-800 placeholder:text-gray-400" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Deal Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input type="number" value={form.dealAmount}
                      onChange={e => setForm({ ...form, dealAmount: e.target.value })}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2.5 text-sm border border-gray-200
                        rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20
                        focus:border-blue-400 text-gray-800" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Commission %</label>
                  <div className="relative">
                    <input type="number" value={form.commissionPercentage}
                      onChange={e => setForm({ ...form, commissionPercentage: e.target.value })}
                      placeholder="5" min="0" max="100" step="0.5"
                      className="w-full px-3 pr-7 py-2.5 text-sm border border-gray-200
                        rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20
                        focus:border-blue-400 text-gray-800" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
              </div>

              {computedCommission > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3
                  flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-600">Commission Amount</span>
                  <span className="text-base font-bold text-emerald-700">{fmt(computedCommission)}</span>
                </div>
              )}

              {/* Payment status is derived from the ledger, not an input. In
                  ADD mode we let the broker optionally log the first payment
                  right here so "closed deal + received token money" is one
                  submit. In EDIT mode we hide this — payments are managed
                  via the History modal, one source of truth per concern. */}
              {modalMode === 'add' ? (() => {
                const initialAmt = Number(form.initialAmount) || 0;
                const half       = Math.max(0, Math.round(computedCommission / 2));
                const willBeFull = initialAmt + 0.005 >= computedCommission && initialAmt > 0 && computedCommission > 0;
                const overMax    = computedCommission > 0 && initialAmt > computedCommission + 0.005;

                return (
                  <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Wallet2 size={14} className="text-emerald-500" />
                        <h4 className="text-sm font-semibold text-gray-800">
                          Initial payment{' '}
                          <span className="text-xs text-gray-400 font-normal">(optional)</span>
                        </h4>
                      </div>
                      {initialAmt > 0 && (
                        <button type="button"
                          onClick={() => setForm({ ...form, initialAmount: '' })}
                          className="text-[11px] font-semibold text-gray-500 hover:text-gray-700
                            bg-white border border-gray-200 hover:bg-gray-50 px-2 py-0.5 rounded-md transition-colors">
                          Clear
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Amount received (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                        <input type="number" min="0" step="0.01"
                          value={form.initialAmount}
                          onChange={e => setForm({ ...form, initialAmount: e.target.value })}
                          placeholder="0"
                          className="w-full pl-7 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl
                            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                            bg-white text-gray-800" />
                      </div>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        <button type="button"
                          onClick={() => setForm({ ...form, initialAmount: '' })}
                          className="text-[11px] font-semibold text-gray-600 bg-white border border-gray-200
                            hover:bg-gray-50 px-2 py-1 rounded-lg transition-colors">
                          None
                        </button>
                        <button type="button"
                          disabled={computedCommission <= 0}
                          onClick={() => setForm({ ...form, initialAmount: String(half) })}
                          className="text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100
                            px-2 py-1 rounded-lg transition-colors disabled:opacity-50">
                          Half ({fmt(half)})
                        </button>
                        <button type="button"
                          disabled={computedCommission <= 0}
                          onClick={() => setForm({ ...form, initialAmount: String(computedCommission) })}
                          className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100
                            px-2 py-1 rounded-lg transition-colors disabled:opacity-50">
                          Full ({fmt(computedCommission)})
                        </button>
                      </div>
                      {overMax && (
                        <p className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
                          <X size={12} /> Cannot exceed commission amount ({fmt(computedCommission)}).
                        </p>
                      )}
                      {willBeFull && !overMax && (
                        <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Will be created as fully Paid.
                        </p>
                      )}
                    </div>

                    {/* Only show payment meta when an amount has been entered —
                        avoids cluttering the form for "no advance" case. */}
                    {initialAmt > 0 && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Paid on</label>
                            <input type="date"
                              value={form.initialPaidOn}
                              onChange={e => setForm({ ...form, initialPaidOn: e.target.value })}
                              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                                bg-white text-gray-800" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Method</label>
                            <select
                              value={form.initialMethod}
                              onChange={e => setForm({ ...form, initialMethod: e.target.value })}
                              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                                bg-white text-gray-800">
                              {PAYMENT_METHODS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            Reference <span className="text-gray-400 font-normal ml-1">(optional)</span>
                          </label>
                          <input type="text"
                            value={form.initialReference}
                            onChange={e => setForm({ ...form, initialReference: e.target.value })}
                            placeholder="Cheque no., UPI Ref, Transaction ID…"
                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                              text-gray-800 placeholder:text-gray-400" />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            Notes <span className="text-gray-400 font-normal ml-1">(optional)</span>
                          </label>
                          <textarea
                            value={form.initialNotes}
                            onChange={e => setForm({ ...form, initialNotes: e.target.value })}
                            rows={2}
                            placeholder="Any context about this payment…"
                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                              text-gray-800 placeholder:text-gray-400" />
                        </div>
                      </>
                    )}

                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Leave Amount at 0 if nothing&apos;s been collected yet. Later instalments
                      are recorded via the <strong>Record Payment</strong> button on the row.
                    </p>
                  </div>
                );
              })() : (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex items-start gap-2">
                  <Wallet2 size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-500">
                    Payment status is tracked from the payment ledger. Use{' '}
                    <strong>Record Payment</strong> on the commission row to log a new
                    instalment, or <strong>History</strong> to review / remove past entries.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Payment Reference <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <input type="text" value={form.paymentReference}
                  onChange={e => setForm({ ...form, paymentReference: e.target.value })}
                  placeholder="Cheque no., UPI Ref, Transaction ID..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20
                    focus:border-blue-400 text-gray-800 placeholder:text-gray-400" />
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={closeModal}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border
                  border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={modalMode === 'add' ? handleAdd : handleEdit}
                disabled={
                  submitting ||
                  (modalMode === 'add' &&
                    computedCommission > 0 &&
                    Number(form.initialAmount || 0) > computedCommission + 0.005)
                }
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600
                  hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-60
                  disabled:cursor-not-allowed">
                {submitting ? 'Saving...' : modalMode === 'add' ? 'Add Commission' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {modalMode === 'recordPayment' && selectedCommission && (() => {
        const paid      = selectedCommission.paidAmount ?? 0;
        const remaining = Math.max(0, selectedCommission.commissionAmount - paid);
        const entered   = Number(paymentForm.amount) || 0;
        const willBeFull = entered + 0.005 >= remaining && entered > 0;
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center
            justify-center p-3 sm:p-6">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Record Payment</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedCommission.client.clientName} · {getSalesPerson(selectedCommission)}
                  </p>
                </div>
                <button onClick={closeModal}
                  className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center
                    justify-center text-gray-500 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-5 space-y-4">
                {/* Balance summary */}
                <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-gray-400">Total</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{fmt(selectedCommission.commissionAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-500">Paid so far</p>
                    <p className="text-sm font-bold text-emerald-700 mt-0.5">{fmt(paid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-orange-500">Remaining</p>
                    <p className="text-sm font-bold text-orange-700 mt-0.5">{fmt(remaining)}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Amount received (₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input type="number" min="0" step="0.01" max={remaining}
                      value={paymentForm.amount}
                      onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl
                        focus:outline-none focus:ring-2 focus:ring-blue-500/20
                        focus:border-blue-400 text-gray-800" />
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button type="button"
                      onClick={() => setPaymentForm({ ...paymentForm, amount: String(remaining) })}
                      className="text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100
                        px-2 py-1 rounded-lg transition-colors">
                      Full remaining
                    </button>
                    <button type="button"
                      onClick={() => setPaymentForm({ ...paymentForm, amount: String(Math.round(remaining / 2)) })}
                      className="text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100
                        px-2 py-1 rounded-lg transition-colors">
                      Half
                    </button>
                  </div>
                  {willBeFull && (
                    <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
                      <CheckCircle2 size={12} /> This payment will fully settle the commission.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Paid on <span className="text-red-500">*</span>
                    </label>
                    <input type="date"
                      value={paymentForm.paidOn}
                      onChange={e => setPaymentForm({ ...paymentForm, paidOn: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                        focus:outline-none focus:ring-2 focus:ring-blue-500/20
                        focus:border-blue-400 text-gray-800" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Method</label>
                    <select
                      value={paymentForm.method}
                      onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                        focus:outline-none focus:ring-2 focus:ring-blue-500/20
                        focus:border-blue-400 bg-white text-gray-800">
                      {PAYMENT_METHODS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Reference <span className="text-gray-400 font-normal ml-1">(optional)</span>
                  </label>
                  <input type="text"
                    value={paymentForm.reference}
                    onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                    placeholder="Cheque no., UPI Ref, Transaction ID…"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20
                      focus:border-blue-400 text-gray-800 placeholder:text-gray-400" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Notes <span className="text-gray-400 font-normal ml-1">(optional)</span>
                  </label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    rows={2}
                    placeholder="Any context about this payment…"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20
                      focus:border-blue-400 text-gray-800 placeholder:text-gray-400" />
                </div>
              </div>

              <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
                <button onClick={closeModal}
                  className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border
                    border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleRecordPayment}
                  disabled={submitting || !entered || entered <= 0 || entered > remaining + 0.005}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600
                    hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-60
                    disabled:cursor-not-allowed">
                  {submitting ? 'Saving...' : willBeFull ? 'Settle & mark Paid' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PAYMENT HISTORY MODAL */}
      {modalMode === 'history' && selectedCommission && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center
          justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <History size={16} className="text-purple-500" />
                  Payment History
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedCommission.client.clientName} · {fmt(selectedCommission.commissionAmount)} total
                </p>
              </div>
              <button onClick={closeModal}
                className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center
                  justify-center text-gray-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Running balance */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400">Total</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">
                    {fmt(selectedCommission.commissionAmount)}
                  </p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-[11px] text-emerald-500">Paid</p>
                  <p className="text-sm font-bold text-emerald-700 mt-0.5">
                    {fmt(selectedCommission.paidAmount ?? 0)}
                  </p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3">
                  <p className="text-[11px] text-orange-500">Remaining</p>
                  <p className="text-sm font-bold text-orange-700 mt-0.5">
                    {fmt(Math.max(0, selectedCommission.commissionAmount - (selectedCommission.paidAmount ?? 0)))}
                  </p>
                </div>
              </div>

              {/* Payment list */}
              {historyLoading ? (
                <div className="flex items-center justify-center py-10 text-gray-400">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="ml-2 text-sm">Loading payments…</span>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet2 size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No payments recorded yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                  {history.map(p => (
                    <li key={p.id} className="px-3 py-3 flex items-start gap-3 bg-white">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <IndianRupee size={14} className="text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-gray-900">{fmt(p.amount)}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(p.paidOn).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                          {p.method && (
                            <span className="capitalize">
                              {PAYMENT_METHODS.find(m => m.value === p.method)?.label ?? p.method}
                            </span>
                          )}
                          {p.reference && <span>Ref: {p.reference}</span>}
                          {p.recorder?.name && <span>by {p.recorder.name}</span>}
                        </div>
                        {p.notes && (
                          <p className="text-xs text-gray-500 mt-1 italic">&ldquo;{p.notes}&rdquo;</p>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => deletePayment(p.id)}
                          title="Remove this payment (admin only)"
                          className="w-7 h-7 rounded-lg border border-gray-200 bg-white
                            flex items-center justify-center text-gray-400 hover:text-red-600
                            hover:border-red-200 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={closeModal}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border
                  border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Close
              </button>
              {selectedCommission.paidStatus !== 'Paid' && (
                <button
                  onClick={() => openRecordPayment(selectedCommission)}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600
                    hover:bg-emerald-700 rounded-xl transition-colors">
                  + Record Payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}