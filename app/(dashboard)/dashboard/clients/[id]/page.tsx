'use client';
import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import Loader from '@/components/common/Loader';
import {
  Users,
  CalendarCheck,
  BadgeDollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface AnalyticsData {
  summary: {
    totalClients: number;
    todayVisits: number;
    closedDeals: number;
    totalCommission: number;
  };
  leadsByStatus: Array<{
    status: string;
    _count: number;
  }>;
  monthlyData: Array<{
    month: string;
    leads: number;
    deals: number;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const StatCard = ({
  title,
  value,
  icon: Icon,
  color,
  sub,
  trend,
}: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  sub?: string;
  trend?: 'up' | 'down';
}) => (
  <div
    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4
      hover:shadow-md transition-shadow duration-200"
  >
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-500">{title}</span>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon size={20} style={{ color }} />
      </div>
    </div>
    <div className="flex items-end justify-between">
      <span className="text-3xl font-bold text-gray-900 tracking-tight">{value}</span>
      {sub && (
        <div
          className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full
            ${trend === 'up' ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}
        >
          {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {sub}
        </div>
      )}
    </div>
  </div>
);

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
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

// Custom pie label
const renderCustomLabel = ({
  cx, cy, midAngle, innerRadius, outerRadius, percent, name,
}: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchAnalytics();
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) {
        console.error('Analytics API failed:', await response.text());
        return;
      }
      setData(await response.json());
    } catch (error) {
      console.error('Analytics error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader fullScreen size="lg" message="Loading analytics..." />;

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <TrendingUp size={28} className="text-red-400" />
        </div>
        <p className="text-gray-500 font-medium">Failed to load analytics</p>
        <button
          onClick={fetchAnalytics}
          className="text-sm text-blue-600 hover:underline font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  const pieData = data.leadsByStatus.map((s) => ({
    name: s.status,
    value: s._count,
  }));

  const summaryCards = [
    {
      title: 'Total Clients',
      value: data.summary.totalClients.toLocaleString(),
      icon: Users,
      color: '#3b82f6',
      sub: '+12%',
      trend: 'up' as const,
    },
    {
      title: "Today's Visits",
      value: data.summary.todayVisits,
      icon: CalendarCheck,
      color: '#10b981',
      sub: '+5%',
      trend: 'up' as const,
    },
    {
      title: 'Closed Deals',
      value: data.summary.closedDeals,
      icon: TrendingUp,
      color: '#8b5cf6',
      sub: '-2%',
      trend: 'down' as const,
    },
    {
      title: 'Total Commission',
      value: `₹${(data.summary.totalCommission || 0).toLocaleString('en-IN')}`,
      icon: BadgeDollarSign,
      color: '#f59e0b',
      sub: '+18%',
      trend: 'up' as const,
    },
  ];

  return (
    <div className="py-6 sm:py-8 space-y-6 px-2 sm:px-0">

      {/* ── Header ── */}
      <div className="px-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Analytics
        </h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          Track your business performance
        </p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {summaryCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      {/* ── Monthly Trends ── */}
      {data.monthlyData && data.monthlyData.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          {/* Line Chart */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-800">Monthly Leads</h2>
              <p className="text-xs text-gray-400 mt-0.5">Leads vs Deals over time</p>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.monthlyData}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                <Line type="monotone" dataKey="leads" stroke="#3b82f6"
                  strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }}
                  activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="deals" stroke="#10b981"
                  strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }}
                  activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-800">Monthly Comparison</h2>
              <p className="text-xs text-gray-400 mt-0.5">Side-by-side leads and deals</p>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.monthlyData}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                <Bar dataKey="leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="deals" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Leads by Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Pie Chart */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-800">Leads by Status</h2>
            <p className="text-xs text-gray-400 mt-0.5">Distribution across pipeline stages</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="75%"
                labelLine={false}
                label={renderCustomLabel}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    stroke="white"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => (
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown List */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-800">Status Breakdown</h2>
            <p className="text-xs text-gray-400 mt-0.5">Count per stage</p>
          </div>
          <div className="space-y-3">
            {data.leadsByStatus.map((item, index) => {
              const total = data.leadsByStatus.reduce((s, i) => s + i._count, 0);
              const pct = total ? Math.round((item._count / total) * 100) : 0;
              const color = COLORS[index % COLORS.length];
              return (
                <div key={item.status}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm text-gray-700 capitalize font-medium">
                        {item.status.toLowerCase().replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">{item._count}</span>
                      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
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