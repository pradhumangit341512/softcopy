'use client';

import { Menu, Bell, LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import Button from '../common/ Button';

interface TopBarProps {
  user: any;
  onMenuClick: () => void;
  onLogout: () => void;
}

export default function TopBar({ user, onMenuClick, onLogout }: TopBarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="px-4 py-4 flex items-center justify-between">
        {/* Left */}
        <Button
          onClick={onMenuClick}
          className="md:hidden text-gray-600 hover:text-gray-900"
        >
          <Menu size={24} />
        </Button>

        {/* Center - Search */}
        <div className="hidden md:block flex-1 max-w-md mx-4">
          <input
            type="text"
            placeholder="Search clients..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <Button className="text-gray-600 hover:text-gray-900 relative">
            <Bell size={20} />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
          </Button>

          {/* User Menu */}
          <div className="relative">
            <Button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <span className="hidden sm:block text-sm font-medium">
                {user?.name}
              </span>
            </Button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg">
                <Link href="/dashboard/settings">
                  <span className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-50 transition">
                    <User size={16} />
                    Profile
                  </span>
                </Link>
                <Button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 transition border-t"
                >
                  <LogOut size={16} />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}