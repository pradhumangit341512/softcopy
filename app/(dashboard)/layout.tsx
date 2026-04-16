'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';
import { useAuth } from '@/hooks/useAuth';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { Loader } from '@/components/common/Loader';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, hasFetched, logout } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-logout after 24 hours of inactivity
  useInactivityLogout();

  // Redirect only AFTER we've actually tried to fetch the user.
  // Without `hasFetched`, this effect fires on the very first render when
  // user=null, isLoading=false — racing past the fetchUser call and
  // bouncing authenticated users back to /login.
  useEffect(() => {
    if (!hasFetched) return;
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, hasFetched, router]);

  // Keep the loader visible until the first fetch resolves. Returning
  // `null` during the pre-fetch window flashes a blank screen.
  if (isLoading || !hasFetched) {
    return <Loader fullScreen size="lg" message="Loading..." />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={logout}
        />

        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
