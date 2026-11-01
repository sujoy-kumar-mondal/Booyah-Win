import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTransactionDetail } from '../api/wallet.js';
import { resolveImageUrl } from '../utils/imageUrl.js';
import {
  formatIndianRupees,
  formatISTDateTime,
  formatSignedRupees,
  formatTransactionId,
} from '../utils/formatters.js';
import { useTranslation } from '../i18n/LanguageContext.js';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Ban,
  Copy,
  Check,
  Trophy,
  Gamepad2,
  Gift,
  Wallet as WalletIcon,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  Image as ImageIcon,
  X,
} from 'lucide-react';

export const TransactionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else if (location.state && typeof (location.state as any).from === 'string') {
      navigate((location.state as any).from, { replace: true });
    } else {
      navigate('/wallet/history', { replace: true });
    }
  };

  const [copiedId, setCopiedId] = useState(false);
  const [copiedUtr, setCopiedUtr] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedPayoutRef, setCopiedPayoutRef] = useState(false);
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);



  

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['transaction-detail', id],
    queryFn: () => getTransactionDetail(id || ''),
    enabled: !!id,
    retry: 1,
  });

  const handleCopy = async (text: string, type: 'id' | 'utr' | 'upi' | 'payout') => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      if (type === 'id') {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      } else if (type === 'utr') {
        setCopiedUtr(true);
        setTimeout(() => setCopiedUtr(false), 2000);
      } else if (type === 'upi') {
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2000);
      } else if (type === 'payout') {
        setCopiedPayoutRef(true);
        setTimeout(() => setCopiedPayoutRef(false), 2000);
      }
    } catch {
      // Ignore copy error
    }
  };

  const formatTypeLabel = (type: string): string => {
    switch (type) {
      case 'add_money':
        return t('transactionDetail.refDeposit') || t('wallet.txnDeposit') || 'Deposit';
      case 'referral':
        return t('transactionDetail.refReferral') || t('wallet.txnReferralReward') || 'Referral';
      case 'joining_reward':
        return t('transactionDetail.refJoiningReward') || t('wallet.txnJoiningReward') || 'Joining Reward';
      case 'join_fee':
        return t('wallet.txnMatchEntryFee') || 'Match Entry Fee';
      case 'winning':
        return t('wallet.txnMatchWinning') || 'Match Winning';
      case 'withdrawal_hold':
      case 'withdrawal':
        return t('transactionDetail.refWithdrawal') || t('wallet.txnWithdrawal') || 'Withdrawal';
      case 'withdrawal_refund':
        return t('transactionDetail.refWithdrawalRefund') || t('wallet.txnWithdrawalRefund') || 'Withdrawal Refund';
      case 'refund':
        return t('transactionDetail.refFeeRefund') || t('wallet.txnFeeRefund') || 'Fee Refund';
      case 'admin_adjustment':
        return t('transactionDetail.refAdjustment') || t('wallet.txnAdminAdjustment') || 'Adjustment';
      case 'reversal':
        return t('transactionDetail.refResultReversal') || t('wallet.txnResultReversal') || 'Result Reversal';
      default:
        return type.replace(/_/g, ' ');
    }
  };

  const formatReferenceType = (): string => {
    if (!data) return '';
    if (data.match) return t('transactionDetail.refTournamentMatch') || 'Tournament Match';
    if (data.deposit) return t('transactionDetail.refDeposit') || 'Deposit';
    if (data.withdrawal) return t('transactionDetail.refWithdrawal') || 'Withdrawal';
    if (data.type === 'referral') return t('transactionDetail.refReferral') || 'Referral';
    if (data.type === 'joining_reward') return t('transactionDetail.refJoiningReward') || 'Joining Reward';
    if (data.type === 'admin_adjustment') return t('transactionDetail.refAdjustment') || 'Adjustment';
    if (data.type === 'withdrawal_refund') return t('transactionDetail.refWithdrawalRefund') || 'Withdrawal Refund';
    if (data.type === 'withdrawal_hold') return t('transactionDetail.refWithdrawal') || 'Withdrawal';
    if (data.type === 'reversal') return t('transactionDetail.refResultReversal') || 'Result Reversal';
    if (data.type === 'refund') return t('transactionDetail.refFeeRefund') || 'Fee Refund';
    if (data.type === 'join_fee' || data.type === 'winning') return t('transactionDetail.refTournamentMatch') || 'Tournament Match';
    if (data.type === 'add_money') return t('transactionDetail.refDeposit') || 'Deposit';
    return data.type.replace(/_/g, ' ');
  };

  const formatWalletName = (name: string): string => {
    if (!name) return '';
    const lower = name.toLowerCase();
    if (lower === 'winning') return t('wallet.cardWinning') || t('wallet.tabWinning') || name;
    if (lower === 'deposited') return t('wallet.unutilizedBalance') || t('wallet.tabDeposited') || name;
    if (lower === 'cashback') return t('wallet.cashbackTitle') || t('wallet.tabCashback') || name;
    return name;
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="transaction-detail-loading">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            {t('wallet.transactionDetailsTitle') || 'Transaction Details'}
          </h1>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#0e1626] p-12 text-center text-slate-400 space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-xs font-semibold">{t('wallet.loadingTransactions') || 'Loading transaction details...'}</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4" data-testid="transaction-detail-error">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            {t('wallet.transactionDetailsTitle') || 'Transaction Details'}
          </h1>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-8 text-center space-y-3">
          <ShieldAlert className="h-10 w-10 text-rose-400 mx-auto" />
          <p className="text-sm font-bold text-rose-300">
            {(error as any)?.message || 'Transaction details not found or access denied.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
          >
            Return to Wallet
          </button>
        </div>
      </div>
    );
  }

  const { text: signedText, isCredit } = formatSignedRupees(data.amount);

  return (
    <div className="space-y-4 pb-8" data-testid="transaction-detail-page">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back"
          data-testid="transaction-detail-back-btn"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 transition-all active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">
          {t('wallet.transactionDetailsTitle') || 'Transaction Details'}
        </h1>
      </div>

      {/* Main Hero Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#0e1626] p-6 shadow-xl text-center space-y-3 relative overflow-hidden">
        {/* Subtle background glow */}
        <div
          className={`absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 ${
            data.status === 'rejected'
              ? 'bg-rose-500'
              : data.status === 'cancelled'
              ? 'bg-purple-500'
              : data.status === 'pending'
              ? 'bg-amber-500'
              : isCredit
              ? 'bg-emerald-500'
              : 'bg-rose-500'
          }`}
        />

        {/* Status / Direction Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/90 border border-slate-700 shadow-md">
          {data.status === 'rejected' ? (
            <XCircle className="h-7 w-7 text-rose-400" />
          ) : data.status === 'cancelled' ? (
            <Ban className="h-7 w-7 text-purple-400" />
          ) : data.status === 'pending' ? (
            <Clock className="h-7 w-7 text-amber-400" />
          ) : isCredit ? (
            <ArrowDownLeft className="h-7 w-7 text-emerald-400" />
          ) : (
            <ArrowUpRight className="h-7 w-7 text-rose-400" />
          )}
        </div>

        {/* Amount */}
        <div>
          <div
            className={`text-3xl font-black tracking-tight font-mono ${
              isCredit ? 'text-emerald-400' : 'text-rose-400'
            }`}
            data-testid="transaction-amount-display"
          >
            {signedText}
          </div>
          <p className="mt-1 text-sm font-bold text-slate-200 capitalize">
            {formatTypeLabel(data.type)}
          </p>
        </div>

        {/* Status Pill Badge */}
        <div className="pt-1">
          {data.status === 'successful' && (
            <span
              data-testid="status-badge-successful"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 shadow-sm"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{t('transactionDetail.statusSuccessful') || t('wallet.statusSuccessful') || 'Successful'}</span>
            </span>
          )}
          {data.status === 'rejected' && (
            <span
              data-testid="status-badge-rejected"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400 shadow-sm"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>{t('transactionDetail.statusRejected') || t('wallet.statusRejected') || 'Rejected'}</span>
            </span>
          )}
          {data.status === 'cancelled' && (
            <span
              data-testid="status-badge-cancelled"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-bold text-purple-300 shadow-sm"
            >
              <Ban className="h-3.5 w-3.5" />
              <span>{t('transactionDetail.statusCancelled') || t('wallet.statusCancelled') || 'Cancelled'}</span>
            </span>
          )}
          {data.status === 'pending' && (
            <span
              data-testid="status-badge-pending"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-400 shadow-sm"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{t('transactionDetail.statusPendingReview') || t('wallet.statusPending') || 'Pending Review'}</span>
            </span>
          )}
        </div>

        {/* Status Reason Alert (e.g. rejection or cancellation note) */}
        {data.statusReason && (
          <div
            data-testid="transaction-status-reason"
            className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 text-xs text-slate-300 text-left flex items-start gap-2.5 mt-2"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Note: </span>
              <span>{data.statusReason}</span>
            </div>
          </div>
        )}

        <div className="text-[11px] text-slate-400 pt-1">
          {formatISTDateTime(data.createdAt)}
        </div>
      </div>

      {/* Wallet Breakdown Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#0e1626] p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
          <WalletIcon className="h-4 w-4 text-emerald-400" />
          <span>{isCredit ? t('transactionDetail.creditedTo') : t('transactionDetail.debitedFrom')}</span>
        </div>

        <div className="space-y-2 text-xs">
          {/* Target Wallet Name */}
          <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
            <span className="text-slate-400">{isCredit ? t('transactionDetail.targetWallet') : t('transactionDetail.sourceWallet')}</span>
            <span className="font-bold text-slate-100" data-testid="target-wallet-name">
              {formatWalletName(data.walletName)}
            </span>
          </div>

          {/* Detailed Wallet Split Breakdown (if available) */}
          {data.breakdown && (
            <div className="py-1 space-y-1.5 border-b border-slate-800/80" data-testid="wallet-breakdown-details">
              <span className="text-[11px] font-semibold text-slate-400">
                {t('transactionDetail.moneySplit')}
              </span>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                {data.breakdown.deposited && (
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                    <span className="text-[10px] text-slate-400 block">{t('wallet.unutilizedBalance') || 'Deposited'}</span>
                    <span className="font-bold text-slate-200 text-xs">
                      {formatIndianRupees(data.breakdown.deposited)}
                    </span>
                  </div>
                )}
                {data.breakdown.cashback && (
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                    <span className="text-[10px] text-slate-400 block">{t('wallet.cashbackTitle') || 'Cashback'}</span>
                    <span className="font-bold text-amber-300 text-xs">
                      {formatIndianRupees(data.breakdown.cashback)}
                    </span>
                  </div>
                )}
                {data.breakdown.winning && (
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                    <span className="text-[10px] text-slate-400 block">{t('wallet.cardWinning') || 'Winning'}</span>
                    <span className="font-bold text-emerald-400 text-xs">
                      {formatIndianRupees(data.breakdown.winning)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Balance after entry */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-400">{t('transactionDetail.balanceAfter')}</span>
            <span className="font-mono font-extrabold text-slate-100 text-sm" data-testid="remaining-balance-display">
              {formatIndianRupees(data.remainingAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Transaction Identifiers & Metadata */}
      <div className="rounded-2xl border border-slate-800 bg-[#0e1626] p-4 space-y-3">
        <div className="flex items-center justify-between py-1 border-b border-slate-800/80 text-xs">
          <span className="text-slate-400">{t('transactionDetail.txnId')}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-slate-100" data-testid="transaction-display-id">
              {formatTransactionId(data.transactionId)}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(formatTransactionId(data.transactionId), 'id')}
              aria-label="Copy Transaction ID"
              data-testid="copy-txn-id-btn"
              className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            >
              {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-slate-800/80 text-xs">
          <span className="text-slate-400">{t('transactionDetail.timestamp')}</span>
          <span className="font-mono text-slate-200">
            {formatISTDateTime(data.createdAt)}
          </span>
        </div>

        <div className={`flex items-center justify-between py-1 text-xs ${(data.referral?.referredUsername || data.adjustment?.reason || data.type === 'admin_adjustment') ? 'border-b border-slate-800/80' : ''}`}>
          <span className="text-slate-400">{t('transactionDetail.refType')}</span>
          <span className="font-semibold text-slate-300" data-testid="reference-type-display">
            {formatReferenceType()}
          </span>
        </div>

        {data.referral?.referredUsername && (
          <div className={`flex items-center justify-between py-1 text-xs ${(data.adjustment?.reason || data.type === 'admin_adjustment') ? 'border-b border-slate-800/80' : ''}`}>
            <span className="text-slate-400">{t('wallet.referredUser') || 'Referred User'}</span>
            <span className="font-semibold text-slate-100" data-testid="referred-user-display">
              {data.referral.referredUsername}
            </span>
          </div>
        )}

        {(data.adjustment?.reason || data.type === 'admin_adjustment') && (
          <div className="flex items-start justify-between py-1 text-xs gap-3">
            <span className="text-slate-400 shrink-0">{t('wallet.reason') || 'Reason'}</span>
            <span className="font-semibold text-slate-200 text-right" data-testid="adjustment-reason-display">
              {data.adjustment?.reason || 'Balance Adjustment'}
            </span>
          </div>
        )}
      </div>

      {/* Joining Reward Welcome Bonus Card */}
      {data.type === 'joining_reward' && (
        <div
          data-testid="transaction-joining-reward-card"
          className="rounded-2xl border border-slate-800 bg-[#0e1626] p-4 space-y-2"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Gift className="h-4 w-4 text-amber-400" />
            <span>{t('wallet.welcomeBonus') || 'Welcome Bonus'}</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {t('wallet.welcomeBonusDesc') ||
              'Welcome to Booyah Win! Your Joining Reward has been credited directly to your Deposit wallet.'}
          </p>
        </div>
      )}

      {/* Match Information Card (If match interaction) */}
      {data.match && (
        <div
          data-testid="transaction-match-card"
          className="rounded-2xl border border-slate-800 bg-[#0e1626] p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Gamepad2 className="h-4 w-4 text-violet-400" />
              <span>{t('wallet.matchInformation') || 'Match Information'}</span>
            </div>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                data.match.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : data.match.status === 'cancelled'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : data.match.status === 'live'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {data.match.status}
            </span>
          </div>

          <div
            onClick={() => navigate(`/matches/${data.match?.id}`)}
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-2.5 hover:border-violet-500/50 hover:bg-slate-900 transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-white group-hover:text-violet-300 transition-colors">
                  {data.match.title}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  📍 {data.match.mapName || 'Bermuda'} • {formatISTDateTime(data.match.startTime)}
                </p>
              </div>
              <div className="text-right font-mono shrink-0">
                <span className="text-[10px] text-slate-400 block">Fee</span>
                <span className="text-xs font-bold text-slate-200">
                  {formatIndianRupees(data.match.entryFee)}
                </span>
              </div>
            </div>

            {/* Performance Summary if completed */}
            {(data.match.kills != null || data.match.prizeAmount != null) && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-slate-400">Kills:</span>
                  <span className="font-bold text-white">{data.match.kills ?? 0}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300 justify-end font-mono">
                  <span className="text-slate-400">Won:</span>
                  <span className="font-bold text-emerald-400">
                    {data.match.prizeAmount ? formatIndianRupees(data.match.prizeAmount) : 'Rs0.00'}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/matches/${data.match?.id}`);
              }}
              data-testid="view-match-details-btn"
              className="w-full flex items-center justify-center gap-1.5 pt-2 text-xs font-bold text-violet-400 group-hover:text-violet-300"
            >
              <span>{t('wallet.viewMatchDetails') || 'View Match Details'}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Payment / UPI Details Card (For Deposit or Withdrawal) */}
      {(data.deposit || data.withdrawal) && (
        <div
          data-testid="transaction-payment-card"
          className="rounded-2xl border border-slate-800 bg-[#0e1626] p-4 space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Trophy className="h-4 w-4 text-sky-400" />
            <span>{data.deposit ? t('transactionDetail.depositReceipt') : t('transactionDetail.withdrawalDetails')}</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Deposit Specific Fields */}
            {data.deposit && (
              <>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">{t('transactionDetail.utrRef')}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-100" data-testid="deposit-utr-display">
                      {data.deposit.utr}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(data.deposit?.utr || '', 'utr')}
                      aria-label="Copy UTR"
                      data-testid="copy-utr-btn"
                      className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
                    >
                      {copiedUtr ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">{t('wallet.requestMadeTime') || 'Request Made Time'}</span>
                  <span className="font-medium text-slate-200" data-testid="deposit-request-time">
                    {formatISTDateTime(data.deposit.createdAt)}
                  </span>
                </div>

                {data.deposit.screenshotUrl && (
                  <div className="py-2 border-b border-slate-800/80">
                    <span className="text-slate-400 block mb-2">{t('transactionDetail.screenshot')}</span>
                    <div
                      onClick={() => !imageError && setPreviewScreenshot(data.deposit?.screenshotUrl || null)}
                      className="relative w-28 h-28 rounded-xl border border-slate-700 overflow-hidden cursor-pointer group bg-slate-900"
                      data-testid="screenshot-thumbnail-container"
                    >
                      {imageError ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-slate-950/80 text-slate-400">
                          <ImageIcon className="h-6 w-6 text-slate-500 mb-1" />
                          <span className="text-[10px] text-slate-400 font-medium leading-tight">Image unavailable</span>
                        </div>
                      ) : (
                        <>
                          <img
                            src={resolveImageUrl(data.deposit.screenshotUrl)}
                            alt="Deposit receipt proof"
                            onError={() => setImageError(true)}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold gap-1">
                            <ImageIcon className="h-3.5 w-3.5" />
                            <span>View</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Withdrawal Specific Fields */}
            {data.withdrawal && (
              <>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">{t('transactionDetail.beneficiaryUpi')}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-100" data-testid="withdrawal-upi-display">
                      {data.withdrawal.upiId}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(data.withdrawal?.upiId || '', 'upi')}
                      aria-label="Copy UPI ID"
                      data-testid="copy-upi-btn"
                      className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
                    >
                      {copiedUpi ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {data.withdrawal.payoutRef && (
                  <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-400">{t('transactionDetail.payoutRef')}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-400" data-testid="payout-ref-display">
                        {data.withdrawal.payoutRef}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(data.withdrawal?.payoutRef || '', 'payout')}
                        aria-label="Copy UTR"
                        data-testid="copy-payout-ref-btn"
                        className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
                      >
                        {copiedPayoutRef ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">{t('wallet.requestMadeTime') || 'Request Made Time'}</span>
                  <span className="font-medium text-slate-200" data-testid="withdrawal-request-time">
                    {formatISTDateTime(data.withdrawal.createdAt)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Support / Help Section */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#0e1626] p-4 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-slate-300">
          <HelpCircle className="h-4 w-4 text-violet-400 shrink-0" />
          <span>{t('transactionDetail.needHelp')}</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/support')}
          data-testid="contact-support-btn"
          className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 font-bold hover:bg-slate-700 transition active:scale-95 shrink-0"
        >
          {t('transactionDetail.contactSupport')}
        </button>
      </div>

      {/* Screenshot Lightbox Modal */}
      {previewScreenshot && (
        <div
          data-testid="screenshot-modal"
          onClick={() => setPreviewScreenshot(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-lg w-full max-h-[90vh] rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200">{t('transactionDetail.screenshot')}</span>
              <button
                type="button"
                onClick={() => setPreviewScreenshot(null)}
                data-testid="close-screenshot-modal-btn"
                aria-label={t('common.close')}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-2 overflow-auto max-h-[80vh] flex items-center justify-center bg-black/40">
              <img
                src={resolveImageUrl(previewScreenshot)}
                alt="Enlarged payment screenshot proof"
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

