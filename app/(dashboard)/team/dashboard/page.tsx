'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { Loader } from '@/components/common/Loader';

/**
 * Team dashboard at /team/dashboard.
 *
 * DB role stays as `user` (to avoid a migration); we render the spec's
 * "team" URL by mapping user → /team/dashboard in redirects + middleware.
 * Admins hitting this route are bounced to /admin/dashboard.
 */
export default function TeamDashboardPage() {
  const router = useRouter();
  const { user, isLoading, hasFetched } = useAuth();

  useEffect(() => {
    if (!hasFetched || isLoading) return;
    if (!user) return;
    if (user.role === 'admin' || user.role === 'superadmin') {
      router.replace('/admin/dashboard');
    }
  }, [user, isLoading, hasFetched, router]);

  if (!user || user.role === 'admin' || user.role === 'superadmin') {
    return <Loader size="md" message="Verifying access..." />;
  }

  return <DashboardShell />;
}
