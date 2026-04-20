'use client';

import { useEffect, useState } from 'react';
import { X, Phone, MessageCircle, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Loader } from '@/components/common/Loader';
import { LoginHistory } from '@/components/dashboard/LoginHistory';
import { formatCurrency, formatDate } from '@/lib/utils';

interface ClientRow {
  id: string;
  clientName: string;
  phone: string;
  email?: string | null;
  status: string;
  requirementType: string;
  followUpDate?: string | null;
  notes?: string | null;
  source?: string | null;
  createdAt: string;
  creator?: { name: string } | null;
}

interface CommissionRow {
  id: string;
  dealAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  paidStatus: string;
  createdAt: string;
  client?: { clientName: string } | null;
}

interface MemberStats {
  totalLeads: number;
  dealsClosed: number;
  conversionRate: number;
  commissionEarned: number;
  commissionCount: number;
  pendingFollowUps: number;
}

interface MemberSession {
  isOnline: boolean;
  lastLoginAt: string | null;
  totalWeekHours: number;
  daysActiveThisWeek: number;
}

interface Props {
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberRole: string;
  stats: MemberStats;
  session?: MemberSession;
  onClose: () => void;
}

function cleanPhone(p: string) { return p.replace(/[\s\-()]/g, ''); }
function waUrl(p: string) { return `https://wa.me/${cleanPhone(p).replace(/^\+/, '')}`; }

