'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users, Clock, Calendar, TrendingUp, CheckCircle2, Phone, MapPin,
  AlertCircle, ArrowRight,
} from 'lucide-react';

import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatCurrency } from '@/lib/utils';

import type { Client } from '@/lib/types';

/** Stats summary returned by /api/my-work */
interface MyWorkStats {
  total: number;
  new: number;
  interested: number;
  dealDone: number;
  rejected: number;
  followUpsDue: number;
  visitsToday: number;
}

/** Today's visit summary shape */
interface TodayVisitItem {
  id: string;
  clientName: string;
  phone: string;
  visitingDate: string;
  visitingTime: string | null;
  preferredLocation: string | null;
  status: string;
}

/** Full response from /api/my-work */
interface MyWorkResponse {
  assignedLeads: Client[];
  pendingFollowUps: Client[];
  todayVisits: TodayVisitItem[];
  stats: MyWorkStats;
}

/**
 * My Work page — personal workspace for the logged-in user.
 * Shows their assigned leads, pending follow-ups, and today's visits.
 */
export default function MyWorkPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [data, setData] = useState<MyWorkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyWork = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/my-work', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch work data');
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    fetchMyWork();
  }, [authLoading, user?.id, fetchMyWork]);

  if (authLoading || loading) {
    return (
      <div className="py-8">
        <Loader size="lg" message="Loading your work..." />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-4 sm:py-6 lg:py-8">
        <Alert type="error" title="Error" message={error || 'Failed to load work data'} />
      </div>
    );
  }

  const { stats, pendingFollowUps, todayVisits, assignedLeads } = data;
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">
          My Work
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
          Hi {firstName} — here's what needs your attention today
        </p>
      </div>

      {error && (
        <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="My Total Leads"
          value={stats.total}
          icon={<Users size={18} />}
          bg="bg-blue-50"
          text="text-blue-600"
        />
        <StatCard
          label="Today's Visits"
          value={stats.visitsToday}
          icon={<Calendar size={18} />}
          bg="bg-purple-50"
          text="text-purple-600"
          highlight={stats.visitsToday > 0}
        />
        <StatCard
          label="Follow-ups Due"
          value={stats.followUpsDue}
          icon={<Clock size={18} />}
          bg="bg-amber-50"
          text="text-amber-600"
          highlight={stats.followUpsDue > 0}
        />
        <StatCard
          label="Deals Closed"
          value={stats.dealDone}
          icon={<CheckCircle2 size={18} />}
          bg="bg-emerald-50"
          text="text-emerald-600"
        />
      </div>

      {/* TODAY'S VISITS */}
      {todayVisits.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
              <Calendar size={14} className="text-purple-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">
              Today's Visits
              <span className="ml-2 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {todayVisits.length}
              </span>
            </h3>
          </div>

          <div className="divide-y divide-gray-100">
            {todayVisits.map((visit, idx) => (
              <button
                key={visit.id}
                onClick={() => router.push(`/dashboard/all-leads/${visit.id}`)}
                className="w-full text-left px-4 sm:px-5 py-3 sm:py-4 hover:bg-gray-50/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-purple-50 text-purple-600
                    text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {visit.clientName}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {visit.visitingTime && (
                        <span className="text-xs font-semibold text-purple-600
                          bg-purple-50 px-2 py-0.5 rounded-full">
                          {visit.visitingTime}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone size={10} /> {visit.phone}
                      </span>
                      {visit.preferredLocation && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin size={10} /> {visit.preferredLocation}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-gray-300 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PENDING FOLLOW-UPS */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
            <AlertCircle size={14} className="text-amber-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800">
            Pending Follow-ups
            <span className="ml-2 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {pendingFollowUps.length}
            </span>
          </h3>
        </div>

        {pendingFollowUps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <CheckCircle2 size={24} className="text-emerald-300" />
            <p className="text-sm text-gray-400 font-medium">All caught up!</p>
            <p className="text-xs text-gray-400">No follow-ups are due.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingFollowUps.slice(0, 10).map((lead) => (
              <button
                key={lead.id}
                onClick={() => router.push(`/dashboard/all-leads/${lead.id}`)}
                className="w-full text-left px-4 sm:px-5 py-3 sm:py-4 hover:bg-gray-50/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {lead.clientName}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone size={10} /> {lead.phone}
                      </span>
                      {lead.followUpDate && (
                        <span className="text-xs font-semibold text-amber-700
                          bg-amber-50 px-2 py-0.5 rounded-full">
                          Due {formatDate(lead.followUpDate)}
                        </span>
                      )}
                      <Badge label={lead.status} variant="primary" size="sm" />
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-gray-300 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ALL MY LEADS */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <TrendingUp size={14} className="text-blue-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">
              My Recent Leads
              <span className="ml-2 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {assignedLeads.length}
              </span>
            </h3>
          </div>
          <Link
            href="/dashboard/all-leads"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            View all →
          </Link>
        </div>

        {assignedLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Users size={24} className="text-gray-300" />
            <p className="text-sm text-gray-400 font-medium">No leads yet</p>
            <Link
              href="/dashboard/all-leads/add"
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              + Add your first lead
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {assignedLeads.slice(0, 8).map((lead) => (
              <button
                key={lead.id}
                onClick={() => router.push(`/dashboard/all-leads/${lead.id}`)}
                className="w-full text-left px-4 sm:px-5 py-3 sm:py-4 hover:bg-gray-50/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {lead.clientName}
                      </p>
                      <Badge
                        label={lead.status}
                        variant={
                          lead.status === 'DealDone'
                            ? 'success'
                            : lead.status === 'Rejected'
                            ? 'danger'
                            : lead.status === 'Interested'
                            ? 'warning'
                            : 'primary'
                        }
                        size="sm"
                      />
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone size={10} /> {lead.phone}
                      </span>
                      {lead.budget ? (
                        <span className="text-xs text-gray-700 font-semibold">
                          {formatCurrency(lead.budget)}
                        </span>
                      ) : null}
                      {lead.preferredLocation && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin size={10} /> {lead.preferredLocation}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-gray-300 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact stat card used in the top grid */
function StatCard({
  label,
  value,
  icon,
  bg,
  text,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  bg: string;
  text: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 border shadow-sm flex flex-col gap-3 transition-all
        ${highlight
          ? 'bg-white border-gray-100 hover:shadow-md'
          : 'bg-white border-gray-100 hover:shadow-md'
        }`}
    >
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
