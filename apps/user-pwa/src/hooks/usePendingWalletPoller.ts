import { useEffect, useRef } from 'react';
import type { DepositDto, WithdrawalDto } from '../api/types.js';

interface UsePendingWalletPollerOptions {
  deposits?: DepositDto[];
  withdrawals?: WithdrawalDto[];
  onRefetch: () => void | Promise<any>;
}

/**
 * Requirement 9: While any deposit or withdrawal is pending, refetch lists
 * and balances every 30 seconds when the tab is visible; stop when none are pending.
 */
export function usePendingWalletPoller({
  deposits = [],
  withdrawals = [],
  onRefetch,
}: UsePendingWalletPollerOptions) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasPending =
    deposits.some((d) => d.status === 'pending') ||
    withdrawals.some((w) => w.status === 'pending');

  useEffect(() => {
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
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      timerRef.current = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          onRefetch();
        }
      }, 30000);
    };

    startTimer();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onRefetch();
        startTimer();
      } else {
        clearTimer();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearTimer();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [hasPending, onRefetch]);
}
