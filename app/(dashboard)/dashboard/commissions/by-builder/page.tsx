'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, Calendar, Loader2, Building2, TrendingUp,
  CheckCircle2, Wallet, Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Loader } from '@/components/common/Loader';
import { useToast } from '@/components/common/Toast';

const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

interface BuilderRow {
  builder: string;
  deals: number;
  dealAmount: number;
  dealAmountPaid: number;
  commissionAmount: number;
  paidAmount: number;
  openDeals: number;
  completedDeals: number;
  unpaidCommissions: number;
}

interface BuilderResponse {
  rows: BuilderRow[];
  totals: {
    deals: number;
    dealAmount: number;
    dealAmountPaid: number;
    commissionAmount: number;
    paidAmount: number;
  };
}

type TimePreset = 'all' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisFY' | 'custom';

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Builder-wise rollup. Each builder is a row with dealsCount, total deal ₹,
 * deal received so far, total commission, and commission collected.
 *
 * Admin-only — same as the per-broker statement.
 */
export default function ByBuilderPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [timePreset, setTimePreset] = useState<TimePreset>('thisFY');
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({
    from: '', to: '',
  });

  const [rows, setRows] = useState<BuilderRow[]>([]);
  const [totals, setTotals] = useState<BuilderResponse['totals']>({
    deals: 0, dealAmount: 0, dealAmountPaid: 0, commissionAmount: 0, paidAmount: 0,
  });
  const [loading, setLoading] = useState(false);

  const dateRange = useMemo<{ from?: string; to?: string }>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const startOfMonth = (yy: number, mm: number) => new Date(yy, mm, 1);
    const endOfMonth   = (yy: number, mm: number) => new Date(yy, mm + 1, 0);

    switch (timePreset) {
      case 'all': return {};
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
        const fyStartYear = m >= 3 ? y : y - 1;
        return { from: `${fyStartYear}-04-01`, to: `${fyStartYear + 1}-03-31` };
      }
      case 'custom':
        return { from: customRange.from || undefined, to: customRange.to || undefined };
      default:
        return {};
    }
  }, [timePreset, customRange]);

  const fetchRollup = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('from', dateRange.from);
      if (dateRange.to) params.set('to', dateRange.to);
      const res = await fetch(`/api/commissions/by-builder?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load builder rollup');
      const data: BuilderResponse = await res.json();
      setRows(data.rows ?? []);
      setTotals(data.totals);
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load builder rollup',
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, dateRange.from, dateRange.to, addToast]);

  useEffect(() => {
    fetchRollup();
  }, [fetchRollup]);

  if (!user) return <Loader size="md" message="Loading…" />;
  if (!isAdmin) {
    return (
      <div className="py-8 px-4">
        <div className="max-w-md mx-auto bg-white border border-amber-200 rounded-2xl p-6 text-center">
          <h1 className="text-base font-bold text-gray-900">Admin only</h1>
          <p className="text-sm text-gray-500 mt-1">
            Builder rollups are visible to administrators only.
          </p>
          <Link href="/dashboard/commissions"
            className="inline-flex items-center gap-1.5 mt-4 px-3 py-2 text-sm font-semibold
              text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">
            <ChevronLeft size={14} /> Back to commissions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">
      {/* HEADER */}
      <div>
        <Link href="/dashboard/commissions"
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400
            hover:text-gray-600 transition-colors mb-2">
          <ChevronLeft size={12} /> Commissions
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">
              Deals by Builder
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
              How each developer compares — deal value, deal-paid, commission, collected.
            </p>
          </div>
          <Link href="/dashboard/commissions/statement"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium
              text-blue-700 bg-blue-50 border border-blue-200 rounded-xl
              hover:bg-blue-100 transition-colors w-fit">
            <Users size={14} />
            <span>Per-broker statement</span>
          </Link>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5
            flex items-center gap-1.5">
            <Calendar size={12} className="text-gray-400" /> Period
          </label>
          <select
            value={timePreset}
            onChange={(e) => setTimePreset(e.target.value as TimePreset)}
            className="w-full sm:max-w-xs px-3 py-2.5 text-sm border border-gray-200 rounded-xl
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
              bg-white text-gray-800"
          >
            <option value="all">All time</option>
            <option value="thisMonth">This month</option>
            <option value="lastMonth">Last month</option>
            <option value="thisQuarter">This quarter</option>
            <option value="thisFY">This Indian FY (Apr–Mar)</option>
            <option value="custom">Custom range</option>
          </select>
        </div>

        {timePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={customRange.from}
                max={customRange.to || undefined}
                onChange={(e) => setCustomRange((p) => ({ ...p, from: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                  bg-white text-gray-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={customRange.to}
                min={customRange.from || undefined}
                max={todayIso()}
                onChange={(e) => setCustomRange((p) => ({ ...p, to: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                  bg-white text-gray-800"
              />
            </div>
          </div>
        )}
      </div>

      {/* TOTALS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Deals"             value={String(totals.deals)}        tone="blue"    icon={TrendingUp} />
        <Tile label="Deal value"        value={fmt(totals.dealAmount)}      tone="indigo"  icon={Building2} />
        <Tile label="Total commission"  value={fmt(totals.commissionAmount)} tone="purple"  icon={Wallet} />
        <Tile label="Commission paid"   value={fmt(totals.paidAmount)}      tone="emerald" icon={CheckCircle2} />
      </div>

      {/* TABLE / CARDS */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="ml-2 text-sm">Loading rollup…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <Building2 size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No deals in this window.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Builder', 'Deals', 'Deal value', 'Deal received', 'Commission', 'Commission paid', 'Outstanding'].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500
                        uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r) => {
                    const outstanding = Math.max(0, r.commissionAmount - r.paidAmount);
                    return (
                      <tr key={r.builder} className="hover:bg-gray-50/40 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-gray-900">{r.builder}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {r.completedDeals} completed · {r.openDeals} open
                            {r.unpaidCommissions > 0 && ` · ${r.unpaidCommissions} unpaid`}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{r.deals}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{fmt(r.dealAmount)}</td>
                        <td className="px-4 py-3 text-sm text-indigo-700">{fmt(r.dealAmountPaid)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-purple-700">{fmt(r.commissionAmount)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-emerald-700">{fmt(r.paidAmount)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-orange-700">{fmt(outstanding)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {rows.map((r) => {
                const outstanding = Math.max(0, r.commissionAmount - r.paidAmount);
                return (
                  <div key={r.builder} className="px-4 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{r.builder}</p>
                        <p className="text-[11px] text-gray-400">
                          {r.deals} deal{r.deals === 1 ? '' : 's'} · {r.completedDeals} done · {r.openDeals} open
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Mini label="Deal value"      value={fmt(r.dealAmount)} />
                      <Mini label="Deal received"   value={fmt(r.dealAmountPaid)} tone="indigo" />
                      <Mini label="Commission"      value={fmt(r.commissionAmount)} tone="purple" />
                      <Mini label="Commission paid" value={fmt(r.paidAmount)} tone="emerald" />
                    </div>
                    {outstanding > 0 && (
                      <div className="bg-orange-50 rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="text-[11px] text-orange-600 font-medium">Outstanding</span>
                        <span className="text-sm font-bold text-orange-700">{fmt(outstanding)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({
  label, value, tone, icon: Icon,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'indigo' | 'purple' | 'emerald';
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  const palette = {
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    icon: 'text-blue-500' },
    indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  icon: 'text-indigo-500' },
    purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  icon: 'text-purple-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-500' },
  }[tone];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5
      flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-medium text-gray-500">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${palette.bg}`}>
          <Icon size={18} className={palette.icon} />
        </div>
      </div>
      <p className={`text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight truncate ${palette.text}`}>
        {value}
      </p>
    </div>
  );
}

function Mini({
  label, value, tone,
}: {
  label: string;
  value: string;
  tone?: 'indigo' | 'purple' | 'emerald';
}) {
  const colorMap = {
    indigo:  { bg: 'bg-indigo-50',  label: 'text-indigo-500',  text: 'text-indigo-700' },
    purple:  { bg: 'bg-purple-50',  label: 'text-purple-500',  text: 'text-purple-700' },
    emerald: { bg: 'bg-emerald-50', label: 'text-emerald-500', text: 'text-emerald-700' },
  };
  const c = tone ? colorMap[tone] : { bg: 'bg-gray-50', label: 'text-gray-400', text: 'text-gray-700' };
  return (
    <div className={`${c.bg} rounded-lg px-2 py-1.5`}>
      <p className={`text-[10px] uppercase tracking-wide ${c.label}`}>{label}</p>
      <p className={`text-xs font-bold mt-0.5 truncate ${c.text}`}>{value}</p>
    </div>
  );
}
