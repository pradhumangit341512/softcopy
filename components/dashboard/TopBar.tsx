'use client';

import { Menu, Bell, LogOut, User, Settings, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import NotificationDropdown from '../notifications/NotificationDropdown';
import { TodayVisit } from '@/lib/types';

interface TopBarProps {
  user: any;
  onMenuClick: () => void;
  onLogout: () => void;
}

export default function TopBar({ user, onMenuClick, onLogout }: TopBarProps) {
  const [showUserMenu, setShowUserMenu]       = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [todayVisits, setTodayVisits]         = useState<TodayVisit[]>([]);
  const [loadingVisits, setLoadingVisits]     = useState(false);

  const userMenuRef  = useRef<HTMLDivElement>(null);
  const notifRef     = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setShowUserMenu(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotifications(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchTodayVisits = async () => {
    try {
      setLoadingVisits(true);
      const res  = await fetch('/api/analytics', { credentials: 'include' });
      const data = await res.json();
      setTodayVisits(data.todayVisits || []);
    } catch (error) {
      console.error('Failed to fetch visits', error);
    } finally {
      setLoadingVisits(false);
    }
  };

  const handleBellClick = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    setShowUserMenu(false);
    if (next) fetchTodayVisits();
  };

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">

        {/* ── Left: hamburger (mobile) ── */}
        <button
          onClick={onMenuClick}
          className="md:hidden w-9 h-9 rounded-xl border border-gray-200 bg-white
            flex items-center justify-center text-gray-600 hover:bg-gray-50
            transition-colors flex-shrink-0"
        >
          <Menu size={18} />
        </button>

        {/* ── Center: search ── */}
        <div className="hidden md:flex flex-1 max-w-sm">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search clients..."
              className="w-full pl-4 pr-4 py-2 text-sm border border-gray-200 rounded-xl
                bg-gray-50 focus:bg-white focus:outline-none focus:ring-2
                focus:ring-blue-500/20 focus:border-blue-400 transition-all text-gray-800
                placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* ── Right: bell + user ── */}
        <div className="flex items-center gap-2 ml-auto">

          {/* Bell */}
          <div ref={notifRef} className="relative">
            <button
              onClick={handleBellClick}
              className="relative w-9 h-9 rounded-xl border border-gray-200 bg-white
                flex items-center justify-center text-gray-500 hover:text-gray-800
                hover:bg-gray-50 transition-colors"
            >
              <Bell size={17} />
              {todayVisits.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500
                  rounded-full ring-2 ring-white" />
              )}
            </button>

            {showNotifications && (
              <NotificationDropdown
                visits={todayVisits}
                onClose={() => setShowNotifications(false)}
              />
            )}
          </div>

          {/* User menu */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl
                hover:bg-gray-50 border border-transparent hover:border-gray-200
                transition-all"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600
                flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {initials}
              </div>
              <span className="hidden sm:block text-sm font-semibold text-gray-700 max-w-[100px] truncate">
                {user?.name}
              </span>
              <ChevronDown size={13} className={`hidden sm:block text-gray-400 transition-transform
                ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-100
                rounded-2xl shadow-xl overflow-hidden z-50 py-1">

                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{user?.email}</p>
                </div>

                <Link href="/dashboard/settings" onClick={() => setShowUserMenu(false)}>
                  <span className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700
                    hover:bg-gray-50 transition-colors cursor-pointer">
                    <User size={15} className="text-gray-400" />
                    Profile & Settings
                  </span>
                </Link>

                <div className="border-t border-gray-100 mt-1">
                  <button
                    onClick={() => { setShowUserMenu(false); onLogout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm
                      text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}