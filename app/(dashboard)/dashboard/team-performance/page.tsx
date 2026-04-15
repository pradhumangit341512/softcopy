'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, TrendingUp, CheckCircle2, Clock, IndianRupee, Award,
} from 'lucide-react';

import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, CHART_COLORS, CustomTooltipProps, TooltipPayloadEntry } from '@/lib/utils';

/** Team member with performance stats from /api/team-performance */
interface TeamMemberPerformance {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  profilePhoto?: string | null;
  joinedAt: string;
  stats: {
    totalLeads: number;
    dealsClosed: number;
    conversionRate: number;
    commissionEarned: number;
    commissionCount: number;
    pendingFollowUps: number;
  };
}

/** Custom tooltip for Recharts that formats currency nicely */
const ChartTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
        {payload.map((p: TooltipPayloadEntry, i: number) => (
          <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * Team Performance page — admin/superadmin only.
 * Shows per-member stats: leads, deals, conversion, commission.
 */
export default function TeamPerformancePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [members, setMembers] = useState<TeamMemberPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/team-performance', { credentials: 'include' });
      if (res.status === 403) {
        setError('Only admins can access team performance');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch team performance');
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;

    // Redirect non-admins
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      router.replace('/dashboard');
      return;
    }

    fetchPerformance();
  }, [authLoading, user, router, fetchPerformance]);

  if (authLoading || loading) {
    return (
      <div className="py-8">
        <Loader size="lg" message="Loading performance data..." />
      </div>
    );
  }

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return null;
  }

  // Chart data — top 10 members by leads
  const chartData = [...members]
    .sort((a, b) => b.stats.totalLeads - a.stats.totalLeads)
    .slice(0, 10)
    .map((m) => ({
      name: m.name.split(' ')[0], // first name only, easier to read
      Leads: m.stats.totalLeads,
      Deals: m.stats.dealsClosed,
    }));

  // Totals across the team
  const teamTotals = members.reduce(
    (acc, m) => ({
      totalLeads: acc.totalLeads + m.stats.totalLeads,
      dealsClosed: acc.dealsClosed + m.stats.dealsClosed,
      commissionEarned: acc.commissionEarned + m.stats.commissionEarned,
      pendingFollowUps: acc.pendingFollowUps + m.stats.pendingFollowUps,
    }),
    { totalLeads: 0, dealsClosed: 0, commissionEarned: 0, pendingFollowUps: 0 }
  );

  const topPerformer = [...members]
    .sort((a, b) => b.stats.dealsClosed - a.stats.dealsClosed)[0];

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">
          Team Performance
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
          Track how each team member is performing
        </p>
      </div>

      {error && (
        <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />
      )}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryCard
          label="Team Members"
          value={String(members.length)}
          icon={<Users size={18} />}
          bg="bg-blue-50"
          text="text-blue-600"
        />
        <SummaryCard
          label="Total Leads"
          value={String(teamTotals.totalLeads)}
          icon={<TrendingUp size={18} />}
          bg="bg-amber-50"
          text="text-amber-600"
        />
        <SummaryCard
          label="Deals Closed"
          value={String(teamTotals.dealsClosed)}
          icon={<CheckCircle2 size={18} />}
          bg="bg-emerald-50"
          text="text-emerald-600"
        />
        <SummaryCard
          label="Total Commission"
          value={formatCurrency(teamTotals.commissionEarned)}
          icon={<IndianRupee size={18} />}
          bg="bg-purple-50"
          text="text-purple-600"
        />
      </div>

      {/* TOP PERFORMER BANNER */}
      {topPerformer && topPerformer.stats.dealsClosed > 0 && (
        <div className="bg-linear-to-r from-amber-50 to-yellow-50 border border-amber-200
          rounded-2xl p-4 sm:p-5 flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-100
            flex items-center justify-center shrink-0">
            <Award size={24} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
              Top Performer
            </p>
            <p className="text-base sm:text-lg font-bold text-gray-900 mt-0.5">
              {topPerformer.name}
            </p>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
              {topPerformer.stats.dealsClosed} deals closed • {formatCurrency(topPerformer.stats.commissionEarned)} earned
            </p>
          </div>
        </div>
      )}

      {/* CHART */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-800">Leads vs Deals by Member</h2>
            <p className="text-xs text-gray-400 mt-0.5">Top 10 members</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
              <Bar dataKey="Leads" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Deals" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* MEMBER LIST */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <Users size={14} className="text-blue-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">Member Details</h3>
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Users size={22} className="text-gray-300" />
            <p className="text-gray-500 text-sm font-medium">No team members yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Member</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-right">Deals</th>
                  <th className="px-4 py-3 text-right">Conversion</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3 text-right">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {members.map((m) => {
                  const initials = m.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-500 to-blue-600
                            flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{m.name}</p>
                            <p className="text-xs text-gray-500 truncate">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          label={m.role}
                          variant={
                            m.role === 'admin' || m.role === 'superadmin' ? 'primary' : 'gray'
                          }
                          size="sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {m.stats.totalLeads}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                        {m.stats.dealsClosed}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${
                          m.stats.conversionRate >= 30
                            ? 'text-emerald-600'
                            : m.stats.conversionRate >= 15
                            ? 'text-amber-600'
                            : 'text-gray-500'
                        }`}>
                          {m.stats.conversionRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {formatCurrency(m.stats.commissionEarned)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {m.stats.pendingFollowUps > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold
                            text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            <Clock size={10} />
                            {m.stats.pendingFollowUps}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Small summary card used in the header grid */
function SummaryCard({
  label,
  value,
  icon,
  bg,
  text,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  bg: string;
  text: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100
      flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-medium text-gray-500">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
          <span className={text}>{icon}</span>
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
    </div>
  );
}
