'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Dashboard from '@/components/dashboard/Dashboard';
import Loader from '@/components/common/Loader';

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <Loader size="md" message="Loading dashboard..." />;
  }

  // ── Greeting based on time of day ──
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
                'Good evening';

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">
            {greeting}, {firstName}! 👋
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            Here's what's happening with your business today.
          </p>
        </div>

        {/* Today's date pill */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-100
          rounded-xl shadow-sm w-fit text-xs sm:text-sm text-gray-500 font-medium self-start sm:self-auto">
          📅 {new Date().toLocaleDateString('en-IN', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
          })}
        </div>
      </div>

      {/* ── DASHBOARD CONTENT ── */}
      <Dashboard />

    </div>
  );
}