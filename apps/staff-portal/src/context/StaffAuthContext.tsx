/**
 * Staff Authentication Context
 *
 * Requirements:
 * - Requirement 2: Store staff token in sessionStorage, never log it
 * - Requirement 10: Idle timeout: warn after 25 minutes without activity and log out at 30
 * - Activity tracking on user interactions (click, keypress, scroll, mousemove)
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { StaffDto } from '../api/types.js';
import {
  getStoredStaffToken,
  setStoredStaffToken,
  clearStoredStaffToken,
  isRememberedStaffToken,
  STAFF_TOKEN_STORAGE_KEY,
} from '../api/client.js';
import { getStaffMe, logoutStaff as apiLogoutStaff } from '../api/staff.js';

export { STAFF_TOKEN_STORAGE_KEY };

interface StaffAuthContextType {
  staff: StaffDto | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, staff: StaffDto, remember?: boolean) => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isIdleWarnOpen: boolean;
  stayLoggedIn: () => void;
}

const StaffAuthContext = createContext<StaffAuthContextType | undefined>(undefined);

// Idle timeout thresholds (in ms)
export const IDLE_WARN_MS = 25 * 60 * 1000; // 25 minutes
export const IDLE_LOGOUT_MS = 30 * 60 * 1000; // 30 minutes

export const StaffAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => getStoredStaffToken());
  const [staff, setStaff] = useState<StaffDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isIdleWarnOpen, setIsIdleWarnOpen] = useState<boolean>(false);

  const lastActivityRef = useRef<number>(Date.now());

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (isIdleWarnOpen) {
      setIsIdleWarnOpen(false);
    }
  }, [isIdleWarnOpen]);

  const stayLoggedIn = useCallback(() => {
    resetActivity();
  }, [resetActivity]);

  const logout = useCallback(async () => {
    clearStoredStaffToken();
    setToken(null);
    setStaff(null);
    setIsIdleWarnOpen(false);
    try {
      if (token) {
        await apiLogoutStaff().catch(() => {});
      }
    } catch {
      // ignore
    }
  }, [token]);

  const login = useCallback(
    (newToken: string, newStaff: StaffDto, remember: boolean = true) => {
      setStoredStaffToken(newToken, remember);
      setToken(newToken);
      setStaff(newStaff);
      resetActivity();
    },
    [resetActivity]
  );

  const refreshProfile = useCallback(async () => {
    const currentToken = getStoredStaffToken();
    if (!currentToken) {
      setStaff(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await getStaffMe();
      setStaff(res.profile);
    } catch {
      // If profile fails, unauthenticated or replaced handled by session watcher
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (token) {
      refreshProfile();
    } else {
      setIsLoading(false);
    }
  }, [token, refreshProfile]);

  // Requirement 10: Track user activity & enforce 25m warning / 30m logout (sessions that are NOT remembered only)
  useEffect(() => {
    if (!token) return;
    if (isRememberedStaffToken()) return;

    const onUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, onUserActivity, { passive: true }));

    // Check idle status every 15 seconds
    const interval = setInterval(() => {
      if (!getStoredStaffToken() || isRememberedStaffToken()) return;

      const idleDuration = Date.now() - lastActivityRef.current;

      if (idleDuration >= IDLE_LOGOUT_MS) {
        // Exceeded 30 minutes: auto-logout
        logout();
      } else if (idleDuration >= IDLE_WARN_MS) {
        // Exceeded 25 minutes: show warning modal
        setIsIdleWarnOpen(true);
      } else {
        setIsIdleWarnOpen(false);
      }
    }, 15000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onUserActivity));
      clearInterval(interval);
    };
  }, [token, logout]);

  return (
    <StaffAuthContext.Provider
      value={{
        staff,
        token,
        isLoading,
        login,
        logout,
        refreshProfile,
        isIdleWarnOpen,
        stayLoggedIn,
      }}
    >
      {children}
    </StaffAuthContext.Provider>
  );
};

export function useStaffAuth(): StaffAuthContextType {
  const context = useContext(StaffAuthContext);
  if (!context) {
    throw new Error('useStaffAuth must be used within a StaffAuthProvider');
  }
  return context;
}
