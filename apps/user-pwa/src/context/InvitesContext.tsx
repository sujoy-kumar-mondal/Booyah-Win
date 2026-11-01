import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext.js';
import { fetchTeamInvites, type TeamInviteDto } from '../api/matches.js';

interface InvitesContextType {
  invites: TeamInviteDto[];
  pendingCount: number;
  isLoading: boolean;
  refetchInvites: () => Promise<void>;
}

const InvitesContext = createContext<InvitesContextType | undefined>(undefined);

export const InvitesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  const [invites, setInvites] = useState<TeamInviteDto[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isFetchingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInvitesInternal = useCallback(async () => {
    // Session watcher's visibility & network rules
    if (
      typeof document !== 'undefined' &&
      (document.visibilityState === 'hidden' ||
        (typeof navigator !== 'undefined' && navigator.onLine === false))
    ) {
      return;
    }

    if (!isAuthenticated || !token) {
      setInvites([]);
      setPendingCount(0);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      setIsLoading(true);
      const list = await fetchTeamInvites();
      setInvites(list);
      const pending = list.filter((item) => item.status === 'pending').length;
      setPendingCount(pending);
    } catch {
      // Background poll silently fails
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [isAuthenticated, token]);

  const scheduleNextPoll = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    timerRef.current = setTimeout(async () => {
      await fetchInvitesInternal();
      scheduleNextPoll();
    }, 60000); // 60 seconds
  }, [fetchInvitesInternal]);

  // App start and token change
  useEffect(() => {
    if (isAuthenticated) {
      fetchInvitesInternal();
      scheduleNextPoll();
    } else {
      setInvites([]);
      setPendingCount(0);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isAuthenticated, fetchInvitesInternal, scheduleNextPoll]);

  // Visibility and online listeners
  useEffect(() => {
    const handleVisibilityOrOnline = () => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible' &&
        (typeof navigator === 'undefined' || navigator.onLine !== false)
      ) {
        fetchInvitesInternal();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrOnline);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleVisibilityOrOnline);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleVisibilityOrOnline);
      }
    };
  }, [fetchInvitesInternal]);

  const refetchInvites = useCallback(async () => {
    await fetchInvitesInternal();
  }, [fetchInvitesInternal]);

  return (
    <InvitesContext.Provider
      value={{
        invites,
        pendingCount,
        isLoading,
        refetchInvites,
      }}
    >
      {children}
    </InvitesContext.Provider>
  );
};

export function useInvites(): InvitesContextType {
  const context = useContext(InvitesContext);
  if (!context) {
    throw new Error('useInvites must be used within an InvitesProvider');
  }
  return context;
}
