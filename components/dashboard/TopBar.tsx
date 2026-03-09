'use client';

import { Menu, Bell, LogOut, User, Search, ChevronDown, X } from 'lucide-react';
import Link from 'next/link';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import NotificationDropdown from '../notifications/NotificationDropdown';
import { TodayVisit } from '@/lib/types';

interface TopBarProps {
  user: any;
  onMenuClick: () => void;
  onLogout: () => void;
}

export default function TopBar({ user, onMenuClick, onLogout }: TopBarProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [showUserMenu, setShowUserMenu]           = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [todayVisits, setTodayVisits]             = useState<TodayVisit[]>([]);
  const [loadingVisits, setLoadingVisits]         = useState(false);
  const [showMobileSearch, setShowMobileSearch]   = useState(false);
  const [searchValue, setSearchValue]             = useState(
    () => searchParams.get('search') || ''
  );

  const userMenuRef    = useRef<HTMLDivElement>(null);
  const notifRef       = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdowns on outside click
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

  // Auto-focus mobile search when opened
  useEffect(() => {
    if (showMobileSearch) mobileInputRef.current?.focus();
  }, [showMobileSearch]);

  // Clear search when leaving /clients
  useEffect(() => {
    if (!pathname.includes('/clients')) {
      setSearchValue('');
      setShowMobileSearch(false);
    }
  }, [pathname]);

  // Debounced push to URL
  const pushSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (value.trim()) {
          params.set('search', value.trim());
          params.set('page', '1');
        } else {
          params.delete('search');
          params.delete('page');
        }
        router.push(`/dashboard/clients?${params.toString()}`);
      }, 400);
    },
    [router, searchParams]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    pushSearch(value);
  };

  const clearSearch = () => {
    setSearchValue('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('search');
    router.push(`/dashboard/clients?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      clearSearch();
      setShowMobileSearch(false);
    }
  };

  const fetchTodayVisits = async () => {
    try {
      setLoadingVisits(true);
      const res  = await fetch('/api/analytics', { credentials: 'include' });
      const data = await res.json();
      setTodayVisits(data.todayVisits || []);
    } catch (err) {
      console.error('Failed to fetch visits', err);
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

      {/* ════════════════════════════════
          Main bar  (all screen sizes)
      ════════════════════════════════ */}
      <div className="px-3 sm:px-4 md:px-6 h-14 flex items-center gap-2">

        {/* Hamburger — visible on < lg */}
        <button
          onClick={onMenuClick}
          aria-label="Toggle sidebar"
          className="lg:hidden w-9 h-9 rounded-xl border border-gray-200 bg-white
            flex items-center justify-center text-gray-600 hover:bg-gray-50
            transition-colors shrink-0"
        >
          <Menu size={18} />
        </button>

        {/* Desktop search — hidden on < md */}
        <div className="hidden md:flex flex-1 max-w-xs lg:max-w-sm xl:max-w-md">
          <div className="relative w-full">
            <Search size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchValue}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              placeholder="Search clients..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl
                bg-gray-50 focus:bg-white focus:outline-none focus:ring-2
                focus:ring-blue-500/20 focus:border-blue-400 transition-all
                text-gray-800 placeholder:text-gray-400"
            />
            {searchValue && (
              <button onClick={clearSearch} aria-label="Clear"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">

          {/* Mobile search icon — hidden on md+ */}
          <button
            onClick={() => setShowMobileSearch(v => !v)}
            aria-label="Search"
            className="md:hidden w-9 h-9 rounded-xl border border-gray-200 bg-white
              flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {showMobileSearch ? <X size={17} /> : <Search size={17} />}
          </button>

          {/* Bell */}
          <div ref={notifRef} className="relative">
            <button
              onClick={handleBellClick}
              aria-label="Notifications"
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
              onClick={() => { setShowUserMenu(v => !v); setShowNotifications(false); }}
              aria-label="User menu"
              className="flex items-center gap-1.5 sm:gap-2 pl-1 pr-1.5 sm:pr-2.5 py-1
                rounded-xl hover:bg-gray-50 border border-transparent
                hover:border-gray-200 transition-all"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-xl bg-linear-to-br from-blue-500 to-blue-600
                flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
                {initials}
              </div>
              {/* Name — hidden on xs */}
              <span className="hidden sm:block text-sm font-semibold text-gray-700
                max-w-[80px] lg:max-w-[130px] truncate">
                {user?.name}
              </span>
              <ChevronDown size={13}
                className={`hidden sm:block text-gray-400 transition-transform shrink-0
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
                  {/* Role badge — useful on mobile where name is hidden in topbar */}
                  <span className="mt-1.5 inline-block text-xs bg-blue-50 text-blue-600
                    px-2 py-0.5 rounded-full font-medium capitalize">
                    {user?.role}
                  </span>
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

      {/* ════════════════════════════════
          Mobile search bar (slide-down)
          Shown only on < md when toggled
      ════════════════════════════════ */}
      {showMobileSearch && (
        <div className="md:hidden px-3 pb-3 pt-1 border-t border-gray-100 bg-white
          animate-in slide-in-from-top-1 duration-150">
          <div className="relative w-full">
            <Search size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={mobileInputRef}
              type="text"
              value={searchValue}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              placeholder="Search clients..."
              className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl
                bg-gray-50 focus:bg-white focus:outline-none focus:ring-2
                focus:ring-blue-500/20 focus:border-blue-400 transition-all
                text-gray-800 placeholder:text-gray-400"
            />
            {searchValue && (
              <button
                onClick={() => { clearSearch(); setShowMobileSearch(false); }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}