import { useEffect, useRef } from 'react';
import type { DepositDto, WithdrawalDto } from '../api/types.js';

interface UsePendingWalletPollerOptions {
  deposits?: DepositDto[];
  withdrawals?: WithdrawalDto[];
  onRefetch: () => void | Promise<any>;
}

/**
 * While any deposit or withdrawal is pending or employee_approved, refetch lists
 * and balances every 30 seconds when the tab is visible and online; stop when none are pending or tab is hidden/offline.
 */
export function usePendingWalletPoller({
  deposits = [],
  withdrawals = [],
  onRefetch,
}: UsePendingWalletPollerOptions) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasPending =
    deposits.some((d) => d.status === 'pending' || d.status === 'employee_approved') ||
    withdrawals.some((w) => w.status === 'pending' || w.status === 'employee_approved');

  useEffect(() => {
    const isOnline = () =>
      typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true;
    const isVisible = () =>
      typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;

    const clearTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!hasPending) {
      clearTimer();
      return;
    }

    const startTimer = () => {
      clearTimer();
      if (!isVisible() || !isOnline()) {
        return;
      }
      timerRef.current = setInterval(() => {
        if (isVisible() && isOnline()) {
          onRefetch();
        }
      }, 30000);
    };

    startTimer();

    const onVisibilityChange = () => {
      if (isVisible() && isOnline()) {
        onRefetch();
        startTimer();
      } else {
        clearTimer();
      }
    };

    const onOnline = () => {
      if (isVisible() && isOnline()) {
        onRefetch();
        startTimer();
      }
    };

    const onOffline = () => {
      clearTimer();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
    }

    return () => {
      clearTimer();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      }
    };
  }, [hasPending, onRefetch]);
}
