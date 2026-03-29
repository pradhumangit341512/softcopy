'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/'];

// ─────────────────────────────────────────
// useAuth — main hook
// ─────────────────────────────────────────
export function useAuth() {
  const router   = useRouter();
  const pathname = usePathname();

  const {
    user,
    isAuthenticated,
    isLoading,
    hasFetched,
    fetchUser,
    setUser,
    logout:  authLogout,
  } = useAuthStore();

  // ── Fetch user only once on first mount ──
  useEffect(() => {
    if (!hasFetched && !isLoading) {
      fetchUser();
    }
  }, []); // ✅ empty deps — run once only, no infinite loop

  // ── Redirect unauthenticated users away from protected pages ──
  useEffect(() => {
    if (isLoading) return;                          // still loading — wait
    if (!hasFetched) return;                        // not tried yet — wait

    const isPublic = PUBLIC_PATHS.some(p =>
      pathname === p || pathname?.startsWith(p + '/')
    );

    if (!isAuthenticated && !isPublic) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, hasFetched, pathname, router]);

  // ── Logout helper ──
  const logout = async () => {
    await authLogout();
    router.replace('/login');
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    hasFetched,
    setUser,
    logout,
  };
}

// ─────────────────────────────────────────
// useRequireAuth — for protected pages
// ─────────────────────────────────────────
export function useRequireAuth() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, hasFetched } = useAuthStore();

  useEffect(() => {
    if (!isLoading && hasFetched && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, hasFetched, router]);

  return { user, isLoading };
}

// ─────────────────────────────────────────
// useCanAccess — role-based access check
// ─────────────────────────────────────────
export function useCanAccess(requiredRole: 'superadmin' | 'admin' | 'user') {
  const { user } = useAuthStore();

  if (!user) return false;

  const hierarchy = { superadmin: 3, admin: 2, user: 1 };
  const userLevel     = hierarchy[user.role as keyof typeof hierarchy] || 0;
  const requiredLevel = hierarchy[requiredRole];

  return userLevel >= requiredLevel;
}