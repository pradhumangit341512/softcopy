'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, TrendingUp,
  BarChart3, Settings, X, Building2,
  GitBranch, Briefcase, UserCog, Award,
} from 'lucide-react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Button } from '../common/Button';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: { name?: string; email?: string; role?: string } | null;
}

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  /** If defined, only these roles see the item */
  roles?: Array<'admin' | 'superadmin' | 'user'>;
}

/** Nav items with optional role-based visibility */
const navItems: NavItem[] = [
  { href: '/dashboard',                  icon: LayoutDashboard, label: 'Dashboard'        },
  { href: '/dashboard/my-work',          icon: Briefcase,       label: 'My Work',
    roles: ['user'] },
  { href: '/dashboard/clients',          icon: Users,           label: 'Clients'          },
  { href: '/dashboard/pipeline',         icon: GitBranch,       label: 'Deal Pipeline'    },
  { href: '/dashboard/properties',       icon: Building2,       label: 'Properties'       },
  { href: '/dashboard/commissions',      icon: TrendingUp,      label: 'Commissions'      },
  { href: '/dashboard/analytics',        icon: BarChart3,       label: 'Analytics',
    roles: ['admin', 'superadmin'] },
  { href: '/dashboard/team',             icon: UserCog,         label: 'Team',
    roles: ['admin', 'superadmin'] },
  { href: '/dashboard/team-performance', icon: Award,           label: 'Team Performance',
    roles: ['admin', 'superadmin'] },
  { href: '/dashboard/settings',         icon: Settings,        label: 'Settings'         },
];

/** Main navigation sidebar with links, user info, and mobile responsive behavior */
export function Sidebar({ isOpen, onClose, user }: SidebarProps) {
  const pathname = usePathname();

  // initials from name
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <>
      {/* ── Mobile backdrop ── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={clsx(
          'fixed md:static inset-y-0 left-0 z-50',
          'w-64 flex flex-col',
          'bg-gray-900 text-white',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* ── Logo ── */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-800">
          <div>
            <h1 className="text-lg font-bold font-display tracking-tight text-white">
              RealEstate CRM
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">v1.0</p>
          </div>

          {/* Close button — mobile only */}
          <Button
            onClick={onClose}
            className="md:hidden w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700
              flex items-center justify-center text-gray-400 hover:text-white
              transition-colors"
          >
            <X size={16} />
          </Button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems
            .filter((item) => {
              // No roles restriction → visible to everyone
              if (!item.roles) return true;
              // Hide until we know the user's role
              if (!user?.role) return false;
              return item.roles.includes(user.role as 'admin' | 'superadmin' | 'user');
            })
            .map(({ href, icon: Icon, label }) => {
            const isActive =
              href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname === href || pathname.startsWith(href + '/');

            return (
              <Link key={href} href={href} onClick={onClose}>
                <span
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150',
                    'text-sm font-medium cursor-pointer',
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <Icon
                    size={18}
                    className={clsx(
                      'shrink-0 transition-colors',
                      isActive ? 'text-white' : 'text-gray-500'
                    )}
                  />
                  {label}

                  {/* Active indicator dot */}
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* ── User info ── */}
        <div className="px-4 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            {/* Avatar with initials */}
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-500 to-blue-600
              flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-md">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email}
              </p>
            </div>
            {/* Role pill */}
            {user?.role && (
              <span className="text-xs font-semibold text-blue-400 bg-blue-900/40
                px-2 py-0.5 rounded-full capitalize -shrink-0">
                {user.role}
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}