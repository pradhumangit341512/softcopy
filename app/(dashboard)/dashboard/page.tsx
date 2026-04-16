'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader } from '@/components/common/Loader';

/**
 * /dashboard — legacy URL kept as a role-aware redirect.
 *
 * New code should link directly to /admin/dashboard or /team/dashboard.
 * This page exists so old bookmarks, emails, and hardcoded refs keep working.
 */
export default function DashboardRedirect() {
  const router = useRouter();
  const { user, isLoading, hasFetched } = useAuth();

  useEffect(() => {
    if (!hasFetched || isLoading) return;
    if (!user) return; // parent layout handles unauthenticated
    if (user.role === 'admin' || user.role === 'superadmin') {
      router.replace('/admin/dashboard');
    } else {
      router.replace('/team/dashboard');
    }
  }, [user, isLoading, hasFetched, router]);

  return <Loader size="md" message="Loading..." />;
}
