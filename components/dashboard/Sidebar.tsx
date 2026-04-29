'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, TrendingUp,
  BarChart3, Settings, X, Building2,
  GitBranch, Briefcase, UserCog, Award,
  CalendarCheck, FolderTree, Handshake, Sparkles,
  BookOpen, Database,
} from 'lucide-react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Button } from '../common/Button';
import { useFeatureSet } from '@/hooks/useFeature';
import type { FeatureKey } from '@/lib/plans';

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
  /** If defined, item is hidden when the company doesn't have this feature */
  feature?: FeatureKey;
}

/** Nav items with optional role + feature gating.
 * Items without `feature` are always visible (subject to role check).
 * Items with `feature` are hidden unless the company has it unlocked.
 */
const navItems: NavItem[] = [
  // ── Everyone ──
  { href: '/dashboard',                  icon: LayoutDashboard, label: 'Dashboard'         },
  { href: '/dashboard/daily-plan',       icon: CalendarCheck,   label: 'Daily Plan',
    feature: 'feature.daily_plan' },

  // ── Team member only ──
  { href: '/dashboard/my-work',              icon: Briefcase,       label: 'My Work',
    roles: ['user'] },
  { href: '/dashboard/all-leads',            icon: Users,           label: 'My Leads',
    roles: ['user'] },
  { href: '/dashboard/pipeline',             icon: GitBranch,       label: 'My Pipeline',
    roles: ['user'] },
  { href: '/dashboard/commissions',          icon: TrendingUp,      label: 'My Commissions',
    roles: ['user'] },

  // ── Admin / SuperAdmin only ──
  { href: '/dashboard/all-leads',            icon: Users,           label: 'All Leads',
    roles: ['admin', 'superadmin'] },
  { href: '/dashboard/pipeline',             icon: GitBranch,       label: 'Deal Pipeline',
    roles: ['admin', 'superadmin'] },
  { href: '/dashboard/inventory',            icon: Building2,       label: 'Inventory',
    roles: ['admin', 'superadmin'] },
  { href: '/dashboard/projects-working',     icon: FolderTree,      label: 'Projects Working',
    roles: ['admin', 'superadmin'], feature: 'feature.projects_working' },
  { href: '/dashboard/brokers-requirements', icon: Handshake,       label: 'Brokers Requirements',
    roles: ['admin', 'superadmin'], feature: 'feature.broker_reqs' },
  { href: '/dashboard/find-opportunity',     icon: Sparkles,        label: 'Find Opportunity',
    roles: ['admin', 'superadmin'], feature: 'feature.opportunity_matcher' },
  { href: '/dashboard/learn-grow',           icon: BookOpen,        label: 'Learn & Grow',
    feature: 'feature.learn_grow' },
  { href: '/dashboard/database',             icon: Database,        label: 'Reference DB',
    roles: ['admin', 'superadmin'], feature: 'feature.reference_db' },
  { href: '/dashboard/commissions',          icon: TrendingUp,      label: 'Commissions',
    roles: ['admin', 'superadmin'] },
  { href: '/dashboard/analytics',            icon: BarChart3,       label: 'Analytics',
    roles: ['admin', 'superadmin'] },
  { href: '/dashboard/my-team',              icon: UserCog,         label: 'My Team',
    roles: ['admin', 'superadmin'] },
  { href: '/dashboard/all-team-performance', icon: Award,           label: 'All Team Performance',
    roles: ['admin', 'superadmin'] },

  // ── Everyone (bottom) ──
  { href: '/dashboard/settings',         icon: Settings,        label: 'Settings'          },
];

/** Main navigation sidebar with role + feature gating, mobile overlay. */
export function Sidebar({ isOpen, onClose, user }: SidebarProps) {
  const pathname = usePathname();
  const features = useFeatureSet();

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const visibleItems = navItems.filter((item) => {
    if (item.roles) {
      if (!user?.role) return false;
      if (!item.roles.includes(user.role as 'admin' | 'superadmin' | 'user')) return false;
    }
    if (item.feature && !features.includes(item.feature)) return false;
    return true;
  });

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
          <Link href="/dashboard" aria-label="Broker365 home" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logodark.svg"
              alt="Broker365"
              className="h-9 w-auto select-none"
              draggable={false}
            />
          </Link>

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
          {visibleItems.map(({ href, icon: Icon, label }, idx) => {
            const isActive =
              href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname === href || pathname?.startsWith(href + '/');

            return (
              <Link key={`${href}-${idx}`} href={href} onClick={onClose}>
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
