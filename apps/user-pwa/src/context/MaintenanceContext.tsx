import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getSystemStatus, type MaintenanceStatus } from '../api/status.js';
import { onMaintenanceMode } from '../api/client.js';

interface MaintenanceContextType {
  enabled: boolean;
  message: string;
  until: string | null;
  unknown?: boolean;
  refreshStatus: () => Promise<void>;
  triggerMaintenanceMode: (message?: string) => void;
}

const defaultStatus: MaintenanceStatus = {
  enabled: false,
  message: 'Under scheduled maintenance. Please check back shortly.',
  until: null,
};

const MaintenanceContext = createContext<MaintenanceContextType>({
  ...defaultStatus,
  refreshStatus: async () => {},
  triggerMaintenanceMode: () => {},
});

export const MaintenanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<MaintenanceStatus>(defaultStatus);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = useCallback(async () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    const res = await getSystemStatus();
    let nextDelay = 60 * 1000; // default 60s

    if (res) {
      if (res.retryAfter) {
        // Requirement 9: Respect Retry-After on a 429 and do not show an error banner
        nextDelay = Math.max(res.retryAfter * 1000, 5000);
      } else {
        setStatus(res.maintenance);
      }
    }

    // Schedule next poll
    pollTimerRef.current = setTimeout(() => {
      fetchStatus();
    }, nextDelay);
  }, []);

  const triggerMaintenanceMode = useCallback((customMsg?: string) => {
    setStatus((prev) => ({
      ...prev,
      enabled: true,
      message: customMsg || prev.message,
    }));
    // Re-check status in background
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    // 1. Initial poll on mount
    fetchStatus();

    // 2. Poll on visibilitychange
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Listen for 503 MAINTENANCE_MODE errors from API client
    const unbindMaintenance = onMaintenanceMode((msg) => {
      triggerMaintenanceMode(msg);
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unbindMaintenance();
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [fetchStatus, triggerMaintenanceMode]);

  return (
    <MaintenanceContext.Provider
      value={{
        enabled: status.enabled,
        message: status.message,
        until: status.until,
        unknown: status.unknown,
        refreshStatus: fetchStatus,
        triggerMaintenanceMode,
      }}
    >
      {children}
    </MaintenanceContext.Provider>
  );
};

export function useMaintenance(): MaintenanceContextType {
  return useContext(MaintenanceContext);
}
