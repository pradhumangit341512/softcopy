'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Loader from '@/components/common/Loader';
import {
  Trophy, Users, TrendingUp, BadgeDollarSign,
  Medal, Crown, Award, Target,
} from 'lucide-react';
import clsx from 'clsx';

interface UserMetrics {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    profilePhoto?: string;
  };
  metrics: {
    totalClients: number;
    monthlyClients: number;
    dealsClosedAllTime: number;
    dealsClosedMonth: number;
    totalCommission: number;
    monthlyCommission: number;
    totalProperties: number;
    conversionRate: number;
  };
}

interface TeamTotals {
  totalClients: number;
  monthlyClients: number;
  dealsClosedMonth: number;
  monthlyCommission: number;
  totalMembers: number;
}

const RANK_ICONS = [Crown, Medal, Award];
const RANK_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];

function formatCurrency(amount: number) {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return `${amount.toLocaleString('en-IN')}`;
}

export default function TeamPerformancePage() {
  const { user } = useAuth();
  const [data, setData] = useState<{ performance: UserMetrics[]; teamTotals: TeamTotals } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        const res = await fetch('/api/team-performance', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch team performance:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPerformance();
  }, []);

  if (loading) return <Loader fullScreen size="lg" message="Loading team performance..." />;

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-sm">Failed to load team performance</p>
      </div>
    );
  }

  const { performance, teamTotals } = data;
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">
          Team Performance
        </h1>
        <p className="text-gray-500 mt-1 text-xs sm:text-sm">
          {currentMonth} — Leaderboard and individual metrics
        </p>
      </div>

      {/* Team Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500">Team Members</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Users size={16} className="text-blue-500" />
            </div>
          </div>
          <span className="text-2xl font-bold text-gray-900">{teamTotals.totalMembers}</span>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500">New Leads (Month)</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
              <Target size={16} className="text-purple-500" />
            </div>
          </div>
          <span className="text-2xl font-bold text-gray-900">{teamTotals.monthlyClients}</span>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500">Deals Closed (Month)</span>
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
              <TrendingUp size={16} className="text-green-500" />
            </div>
          </div>
          <span className="text-2xl font-bold text-gray-900">{teamTotals.dealsClosedMonth}</span>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500">Commission (Month)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <BadgeDollarSign size={16} className="text-amber-500" />
            </div>
          </div>
          <span className="text-2xl font-bold text-gray-900">
            {teamTotals.monthlyCommission > 0 ? `₹${formatCurrency(teamTotals.monthlyCommission)}` : '₹0'}
          </span>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center">
            <Trophy size={16} className="text-yellow-500" />
          </div>
          <h2 className="text-base font-semibold text-gray-800">Leaderboard</h2>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center w-16">Rank</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">Agent</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Total Leads</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">This Month</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Deals (Month)</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Deals (All)</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Conversion</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Commission (Month)</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Properties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {performance.map((item, index) => {
                const RankIcon = index < 3 ? RANK_ICONS[index] : null;
                const rankColor = index < 3 ? RANK_COLORS[index] : '';
                const isCurrentUser = item.user.id === user?.id;
                const initials = item.user.name
                  .split(' ')
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <tr
                    key={item.user.id}
                    className={clsx(
                      'hover:bg-gray-50/50 transition-colors',
                      isCurrentUser && 'bg-blue-50/30'
                    )}
                  >
                    <td className="px-4 py-3.5 text-center">
                      {RankIcon ? (
                        <RankIcon size={20} className={rankColor} />
                      ) : (
                        <span className="text-sm font-bold text-gray-400">#{index + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {item.user.name}
                            {isCurrentUser && (
                              <span className="ml-1.5 text-[10px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">You</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400 capitalize">{item.user.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center text-sm font-medium text-gray-700">
                      {item.metrics.totalClients}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="text-sm font-bold text-blue-600">{item.metrics.monthlyClients}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="text-sm font-bold text-green-600">{item.metrics.dealsClosedMonth}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-sm text-gray-600">
                      {item.metrics.dealsClosedAllTime}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all"
                            style={{ width: `${Math.min(item.metrics.conversionRate, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-600">{item.metrics.conversionRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center text-sm font-semibold text-amber-600">
                      {item.metrics.monthlyCommission > 0 ? `₹${formatCurrency(item.metrics.monthlyCommission)}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center text-sm text-gray-600">
                      {item.metrics.totalProperties}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {performance.map((item, index) => {
            const RankIcon = index < 3 ? RANK_ICONS[index] : null;
            const rankColor = index < 3 ? RANK_COLORS[index] : '';
            const isCurrentUser = item.user.id === user?.id;
            const initials = item.user.name
              .split(' ')
              .map((n: string) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div
                key={item.user.id}
                className={clsx('px-4 py-4 space-y-3', isCurrentUser && 'bg-blue-50/30')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                        {initials}
                      </div>
                      {RankIcon && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <RankIcon size={12} className={rankColor} />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {item.user.name}
                        {isCurrentUser && (
                          <span className="ml-1.5 text-[10px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">You</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{item.user.role}</p>
                    </div>
                  </div>
                  {!RankIcon && (
                    <span className="text-lg font-bold text-gray-300">#{index + 1}</span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-400">Leads</p>
                    <p className="text-sm font-bold text-gray-800">{item.metrics.monthlyClients}</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <p className="text-xs text-gray-400">Deals</p>
                    <p className="text-sm font-bold text-green-600">{item.metrics.dealsClosedMonth}</p>
                  </div>
                  <div className="text-center p-2 bg-amber-50 rounded-lg">
                    <p className="text-xs text-gray-400">Conv.</p>
                    <p className="text-sm font-bold text-amber-600">{item.metrics.conversionRate}%</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
