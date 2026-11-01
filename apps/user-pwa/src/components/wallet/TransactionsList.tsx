import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '../../api/wallet.js';
import {
  formatIndianRupees,
  formatISTDateTime,
  formatSignedRupees,
  formatTransactionId,
} from '../../utils/formatters.js';
import type { TransactionDto } from '../../api/types.js';
import { useTranslation } from '../../i18n/LanguageContext.js';
import {
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  Gift,
  Trophy,
  RotateCcw,
  Loader2,
  Clock,
  XCircle,
  Calendar,
  X,
} from 'lucide-react';

const FILTER_CHIPS = [
  { labelKey: 'wallet.chipAll', value: 'all' },
  { labelKey: 'wallet.chipAddMoney', value: 'add_money' },
  { labelKey: 'wallet.chipReferral', value: 'referral' },
  { labelKey: 'wallet.chipJoiningReward', value: 'joining_reward' },
  { labelKey: 'wallet.chipWithdrawal', value: 'withdrawal' },
  { labelKey: 'wallet.chipJoiningFee', value: 'join_fee' },
  { labelKey: 'wallet.chipWinning', value: 'winning' },
  { labelKey: 'wallet.chipRefund', value: 'refund' },
];

interface TransactionsListProps {
  limit?: number;
  showFilters?: boolean;
  showPagination?: boolean;
}

