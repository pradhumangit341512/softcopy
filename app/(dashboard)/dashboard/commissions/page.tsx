'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
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
  FileText, X, Target,
  Search, Wallet, Settings2,
  Users2, Building2,
  Calendar,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import type { CustomTooltipProps } from '@/lib/utils';
import { ManageDealModal, type ManagedCommission } from '@/components/commissions/ManageDealModal';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface Commission {
  id: string;
  clientId: string;
  client: { clientName: string; phone?: string };
  user?: { name: string } | null;
  salesPersonName?: string | null;
  builderName?: string | null;
  dealAmount: number;
  /** Phase-1 buyer→builder ledger summary (denormalized on the Commission row). */
  dealAmountPaid?: number;
  dealStatus?: string; // 'Open' | 'InProgress' | 'Completed'
  commissionPercentage: number;
  commissionAmount: number;
  /** Running total from the commission payment ledger. 0 = Pending, < full = Partial, >= full = Paid. */
  paidAmount: number;
  paidStatus: string; // 'Pending' | 'Partial' | 'Paid'
  createdAt: string;
  paymentReference?: string;
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

interface MonthlyBudget {
  id?: string;
  month: string;
  targetAmount: number;
}

type FilterType = 'all' | 'Pending' | 'Partial' | 'Paid';

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

/**
 * Tooltip used by the Commission Overview chart.
 *
 * Renders ALL payload entries — required for the multi-month stacked-bar
 * mode where each bar carries both `paid` and `pending` series. Showing
 * only payload[0] (the previous behaviour) silently dropped the pending
 * value, so users saw a stacked bar but only the bottom number on hover.
 *
 * Single-bar mode (Pending / Paid / Target) still works because there's
 * always exactly one entry in the payload — we just render the same row
 * shape for it.
 */
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;

  // Total across stacked series — useful in multi-month mode so users
  // can see the combined commission for the month at a glance.
  const total = payload.reduce(
    (acc, entry) => acc + (Number(entry?.value) || 0),
    0
  );
  const showTotal = payload.length > 1;

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 min-w-[160px]">
      <p className="text-xs font-semibold text-gray-500 mb-1.5">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={`${entry.name}-${i}`} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-500 truncate">{entry.name}</span>
            <span className="ml-auto font-bold text-gray-800">
              {fmt(Number(entry.value) || 0)}
            </span>
          </div>
        ))}
        {showTotal && (
          <div className="flex items-center gap-2 pt-1 mt-1 border-t border-gray-100 text-xs">
            <span className="text-gray-500">Total</span>
            <span className="ml-auto font-bold text-gray-900">{fmt(total)}</span>
          </div>
        )}
      </div>
    </div>
  );
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

  // Time filter — explicit (from, to) date range only. Both bounds are sent
  // to the API as YYYY-MM-DD; the server treats `to` as inclusive up to
  // end-of-day. Empty strings mean "no bound on that side".
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const hasDateRange = Boolean(dateRange.from || dateRange.to);

  const [budget, setBudget]               = useState<MonthlyBudget>({ month: currentMonthKey(), targetAmount: 0 });
  const [budgetInput, setBudgetInput]     = useState('');
  const [editingBudget, setEditingBudget] = useState(false);
  const [savingBudget, setSavingBudget]   = useState(false);

  // The merged "Manage Deal" modal replaces the legacy Add / Edit / Record
  // Payment / History quartet. It owns its own form state, payment-ledger
  // fetch, and submit logic — this page only tracks open/mode/target and
  // refetches on `onChanged`.
  const [manageState, setManageState] = useState<{
    open: boolean;
    mode: 'add' | 'manage';
    target: Commission | null;
  }>({ open: false, mode: 'add', target: null });

  // Admin-only monthly + per-salesperson breakdown for the selected window.
  const [breakdown, setBreakdown]             = useState<BreakdownResponse | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [showPerformers, setShowPerformers]   = useState(false);

  const openAdd = () =>
    setManageState({ open: true, mode: 'add', target: null });

  const openManage = (c: Commission) =>
    setManageState({ open: true, mode: 'manage', target: c });

  const closeManage = () =>
    setManageState((s) => ({ ...s, open: false }));

  // Debounced copy of `search` — keeps typing snappy by issuing one fetch
  // per ~250ms of idle instead of one per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Human label for the active date range — shown on the Date chip.
  const timeLabel = useMemo(() => {
    const { from, to } = dateRange;
    if (from && to) return `${from} → ${to}`;
    if (from)       return `From ${from}`;
    if (to)         return `Until ${to}`;
    return 'Date range';
  }, [dateRange]);

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
  useEffect(() => { fetchBudget(); }, []);

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

  /**
   * Pull every commission that matches the current filter, search, and
   * date range — paginating through the API at its max page size of 100.
   * Used by the Excel and PDF exports so the file reflects the whole
   * window the admin selected, not just the visible page of 10 rows.
   */
  const fetchAllCommissionsForExport = async (): Promise<Commission[]> => {
    const PAGE_SIZE = 100;
    const collected: Commission[] = [];
    let pageNum = 1;
    let pages = 1;
    do {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_SIZE),
        ...(filter !== 'all' && { paidStatus: filter }),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(dateRange.from && { from: dateRange.from }),
        ...(dateRange.to   && { to:   dateRange.to   }),
      });
      const res = await fetch(`/api/commissions?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch commissions for export');
      const data = await res.json();
      collected.push(...(data.commissions || []));
      pages = data.pagination?.pages || 1;
      pageNum += 1;
    } while (pageNum <= pages);
    return collected;
  };

  /** Filename suffix that reflects the active date window. */
  const exportSuffix = () => {
    const { from, to } = dateRange;
    if (from && to) return `${from}_to_${to}`;
    if (from)       return `from_${from}`;
    if (to)         return `until_${to}`;
    return currentMonthKey();
  };

  // ─── Export PDF ───
  const exportPDF = async () => {
    try {
      const rows = await fetchAllCommissionsForExport();
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Commissions Report', 14, 18);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 26);
      doc.text(`Range: ${hasDateRange ? timeLabel : 'All time'}  |  Records: ${rows.length}`, 14, 33);
      doc.text(`Total: ${fmt(totals.totalCommission)}  |  Pending: ${fmt(totals.pendingCommission)}  |  Paid: ${fmt(totals.paidCommission)}`, 14, 40);
      autoTable(doc, {
        startY: 47,
        head: [['Client', 'Sales Person', 'Deal Amount', 'Commission %', 'Amount', 'Status', 'Date']],
        body: rows.map(c => [
          c.client.clientName, getSalesPerson(c), fmt(c.dealAmount),
          `${c.commissionPercentage}%`, fmt(c.commissionAmount),
          c.paidStatus, new Date(c.createdAt).toLocaleDateString('en-IN'),
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      doc.save(`commissions-${exportSuffix()}.pdf`);
      addToast({ type: 'success', message: `PDF downloaded (${rows.length} records)` });
    } catch {
      addToast({ type: 'error', message: 'PDF export failed.' });
    }
  };

  // ─── Export Excel (exceljs — no vulnerabilities) ───
  const exportExcel = async () => {
    try {
      const rows = await fetchAllCommissionsForExport();
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
      rows.forEach(c => {
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
        { header: 'Value', key: 'value', width: 28 },
      ];
      ws2.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      });
      ws2.addRows([
        { metric: 'Date Range',            value: hasDateRange ? timeLabel : 'All time' },
        { metric: 'Records',               value: rows.length },
        { metric: 'Total Commission (₹)',  value: totals.totalCommission },
        { metric: 'Pending Commission (₹)',value: totals.pendingCommission },
        { metric: 'Paid Commission (₹)',   value: totals.paidCommission },
        { metric: 'Monthly Budget (₹)',    value: budget.targetAmount },
      ]);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob   = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url; a.download = `commissions-${exportSuffix()}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      addToast({ type: 'success', message: `Excel downloaded (${rows.length} records)` });
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
   * Numeric fields are coerced through `Number(x) || 0` so a missing/NaN
   * value from the backend can't blow the chart up with `null` ticks.
   */
  const chartData = useMemo(() => {
    if (isMultiMonth && breakdown) {
      return breakdown.monthly.map((m) => ({
        status: formatMonthShort(m.month),
        paid: Number(m.paid) || 0,
        pending: Number(m.pending) || 0,
        // Keep `amount` too so the old single-series bar still works if a
        // consumer (export, screenshot) reads it.
        amount: Number(m.commission) || 0,
      }));
    }
    return [
      {
        status: 'Pending',
        amount: Number(totals.pendingCommission) || 0,
        paid: 0,
        pending: Number(totals.pendingCommission) || 0,
      },
      {
        status: 'Paid',
        amount: Number(paidAmount) || 0,
        paid: Number(paidAmount) || 0,
        pending: 0,
      },
      ...(budget.targetAmount > 0
        ? [{
            status: 'Target',
            amount: Number(budget.targetAmount) || 0,
            paid: 0,
            pending: 0,
          }]
        : []),
    ];
  }, [isMultiMonth, breakdown, totals.pendingCommission, paidAmount, budget.targetAmount]);

  // Used to show an empty-state instead of an axes-only blank chart when
  // there's nothing to plot. We sum the numeric series across rows.
  const chartHasValue = useMemo(
    () => chartData.some((d) => (d.paid || 0) + (d.pending || 0) + (d.amount || 0) > 0),
    [chartData]
  );

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all',     label: 'All'     },
    { key: 'Pending', label: 'Pending' },
    { key: 'Partial', label: 'Partial' },
    { key: 'Paid',    label: 'Paid'    },
  ];

  /** Update one side of the date range and reset to the first page. */
  const updateDateRange = (patch: Partial<{ from: string; to: string }>) => {
    setDateRange(prev => ({ ...prev, ...patch }));
    setPage(1);
  };

  /** Wipe the date range and close the picker. */
  const clearDateRange = () => {
    setDateRange({ from: '', to: '' });
    setShowTimePicker(false);
    setPage(1);
  };

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
          {isAdmin && (
            <>
              <Link href="/dashboard/commissions/statement"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                  text-purple-700 bg-purple-50 border border-purple-200 rounded-xl
                  hover:bg-purple-100 transition-colors">
                <Users2 size={15} />
                <span className="hidden sm:inline">Statement</span>
              </Link>
              <Link href="/dashboard/commissions/by-builder"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                  text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl
                  hover:bg-indigo-100 transition-colors">
                <Building2 size={15} />
                <span className="hidden sm:inline">By Builder</span>
              </Link>
            </>
          )}
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
          {isAdmin && (
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-semibold
                text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors">
              <Plus size={16} />
              <span>Add Payment</span>
            </button>
          )}
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
          {chartHasValue ? (
            <ResponsiveContainer width="100%" height={isMultiMonth ? 220 : 180}>
              <BarChart
                data={chartData}
                barCategoryGap={isMultiMonth ? '20%' : '35%'}
                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="status"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  // Compact INR formatter: ₹0 → ₹999, ₹1k → ₹999k, ₹1L → ₹999L, ₹1Cr+
                  // Keeps Y-axis labels short on narrow screens without
                  // losing the order of magnitude.
                  tickFormatter={(v) => {
                    const n = Math.abs(Number(v) || 0);
                    if (n >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
                    if (n >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
                    if (n >= 1e3) return `₹${(v / 1e3).toFixed(0)}k`;
                    return `₹${v}`;
                  }}
                />
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
          ) : (
            <div
              className="flex items-center justify-center text-center text-xs text-gray-400"
              style={{ height: isMultiMonth ? 220 : 180 }}
            >
              No commission activity in the selected window yet.
            </div>
          )}
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

        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 space-y-3">
          {/* Title row */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-800">Commission Details</h3>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {commissions.length} record{commissions.length !== 1 ? 's' : ''}
                {hasDateRange && (
                  <span className="ml-1 text-gray-500">· {timeLabel}</span>
                )}
              </p>
            </div>
          </div>

          {/* Controls row — wraps cleanly so the date chip never gets
              clipped behind the status pills when both are active. */}
          <div className="flex flex-wrap items-center gap-2">

            {/* Search — debounced via `debouncedSearch`, so typing stays smooth */}
            <div className="relative w-full sm:w-52 sm:flex-1 sm:max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input type="text" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search lead..."
                aria-label="Search by lead name"
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl
                  bg-gray-50 focus:bg-white focus:outline-none focus:ring-2
                  focus:ring-blue-500/20 focus:border-blue-400 text-gray-700" />
            </div>

            {/* Date-range chip — opens a popover with only From / To inputs.
                No presets; admins pick the exact window they want and the
                list, totals, breakdown, and exports all follow it. */}
            <div className="relative">
              <button type="button"
                onClick={() => setShowTimePicker(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold
                  rounded-xl border transition-all
                  ${hasDateRange
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                <Calendar size={13} />
                <span className="truncate max-w-[200px]">{timeLabel}</span>
                {hasDateRange && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Clear date range"
                    onClick={(e) => { e.stopPropagation(); clearDateRange(); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        clearDateRange();
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
                    aria-label="Close date picker"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setShowTimePicker(false)}
                  />
                  <div className="absolute right-0 mt-1.5 z-50 w-72 max-w-[calc(100vw-2rem)]
                    bg-white border border-gray-100 rounded-xl shadow-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-700">Pick a date range</p>
                    <div>
                      <label htmlFor="commissions-from-date"
                        className="block text-xs font-medium text-gray-600 mb-1">From date</label>
                      <input id="commissions-from-date" type="date"
                        value={dateRange.from}
                        max={dateRange.to || undefined}
                        onChange={e => updateDateRange({ from: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-gray-800" />
                    </div>
                    <div>
                      <label htmlFor="commissions-to-date"
                        className="block text-xs font-medium text-gray-600 mb-1">To date</label>
                      <input id="commissions-to-date" type="date"
                        value={dateRange.to}
                        min={dateRange.from || undefined}
                        onChange={e => updateDateRange({ to: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-gray-800" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="button"
                        onClick={clearDateRange}
                        className="flex-1 px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50
                          hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors">
                        Clear
                      </button>
                      <button type="button"
                        onClick={() => setShowTimePicker(false)}
                        className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-blue-600
                          hover:bg-blue-700 rounded-lg transition-colors">
                        Apply
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Payment-status chips */}
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl w-fit overflow-x-auto ml-auto">
              {FILTERS.map(({ key, label }) => (
                <button key={key} type="button" onClick={() => { setFilter(key); setPage(1); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap
                    ${filter === key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>
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
            {isAdmin && (
              <button onClick={openAdd}
                className="text-xs text-blue-600 hover:underline font-semibold">
                + Add first commission
              </button>
            )}
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
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => openManage(c)}
                              title="Manage deal — edit details, record payments, view history"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold
                                text-blue-700 hover:text-blue-800 border border-blue-200
                                bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg
                                transition-colors whitespace-nowrap"
                            >
                              <Settings2 size={12} />
                              Manage
                            </button>
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
                    <button
                      onClick={() => openManage(c)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm
                        font-semibold text-blue-700 border border-blue-200 bg-blue-50
                        hover:bg-blue-100 rounded-xl transition-colors"
                    >
                      <Settings2 size={13} /> Manage
                    </button>
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

      <ManageDealModal
        open={manageState.open}
        mode={manageState.mode}
        commission={manageState.target as ManagedCommission | null}
        isAdmin={isAdmin}
        onClose={closeManage}
        onChanged={fetchCommissions}
      />
    </div>
  );
}