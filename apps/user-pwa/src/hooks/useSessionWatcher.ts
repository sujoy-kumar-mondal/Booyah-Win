import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { getStoredToken } from '../api/client.js';
import { getMe } from '../api/user.js';
import { ApiError } from '../api/client.js';
import { ErrorCodes } from '@booyah/shared';

/**
 * Returns 45s interval with a random offset of ±5 seconds (40,000ms - 50,000ms)
 * to prevent multiple open tabs from polling in lockstep.
 */
export function getWatcherIntervalMs(): number {
  const base = 45000;
  const jitter = Math.random() * 10000 - 5000; // -5000 to +5000 ms
  return Math.round(base + jitter);
}

export function useSessionWatcher() {
  const {
    token,
    isAuthenticated,
    sessionReplacedOpen,
    handleSessionTerminated,
    updateSessionData,
  } = useAuth();

  const isCheckingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const checkSession = useCallback(async () => {
    // Hidden tabs make no requests; offline tabs make no requests; stop if dialog is open
    if (
      typeof document !== 'undefined' &&
      (document.visibilityState === 'hidden' ||
        (typeof navigator !== 'undefined' && navigator.onLine === false))
    ) {
      return;
    }

    if (sessionReplacedOpen) {
      return;
    }

    const currentToken = getStoredToken();
    if (!currentToken) {
      return;
    }

    // Concurrency guard: Never run more than one check at a time
    if (isCheckingRef.current) {
      return;
    }

    isCheckingRef.current = true;
    const requestToken = currentToken;

    try {
      const data = await getMe();

      // Requirement 4: Ignore check result if the token it was sent with is no longer current
      if (requestToken !== getStoredToken()) {
        return;
      }

      updateSessionData(data);
    } catch (err: any) {
      // Requirement 4: Ignore error if token changed in flight
      if (requestToken !== getStoredToken()) {
        return;
      }

      if (err instanceof ApiError) {
        // Requirement 1 & 2: Only SESSION_REPLACED and UNAUTHENTICATED end the session
        if (err.code === ErrorCodes.SESSION_REPLACED) {
          handleSessionTerminated(
            'You were logged out because your account was used on another device.',
            'Session Replaced'
          );
          return;
        }

        if (err.code === ErrorCodes.UNAUTHENTICATED) {
          handleSessionTerminated(
            'Your session has expired. Please log in again.',
            'Session Expired'
          );
          return;
        }
      }

      // Requirement 2: Every other error (network, timeout, 5xx, RATE_LIMITED, DATABASE_BUSY, NOT_FOUND) is silent.
      // Silently swallowed and will retry on the next tick.
    } finally {
      isCheckingRef.current = false;
    }
  }, [sessionReplacedOpen, handleSessionTerminated, updateSessionData]);

  // Schedule next tick with 45s ± 5s jitter
  const scheduleNextTick = useCallback(() => {
    clearTimer();

    // Never run without a token, if unauthenticated, or if dialog is already open
    if (!isAuthenticated || !token || sessionReplacedOpen) {
      return;
    }

    // Hidden tabs make no requests
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    const intervalMs = getWatcherIntervalMs();
    timerRef.current = setTimeout(async () => {
      await checkSession();
      // Reschedule subsequent tick after check finishes
      scheduleNextTick();
    }, intervalMs);
  }, [isAuthenticated, token, sessionReplacedOpen, checkSession, clearTimer]);

  useEffect(() => {
    // Requirement 5: Never runs without a token (login and registration screens)
    if (!isAuthenticated || !token || sessionReplacedOpen) {
      clearTimer();
      return;
    }

    // Requirement 5: The first scheduled tick waits one full interval after startup,
    // so initial page load does not make two duplicate GET /me requests
    scheduleNextTick();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible again: run immediate check and restart jittered interval
        checkSession();
        scheduleNextTick();
      } else {
        // Hidden tabs make no requests: pause timers
        clearTimer();
      }
    };

    const onOnline = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
        scheduleNextTick();
      }
    };

    const onOffline = () => {
      clearTimer();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      clearTimer();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [isAuthenticated, token, sessionReplacedOpen, scheduleNextTick, checkSession, clearTimer]);
}