export function MemberDetailPanel({
  memberId, memberName, memberEmail, memberRole, stats, session, onClose,
}: Props) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCommissions, setShowCommissions] = useState(false);

  useEffect(() => {
    let alive = true;

    Promise.all([
      fetch(`/api/clients?createdBy=${memberId}&limit=50`, { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => d.clients ?? []),
      fetch(`/api/commissions?limit=50`, { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => (d.commissions ?? []).filter((c: CommissionRow & { userId?: string }) =>
          c.userId === memberId || (c.client && (c as unknown as Record<string, unknown>).userId === memberId)
        )),
    ])
      .then(([c, com]) => {
        if (!alive) return;
        setClients(c);
        setCommissions(com);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [memberId]);

  const now = new Date();
  const overdueClients = clients.filter(
    (c) => c.followUpDate && new Date(c.followUpDate) < now &&
      c.status !== 'DealDone' && c.status !== 'Rejected'
  );

  const statusCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  for (const c of clients) {
    statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
    if (c.source) sourceCounts[c.source] = (sourceCounts[c.source] ?? 0) + 1;
  }

  return (
    <tr>
      <td colSpan={100} className="p-0">
        <div className="bg-blue-50/50 border-t-2 border-b-2 border-blue-200 px-6 py-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600
                  flex items-center justify-center text-white text-sm font-bold">
                  {memberName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                {session?.isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{memberName}</h3>
                <p className="text-sm text-gray-500">{memberEmail} · {memberRole}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-white/80 flex items-center justify-center text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
            <StatCard label="Clients Assigned" value={stats.totalLeads.toString()} />
            <StatCard label="Deals Closed" value={stats.dealsClosed.toString()} color="green" />
            <StatCard label="Conversion" value={`${stats.conversionRate}%`}
              color={stats.conversionRate >= 30 ? 'green' : stats.conversionRate >= 15 ? 'amber' : 'gray'} />
            <StatCard label="Commission" value={formatCurrency(stats.commissionEarned)} />
            <StatCard label="Week Hours" value={session ? `${session.totalWeekHours}h` : '—'} />
            <StatCard label="Overdue" value={overdueClients.length.toString()}
              color={overdueClients.length > 0 ? 'red' : 'green'} />
          </div>

          {loading ? (
            <Loader size="md" message="Loading work history..." />
          ) : (
            <div className="space-y-4">
              {/* Overdue Alert */}
              {overdueClients.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <h4 className="text-sm font-bold text-red-800 flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={14} />
                    Overdue Follow-ups ({overdueClients.length})
                  </h4>
                  <div className="space-y-1">
                    {overdueClients.map((c) => {
                      const daysOverdue = Math.floor((now.getTime() - new Date(c.followUpDate!).getTime()) / 86400000);
                      return (
                        <div key={c.id} className="flex items-center justify-between text-xs">
                          <span className="text-red-700 font-medium">{c.clientName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-red-600">{daysOverdue}d overdue</span>
                            <a href={`tel:${cleanPhone(c.phone)}`} className="text-blue-600 hover:underline">
                              <Phone size={10} />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Work Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">By Status</h4>
                  <div className="space-y-1.5">
                    {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([s, count]) => (
                      <div key={s} className="flex items-center justify-between text-xs">
                        <Badge label={s} variant={s === 'DealDone' ? 'success' : s === 'Rejected' ? 'danger' : 'primary'} size="sm" />
                        <span className="font-bold text-gray-900">{count}</span>
                      </div>
                    ))}
                    {Object.keys(statusCounts).length === 0 && (
                      <p className="text-xs text-gray-400">No clients yet</p>
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">By Source</h4>
                  <div className="space-y-1.5">
                    {Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).map(([s, count]) => (
                      <div key={s} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">{s}</span>
                        <span className="font-bold text-gray-900">{count}</span>
                      </div>
                    ))}
                    {Object.keys(sourceCounts).length === 0 && (
                      <p className="text-xs text-gray-400">No sources recorded</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Login History */}
              <LoginHistory memberId={memberId} />

              {/* Client List */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h4 className="text-sm font-bold text-gray-800">
                    All Assigned Clients ({clients.length})
                  </h4>
                </div>
                {clients.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-gray-400">No clients assigned</p>
                ) : (
                  <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Client</th>
                          <th className="px-3 py-2 text-left">Phone</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Follow Up</th>
                          <th className="px-3 py-2 text-left">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {clients.map((c) => {
                          const isOverdue = c.followUpDate && new Date(c.followUpDate) < now &&
                            c.status !== 'DealDone' && c.status !== 'Rejected';
                          return (
                            <tr key={c.id} className={isOverdue ? 'bg-red-50/50' : ''}>
                              <td className="px-3 py-2">
                                <p className="font-semibold text-gray-900">{c.clientName}</p>
                                <p className="text-gray-400">{c.requirementType}</p>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  <a href={`tel:${cleanPhone(c.phone)}`} className="text-blue-600 hover:underline flex items-center gap-0.5">
                                    <Phone size={10} /> {c.phone}
                                  </a>
                                  <a href={waUrl(c.phone)} target="_blank" rel="noopener noreferrer"
                                    className="w-5 h-5 rounded-full bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-100">
                                    <MessageCircle size={9} />
                                  </a>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <Badge label={c.status}
                                  variant={c.status === 'DealDone' ? 'success' : c.status === 'Rejected' ? 'danger' : 'primary'}
                                  size="sm" />
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {c.followUpDate ? (
                                  <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                                    {formatDate(c.followUpDate)}
                                    {isOverdue && ' ⚠'}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-3 py-2 max-w-[200px]">
                                {c.notes ? (
                                  <p className="text-gray-600 line-clamp-2" title={c.notes}>{c.notes}</p>
                                ) : <span className="text-gray-400">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Commissions (collapsible) */}
              {stats.commissionCount > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setShowCommissions(!showCommissions)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                  >
                    <h4 className="text-sm font-bold text-gray-800">
                      Commissions ({stats.commissionCount})
                      <span className="ml-2 font-normal text-gray-500">
                        Total: {formatCurrency(stats.commissionEarned)}
                      </span>
                    </h4>
                    {showCommissions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {showCommissions && commissions.length > 0 && (
                    <div className="border-t border-gray-100 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500 uppercase">
                          <tr>
                            <th className="px-3 py-2 text-left">Client</th>
                            <th className="px-3 py-2 text-right">Deal</th>
                            <th className="px-3 py-2 text-right">Commission</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {commissions.map((c) => (
                            <tr key={c.id}>
                              <td className="px-3 py-2 font-medium text-gray-900">{c.client?.clientName ?? '—'}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(c.dealAmount)}</td>
                              <td className="px-3 py-2 text-right font-bold text-gray-900">
                                {formatCurrency(c.commissionAmount)}
                                <span className="text-gray-400 ml-1">({c.commissionPercentage}%)</span>
                              </td>
                              <td className="px-3 py-2">
                                <Badge label={c.paidStatus} variant={c.paidStatus === 'Paid' ? 'success' : 'warning'} size="sm" />
                              </td>
                              <td className="px-3 py-2 text-gray-500">{formatDate(c.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorMap: Record<string, string> = {
    green: 'text-green-700 bg-green-50 border-green-200',
    red: 'text-red-700 bg-red-50 border-red-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
    gray: 'text-gray-700 bg-gray-50 border-gray-200',
  };
  const cls = color ? colorMap[color] ?? colorMap.gray : 'text-gray-900 bg-white border-gray-200';

  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
