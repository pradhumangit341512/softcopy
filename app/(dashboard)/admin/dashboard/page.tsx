'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { Loader } from '@/components/common/Loader';

/**
 * Admin dashboard at /admin/dashboard.
 *
 * Access is enforced in three layers:
 *   1. Middleware — blocks unauthenticated requests and wrong-role users at
 *      the edge before they hit this page at all.
 *   2. Parent layout — redirects anyone without a user session.
 *   3. This component — belt-and-suspenders: if somehow a non-admin reaches
 *      this page, redirect them to their correct dashboard.
 *
 * Admin + superadmin both land here.
 */
export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isLoading, hasFetched } = useAuth();

  useEffect(() => {
    if (!hasFetched || isLoading) return;
    if (!user) return; // parent layout handles redirect to /login
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      router.replace('/team/dashboard');
    }
  }, [user, isLoading, hasFetched, router]);

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <Loader size="md" message="Verifying access..." />;
  }

  return <DashboardShell />;
}
