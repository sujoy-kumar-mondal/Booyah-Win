import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getSystemStatus } from '../../api/staffUsers.js';
import { formatISTDate } from '../../utils/formatters.js';
import { AlertTriangle, Clock } from 'lucide-react';

export const StaffMaintenanceBanner: React.FC = () => {
  const [maintenance, setMaintenance] = useState<{
    enabled: boolean;
    message: string;
    until: string | null;
  }>({
    enabled: false,
    message: '',
    until: null,
  });

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = useCallback(async () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    const res = await getSystemStatus();
    let nextDelay = 60 * 1000;

    if (res) {
      if (res.retryAfter) {
        nextDelay = Math.max(res.retryAfter * 1000, 5000);
      } else {
        setMaintenance(res.maintenance);
      }
    }

    pollTimerRef.current = setTimeout(fetchStatus, nextDelay);
  }, []);

  useEffect(() => {
    fetchStatus();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [fetchStatus]);

  if (!maintenance.enabled) return null;

  return (
    <div
      role="alert"
      data-testid="staff-maintenance-banner"
      className="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-1.5 text-xs font-medium flex flex-wrap items-center justify-between gap-2 z-10 shrink-0"
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="font-bold text-amber-300 shrink-0">Maintenance Mode Active:</span>
        <span className="truncate text-amber-100" data-testid="staff-maintenance-message">
          {maintenance.message}
        </span>
      </div>

      {maintenance.until && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-300/80 shrink-0" data-testid="staff-maintenance-until">
          <Clock className="h-3.5 w-3.5" />
          <span>Expected End: {formatISTDate(maintenance.until)}</span>
        </div>
      )}
    </div>
  );
};
