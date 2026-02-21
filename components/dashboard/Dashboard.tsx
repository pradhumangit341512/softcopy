'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StatsCard from './StatsCard';
import VisitReminder from './VisitReminder';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!data) return <div className="p-8">Failed to load dashboard</div>;

  return (
    <div className="space-y-8 p-8">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Clients"
          value={data.summary.totalClients}
          icon="👥"
        />
        <StatsCard
          title="Today's Visits"
          value={data.summary.todayVisits}
          icon="📅"
          highlight={data.summary.todayVisits > 0}
        />
        <StatsCard
          title="Closed Deals"
          value={data.summary.closedDeals}
          icon="✅"
        />
        <StatsCard
          title="Monthly Commission"
          value={`₹${(data.summary.totalCommission || 0).toLocaleString()}`}
          icon="💰"
        />
      </div>

      {/* Visit Reminder */}
      {data.summary.todayVisits > 0 && (
        <VisitReminder visitCount={data.summary.todayVisits} />
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Leads & Deals */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Monthly Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="leads" fill="#3b82f6" name="Leads" />
              <Bar dataKey="deals" fill="#10b981" name="Deals" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Lead Status Distribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Lead Status</h3>
            <div className="space-y-3">
            {data.leadsByStatus.map((status: any) => (
              <div key={status.status} className="flex justify-between items-center">
                <span className="font-medium">{status.status}</span>
                <div className="flex items-center gap-2">
                  <div className="w-48 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <progress
                      value={status._count}
                      max={data.summary.totalClients}
                      className="w-full h-2 progress-bar"
                    />
                  </div>
                  <span className="font-semibold">{status._count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}