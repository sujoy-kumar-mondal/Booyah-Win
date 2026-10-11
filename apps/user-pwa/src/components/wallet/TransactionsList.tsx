import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '../../api/wallet.js';
import {
  formatIndianRupees,
  formatISTDateTime,
  formatSignedRupees,
} from '../../utils/formatters.js';
import type { TransactionDto } from '../../api/types.js';
import {
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  Gift,
  Trophy,
  RotateCcw,
  Loader2,
} from 'lucide-react';

const FILTER_CHIPS = [
  { label: 'All', value: 'all' },
  { label: 'Add Money', value: 'add_money' },
  { label: 'Referral', value: 'referral' },
  { label: 'Withdrawal', value: 'withdrawal' },
  { label: 'Joining Fee', value: 'join_fee' },
  { label: 'Winning', value: 'winning' },
  { label: 'Refund', value: 'refund' },
];

export const TransactionsList: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allTransactions, setAllTransactions] = useState<TransactionDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const { isLoading, isFetching } = useQuery({
    queryKey: ['transactions', selectedType, cursor],
    queryFn: async () => {
      const res = await getTransactions({
        type: selectedType === 'all' ? undefined : selectedType,
        cursor,
      });

      if (!cursor) {
        setAllTransactions(res.items);
      } else {
        setAllTransactions((prev) => {
          const ids = new Set(prev.map((t) => t.transactionId));
          const newItems = res.items.filter((t) => !ids.has(t.transactionId));
          return [...prev, ...newItems];
        });
      }
      setNextCursor(res.nextCursor ?? null);
      return res;
    },
  });

  const handleChipClick = (typeValue: string) => {
    if (typeValue === selectedType) return;
    setSelectedType(typeValue);
    setCursor(undefined);
    setAllTransactions([]);
  };

  const getTransactionIcon = (type: string, isCredit: boolean) => {
    switch (type) {
      case 'add_money':
        return <Coins className="h-4 w-4 text-emerald-400" />;
      case 'referral':
        return <Gift className="h-4 w-4 text-amber-400" />;
      case 'winning':
        return <Trophy className="h-4 w-4 text-amber-400" />;
      case 'withdrawal_hold':
      case 'withdrawal':
        return <ArrowDownLeft className="h-4 w-4 text-rose-400" />;
      case 'refund':
      case 'withdrawal_refund':
        return <RotateCcw className="h-4 w-4 text-emerald-400" />;
      case 'join_fee':
        return <ArrowUpRight className="h-4 w-4 text-slate-400" />;
      default:
        return isCredit ? (
          <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
        ) : (
          <ArrowUpRight className="h-4 w-4 text-rose-400" />
        );
    }
  };

  const formatTypeLabel = (type: string): string => {
    switch (type) {
      case 'add_money':
        return 'Deposit';
      case 'referral':
        return 'Referral Reward';
      case 'join_fee':
        return 'Match Entry Fee';
      case 'winning':
        return 'Match Winning';
      case 'withdrawal_hold':
      case 'withdrawal':
        return 'Withdrawal';
      case 'withdrawal_refund':
        return 'Withdrawal Refund';
      case 'refund':
        return 'Fee Refund';
      case 'admin_adjustment':
        return 'Admin Adjustment';
      case 'reversal':
        return 'Result Reversal';
      default:
        return type.replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-4" data-testid="transactions-list-container">
      {/* Filter Chips Bar */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
        data-testid="transaction-filter-chips"
      >
        {FILTER_CHIPS.map((chip) => {
          const isActive = selectedType === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => handleChipClick(chip.value)}
              data-testid={`filter-chip-${chip.value}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all border ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md font-bold'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-slate-100'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Transactions List */}
      <div className="space-y-3" data-testid="transactions-items">
        {isLoading && allTransactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            Loading transaction history...
          </div>
        ) : allTransactions.length === 0 ? (
          <div
            className="p-8 text-center rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-400 space-y-2"
            data-testid="transactions-empty-state"
          >
            <History className="h-8 w-8 mx-auto text-slate-600" />
            <p className="text-xs font-medium text-slate-300">No transactions found</p>
            <p className="text-[11px] text-slate-500">
              Transactions will appear here as you add funds, enter matches, or receive rewards.
            </p>
          </div>
        ) : (
          <>
            {allTransactions.map((tx) => {
              const { text: signedText, isCredit, accessibleLabel } = formatSignedRupees(tx.amount);
              return (
                <div
                  key={tx.transactionId}
                  data-testid={`transaction-item-${tx.transactionId}`}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 border border-slate-700/60">
                        {getTransactionIcon(tx.type, isCredit)}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-100 capitalize">
                          {formatTypeLabel(tx.type)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {tx.transactionId}
                        </span>
                      </div>
                    </div>

                    {/* Signed amount with accessible label (Requirement 12) */}
                    <div className="text-right">
                      <span
                        className={`text-sm font-extrabold font-mono ${
                          isCredit ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                        data-testid="transaction-signed-amount"
                        aria-label={accessibleLabel}
                      >
                        {signedText}
                      </span>
                      <span className="sr-only">{accessibleLabel}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{formatISTDateTime(tx.createdAt)}</span>
                    <div className="flex items-center gap-1 font-mono">
                      <span>Bal:</span>
                      <span className="text-slate-200">
                        {formatIndianRupees(tx.remainingAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {nextCursor && (
              <button
                type="button"
                onClick={() => setCursor(nextCursor)}
                disabled={isFetching}
                data-testid="load-more-transactions-btn"
                className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                {isFetching ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load more'
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
