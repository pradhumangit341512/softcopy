'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
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
  ComposedChart,
} from 'recharts';

/* ================= TYPES ================= */

type RevenueData = {
  month: string;
  revenue: number;
  target: number;
  profit: number;
  expenses: number;
};

type SourceData = {
  source: string;
  amount: number;
  percentage: number;
};

/* ================= FORMATTERS ================= */

const currencyFormatter = (value: unknown) => {
  if (typeof value !== 'number') return '₹0';
  return `₹${(value / 100000).toFixed(2)}L`;
};

/* ================= COMPONENT ================= */

export default function RevenueGraph() {
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [sourceData, setSourceData] = useState<SourceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'3m' | '6m' | '12m'>('6m');

  useEffect(() => {
    fetchRevenueData();
  }, [timeframe]);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/analytics/revenue?period=${timeframe}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('API failed');

      const result = await response.json();

      setRevenueData(result.revenueData ?? generateMockRevenueData(timeframe));
      setSourceData(result.sourceData ?? generateMockSourceData());
    } catch (error) {
      console.error('Revenue API failed → using mock:', error);
      setRevenueData(generateMockRevenueData(timeframe));
      setSourceData(generateMockSourceData());
    } finally {
      setLoading(false);
    }
  };

  /* ================= STATS ================= */

  const stats = useMemo(() => {
    const totalRevenue = revenueData.reduce((sum, d) => sum + (d.revenue || 0), 0);
    const totalProfit = revenueData.reduce((sum, d) => sum + (d.profit || 0), 0);
    const totalExpenses = revenueData.reduce((sum, d) => sum + (d.expenses || 0), 0);

    const averageRevenue = totalRevenue / (revenueData.length || 1);

    const profitMargin =
      totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : '0';

    return {
      totalRevenue,
      totalProfit,
      totalExpenses,
      averageRevenue,
      profitMargin,
    };
  }, [revenueData]);

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-b-4 border-blue-500 rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading revenue analytics...</p>
        </div>
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="space-y-6 p-6 bg-gray-50 rounded-lg">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Revenue Analytics</h1>
          <p className="text-gray-600">Business revenue insights</p>
        </div>

        <div className="flex gap-2">
          {(['3m', '6m', '12m'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setTimeframe(period)}
              className={`px-4 py-2 rounded-lg ${
                timeframe === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border'
              }`}
            >
              {period === '3m'
                ? '3 Months'
                : period === '6m'
                ? '6 Months'
                : '1 Year'}
            </button>
          ))}
        </div>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric title="Total Revenue" value={currencyFormatter(stats.totalRevenue)} />
        <Metric title="Total Profit" value={currencyFormatter(stats.totalProfit)} />
        <Metric title="Expenses" value={currencyFormatter(stats.totalExpenses)} />
        <Metric title="Profit Margin" value={`${stats.profitMargin}%`} />
      </div>

      {/* REVENUE VS TARGET */}
      <ChartCard title="Revenue vs Target">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={currencyFormatter} />
            <Legend />
            <Area dataKey="revenue" fill="#3b82f6" stroke="#1e3a8a" />
            <Line dataKey="target" stroke="#ef4444" strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* PROFIT / EXPENSE */}
      <ChartCard title="Profit vs Expenses">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={currencyFormatter} />
            <Legend />
            <Bar dataKey="profit" fill="#10b981" />
            <Bar dataKey="expenses" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* REVENUE TREND */}
      <ChartCard title="Revenue Trend">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={currencyFormatter} />
            <Legend />
            <Line dataKey="revenue" stroke="#3b82f6" />
            <Line dataKey="profit" stroke="#10b981" />
            <Line dataKey="expenses" stroke="#f59e0b" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

/* ================= SMALL COMPONENTS ================= */

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white p-5 rounded-lg shadow">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}

/* ================= MOCK DATA ================= */

function generateMockRevenueData(period: '3m' | '6m' | '12m'): RevenueData[] {
  const months =
    period === '3m'
      ? ['Apr', 'May', 'Jun']
      : period === '6m'
      ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
      : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return months.map((month, idx) => ({
    month,
    revenue: 200000 + Math.random() * 500000,
    target: 300000 + idx * 40000,
    profit: 100000 + Math.random() * 200000,
    expenses: 80000 + Math.random() * 150000,
  }));
}

function generateMockSourceData(): SourceData[] {
  return [
    { source: 'Direct Sales', amount: 450000, percentage: 35 },
    { source: 'Referrals', amount: 380000, percentage: 29 },
    { source: 'Digital', amount: 320000, percentage: 25 },
    { source: 'Partners', amount: 140000, percentage: 11 },
  ];
}
