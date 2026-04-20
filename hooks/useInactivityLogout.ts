'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';

const INACTIVITY_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const ACTIVITY_KEY = 'last_activity_time';
const CHECK_INTERVAL = 60 * 1000; // Check every 1 minute

/**
 * Tracks user activity (mouse, keyboard, touch, scroll).
 * Auto-logs out if user is inactive for 24 hours.
 * Persists last activity time in localStorage so it works across tabs.
 */
export function useInactivityLogout() {
  const { logout, isAuthenticated } = useAuthStore();
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateActivity = useCallback(() => {
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
  }, []);

  const checkInactivity = useCallback(() => {
    const lastActivity = localStorage.getItem(ACTIVITY_KEY);
    if (!lastActivity) {
      // No activity recorded — set it now
      updateActivity();
      return;
    }

    const elapsed = Date.now() - Number(lastActivity);
    if (elapsed >= INACTIVITY_TIMEOUT) {
      // User has been inactive for 24+ hours — log them out
      console.log('Auto-logout: inactive for 24 hours');
      localStorage.removeItem(ACTIVITY_KEY);
      logout();
    }
  }, [logout, updateActivity]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Set initial activity
    updateActivity();

    // Listen for user activity events
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];

    // Throttle activity updates to avoid excessive localStorage writes
    let lastUpdate = Date.now();
    const throttledUpdate = () => {
      const now = Date.now();
      if (now - lastUpdate > 30000) { // Update at most every 30 seconds
        lastUpdate = now;
        updateActivity();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, throttledUpdate, { passive: true });
    });

    // Check inactivity periodically
    checkTimerRef.current = setInterval(checkInactivity, CHECK_INTERVAL);

    // Also check immediately on mount (e.g., when user reopens browser after long time)
    checkInactivity();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledUpdate);
      });
      if (checkTimerRef.current) {
        clearInterval(checkTimerRef.current);
      }
    };
  }, [isAuthenticated, updateActivity, checkInactivity]);
}
