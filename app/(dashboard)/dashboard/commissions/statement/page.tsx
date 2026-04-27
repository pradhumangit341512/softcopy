'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, Users, Calendar, Loader2, Wallet, Building2,
  TrendingUp, Clock, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Loader } from '@/components/common/Loader';
import { useToast } from '@/components/common/Toast';

const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

interface StatementRow {
  splitId: string;
  commissionId: string;
  participantUserId: string | null;
  participantName: string;
  client: string;
  builder: string;
  dealAmount: number;
  commissionAmount: number;
  commissionPercentage: number;
  sharePercent: number;
  shareAmount: number;
  paidOut: number;
  outstanding: number;
  status: string;
  commissionPaidStatus: string;
  createdAt: string;
}

interface StatementResponse {
  rows: StatementRow[];
  totals: {
    deals: number;
    dealAmount: number;
    shareAmount: number;
    paidOut: number;
    outstanding: number;
  };
}

interface CompanyUser {
  id: string;
  name: string;
}

type TimePreset = 'all' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisFY' | 'custom';

const STATUS_PILL: Record<string, string> = {
  Paid:    'bg-emerald-50 text-emerald-700',
  Partial: 'bg-orange-50 text-orange-700',
  Pending: 'bg-amber-50 text-amber-700',
};

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Per-broker / per-participant commission statement page.
 *
 * Admin-only (the API enforces it; this guard prevents a flash of UI
 * before the redirect). Lets a brokerage owner pick a participant + a
 * date range and see every deal that participant had a slice of —
 * with their share %, share ₹, paid-out, and outstanding.
 */
