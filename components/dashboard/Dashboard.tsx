'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import StatsCard from './StatsCard';
import VisitReminder from './VisitReminder';
import { TodayVisit } from '@/lib/types';
import Link from 'next/link';
import { Users, CheckCircle2, TrendingUp, CalendarCheck, Phone, MapPin, Clock, UserCheck, Bell } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAnalytics(); }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics', { credentials: 'include' });
      if (response.ok) setData(await response.json());
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-sm">Failed to load dashboard</p>
      </div>
    );
  }

  const todayVisits: TodayVisit[] = data.todayVisits || [];
  const totalClients = data.summary.totalClients || 1;

  return (
    <div className="space-y-5">

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard
          title="Total Clients"
          value={data.summary.totalClients}
          icon="👥"
        />
        <StatsCard
          title="Today's Visits"
          value={data.summary.todayVisitsCount}
          icon="📅"
          highlight={data.summary.todayVisitsCount > 0}
        />
        <StatsCard
          title="Closed Deals"
          value={data.summary.closedDeals}
          icon="✅"
        />
        <StatsCard
          title="Commission"
          value={`₹${(data.summary.allTimeCommission || data.summary.totalCommission || 0).toLocaleString('en-IN')}`}
          icon="💰"
        />
      </div>

      {/* ── MY WORK (Assigned Leads) ── */}
      {(data.summary.myAssignedLeads > 0 || data.summary.myPendingFollowUps > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Link href="/dashboard/my-work">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl border border-blue-200 p-4 sm:p-5
              flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-11 h-11 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
                <UserCheck size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-blue-600">My Assigned Leads</p>
                <p className="text-2xl font-bold text-blue-900">{data.summary.myAssignedLeads}</p>
                <p className="text-[11px] text-blue-500 mt-0.5">Tap to view your work</p>
              </div>
            </div>
          </Link>

          {data.summary.myPendingFollowUps > 0 && (
            <Link href="/dashboard/my-work">
              <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl border border-orange-200 p-4 sm:p-5
                flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-11 h-11 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
                  <Bell size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-orange-600">Pending Follow-ups</p>
                  <p className="text-2xl font-bold text-orange-900">{data.summary.myPendingFollowUps}</p>
                  <p className="text-[11px] text-orange-500 mt-0.5">Tap to view follow-ups</p>
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* ── VISIT REMINDER ── */}
      {data.summary.todayVisitsCount > 0 && (
        <VisitReminder visitCount={data.summary.todayVisitsCount} />
      )}

      {/* ── TODAY'S VISITS ── */}
      {todayVisits.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <CalendarCheck size={14} className="text-blue-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">
              Today's Visiting Clients
              <span className="ml-2 text-xs font-medium text-gray-400 bg-gray-100
                px-2 py-0.5 rounded-full">
                {todayVisits.length}
              </span>
            </h3>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['#', 'Client', 'Phone', 'Time', 'Location'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500
                      uppercase tracking-wide text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {todayVisits.map((visit, index) => (
                  <tr key={visit.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3.5 text-sm text-gray-400 font-medium">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-bold text-gray-900">
                      {visit.clientName}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">{visit.phone}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-semibold text-blue-600
                        bg-blue-50 px-2.5 py-1 rounded-full">
                        {visit.visitingTime}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">
                      {visit.location || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {todayVisits.map((visit, index) => (
              <div key={visit.id} className="px-4 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600
                      text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <p className="text-sm font-bold text-gray-900">{visit.clientName}</p>
                  </div>
                  <span className="text-xs font-semibold text-blue-600
                    bg-blue-50 px-2.5 py-1 rounded-full">
                    {visit.visitingTime}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pl-7">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Phone size={11} /> {visit.phone}
                  </span>
                  {visit.location && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin size={11} /> {visit.location}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CHARTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Monthly Performance */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-800">Monthly Performance</h3>
            <p className="text-xs text-gray-400 mt-0.5">Leads vs Deals over time</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.monthlyData} barCategoryGap="30%"
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
              <Bar dataKey="leads" fill="#3b82f6" name="Leads" radius={[4, 4, 0, 0]} />
              <Bar dataKey="deals" fill="#10b981" name="Deals" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Lead Status */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-800">Lead Status</h3>
            <p className="text-xs text-gray-400 mt-0.5">Distribution across pipeline</p>
          </div>
          <div className="space-y-3">
            {data.leadsByStatus.map((status: any, index: number) => {
              const pct = Math.round((status._count / totalClients) * 100);
              const color = COLORS[index % COLORS.length];
              return (
                <div key={status.status}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }} />
                      <span className="text-sm text-gray-700 font-medium capitalize">
                        {status.status.toLowerCase().replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">{status._count}</span>
                      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}