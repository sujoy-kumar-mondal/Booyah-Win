import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDeposits, getWithdrawals } from '../../api/wallet.js';
import { formatIndianRupees, formatISTDateTime } from '../../utils/formatters.js';
import { useTranslation } from '../../i18n/LanguageContext.js';
import type { DepositDto, WithdrawalDto } from '../../api/types.js';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowDownToLine,
  Upload,
  Loader2,
} from 'lucide-react';

interface RequestsListProps {
  initialTab?: 'deposits' | 'withdrawals';
}

export const RequestsList: React.FC<RequestsListProps> = ({ initialTab = 'deposits' }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals'>(initialTab);

  // Pagination states
  const [depositCursor, setDepositCursor] = useState<string | undefined>(undefined);
  const [allDeposits, setAllDeposits] = useState<DepositDto[]>([]);
  const [nextDepositCursor, setNextDepositCursor] = useState<string | null>(null);

  const [withdrawalCursor, setWithdrawalCursor] = useState<string | undefined>(undefined);
  const [allWithdrawals, setAllWithdrawals] = useState<WithdrawalDto[]>([]);
  const [nextWithdrawalCursor, setNextWithdrawalCursor] = useState<string | null>(null);

  // Query deposits
  const {
    isLoading: isLoadingDeposits,
    isFetching: isFetchingDeposits,
  } = useQuery({
    queryKey: ['deposits', depositCursor],
    queryFn: async () => {
      const res = await getDeposits(depositCursor);
      if (!depositCursor) {
        setAllDeposits(res.items);
      } else {
        setAllDeposits((prev) => {
          const ids = new Set(prev.map((d) => d.id));
          const newItems = res.items.filter((d) => !ids.has(d.id));
          return [...prev, ...newItems];
        });
      }
      setNextDepositCursor(res.nextCursor ?? null);
      return res;
    },
  });

  // Query withdrawals
  const {
    isLoading: isLoadingWithdrawals,
    isFetching: isFetchingWithdrawals,
  } = useQuery({
    queryKey: ['withdrawals', withdrawalCursor],
    queryFn: async () => {
      const res = await getWithdrawals(withdrawalCursor);
      if (!withdrawalCursor) {
        setAllWithdrawals(res.items);
      } else {
        setAllWithdrawals((prev) => {
          const ids = new Set(prev.map((w) => w.id));
          const newItems = res.items.filter((w) => !ids.has(w.id));
          return [...prev, ...newItems];
        });
      }
      setNextWithdrawalCursor(res.nextCursor ?? null);
      return res;
    },
  });

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'employee_approved':
        return (
          <span className="flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-bold text-cyan-400 border border-cyan-500/20">
            <Clock className="h-3 w-3" />
            {t('wallet.verifiedByStaff')}
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3" />
            {t('wallet.statusUnderReview')}
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            {t('wallet.statusApproved')}
          </span>
        );
      case 'paid':
        return (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            {t('wallet.statusPaid')}
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            {t('wallet.statusRejected')}
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-400 border border-amber-500/20 capitalize">
            <Clock className="h-3 w-3" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4" data-testid="requests-list-container">
      {/* Sub-tab navigation */}
      <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('deposits')}
          data-testid="tab-deposits"
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
            activeTab === 'deposits'
              ? 'bg-slate-800 text-emerald-400 shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('wallet.myDeposits')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('withdrawals')}
          data-testid="tab-withdrawals"
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
            activeTab === 'withdrawals'
              ? 'bg-slate-800 text-emerald-400 shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('wallet.myWithdrawals')}
        </button>
      </div>

      {/* Deposits Tab */}
      {activeTab === 'deposits' && (
        <div className="space-y-3" data-testid="deposits-list">
          {isLoadingDeposits && allDeposits.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              {t('wallet.loadingDeposits')}
            </div>
          ) : allDeposits.length === 0 ? (
            <div
              className="p-8 text-center rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-400 space-y-2"
              data-testid="deposits-empty-state"
            >
              <Upload className="h-8 w-8 mx-auto text-slate-600" />
              <p className="text-xs font-medium text-slate-300">{t('wallet.noDepositsFound')}</p>
              <p className="text-[11px] text-slate-500">
                {t('wallet.noDepositsDesc')}
              </p>
            </div>
          ) : (
            <>
              {allDeposits.map((item) => (
                <div
                  key={item.id}
                  data-testid={`deposit-item-${item.id}`}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        {t('wallet.depositId', { id: item.id })}
                      </span>
                      <span className="text-base font-extrabold text-slate-100">
                        {formatIndianRupees(item.amount)}
                      </span>
                    </div>
                    {renderStatusBadge(item.status)}
                  </div>

                  <div className="border-t border-slate-800/80 pt-2 flex flex-col gap-1 text-[11px] text-slate-400">
                    <div className="flex justify-between">
                      <span>{t('wallet.utrColon')}</span>
                      <span className="font-mono text-slate-200">{item.utr}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('wallet.submittedColon')}</span>
                      <span className="text-slate-300">{formatISTDateTime(item.createdAt)}</span>
                    </div>

                    {item.status === 'rejected' && item.rejectReason && (
                      <div className="mt-1 rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-rose-400 flex items-start gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{t('wallet.reasonColon', { reason: item.rejectReason })}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {nextDepositCursor && (
                <button
                  type="button"
                  onClick={() => setDepositCursor(nextDepositCursor)}
                  disabled={isFetchingDeposits}
                  data-testid="load-more-deposits-btn"
                  className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  {isFetchingDeposits ? (
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
      )}

      {/* Withdrawals Tab */}
      {activeTab === 'withdrawals' && (
        <div className="space-y-3" data-testid="withdrawals-list">
          {isLoadingWithdrawals && allWithdrawals.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              {t('wallet.loadingWithdrawals')}
            </div>
          ) : allWithdrawals.length === 0 ? (
            <div
              className="p-8 text-center rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-400 space-y-2"
              data-testid="withdrawals-empty-state"
            >
              <ArrowDownToLine className="h-8 w-8 mx-auto text-slate-600" />
              <p className="text-xs font-medium text-slate-300">{t('wallet.noWithdrawalsFound')}</p>
              <p className="text-[11px] text-slate-500">
                {t('wallet.noWithdrawalsDesc')}
              </p>
            </div>
          ) : (
            <>
              {allWithdrawals.map((item) => (
                <div
                  key={item.id}
                  data-testid={`withdrawal-item-${item.id}`}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        {t('wallet.withdrawalId', { id: item.id })}
                      </span>
                      <span className="text-base font-extrabold text-slate-100">
                        {formatIndianRupees(item.amount)}
                      </span>
                    </div>
                    {renderStatusBadge(item.status)}
                  </div>

                  <div className="border-t border-slate-800/80 pt-2 flex flex-col gap-1 text-[11px] text-slate-400">
                    <div className="flex justify-between">
                      <span>{t('wallet.upiIdColon')}</span>
                      <span className="font-mono text-slate-200">{item.upiId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('wallet.requestedColon')}</span>
                      <span className="text-slate-300">{formatISTDateTime(item.createdAt)}</span>
                    </div>

                    {item.payoutRef && (
                      <div className="flex justify-between">
                        <span>{t('wallet.payoutRefColon')}</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          {item.payoutRef}
                        </span>
                      </div>
                    )}

                    {item.status === 'rejected' && item.rejectReason && (
                      <div className="mt-1 rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-rose-400 flex items-start gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{t('wallet.reasonColon', { reason: item.rejectReason })}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {nextWithdrawalCursor && (
                <button
                  type="button"
                  onClick={() => setWithdrawalCursor(nextWithdrawalCursor)}
                  disabled={isFetchingWithdrawals}
                  data-testid="load-more-withdrawals-btn"
                  className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  {isFetchingWithdrawals ? (
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
      )}
    </div>
  );
};
