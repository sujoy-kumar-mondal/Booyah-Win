import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.js';
import { getDeposits, getWithdrawals } from '../api/wallet.js';
import { usePendingWalletPoller } from '../hooks/usePendingWalletPoller.js';
import { formatIndianRupees } from '../utils/formatters.js';
import { DepositForm } from '../components/wallet/DepositForm.js';
import { WithdrawForm } from '../components/wallet/WithdrawForm.js';
import { RequestsList } from '../components/wallet/RequestsList.js';
import { TransactionsList } from '../components/wallet/TransactionsList.js';
import {
  Wallet as WalletIcon,
  PlusCircle,
  ArrowDownToLine,
  History,
  FileText,
  Info,
  Gift,
  Coins,
  Trophy,
} from 'lucide-react';

export const Wallet: React.FC = () => {
  const { wallets, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active view: 'overview' | 'add' | 'withdraw' | 'requests' | 'transactions'
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(tabParam || 'overview');

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    } else if (!tabParam && activeTab !== 'overview') {
      setActiveTab('overview');
    }
  }, [tabParam]);

  const switchTab = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'overview') {
      searchParams.delete('tab');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ tab });
    }
  };

  // Query background pending items to drive 30s auto-refresh
  const { data: depositsData } = useQuery({
    queryKey: ['deposits', 'summary'],
    queryFn: () => getDeposits(undefined, 10),
  });

  const { data: withdrawalsData } = useQuery({
    queryKey: ['withdrawals', 'summary'],
    queryFn: () => getWithdrawals(undefined, 10),
  });

  // Requirement 9: 30s poller while pending deposits or withdrawals exist
  usePendingWalletPoller({
    deposits: depositsData?.items,
    withdrawals: withdrawalsData?.items,
    onRefetch: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  return (
    <div className="space-y-5" data-testid="wallet-page">
      {/* Balances Section (Always visible or in overview) */}
      <div className="space-y-3">
        {/* Total Balance Card */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 p-5 shadow-xl">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <WalletIcon className="h-4 w-4" />
              Total Wallet Balance
            </span>
            <span className="text-[11px] font-semibold text-emerald-400">100% Protected</span>
          </div>
          <div
            className="text-3xl font-black tracking-tight text-slate-100"
            data-testid="wallet-total-balance"
          >
            {formatIndianRupees(wallets?.total || '0.00')}
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="mt-4 grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => switchTab('add')}
              data-testid="quick-add-money-btn"
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${activeTab === 'add'
                  ? 'bg-emerald-400 text-slate-950 ring-2 ring-emerald-500 shadow-md'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:scale-[0.98]'
                }`}
            >
              <PlusCircle className="h-4 w-4" />
              Add Money
            </button>
            <button
              type="button"
              onClick={() => switchTab('withdraw')}
              data-testid="quick-withdraw-btn"
              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition-all ${activeTab === 'withdraw'
                  ? 'border-emerald-500 bg-slate-800 text-emerald-400 ring-2 ring-emerald-500/50'
                  : 'border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 active:scale-[0.98]'
                }`}
            >
              <ArrowDownToLine className="h-4 w-4" />
              Withdraw
            </button>
          </div>
        </div>

        {/* Breakdown of Three Wallets */}
        <div className="grid grid-cols-3 gap-2.5 text-left" data-testid="wallets-breakdown">
          {/* Add Money Wallet */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 space-y-1">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
              <Coins className="h-3 w-3 text-sky-400 shrink-0" />
              <span className="truncate">Add Money</span>
            </div>
            <div
              className="text-sm font-extrabold text-slate-100 font-mono"
              data-testid="wallet-add-money"
            >
              {formatIndianRupees(wallets?.addMoney || '0.00')}
            </div>
            <span className="text-[10px] text-slate-400 block truncate">Entry fees</span>
          </div>

          {/* Cashback Wallet */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 space-y-1">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
              <Gift className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="truncate">Cashback</span>
            </div>
            <div
              className="text-sm font-extrabold text-slate-100 font-mono"
              data-testid="wallet-cashback"
            >
              {formatIndianRupees(wallets?.cashback || '0.00')}
            </div>
            <span className="text-[10px] text-slate-400 block truncate">Max 5% / join</span>
          </div>

          {/* Winning Wallet */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 space-y-1">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
              <Trophy className="h-3 w-3 text-emerald-400 shrink-0" />
              <span className="truncate">Winning</span>
            </div>
            <div
              className="text-sm font-extrabold text-emerald-400 font-mono"
              data-testid="wallet-winning"
            >
              {formatIndianRupees(wallets?.winning || '0.00')}
            </div>
            <span className="text-[10px] text-emerald-500 font-semibold block truncate">
              Withdrawable
            </span>
          </div>
        </div>

        {/* Short Explanations Banner */}
        <div
          className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 text-[11px] text-slate-400 space-y-1"
          data-testid="wallet-explanations-banner"
        >
          <div className="flex items-start gap-1.5 text-slate-300">
            <Info className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Add Money & Cashback</strong> can be used for tournament entry fees. Only{' '}
              <strong>Winning</strong> can be withdrawn.
            </span>
          </div>
          <p className="pl-5 text-slate-400">
            Cashback covers at most 5% of an entry fee per match.
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800" data-testid="wallet-tab-bar">
        <button
          type="button"
          onClick={() => switchTab('overview')}
          data-testid="tab-btn-overview"
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${activeTab === 'overview'
              ? 'bg-slate-800 text-emerald-400 shadow'
              : 'text-slate-400 hover:text-slate-200'
            }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => switchTab('add')}
          data-testid="tab-btn-add"
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${activeTab === 'add'
              ? 'bg-slate-800 text-emerald-400 shadow'
              : 'text-slate-400 hover:text-slate-200'
            }`}
        >
          Add Money
        </button>
        <button
          type="button"
          onClick={() => switchTab('withdraw')}
          data-testid="tab-btn-withdraw"
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${activeTab === 'withdraw'
              ? 'bg-slate-800 text-emerald-400 shadow'
              : 'text-slate-400 hover:text-slate-200'
            }`}
        >
          Withdraw
        </button>
        <button
          type="button"
          onClick={() => switchTab('requests')}
          data-testid="tab-btn-requests"
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${activeTab === 'requests'
              ? 'bg-slate-800 text-emerald-400 shadow'
              : 'text-slate-400 hover:text-slate-200'
            }`}
        >
          Requests
        </button>
        <button
          type="button"
          onClick={() => switchTab('transactions')}
          data-testid="tab-btn-transactions"
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${activeTab === 'transactions'
              ? 'bg-slate-800 text-emerald-400 shadow'
              : 'text-slate-400 hover:text-slate-200'
            }`}
        >
          History
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="space-y-4" data-testid="overview-view">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => switchTab('requests')}
              data-testid="view-requests-card"
              className="flex flex-col items-start p-4 rounded-2xl border border-slate-800 bg-slate-900/80 hover:bg-slate-900 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-slate-800 text-sky-400 mb-2">
                <FileText className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-100">Deposit & Payouts</span>
              <span className="text-[10px] text-slate-400">View status of all requests</span>
            </button>

            <button
              type="button"
              onClick={() => switchTab('transactions')}
              data-testid="view-history-card"
              className="flex flex-col items-start p-4 rounded-2xl border border-slate-800 bg-slate-900/80 hover:bg-slate-900 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-slate-800 text-emerald-400 mb-2">
                <History className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-100">Transaction History</span>
              <span className="text-[10px] text-slate-400">All credits, debits & refunds</span>
            </button>
          </div>

          {/* Quick Transactions Preview */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Recent Transactions
              </h3>
              <button
                type="button"
                onClick={() => switchTab('transactions')}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
              >
                View all
              </button>
            </div>
            <TransactionsList />
          </div>
        </div>
      )}

      {activeTab === 'add' && (
        <DepositForm
          onSuccess={() => {
            refreshProfile();
          }}
          onViewDeposits={() => switchTab('requests')}
        />
      )}

      {activeTab === 'withdraw' && (
        <WithdrawForm
          onSuccess={() => {
            refreshProfile();
          }}
          onViewWithdrawals={() => switchTab('requests')}
        />
      )}

      {activeTab === 'requests' && <RequestsList />}

      {activeTab === 'transactions' && <TransactionsList />}
    </div>
  );
};
