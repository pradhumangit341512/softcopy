'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type ApiMonthly = {
  month: string;
  leads: number;
  deals: number;
};

type ApiStatus = {
  status: string;
  _count: number;
};

type ApiResponse = {
  summary: {
    totalClients: number;
    todayVisits: number;
    closedDeals: number;
    totalCommission: number;
  };
  leadsByStatus: ApiStatus[];
  monthlyData: ApiMonthly[];
};

interface ChartMonthly {
  month: string;
  clients: number;
  commissions: number;
  revenue: number;
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AnalyticsChart() {
  const [data, setData] = useState<ChartMonthly[]>([]);
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/analytics', {
        method: 'GET',
        credentials: 'include', // 🔥 important for JWT cookie
      });

      if (!response.ok) throw new Error('API failed');

      const result: ApiResponse = await response.json();

      // ===== Transform monthly API data =====
      const monthly: ChartMonthly[] = result.monthlyData.map((m) => ({
        month: m.month,
        clients: m.leads,
        commissions: m.deals,
        revenue: m.deals * 50000, // estimated revenue
      }));

      // ===== Transform status API data =====
      const status: StatusData[] = result.leadsByStatus.map((s, i) => ({
        name: s.status,
        value: s._count,
        color: COLORS[i % COLORS.length],
      }));

      setData(monthly);
      setStatusData(status);
    } catch (error) {
      console.error('Analytics fetch failed:', error);

      // fallback mock data
      setData(generateMockData());
      setStatusData(generateMockStatusData());
    } finally {
      setLoading(false);
    }
  };

  // ===== Derived stats (optimized with memo) =====
  const stats = useMemo(() => {
    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
    const totalDeals = data.reduce((sum, d) => sum + d.commissions, 0);
    const totalClients = data.reduce((sum, d) => sum + d.clients, 0);

    return {
      totalRevenue,
      totalDeals,
      totalClients,
      avgCommission: totalDeals
        ? Math.round(totalRevenue / totalDeals)
        : 0,
    };
  }, [data]);

  // ===== Loading UI =====
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Analytics Dashboard
          </h2>
          <p className="text-gray-600 mt-1">
            Track your business performance
          </p>
        </div>

        <button
          onClick={fetchAnalyticsData}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
        >
          Refresh
        </button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenue & Deals */}
        <ChartCard title="Revenue & Commissions Trend">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" />
              <Line type="monotone" dataKey="commissions" stroke="#10b981" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Clients */}
        <ChartCard title="New Clients Added">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="clients" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Status */}
        <ChartCard title="Client Status Distribution">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={statusData} dataKey="value" outerRadius={90}>
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Metrics */}
        <ChartCard title="Key Metrics">
          <Metrics stats={stats} />
        </ChartCard>

      </div>
    </div>
  );
}

/* ================= COMPONENTS ================= */

function ChartCard({ title, children }: any) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Metrics({ stats }: any) {
  return (
    <div className="space-y-4">
      <Metric label="Total Revenue" value={`₹${(stats.totalRevenue / 100000).toFixed(2)}L`} />
      <Metric label="Total Deals" value={`${stats.totalDeals}`} />
      <Metric label="Total Clients" value={`${stats.totalClients}`} />
      <Metric label="Avg Commission" value={`₹${stats.avgCommission}`} />
    </div>
  );
}

function Metric({ label, value }: any) {
  return (
    <div className="flex justify-between p-3 bg-gray-50 rounded">
      <span>{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

/* ================= MOCK ================= */

function generateMockData(): ChartMonthly[] {
  return [
    { month: 'Jan', clients: 12, commissions: 5, revenue: 250000 },
    { month: 'Feb', clients: 19, commissions: 8, revenue: 380000 },
    { month: 'Mar', clients: 25, commissions: 12, revenue: 520000 },
  ];
}

function generateMockStatusData(): StatusData[] {
  return [
    { name: 'New', value: 45, color: '#3b82f6' },
    { name: 'Interested', value: 120, color: '#10b981' },
    { name: 'Deal Done', value: 85, color: '#f59e0b' },
  ];
}
