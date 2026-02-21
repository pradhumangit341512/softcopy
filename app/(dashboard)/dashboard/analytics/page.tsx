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
import Card, { CardBody, CardHeader } from '@/components/common/Card';
import Loader from '@/components/common/Loader';
import { useAuth } from '@/hooks/useAuth';

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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // 🚀 Fetch only AFTER auth user available
  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Analytics API failed:', errText);
        setLoading(false);
        return;
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Analytics error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loader fullScreen size="lg" message="Loading analytics..." />;
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-gray-500">
        Failed to load analytics
      </div>
    );
  }

  const pieData = data.leadsByStatus.map((status) => ({
    name: status.status,
    value: status._count,
  }));

  return (
    <div className="py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">Track your business performance</p>
      </div>

      {/* metrics + charts (your UI remains same) */}
    </div>
  );
}
