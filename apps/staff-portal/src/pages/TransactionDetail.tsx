/**
 * Staff Portal - Dedicated Transaction Detail Page
 *
 * Displays exhaustive information about a specific transaction:
 * - Transaction overview & status
 * - Financial trace & multi-wallet breakdown
 * - User profile info
 * - Contextual details (Match, Deposit with screenshot, Withdrawal with UPI/Payout, Referral, Adjustment)
 * - Raw ledger metadata
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStaffTransactionDetail } from '../api/staff.js';
import {
  formatIndianRupees,
  formatSignedRupees,
  formatISTDate,
  formatTransactionId,
  formatUserId,
  formatMatchId,
  formatStaffId,
  formatLedgerRefId,
  copyToClipboard,
} from '../utils/formatters.js';
import { UserProfileModal } from '../components/common/UserProfileModal.js';
import { ScreenshotViewerModal } from '../components/common/ScreenshotViewerModal.js';
import {
  ArrowLeft,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Wallet,
  User,
  Swords,
  ArrowDownLeft,
  ArrowUpRight,
  Sliders,
  Users,
  Gift,
  Image as ImageIcon,
  ExternalLink,
  FileText,
  Loader2,
} from 'lucide-react';

export const TransactionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [screenshotModalUrl, setScreenshotModalUrl] = useState<string | null>(null);

  const { data: txn, isLoading, isError, error } = useQuery({
    queryKey: ['staff-transaction-detail', id],
    queryFn: () => getStaffTransactionDetail(id || ''),
    enabled: !!id,
    retry: 1,
  });

  const handleCopy = async (text: string, key: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'successful':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Successful
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'add_money':
        return 'Deposit';
      case 'join_fee':
        return 'Match Entry Fee';
      case 'winning':
        return 'Match Winning';
      case 'refund':
        return 'Match Fee Refund';
      case 'withdrawal_hold':
      case 'withdrawal':
        return 'Withdrawal Request';
      case 'withdrawal_refund':
        return 'Withdrawal Refund';
      case 'referral':
        return 'Referral Reward';
      case 'joining_reward':
        return 'Joining Reward';
      case 'admin_adjustment':
        return 'Balance Adjustment';
      default:
        return type.replace(/_/g, ' ');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
        <p className="text-base font-medium">Loading transaction details...</p>
      </div>
    );
  }

  if (isError || !txn) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/transactions')}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Transactions
        </button>

        <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-12 text-center space-y-4">
          <XCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <div>
            <h2 className="text-lg font-bold text-white">Transaction Not Found</h2>
            <p className="text-sm text-slate-400 mt-1">
              {(error as any)?.message || 'Unable to locate the requested transaction record.'}
            </p>
          </div>
          <button
            onClick={() => navigate('/transactions')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            Return to Transactions
          </button>
        </div>
      </div>
    );
  }

  const isPositive = txn.amount.startsWith('+');
  const isNegative = txn.amount.startsWith('-');

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/transactions')}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Transactions
        </button>
      </div>

      {/* Main Header Card */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-mono font-bold text-white tracking-tight">
                {formatTransactionId(txn.transactionId)}
              </h1>
              <button
                onClick={() => handleCopy(formatTransactionId(txn.transactionId), 'txId')}
                title="Copy Transaction ID"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-800 transition-colors"
              >
                {copiedKey === 'txId' ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Recorded at {formatISTDate(txn.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {getStatusBadge(txn.status)}
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              {getTypeLabel(txn.type)}
            </span>
          </div>
        </div>

        {txn.statusReason && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Notice: </span>
              {txn.statusReason}
            </div>
          </div>
        )}
      </div>

      {/* Financial & User Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Financial Summary Card */}
        <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-5">
          <div className="flex items-center gap-2.5 text-slate-300 font-semibold text-sm">
            <Wallet className="w-4 h-4 text-emerald-400" />
            Financial Summary
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs text-slate-400 font-medium">Transaction Amount</div>
              <div
                className={`text-3xl font-mono font-bold mt-1 ${
                  isPositive
                    ? 'text-emerald-400'
                    : isNegative
                    ? 'text-rose-400'
                    : 'text-white'
                }`}
              >
                {formatSignedRupees(txn.amount)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/80">
                <div className="text-xs text-slate-400">Affected Wallet</div>
                <div className="text-sm font-semibold text-white mt-1">
                  {txn.walletName}
                </div>
              </div>
              <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/80">
                <div className="text-xs text-slate-400">Balance After</div>
                <div className="text-sm font-semibold font-mono text-white mt-1">
                  {formatIndianRupees(txn.balanceAfter)}
                </div>
              </div>
            </div>

            <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400">Total Account Balance After</span>
              <span className="text-sm font-bold font-mono text-emerald-400">
                {formatIndianRupees(txn.remainingAmount)}
              </span>
            </div>

            {/* Multi-wallet breakdown */}
            {txn.breakdown && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Payment Source Breakdown
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-[11px] text-slate-500">Deposited</div>
                    <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">
                      {formatIndianRupees(txn.breakdown.deposited || '0.00')}
                    </div>
                  </div>
                  <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-[11px] text-slate-500">Cashback</div>
                    <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">
                      {formatIndianRupees(txn.breakdown.cashback || '0.00')}
                    </div>
                  </div>
                  <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-[11px] text-slate-500">Winning</div>
                    <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">
                      {formatIndianRupees(txn.breakdown.winning || '0.00')}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User Information Card */}
        <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-300 font-semibold text-sm">
              <User className="w-4 h-4 text-emerald-400" />
              User Information
            </div>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              View Full Profile →
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-start justify-between bg-slate-950/60 rounded-lg p-3 border border-slate-800/80">
              <div>
                <div className="font-semibold text-white">{txn.userName}</div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <span className="font-mono text-emerald-400">{formatUserId(txn.userId)}</span>
                  {txn.userUsername && <span>@{txn.userUsername}</span>}
                </div>
              </div>
              <button
                onClick={() => handleCopy(formatUserId(txn.userId), 'userId')}
                title="Copy User ID"
                className="p-1 text-slate-500 hover:text-white rounded"
              >
                {copiedKey === 'userId' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                <span className="text-slate-500 block">Email</span>
                <span className="text-slate-200 font-medium truncate block mt-0.5">
                  {txn.userEmail || '—'}
                </span>
              </div>
              <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                <span className="text-slate-500 block">Mobile</span>
                <span className="text-slate-200 font-medium truncate block mt-0.5">
                  {txn.userMobile || '—'}
                </span>
              </div>
              <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                <span className="text-slate-500 block">Free Fire UID</span>
                <span className="text-slate-200 font-medium font-mono truncate block mt-0.5">
                  {txn.userFfId || '—'}
                </span>
              </div>
              <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                <span className="text-slate-500 block">Free Fire IGN</span>
                <span className="text-slate-200 font-medium truncate block mt-0.5">
                  {txn.userFfName || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contextual Entity Details */}

      {/* 1. MATCH DETAILS */}
      {txn.match && (
        <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-300 font-semibold text-sm">
              <Swords className="w-4 h-4 text-emerald-400" />
              Associated Match Details
            </div>
            <button
              onClick={() => navigate(`/matches/${txn.match?.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700"
            >
              Open Match <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-500 block">Match ID</span>
              <span className="text-sm font-semibold font-mono text-emerald-400 mt-0.5 block">
                {formatMatchId(txn.match.matchId)}
              </span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-500 block">Game / Team Mode</span>
              <span className="text-sm font-semibold text-white mt-0.5 block uppercase">
                {txn.match.gameMode.replace(/_/g, ' ')} • {txn.match.teamMode}
              </span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-500 block">Entry Fee</span>
              <span className="text-sm font-semibold font-mono text-white mt-0.5 block">
                {formatIndianRupees(txn.match.entryFee)}
              </span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-500 block">Kill Price</span>
              <span className="text-sm font-semibold font-mono text-white mt-0.5 block">
                {formatIndianRupees(txn.match.killPrice)}
              </span>
            </div>
          </div>

          {/* Player Match Stats if available */}
          {(txn.match.kills != null || txn.match.rank != null || txn.match.prizeAmount != null) && (
            <div className="bg-slate-950/40 rounded-lg p-4 border border-slate-800/80 flex flex-wrap items-center gap-6">
              <div>
                <span className="text-xs text-slate-500 block">Player Kills</span>
                <span className="text-base font-bold text-white mt-0.5 block">
                  {txn.match.kills ?? 0}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Placement / Rank</span>
                <span className="text-base font-bold text-white mt-0.5 block">
                  {txn.match.rank ? `#${txn.match.rank}` : '—'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Prize / Payout</span>
                <span className="text-base font-bold font-mono text-emerald-400 mt-0.5 block">
                  {txn.match.prizeAmount ? formatIndianRupees(txn.match.prizeAmount) : '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. DEPOSIT DETAILS */}
      {txn.deposit && (
        <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-300 font-semibold text-sm">
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
              Associated Deposit Request
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
              {txn.deposit.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-3 md:col-span-2">
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">UTR / Reference Number</span>
                  <span className="text-sm font-semibold font-mono text-white mt-0.5 block">
                    {txn.deposit.utr}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(txn.deposit!.utr, 'utr')}
                  className="p-1 text-slate-500 hover:text-white rounded"
                >
                  {copiedKey === 'utr' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {txn.deposit.reviewedBy && (
                <div className="text-xs text-slate-400">
                  Reviewed by: <span className="text-slate-200 font-medium">{formatStaffId(txn.deposit.reviewedBy)}</span>
                  {txn.deposit.reviewedAt && ` on ${formatISTDate(txn.deposit.reviewedAt)}`}
                </div>
              )}
            </div>

            {/* Screenshot Thumbnail */}
            {txn.deposit.screenshotUrl && (
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 flex flex-col items-center justify-center gap-2">
                <span className="text-xs text-slate-400 self-start">Payment Proof</span>
                <img
                  src={txn.deposit.screenshotUrl}
                  alt="Payment Screenshot"
                  className="h-28 object-contain rounded border border-slate-800 hover:opacity-90 transition-opacity cursor-pointer"
                  onClick={() => setScreenshotModalUrl(txn.deposit!.screenshotUrl)}
                />
                <button
                  onClick={() => setScreenshotModalUrl(txn.deposit!.screenshotUrl)}
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Zoom Screenshot
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. WITHDRAWAL DETAILS */}
      {txn.withdrawal && (
        <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-300 font-semibold text-sm">
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              Associated Withdrawal Request
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
              {txn.withdrawal.status}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block">Player UPI ID</span>
                <span className="text-sm font-semibold font-mono text-white mt-0.5 block">
                  {txn.withdrawal.upiId}
                </span>
              </div>
              <button
                onClick={() => handleCopy(txn.withdrawal!.upiId, 'upiId')}
                className="p-1 text-slate-500 hover:text-white rounded"
              >
                {copiedKey === 'upiId' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block">Payout Reference</span>
                <span className="text-sm font-semibold font-mono text-white mt-0.5 block truncate max-w-[150px]">
                  {txn.withdrawal.payoutRef || '—'}
                </span>
              </div>
              {txn.withdrawal.payoutRef && (
                <button
                  onClick={() => handleCopy(txn.withdrawal!.payoutRef!, 'payoutRef')}
                  className="p-1 text-slate-500 hover:text-white rounded"
                >
                  {copiedKey === 'payoutRef' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>

            {txn.withdrawal.processedBy && (
              <div className="text-xs text-slate-400">
                Processed by: <span className="text-slate-200 font-medium">{formatStaffId(txn.withdrawal.processedBy)}</span>
                {txn.withdrawal.processedAt && ` on ${formatISTDate(txn.withdrawal.processedAt)}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. REFERRAL DETAILS */}
      {txn.referral && (
        <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-3">
          <div className="flex items-center gap-2.5 text-slate-300 font-semibold text-sm">
            <Users className="w-4 h-4 text-emerald-400" />
            Referral Reward Details
          </div>
          <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
            <div className="text-xs text-slate-400">Referred User</div>
            <div className="text-sm font-semibold text-white mt-1">
              {txn.referral.referredName || txn.referral.referredUsername}
              {txn.referral.referredUserId && (
                <span className="ml-2 font-mono text-xs text-emerald-400">
                  ({formatUserId(txn.referral.referredUserId)})
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. ADJUSTMENT DETAILS */}
      {txn.adjustment && (
        <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-3">
          <div className="flex items-center gap-2.5 text-slate-300 font-semibold text-sm">
            <Sliders className="w-4 h-4 text-emerald-400" />
            Admin Adjustment Details
          </div>
          <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80 space-y-2">
            <div>
              <span className="text-xs text-slate-500 block">Adjustment Reason</span>
              <span className="text-sm text-slate-200 mt-0.5 block">
                {txn.adjustment.reason || 'No reason specified'}
              </span>
            </div>
            {txn.adjustment.adjustedBy && (
              <div className="text-xs text-slate-500">
                Adjusted by: <span className="text-slate-300">{formatStaffId(txn.adjustment.adjustedBy)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. JOINING REWARD DETAILS */}
      {txn.type === 'joining_reward' && (
        <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-3" data-testid="joining-reward-details-card">
          <div className="flex items-center gap-2.5 text-slate-300 font-semibold text-sm">
            <Gift className="w-4 h-4 text-emerald-400" />
            Joining Reward Details
          </div>
          <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
            <div className="text-xs text-slate-400">Welcome Bonus</div>
            <div className="text-sm font-semibold text-white mt-1">
              New player registration bonus credited directly to the player's Deposit wallet.
            </div>
          </div>
        </div>
      )}

      {/* Technical Ledger Audit Box */}
      <div className="bg-slate-900/40 rounded-xl border border-slate-800/60 p-5 space-y-2 text-xs text-slate-400">
        <div className="font-semibold text-slate-300 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          Technical Ledger Trace
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div>
            <span className="text-slate-500">Reference Type: </span>
            <span className="font-mono text-slate-300">{txn.refType || 'None'}</span>
          </div>
          <div>
            <span className="text-slate-500">Reference ID: </span>
            <span className="font-mono text-slate-300">{formatLedgerRefId(txn.refId, txn.type, txn.refType) || 'None'}</span>
          </div>
          <div>
            <span className="text-slate-500">Raw Ledger ID: </span>
            <span className="font-mono text-slate-300">{txn.id}</span>
          </div>
        </div>
      </div>

      {/* User Profile Modal */}
      {isProfileModalOpen && (
        <UserProfileModal
          isOpen={true}
          userId={txn.userId}
          initialUserName={txn.userName}
          initialUserEmail={txn.userEmail}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}

      {/* Screenshot Viewer Modal */}
      {screenshotModalUrl && txn.deposit && (
        <ScreenshotViewerModal
          isOpen={true}
          depositId={txn.deposit.id}
          initialUrl={screenshotModalUrl}
          onClose={() => setScreenshotModalUrl(null)}
        />
      )}
    </div>
  );
};
