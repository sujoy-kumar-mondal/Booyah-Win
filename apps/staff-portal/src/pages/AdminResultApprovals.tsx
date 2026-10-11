/**
 * Admin Result Approvals Page for Booyah Win Staff Portal
 * Admin-only operation (/results).
 *
 * Requirements & Changes:
 * - Pending queue fetched via GET /admin/results.
 * - Live payout preview fetched via GET /admin/results/:matchId/preview.
 * - Fresh signed screenshot URL, loaded with referrerPolicy="no-referrer".
 * - Warning banner if payout exceeds collected fees.
 * - Approve confirmation dialog re-fetches preview on open and displays total payout.
 * - Reject dialog requires min 5 characters reason.
 * - Reverse dialog requires min 5 characters reason; displays affected users table on LOW_BALANCE.
 * - Successful reversal resets match to live and result to rejected, providing resubmission link.
 * - Double-click guards (ref + disabled state).
 */

import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  getAdminResultsQueue,
  getAdminResultPreview,
  approveAdminResult,
  rejectAdminResult,
  reverseAdminResult,
  getStaffMatchResult,
} from '../api/matches.js';
import type {
  AdminQueueItemDto,
  ResultPayoutPreviewDto,
  AffectedUserDto,
} from '../api/types.js';
import {
  formatIndianRupees,
  formatISTDate,
  getPositionLabel,
} from '../utils/formatters.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Trophy,
  Eye,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export const AdminResultApprovals: React.FC = () => {
  const queryClient = useQueryClient();

  // Selected item for expanded review & preview
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  // Approve dialog state
  const [approveTarget, setApproveTarget] = useState<AdminQueueItemDto | null>(null);
  const [approvePreview, setApprovePreview] = useState<ResultPayoutPreviewDto | null>(null);
  const [approveLoading, setApproveLoading] = useState<boolean>(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Reject dialog state
  const [rejectTarget, setRejectTarget] = useState<AdminQueueItemDto | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Reverse dialog state (supports testing / manual reversal)
  const [reverseMatchId, setReverseMatchId] = useState<string>('');
  const [reverseReason, setReverseReason] = useState<string>('');
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [reverseSuccessMessage, setReverseSuccessMessage] = useState<string | null>(null);
  const [affectedUsers, setAffectedUsers] = useState<AffectedUserDto[]>([]);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState<boolean>(false);

  // Double click guard
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: queueData,
    isLoading: queueLoading,
    isError: queueError,
    error: queueFetchError,
    refetch: refetchQueue,
    isFetching,
  } = useQuery({
    queryKey: ['admin-results-queue'],
    queryFn: getAdminResultsQueue,
    staleTime: 0,
    refetchInterval: 10000,
  });

  const queueItems: AdminQueueItemDto[] = queueData?.results || [];

  // Fetch preview for selected match
  const {
    data: previewData,
    isLoading: previewLoading,
    isError: previewError,
  } = useQuery({
    queryKey: ['admin-result-preview', selectedMatchId],
    queryFn: () => getAdminResultPreview(selectedMatchId!),
    enabled: Boolean(selectedMatchId),
  });

  // Fetch fresh signed screenshot URL for selected match
  const { data: resultDetail } = useQuery({
    queryKey: ['staff-match-result', selectedMatchId],
    queryFn: () => getStaffMatchResult(selectedMatchId!),
    enabled: Boolean(selectedMatchId),
  });

  // ─── Open Approve Confirmation Dialog ─────────────────────────────────────
  const handleOpenApproveDialog = async (item: AdminQueueItemDto) => {
    setApproveTarget(item);
    setApproveError(null);
    setApproveLoading(true);

    try {
      // Pre-fetch / re-fetch live preview when dialog opens
      const preview = await getAdminResultPreview(item.matchId);
      setApprovePreview(preview);
    } catch (err) {
      setApproveError(getFriendlyErrorMessage(err, 'result'));
    } finally {
      setApproveLoading(false);
    }
  };

  // ─── Confirm Approve ──────────────────────────────────────────────────────
  const handleApproveSubmit = async () => {
    if (!approveTarget || isSubmittingRef.current) return;

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setApproveError(null);

      await approveAdminResult(approveTarget.matchId);

      setApproveTarget(null);
      setApprovePreview(null);
      if (selectedMatchId === approveTarget.matchId) {
        setSelectedMatchId(null);
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-results-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['staff-matches'] });
    } catch (err: any) {
      setApproveError(getFriendlyErrorMessage(err, 'result'));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ─── Confirm Reject ───────────────────────────────────────────────────────
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget || isSubmittingRef.current) return;
    if (rejectReason.trim().length < 5) {
      setRejectError('Rejection reason must be at least 5 characters');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setRejectError(null);

      await rejectAdminResult(rejectTarget.matchId, rejectReason.trim());

      setRejectTarget(null);
      setRejectReason('');
      if (selectedMatchId === rejectTarget.matchId) {
        setSelectedMatchId(null);
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-results-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['staff-matches'] });
    } catch (err: any) {
      setRejectError(getFriendlyErrorMessage(err, 'result'));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ─── Confirm Reverse ──────────────────────────────────────────────────────
  const handleReverseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverseMatchId.trim() || isSubmittingRef.current) return;
    if (reverseReason.trim().length < 5) {
      setReverseError('Reversal reason must be at least 5 characters');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setReverseError(null);
      setReverseSuccessMessage(null);
      setAffectedUsers([]);

      await reverseAdminResult(reverseMatchId.trim(), reverseReason.trim());

      setReverseSuccessMessage(
        `Result for Match #${reverseMatchId} was reversed successfully. Match status is reset to 'live' and result is set to 'rejected', allowing score resubmission.`
      );
      setReverseReason('');
      await queryClient.invalidateQueries({ queryKey: ['admin-results-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['staff-matches'] });
    } catch (err: any) {
      if (err?.code === 'LOW_BALANCE' && err?.details?.affectedUsers) {
        setAffectedUsers(err.details.affectedUsers);
        setReverseError(
          'Cannot reverse result: One or more players have already withdrawn or spent their winnings.'
        );
      } else {
        setReverseError(getFriendlyErrorMessage(err, 'result'));
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Link to="/matches" className="hover:text-amber-400 transition-colors">
              Operations
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-200">Results Approval Queue</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-amber-500" />
            Match Results Verification & Payouts
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetchQueue()}
            disabled={isFetching}
            className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setReverseError(null);
              setReverseSuccessMessage(null);
              setAffectedUsers([]);
              setIsReverseModalOpen(true);
            }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors border border-slate-700"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            Dispute Reversal
          </button>
        </div>
      </div>

      {/* Main Content: Queue List & Detail Preview Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Queue Items */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                Pending Approval Queue ({queueItems.length})
              </span>
              <span className="text-xs text-amber-400 font-semibold">
                Requires Admin Signoff
              </span>
            </div>

            {queueLoading ? (
              <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Loading pending results...</p>
              </div>
            ) : queueError ? (
              <div className="p-6 text-center text-xs text-red-300">
                Failed to load results queue: {String(queueFetchError)}
              </div>
            ) : queueItems.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="font-semibold text-slate-300">Queue is completely clear!</p>
                <p>All submitted match results have been reviewed and disbursed.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {queueItems.map((item) => {
                  const isSelected = selectedMatchId === item.matchId;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedMatchId(item.matchId)}
                      className={`p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-500/10 border-l-4 border-l-amber-500'
                          : 'hover:bg-slate-800/40 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono font-bold text-sm text-white">
                          BW-MAT-{item.matchId}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                        <span className="capitalize">
                          {item.gameMode.replace('_', ' ')} • {item.teamMode}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Submitted {formatISTDate(item.createdAt)}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMatchId(item.matchId);
                          }}
                          className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                        >
                          Review Preview
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRejectTarget(item);
                            setRejectReason('');
                            setRejectError(null);
                          }}
                          className="px-2.5 py-1 text-xs text-red-300 hover:text-red-200 bg-red-950/40 hover:bg-red-900/60 border border-red-900 rounded transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenApproveDialog(item);
                          }}
                          className="px-3 py-1 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors shadow-sm"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Detailed Scoreboard & Payout Preview Card */}
        <div className="lg:col-span-7">
          {!selectedMatchId ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center text-xs text-slate-500 space-y-3">
              <Eye className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-medium text-slate-400">
                Select a match from the queue to inspect screenshot and audit payout distribution.
              </p>
            </div>
          ) : previewLoading ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-12 text-center text-xs text-slate-400 space-y-2">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Computing live payout audit preview for Match #{selectedMatchId}...</p>
            </div>
          ) : previewError || !previewData ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-8 text-center text-xs text-red-300 space-y-2">
              <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
              <p>Failed to load payout preview for Match #{selectedMatchId}.</p>
            </div>
          ) : (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-6 p-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Payout Preview & Scoreboard Audit (M{selectedMatchId})
                  </h2>
                  <span className="text-xs text-slate-400">
                    Dry-run computation against active non-refunded players
                  </span>
                </div>
                <Link
                  to={`/matches/${selectedMatchId}`}
                  target="_blank"
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <span>Match Room</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Warning Banner if Payout Exceeds Collected Fees */}
              {previewData.warning && (
                <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-4 text-amber-200 text-xs flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-white font-semibold mb-0.5">
                      Fiscal Discrepancy Warning
                    </strong>
                    {previewData.warning} (Difference: {formatIndianRupees(previewData.difference)})
                  </div>
                </div>
              )}

              {/* Financial Balance Summary Card */}
              <div className="grid grid-cols-3 gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-center">
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Total Collected</span>
                  <span className="font-bold text-white text-base font-mono">
                    {formatIndianRupees(previewData.totalCollected)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Total Payout</span>
                  <span className="font-bold text-emerald-400 text-base font-mono">
                    {formatIndianRupees(previewData.totalPayout)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Difference (Profit/Loss)</span>
                  <span
                    className={`font-bold text-base font-mono ${
                      Number(previewData.difference) < 0 ? 'text-amber-400' : 'text-slate-200'
                    }`}
                  >
                    {formatIndianRupees(previewData.difference)}
                  </span>
                </div>
              </div>

              {/* Fresh Signed Screenshot Section */}
              {resultDetail?.signedScreenshotUrl && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Verified In-Game Scoreboard
                  </span>
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center">
                    <img
                      src={resultDetail.signedScreenshotUrl}
                      alt="Match scoreboard"
                      referrerPolicy="no-referrer"
                      className="max-h-64 max-w-full mx-auto rounded object-contain border border-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Payout Entries Table */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Individual Winner Disbursements ({previewData.entries.length})
                </span>
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">User ID</th>
                        <th className="py-2.5 px-3">Kills</th>
                        <th className="py-2.5 px-3">Position</th>
                        <th className="py-2.5 px-3">Kill Prize</th>
                        <th className="py-2.5 px-3">Pos Prize</th>
                        <th className="py-2.5 px-3 text-right">Total Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {previewData.entries.map((entry: any) => (
                        <tr key={entry.userId} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-mono text-slate-300">
                            #{entry.userId}
                          </td>
                          <td className="py-2 px-3 text-white font-semibold">
                            {entry.kills}
                          </td>
                          <td className="py-2 px-3">
                            {entry.position ? (
                              <span className="text-amber-300 font-medium">
                                {getPositionLabel(entry.position)}
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400">
                            {formatIndianRupees(entry.killReward)}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400">
                            {formatIndianRupees(entry.positionPrize)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                            {formatIndianRupees(entry.payout)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons for Selected Match */}
              {queueItems.find((q) => q.matchId === selectedMatchId) && (
                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const item = queueItems.find((q) => q.matchId === selectedMatchId);
                      if (item) {
                        setRejectTarget(item);
                        setRejectReason('');
                        setRejectError(null);
                      }
                    }}
                    className="px-4 py-2 text-xs font-semibold text-red-300 bg-red-950/50 hover:bg-red-900/60 border border-red-800 rounded-lg transition-colors"
                  >
                    Reject Result
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const item = queueItems.find((q) => q.matchId === selectedMatchId);
                      if (item) handleOpenApproveDialog(item);
                    }}
                    className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors shadow-lg shadow-amber-500/10"
                  >
                    Confirm & Approve Payouts
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── MODAL: Approve Confirmation ────────────────────────────────────── */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Approve Match Result (M{approveTarget.matchId})
            </h3>
            <p className="text-xs text-slate-300">
              Approving re-computes final winnings, locks player wallets, credits winning balances, and permanently transitions the match to completed.
            </p>

            {approveLoading ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Fetching fresh preview...
              </div>
            ) : approvePreview ? (
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Total Entry Collected:</span>
                  <span className="font-mono text-white">
                    {formatIndianRupees(approvePreview.totalCollected)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Winnings Disbursed:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {formatIndianRupees(approvePreview.totalPayout)}
                  </span>
                </div>
                {approvePreview.warning && (
                  <p className="text-amber-400 text-[11px] pt-1">
                    ⚠ {approvePreview.warning}
                  </p>
                )}
              </div>
            ) : null}

            {approveError && (
              <div className="p-3 bg-red-950/50 border border-red-900 rounded-lg text-xs text-red-200">
                {approveError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || approveLoading}
                onClick={handleApproveSubmit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Approving...' : 'Confirm Approval & Payout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Reject Result ───────────────────────────────────────────── */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Reject Match Result (M{rejectTarget.matchId})
            </h3>
            <p className="text-xs text-slate-300">
              Rejecting will notify staff that the submitted results or screenshot were inaccurate. Staff will be required to review and resubmit.
            </p>

            {rejectError && (
              <div className="p-3 bg-red-950/50 border border-red-900 rounded-lg text-xs text-red-200">
                {rejectError}
              </div>
            )}

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Rejection Reason (Min 5 characters)
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Screenshot kills do not match entered entries for Team 2"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || rejectReason.trim().length < 5}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Dispute Reversal ────────────────────────────────────────── */}
      {isReverseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-500" />
              Reverse Match Result
            </h3>
            <p className="text-xs text-slate-300">
              Reversing debits winning balances credited to winners, records reversal ledger rows, and resets the match to 'live' and result to 'rejected', enabling staff to submit corrected results.
            </p>

            {reverseSuccessMessage && (
              <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-lg text-xs text-emerald-200">
                {reverseSuccessMessage}
              </div>
            )}

            {reverseError && (
              <div className="p-3 bg-red-950/50 border border-red-900 rounded-lg text-xs text-red-200">
                {reverseError}
              </div>
            )}

            {/* Affected Users Table on LOW_BALANCE */}
            {affectedUsers.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-semibold text-red-300 uppercase tracking-wider block">
                  Players With Insufficient Winning Balance ({affectedUsers.length}):
                </span>
                <div className="overflow-x-auto border border-red-900/60 rounded-lg bg-red-950/20">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-red-950/50 text-red-300 uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">User ID</th>
                        <th className="py-2 px-3">Available Balance</th>
                        <th className="py-2 px-3 text-right">Required to Debit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-900/40">
                      {affectedUsers.map((u) => (
                        <tr key={u.userId}>
                          <td className="py-1.5 px-3 font-mono text-white">#{u.userId}</td>
                          <td className="py-1.5 px-3 font-mono text-amber-300">
                            {formatIndianRupees(u.winningPaise)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono text-red-300">
                            {formatIndianRupees(u.requiredPaise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-slate-400">
                  Reversal cannot proceed until these users have their winning balances restored or manually adjusted.
                </p>
              </div>
            )}

            <form onSubmit={handleReverseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Match ID to Reverse
                </label>
                <input
                  type="text"
                  required
                  value={reverseMatchId}
                  onChange={(e) => setReverseMatchId(e.target.value)}
                  placeholder="e.g. 2"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reversal Reason (Min 5 characters)
                </label>
                <textarea
                  required
                  rows={3}
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  placeholder="e.g. Dispute resolved in favor of runner up due to disqualification"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReverseModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !reverseMatchId.trim() || reverseReason.trim().length < 5}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Reversing...' : 'Execute Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
