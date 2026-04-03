'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/common/Toast';
import Loader from '@/components/common/Loader';
import Badge from '@/components/common/Badge';
import {
  ClipboardList, Phone, MapPin, Calendar, Clock, Bell,
  ChevronRight, UserCheck, CheckCircle2, XCircle, Sparkles,
  ThumbsUp, IndianRupee, ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';

interface AssignedClient {
  id: string;
  clientName: string;
  phone: string;
  email?: string;
  status: string;
  budget?: number;
  preferredLocation?: string;
  requirementType: string;
  inquiryType: string;
  followUpDate?: string;
  visitingDate?: string;
  visitingTime?: string;
  notes?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
  creator?: { name: string };
}

interface TodayVisit {
  id: string;
  clientName: string;
  phone: string;
  visitingDate: string;
  visitingTime?: string;
  preferredLocation?: string;
  status: string;
}

interface WorkData {
  assignedLeads: AssignedClient[];
  pendingFollowUps: AssignedClient[];
  todayVisits: TodayVisit[];
  stats: {
    total: number;
    new: number;
    interested: number;
    dealDone: number;
    rejected: number;
    followUpsDue: number;
    visitsToday: number;
  };
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string; badge: string }> = {
  New:        { icon: Sparkles,     color: 'text-blue-600',   bg: 'bg-blue-50',   badge: 'primary' },
  Interested: { icon: ThumbsUp,    color: 'text-amber-600',  bg: 'bg-amber-50',  badge: 'warning' },
  DealDone:   { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50',  badge: 'success' },
  Rejected:   { icon: XCircle,     color: 'text-red-600',    bg: 'bg-red-50',    badge: 'danger' },
};

function formatDate(date?: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatCurrency(amount: number) {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return amount.toLocaleString('en-IN');
}

function isOverdue(date?: string | null): boolean {
  if (!date) return false;
  return new Date(date) < new Date(new Date().toDateString());
}

export default function MyWorkPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [data, setData] = useState<WorkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'followups' | 'visits'>('all');

  const fetchWork = useCallback(async () => {
    try {
      const res = await fetch('/api/my-work', { credentials: 'include' });
      if (res.ok) {
        setData(await res.json());
      } else {
        console.error('My work API failed:', await res.text());
      }
    } catch (err) {
      console.error('Failed to fetch work:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWork(); }, [fetchWork]);

  if (loading) return <Loader fullScreen size="lg" message="Loading your work..." />;

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-sm">Failed to load work data</p>
      </div>
    );
  }

  const { assignedLeads, pendingFollowUps, todayVisits, stats } = data;

  const displayLeads = activeTab === 'followups'
    ? pendingFollowUps
    : activeTab === 'visits'
    ? assignedLeads.filter((l) => l.visitingDate && new Date(l.visitingDate).toDateString() === new Date().toDateString())
    : assignedLeads;

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">
          My Work
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-1">
          All leads and tasks assigned to you, {user?.name?.split(' ')[0] || 'there'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
          <p className="text-[10px] text-gray-400 font-medium uppercase">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 text-center">
          <p className="text-[10px] text-blue-500 font-medium uppercase">New</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{stats.new}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 text-center">
          <p className="text-[10px] text-amber-500 font-medium uppercase">Interested</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{stats.interested}</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100 text-center">
          <p className="text-[10px] text-green-500 font-medium uppercase">Deal Done</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{stats.dealDone}</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100 text-center">
          <p className="text-[10px] text-red-400 font-medium uppercase">Rejected</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.rejected}</p>
        </div>
        <div className={clsx(
          'rounded-2xl p-4 border text-center',
          stats.followUpsDue > 0
            ? 'bg-orange-50 border-orange-200'
            : 'bg-white border-gray-100'
        )}>
          <p className="text-[10px] text-orange-500 font-medium uppercase">Follow-ups</p>
          <p className={clsx('text-2xl font-bold mt-1', stats.followUpsDue > 0 ? 'text-orange-700' : 'text-gray-400')}>
            {stats.followUpsDue}
          </p>
        </div>
        <div className={clsx(
          'rounded-2xl p-4 border text-center',
          stats.visitsToday > 0
            ? 'bg-purple-50 border-purple-200'
            : 'bg-white border-gray-100'
        )}>
          <p className="text-[10px] text-purple-500 font-medium uppercase">Visits Today</p>
          <p className={clsx('text-2xl font-bold mt-1', stats.visitsToday > 0 ? 'text-purple-700' : 'text-gray-400')}>
            {stats.visitsToday}
          </p>
        </div>
      </div>

      {/* Today's Visits Alert */}
      {todayVisits.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
              <Calendar size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-bold text-purple-800">
              Today's Visits
              <span className="ml-2 text-xs font-medium bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
                {todayVisits.length}
              </span>
            </h2>
          </div>
          <div className="space-y-2">
            {todayVisits.map((visit) => (
              <div
                key={visit.id}
                onClick={() => router.push(`/dashboard/clients/${visit.id}`)}
                className="bg-white rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer
                  hover:shadow-md transition-shadow border border-purple-100"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{visit.clientName}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <span className="text-xs text-gray-500 flex items-center gap-0.5">
                      <Phone size={10} /> {visit.phone}
                    </span>
                    {visit.visitingTime && (
                      <span className="text-xs text-purple-600 font-semibold flex items-center gap-0.5">
                        <Clock size={10} /> {visit.visitingTime}
                      </span>
                    )}
                    {visit.preferredLocation && (
                      <span className="text-xs text-gray-500 flex items-center gap-0.5">
                        <MapPin size={10} /> {visit.preferredLocation}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Follow-ups Alert */}
      {pendingFollowUps.length > 0 && activeTab !== 'followups' && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                <Bell size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-orange-800">
                  {pendingFollowUps.length} Follow-up{pendingFollowUps.length > 1 ? 's' : ''} Due
                </h2>
                <p className="text-[11px] text-orange-600">Due today or overdue — needs your attention</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('followups')}
              className="text-xs font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              View All
            </button>
          </div>
        </div>
      )}

      {/* Tabs + Lead List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tab Bar */}
        <div className="flex border-b border-gray-100">
          {[
            { id: 'all' as const, label: 'All Assigned', count: assignedLeads.length, icon: ClipboardList },
            { id: 'followups' as const, label: 'Follow-ups Due', count: pendingFollowUps.length, icon: Bell },
            { id: 'visits' as const, label: "Today's Visits", count: todayVisits.length, icon: Calendar },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs sm:text-sm font-semibold transition-all border-b-2',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 bg-blue-50/40'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              )}
            >
              <tab.icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count > 0 && (
                <span className={clsx(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Lead Cards */}
        <div className="divide-y divide-gray-50">
          {displayLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                <UserCheck size={24} className="text-gray-300" />
              </div>
              <p className="text-gray-400 text-sm font-medium">
                {activeTab === 'followups'
                  ? 'No pending follow-ups'
                  : activeTab === 'visits'
                  ? 'No visits scheduled today'
                  : 'No leads assigned to you yet'}
              </p>
              {activeTab === 'all' && (
                <p className="text-xs text-gray-400">Ask your admin to assign leads from the Clients page</p>
              )}
            </div>
          ) : (
            displayLeads.map((lead) => {
              const config = STATUS_CONFIG[lead.status] || STATUS_CONFIG.New;
              const StatusIcon = config.icon;
              const overdue = isOverdue(lead.followUpDate);

              return (
                <div
                  key={lead.id}
                  onClick={() => router.push(`/dashboard/clients/${lead.id}`)}
                  className="px-4 sm:px-5 py-4 hover:bg-gray-50/50 cursor-pointer transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Client Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{lead.clientName}</p>
                        <Badge
                          label={lead.status}
                          variant={config.badge as any}
                        />
                        {overdue && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full animate-pulse">
                            OVERDUE
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone size={10} /> {lead.phone}
                        </span>
                        {lead.budget && (
                          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                            <IndianRupee size={10} /> {formatCurrency(lead.budget)}
                          </span>
                        )}
                        {lead.preferredLocation && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin size={10} /> {lead.preferredLocation}
                          </span>
                        )}
                        {lead.followUpDate && (
                          <span className={clsx(
                            'text-xs font-medium flex items-center gap-1',
                            overdue ? 'text-red-600' : 'text-orange-500'
                          )}>
                            <Bell size={10} /> Follow-up: {formatDate(lead.followUpDate)}
                          </span>
                        )}
                        {lead.visitingDate && (
                          <span className="text-xs text-purple-600 font-medium flex items-center gap-1">
                            <Calendar size={10} /> Visit: {formatDate(lead.visitingDate)}
                            {lead.visitingTime && ` at ${lead.visitingTime}`}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">
                          {lead.requirementType}
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">
                          {lead.inquiryType}
                        </span>
                        {lead.source && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">
                            {lead.source}
                          </span>
                        )}
                      </div>

                      {lead.notes && (
                        <p className="text-[11px] text-gray-400 mt-1.5 truncate max-w-md">
                          {lead.notes}
                        </p>
                      )}
                    </div>

                    {/* Right: Arrow */}
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-500 shrink-0 mt-1 transition-colors" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
