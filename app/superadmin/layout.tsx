'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { Loader } from '@/components/common/Loader';
import { Building2, CreditCard, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';

const NAV = [
  { href: '/superadmin', label: 'Overview', icon: LayoutDashboard },
  { href: '/superadmin/companies', label: 'Companies', icon: Building2 },
  { href: '/superadmin/payments', label: 'Payments', icon: CreditCard },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, hasFetched, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useInactivityLogout();

  // Gate on both `hasFetched` AND `isLoading` — don't redirect until
  // the auth fetch has fully resolved.
  useEffect(() => {
    if (!hasFetched || isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'superadmin') {
      router.replace('/admin/dashboard');
    }
  }, [user, hasFetched, isLoading, router]);

  if (isLoading || !hasFetched || !user) return <Loader fullScreen size="lg" message="Loading..." />;
  if (user.role !== 'superadmin') return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/superadmin" className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            <span className="font-semibold">SuperAdmin Console</span>
          </Link>
          <div className="flex items-center gap-6">
            <span className="text-sm text-slate-300 hidden md:inline">
              {user.email}
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === '/superadmin'
                ? pathname === '/superadmin'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition ${
                  active
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