export const TransactionsList: React.FC<TransactionsListProps> = ({
  limit,
  showFilters = true,
  showPagination = true,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // If showFilters is active, synchronize type, fromDate, and toDate with URL search parameters
  const rawType = showFilters ? searchParams.get('type') || 'all' : 'all';
  const selectedType = FILTER_CHIPS.some((chip) => chip.value === rawType) ? rawType : 'all';
  const fromDate = showFilters ? searchParams.get('from') || '' : '';
  const toDate = showFilters ? searchParams.get('to') || '' : '';

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allTransactions, setAllTransactions] = useState<TransactionDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Reset pagination and list when filters change (including via browser back/forward navigation)
  const prevFilterKey = useRef(`${selectedType}_${fromDate}_${toDate}`);
  useEffect(() => {
    const key = `${selectedType}_${fromDate}_${toDate}`;
    if (prevFilterKey.current !== key) {
      prevFilterKey.current = key;
      setCursor(undefined);
      setAllTransactions([]);
    }
  }, [selectedType, fromDate, toDate]);

  const { isLoading, isFetching } = useQuery({
    queryKey: ['transactions', selectedType, fromDate, toDate, cursor, limit],
    queryFn: async () => {
      const res = await getTransactions({
        type: selectedType === 'all' ? undefined : selectedType,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        limit,
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
    setCursor(undefined);
    setAllTransactions([]);
    if (showFilters) {
      const newParams = new URLSearchParams(searchParams);
      if (typeValue === 'all') {
        newParams.delete('type');
      } else {
        newParams.set('type', typeValue);
      }
      setSearchParams(newParams, { replace: true });
    }
  };

  const handleFromDateChange = (val: string) => {
    setCursor(undefined);
    setAllTransactions([]);
    if (showFilters) {
      const newParams = new URLSearchParams(searchParams);
      if (val) {
        newParams.set('from', val);
      } else {
        newParams.delete('from');
      }
      setSearchParams(newParams, { replace: true });
    }
  };

  const handleToDateChange = (val: string) => {
    setCursor(undefined);
    setAllTransactions([]);
    if (showFilters) {
      const newParams = new URLSearchParams(searchParams);
      if (val) {
        newParams.set('to', val);
      } else {
        newParams.delete('to');
      }
      setSearchParams(newParams, { replace: true });
    }
  };

  const handleClearDates = () => {
    setCursor(undefined);
    setAllTransactions([]);
    if (showFilters) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('from');
      newParams.delete('to');
      setSearchParams(newParams, { replace: true });
    }
  };

  const getTransactionIcon = (type: string, isCredit: boolean, status?: string) => {
    if (status === 'pending') {
      return <Clock className="h-4 w-4 text-amber-400" />;
    }
    if (status === 'rejected') {
      return <XCircle className="h-4 w-4 text-rose-400" />;
    }
    switch (type) {
      case 'add_money':
        return <Coins className="h-4 w-4 text-emerald-400" />;
      case 'referral':
      case 'joining_reward':
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
        return t('wallet.txnDeposit');
      case 'referral':
        return t('wallet.txnReferralReward');
      case 'joining_reward':
        return t('wallet.txnJoiningReward') || 'Joining Reward';
      case 'join_fee':
        return t('wallet.txnMatchEntryFee');
      case 'winning':
        return t('wallet.txnMatchWinning');
      case 'withdrawal_hold':
      case 'withdrawal':
        return t('wallet.txnWithdrawal');
      case 'withdrawal_refund':
        return t('wallet.txnWithdrawalRefund');
      case 'refund':
        return t('wallet.txnFeeRefund');
      case 'admin_adjustment':
        return t('wallet.txnAdminAdjustment') || 'Adjustment';
      case 'reversal':
        return t('wallet.txnResultReversal');
      default:
        return type.replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-4" data-testid="transactions-list-container">
      {/* Filter Chips Bar & Date Filter */}
      {showFilters && (
        <div className="space-y-2.5">
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
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all border ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md font-bold'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-slate-100'
                  }`}
                >
                  {t(chip.labelKey)}
                </button>
              );
            })}
          </div>

          {/* Date Filter: From Date to To Date */}
          <div
            className="flex items-center gap-2"
            data-testid="transaction-date-filters"
          >
            <div className="flex-1 flex items-center gap-1.5 bg-[#0e1626] border border-slate-800 rounded-xl px-3 py-2 text-xs focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/40 transition-all">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-400 text-[11px] font-semibold whitespace-nowrap">
                {t('wallet.filterFromDate') || 'From:'}
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => handleFromDateChange(e.target.value)}
                data-testid="filter-from-date"
                className="w-full bg-transparent text-slate-200 text-xs font-mono focus:outline-none [color-scheme:dark]"
                title="From Date"
              />
            </div>

            <div className="flex-1 flex items-center gap-1.5 bg-[#0e1626] border border-slate-800 rounded-xl px-3 py-2 text-xs focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/40 transition-all">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-400 text-[11px] font-semibold whitespace-nowrap">
                {t('wallet.filterToDate') || 'To:'}
              </span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => handleToDateChange(e.target.value)}
                data-testid="filter-to-date"
                className="w-full bg-transparent text-slate-200 text-xs font-mono focus:outline-none [color-scheme:dark]"
                title="To Date"
              />
            </div>

            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={handleClearDates}
                data-testid="clear-date-filter-btn"
                className="p-2 text-slate-400 hover:text-rose-400 bg-[#0e1626] border border-slate-800 hover:border-rose-500/40 rounded-xl transition-all shrink-0 active:scale-95"
                title={t('wallet.clearDateFilter') || 'Clear date filter'}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="space-y-3" data-testid="transactions-items">
        {isLoading && allTransactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            {t('wallet.loadingTransactions')}
          </div>
        ) : allTransactions.length === 0 ? (
          <div
            className="p-8 text-center rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-400 space-y-2"
            data-testid="transactions-empty-state"
          >
            <History className="h-8 w-8 mx-auto text-slate-600" />
            <p className="text-xs font-medium text-slate-300">{t('wallet.noTransactionsFound')}</p>
            <p className="text-[11px] text-slate-500">
              {t('wallet.noTransactionsDesc')}
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
                  onClick={() =>
                    navigate(`/wallet/transactions/${tx.transactionId}`, {
                      state: { from: `${location.pathname}${location.search}` },
                    })
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      navigate(`/wallet/transactions/${tx.transactionId}`, {
                        state: { from: `${location.pathname}${location.search}` },
                      });
                    }
                  }}
                  className="rounded-2xl border border-slate-800 bg-[#0e1626] hover:bg-[#131c30] hover:border-slate-700 p-4 space-y-2.5 shadow-sm cursor-pointer transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 border border-slate-700/60">
                        {getTransactionIcon(tx.type, isCredit, tx.status)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-100 capitalize">
                            {formatTypeLabel(tx.type)}
                          </span>
                          {tx.status === 'pending' && (
                            <span
                              data-testid={`transaction-status-pending-${tx.transactionId}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400"
                            >
                              <Clock className="h-2.5 w-2.5" />
                              <span>{t('wallet.statusPending') || 'Pending Review'}</span>
                            </span>
                          )}
                          {tx.status === 'rejected' && (
                            <span
                              data-testid={`transaction-status-rejected-${tx.transactionId}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-400"
                            >
                              <XCircle className="h-2.5 w-2.5" />
                              <span>{t('wallet.statusRejected') || 'Rejected'}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {formatTransactionId(tx.transactionId)}
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
                      <span>{t('wallet.balColon')}</span>
                      <span className="text-slate-200">
                        {formatIndianRupees(tx.remainingAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {showPagination && nextCursor && (
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
                    {t('common.loading')}
                  </>
                ) : (
                  t('wallet.loadMore')
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
