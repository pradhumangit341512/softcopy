'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

/**
 * useAuth Hook
 * Handles authentication state and navigation protection
 * 
 * @returns {Object} user, isAuthenticated, isLoading, logout, login, signup
 */
export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    user,
    isAuthenticated,
    isLoading,
    fetchUser,
    logout: authLogout,
    login: authLogin,
    signup: authSignup,
  } = useAuthStore();

  // Fetch user on component mount
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      fetchUser();
    }
  }, [isAuthenticated, isLoading, fetchUser]);

  // Handle protected routes
  useEffect(() => {
    const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password', '/'];
    const isPublicPath = publicPaths.some((p) => pathname?.startsWith(p));

    if (!isAuthenticated && !isLoading && !isPublicPath && pathname) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  const logout = async () => {
    await authLogout();
    router.push('/login');
  };

  const login = async (email: string, password: string) => {
    await authLogin(email, password);
    router.push('/dashboard');
  };

  const signup = async (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    companyName: string;
  }) => {
    await authSignup(data);
    router.push('/dashboard');
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
    login,
    signup,
  };
}

/**
 * useRequireAuth Hook
 * Forces authentication check and redirects if not logged in
 * Use in protected pages
 */
export function useRequireAuth() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  return { user, isLoading };
}

/**
 * useCanAccess Hook
 * Check if user has required role
 * 
 * @param requiredRole - 'superadmin' | 'admin' | 'user'
 * @returns {boolean} canAccess
 */
export function useCanAccess(requiredRole: 'superadmin' | 'admin' | 'user') {
  const { user } = useAuth();

  if (!user) return false;

  const roleHierarchy = {
    superadmin: 3,
    admin: 2,
    user: 1,
  };

  const userLevel = roleHierarchy[user.role as keyof typeof roleHierarchy] || 0;
  const requiredLevel = roleHierarchy[requiredRole];

  return userLevel >= requiredLevel;
}