export default function StatementPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [participantId, setParticipantId] = useState<string>('');
  const [timePreset, setTimePreset] = useState<TimePreset>('thisFY');
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({
    from: '', to: '',
  });

  const [rows, setRows] = useState<StatementRow[]>([]);
  const [totals, setTotals] = useState<StatementResponse['totals']>({
    deals: 0, dealAmount: 0, shareAmount: 0, paidOut: 0, outstanding: 0,
  });
  const [loading, setLoading] = useState(false);

  /** Load company team users for the participant dropdown. */
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setUsersLoading(true);
      try {
        const res = await fetch('/api/users?limit=100', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load team');
        const data: { users?: CompanyUser[] } = await res.json();
        if (!cancelled) setUsers(data.users ?? []);
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  /** Map preset to (from, to) ISO date strings. */
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
        // Indian financial year: Apr 1 → Mar 31. If today is Jan-Mar, FY started LAST year.
        const fyStartYear = m >= 3 ? y : y - 1;
        return { from: `${fyStartYear}-04-01`, to: `${fyStartYear + 1}-03-31` };
      }
      case 'custom':
        return { from: customRange.from || undefined, to: customRange.to || undefined };
      default:
        return {};
    }
  }, [timePreset, customRange]);

  const fetchStatement = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (participantId) params.set('userId', participantId);
      if (dateRange.from) params.set('from', dateRange.from);
      if (dateRange.to) params.set('to', dateRange.to);
      const res = await fetch(`/api/commissions/statement?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load statement');
      const data: StatementResponse = await res.json();
      setRows(data.rows ?? []);
      setTotals(data.totals);
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load statement',
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, participantId, dateRange.from, dateRange.to, addToast]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  const participantLabel = useMemo(() => {
    if (!participantId) return 'All participants';
    if (participantId === 'external') return 'External / co-broker only';
    return users.find((u) => u.id === participantId)?.name ?? 'Selected participant';
  }, [participantId, users]);

  if (!user) return <Loader size="md" message="Loading…" />;
  if (!isAdmin) {
    return (
      <div className="py-8 px-4">
        <div className="max-w-md mx-auto bg-white border border-amber-200 rounded-2xl p-6 text-center">
          <h1 className="text-base font-bold text-gray-900">Admin only</h1>
          <p className="text-sm text-gray-500 mt-1">
            The per-broker statement is visible to administrators only.
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
              Statement
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
              Per-broker payout report — every deal {participantLabel.toLowerCase()} had a slice of.
            </p>
          </div>
          <Link href="/dashboard/commissions/by-builder"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium
              text-blue-700 bg-blue-50 border border-blue-200 rounded-xl
              hover:bg-blue-100 transition-colors w-fit">
            <Building2 size={14} />
            <span>By builder</span>
          </Link>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Participant */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5
              flex items-center gap-1.5">
              <Users size={12} className="text-gray-400" /> Participant
            </label>
            <select
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              disabled={usersLoading}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                bg-white text-gray-800 disabled:opacity-60"
            >
              <option value="">All participants</option>
              <option value="external">External / co-broker only</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Time preset */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5
              flex items-center gap-1.5">
              <Calendar size={12} className="text-gray-400" /> Period
            </label>
            <select
              value={timePreset}
              onChange={(e) => setTimePreset(e.target.value as TimePreset)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
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
        </div>

        {timePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
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
        <Tile label="Deals"        value={String(totals.deals)}      tone="blue"    icon={TrendingUp} />
        <Tile label="Total share"  value={fmt(totals.shareAmount)}   tone="purple"  icon={Wallet} />
        <Tile label="Paid out"     value={fmt(totals.paidOut)}       tone="emerald" icon={CheckCircle2} />
        <Tile label="Outstanding"  value={fmt(totals.outstanding)}   tone="orange"  icon={Clock} />
      </div>

      {/* TABLE / CARDS */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="ml-2 text-sm">Loading statement…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <Users size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">
              No deals in this window for the selected participant.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Date', 'Client', 'Builder', 'Deal ₹', 'Comm. ₹', 'Share %', 'Share ₹', 'Paid out', 'Outstanding', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500
                        uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r) => (
                    <tr key={r.splitId} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {r.client}
                        {!participantId && (
                          <p className="text-[11px] text-gray-400 font-normal mt-0.5">
                            {r.participantName}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{r.builder || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-medium">{fmt(r.dealAmount)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {fmt(r.commissionAmount)}
                        <p className="text-[11px] text-gray-400 font-normal">
                          {r.commissionPercentage}%
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-purple-700">{r.sharePercent}%</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{fmt(r.shareAmount)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-700">{fmt(r.paidOut)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-orange-700">{fmt(r.outstanding)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full
                          ${STATUS_PILL[r.status] ?? STATUS_PILL.Pending}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {rows.map((r) => (
                <div key={r.splitId} className="px-4 py-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{r.client}</p>
                      <p className="text-[11px] text-gray-400">
                        {r.builder || 'No builder'}
                        {' · '}
                        {new Date(r.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: '2-digit',
                        })}
                        {!participantId && ` · ${r.participantName}`}
                      </p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0
                      ${STATUS_PILL[r.status] ?? STATUS_PILL.Pending}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Mini label="Share %"   value={`${r.sharePercent}%`} />
                    <Mini label="Share ₹"   value={fmt(r.shareAmount)} />
                    <Mini label="Paid"      value={fmt(r.paidOut)} tone="emerald" />
                  </div>
                  {r.outstanding > 0 && (
                    <div className="bg-orange-50 rounded-lg px-3 py-2 flex items-center justify-between">
                      <span className="text-[11px] text-orange-600 font-medium">Outstanding</span>
                      <span className="text-sm font-bold text-orange-700">{fmt(r.outstanding)}</span>
                    </div>
                  )}
                </div>
              ))}
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
  tone: 'blue' | 'purple' | 'emerald' | 'orange';
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  const palette = {
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    icon: 'text-blue-500' },
    purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  icon: 'text-purple-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-500' },
    orange:  { bg: 'bg-orange-50',  text: 'text-orange-600',  icon: 'text-orange-500' },
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

function Mini({ label, value, tone }: { label: string; value: string; tone?: 'emerald' }) {
  return (
    <div className={`${tone === 'emerald' ? 'bg-emerald-50' : 'bg-gray-50'} rounded-lg px-2 py-1.5`}>
      <p className={`text-[10px] uppercase tracking-wide ${
        tone === 'emerald' ? 'text-emerald-500' : 'text-gray-400'
      }`}>{label}</p>
      <p className={`text-xs font-bold mt-0.5 truncate ${
        tone === 'emerald' ? 'text-emerald-700' : 'text-gray-700'
      }`}>{value}</p>
    </div>
  );
}
