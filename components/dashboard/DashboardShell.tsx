'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import { Loader } from '@/components/common/Loader';

const Dashboard = dynamic(
  () =>
    import('@/components/dashboard/Dashboard').then((mod) => ({
      default: mod.Dashboard,
    })),
  {
    loading: () => <Loader size="md" message="Loading dashboard..." />,
  }
);

/**
 * Shared dashboard body — used by BOTH /admin/dashboard and /team/dashboard.
 *
 * The only difference between the two routes is the role gate (enforced by
 * middleware + route-level guard). Content is identical; individual widgets
 * inside `<Dashboard />` already filter their data by role.
 */
export function DashboardShell() {
  const { user } = useAuth();

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">
            {greeting}, {firstName}! 👋
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>

        <div
          className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-100
          rounded-xl shadow-sm w-fit text-xs sm:text-sm text-gray-500 font-medium self-start sm:self-auto"
        >
          📅{' '}
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </div>
      </div>

      <Dashboard />
    </div>
  );
}
