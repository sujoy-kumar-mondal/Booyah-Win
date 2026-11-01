import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.js';
import { getRules } from '../api/rules.js';
import { formatIndianRupees } from '../utils/formatters.js';
import { useTranslation } from '../i18n/LanguageContext.js';
import { TransactionsList } from '../components/wallet/TransactionsList.js';
import {
  Wallet as WalletIcon,
  Plus,
  ArrowDown,
  Gift,
  Coins,
  Trophy,
} from 'lucide-react';

export const Wallet: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { wallets } = useAuth();

  const { data: rulesData, isError: isRulesError } = useQuery({
    queryKey: ['rules'],
    queryFn: getRules,
    staleTime: 60 * 1000,
    retry: false,
  });

  const hasRulesPercent = !isRulesError && rulesData && typeof rulesData.maxCashbackUsagePercent === 'number';

  return (
    <div className="space-y-4 text-slate-100" data-testid="wallet-page">
      {/* Title */}
      <h1 className="text-2xl font-bold tracking-tight text-white">
        {t('nav.wallet') || 'Wallet'}
      </h1>

      {/* Balances Section */}
      <div className="space-y-3">
        {/* Total Wallet Balance Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0e1626] p-5 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <WalletIcon className="h-4 w-4" />
            <span>{t('wallet.totalBalanceTitle') || 'Total Wallet Balance'}</span>
          </div>

          <div
            className="mt-2 text-3xl font-black tracking-tight text-white font-mono"
            data-testid="wallet-total-balance"
          >
            {formatIndianRupees(wallets?.total || '0.00')}
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate('/wallet/add')}
              data-testid="quick-add-money-btn"
              className="flex items-center justify-center gap-1.5 rounded-xl bg-[#544af4] hover:bg-[#4338ca] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-950/40 transition-all active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>{t('wallet.tabDeposit') || 'Add Money'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/wallet/withdraw')}
              data-testid="quick-withdraw-btn"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700/60 bg-[#161c2b] hover:bg-[#1e273b] px-4 py-2.5 text-xs font-bold text-slate-200 transition-all active:scale-[0.98]"
            >
              <ArrowDown className="h-4 w-4" />
              <span>{t('wallet.tabWithdraw') || 'Withdraw'}</span>
            </button>
          </div>
        </div>

        {/* Breakdown of Three Wallets */}
        <div className="grid grid-cols-3 gap-2.5 text-left" data-testid="wallets-breakdown">
          {/* Deposited Wallet */}
          <div className="rounded-xl border border-slate-800 bg-[#0e1626] p-3 space-y-1">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
              <Coins className="h-3 w-3 text-cyan-400 shrink-0" />
              <span className="truncate">{t('wallet.cardAddMoney') || 'Deposited'}</span>
            </div>
            <div
              className="text-sm font-extrabold text-white font-mono"
              data-testid="wallet-add-money"
            >
              {formatIndianRupees(wallets?.addMoney || '0.00')}
            </div>
            <span className="text-[10px] text-slate-400 block truncate">
              {t('wallet.cardEntryFees') || 'Entry fees'}
            </span>
          </div>

          {/* Cashback Wallet */}
          <div className="rounded-xl border border-slate-800 bg-[#0e1626] p-3 space-y-1">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
              <Gift className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="truncate">{t('wallet.cardCashback') || 'Cashback'}</span>
            </div>
            <div
              className="text-sm font-extrabold text-white font-mono"
              data-testid="wallet-cashback"
            >
              {formatIndianRupees(wallets?.cashback || '0.00')}
            </div>
            <span className="text-[10px] text-slate-400 block truncate">
              {t('wallet.cardCashbackSubtitle') || 'Can be used sometime'}
            </span>
            <span className="sr-only">
              {hasRulesPercent ? t('wallet.maxPercentJoin', { percent: rulesData.maxCashbackUsagePercent }) : t('wallet.cappedPerJoin')}
            </span>
          </div>

          {/* Winning Wallet */}
          <div className="rounded-xl border border-slate-800 bg-[#0e1626] p-3 space-y-1">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
              <Trophy className="h-3 w-3 text-emerald-400 shrink-0" />
              <span className="truncate">{t('wallet.cardWinning') || 'Winning'}</span>
            </div>
            <div
              className="text-sm font-extrabold text-emerald-400 font-mono"
              data-testid="wallet-winning"
            >
              {formatIndianRupees(wallets?.winning || '0.00')}
            </div>
            <span className="text-[10px] text-emerald-500 font-semibold block truncate">
              {t('wallet.cardWithdrawable') || 'Withdrawable'}
            </span>
          </div>
        </div>

        {/* Hidden Accessibility/Test Explanation Banner */}
        <div
          className="sr-only"
          data-testid="wallet-explanations-banner"
          aria-hidden="true"
        >
          <p>{t('wallet.bannerExplain')}</p>
          <p>
            {hasRulesPercent
              ? t('wallet.bannerPercent', { percent: rulesData.maxCashbackUsagePercent })
              : t('wallet.bannerCapped')}
          </p>
        </div>
      </div>

      {/* Main View: Recent 10 Transactions matching Mockup */}
      <div className="space-y-3 pt-2" data-testid="overview-view">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight">
            {t('wallet.recentTenTransactions') || 'Recent 10 Transactions'}
          </h2>
          <button
            type="button"
            onClick={() => navigate('/wallet/history')}
            data-testid="wallet-history-btn"
            className="rounded-lg border border-[#3b3563] bg-[#1a1932] px-3.5 py-1.5 text-xs font-bold text-[#8b5cf6] transition-all hover:bg-[#252249] active:scale-95"
          >
            {t('matches.tabHistory') || 'History'}
          </button>
        </div>

        {/* Transactions List with 10 limit, no filters, no pagination */}
        <TransactionsList limit={10} showFilters={false} showPagination={false} />
      </div>
    </div>
  );
};
