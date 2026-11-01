/**
 * Staff Session Watcher
 *
 * Requirements:
 * - Periodically checks GET /staff/me while logged in
 * - Checks on visibilitychange (visible), online, and every 45s (±5s random jitter)
 * - Pauses when tab is hidden or offline
 * - Handles SESSION_REPLACED (opens portal modal) and UNAUTHENTICATED (expires session)
 * - Ignores all other transient errors (5xx, network, rate limits)
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getStoredStaffToken, clearStoredStaffToken, ApiError } from '../api/client.js';
import { getStaffMe } from '../api/staff.js';
import { ErrorCodes } from '@booyah/shared';

interface UseStaffSessionWatcherOptions {
  token: string | null;
  onSessionReplaced: () => void;
  onUnauthenticated: () => void;
}

export function useStaffSessionWatcher({
  token,
  onSessionReplaced,
  onUnauthenticated,
}: UseStaffSessionWatcherOptions) {
  const queryClient = useQueryClient();
  const isCheckingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performCheck = async () => {
    const currentToken = getStoredStaffToken();
    if (!currentToken || isCheckingRef.current) {
      return;
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    isCheckingRef.current = true;
    try {
      await getStaffMe();
    } catch (err: any) {
      // If token changed while in-flight, ignore
      if (getStoredStaffToken() !== currentToken) {
        return;
      }

      if (err instanceof ApiError) {
        if (err.code === ErrorCodes.SESSION_REPLACED) {
          clearStoredStaffToken();
          queryClient.clear();
          onSessionReplaced();
          return;
        }

        if (err.code === ErrorCodes.UNAUTHENTICATED || err.status === 401) {
          clearStoredStaffToken();
          queryClient.clear();
          onUnauthenticated();
          return;
        }
      }

      // Transient errors remain silent
    } finally {
      isCheckingRef.current = false;
    }
  };

  useEffect(() => {
    if (!token) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const scheduleNextTick = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      // 45s ± 5s random jitter (40000ms - 50000ms)
      const jitter = (Math.random() - 0.5) * 10000;
      const delay = Math.max(30000, 45000 + jitter);

      timerRef.current = setTimeout(async () => {
        await performCheck();
        scheduleNextTick();
      }, delay);
    };

    scheduleNextTick();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performCheck();
        scheduleNextTick();
      } else if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleOnline = () => {
      performCheck();
      scheduleNextTick();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [token]);
}
