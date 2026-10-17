/**
 * Staff Withdrawal Queue Screen
 *
 * Requirements:
 * - Pending first, oldest first; filter by status
 * - Show amount, user UPI ID with copy button (fallback + "Copied" badge), age
 * - Mark paid: requires payout reference (payoutRef), confirm dialog
 * - Reject: reason >= 5 characters required
 * - Confirm dialog bound to exact row data (Requirement 4)
 * - 409 handling: shows "This request was already processed" and refreshes row (Requirement 3)
 * - Shows ADMIN_APPROVAL_REQUIRED and FORBIDDEN (cannot process own withdrawal) clearly (Requirement 5)
 * - Never logs UPI IDs (Requirement 11)
 * - Double-click ref guard (isSubmittingRef)
 * - Cursor pagination with "Load more" (Requirement 9)
 */

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStaffWithdrawals,
  markWithdrawalPaid,
  verifyWithdrawal,
  rejectWithdrawal,
} from '../api/staff.js';
import { useStaffAuth } from '../context/StaffAuthContext.js';
import type { StaffWithdrawalDto } from '../api/types.js';
import {
  formatIndianRupees,
  formatISTDate,
  formatAgeMinutes,
  isWithdrawalOverdue,
} from '../utils/formatters.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import { UserProfileModal } from '../components/common/UserProfileModal.js';
import {
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Search,
  User,
} from 'lucide-react';

const STATUS_FILTERS = [
  { label: 'Awaiting Final Payout', value: 'employee_approved' },
  { label: 'Pending', value: 'pending' },
  { label: 'All', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'Rejected', value: 'rejected' },
];

function useSafeStaffAuth() {
  try {
    return useStaffAuth();
  } catch {
    return { staff: null };
  }
}

export const Withdrawals: React.FC = () => {
  const queryClient = useQueryClient();
  const { staff } = useSafeStaffAuth();
  const isEmployee = staff?.role === 'employee';
  const isAdmin = !staff || staff.role === 'admin';

  const [filter, setFilter] = useState<string>('pending');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allWithdrawals, setAllWithdrawals] = useState<StaffWithdrawalDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Active row being acted on (Requirement 4 snapshot)
  const [activeWithdrawal, setActiveWithdrawal] = useState<StaffWithdrawalDto | null>(null);
  const [dialogMode, setDialogMode] = useState<'pay' | 'reject' | 'verify' | null>(null);

  const [payoutRef, setPayoutRef] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Clipboard copy state keyed by withdrawal ID
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // User profile modal state
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState<{ name?: string; email?: string } | null>(null);

  // Double submit ref guard
  const isSubmittingRef = useRef<boolean>(false);

  // Fetch withdrawals query
  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['staff-withdrawals', filter, cursor],
    queryFn: () => getStaffWithdrawals({ status: filter, cursor, limit: 15 }),
    staleTime: 0,
    refetchInterval: cursor ? false : 5000,
  });

  // Sync query data into allWithdrawals state (handles cache hits, remounts, polling, and pagination)
  useEffect(() => {
    if (!data) return;
    if (!cursor) {
      setAllWithdrawals(data.items);
    } else {
      setAllWithdrawals((prev) => {
        const existingIds = new Set(prev.map((w) => w.id));
        const uniqueItems = data.items.filter((w) => !existingIds.has(w.id));
        return [...prev, ...uniqueItems];
      });
    }
    setNextCursor(data.nextCursor ?? null);
  }, [data, cursor]);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setCursor(undefined);
    setAllWithdrawals([]);
    setNextCursor(null);
  };

  const handleLoadMore = () => {
    if (nextCursor && !isFetching) {
      setCursor(nextCursor);
    }
  };

  // Requirement 11: Copy with fallback, never log UPI
  const handleCopyUpi = async (id: string, text: string) => {
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
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  // Mutations
  const markPaidMutation = useMutation({
    mutationFn: ({ id, payoutRef }: { id: string; payoutRef: string }) =>
      markWithdrawalPaid(id, payoutRef),
    onSuccess: () => {
      setDialogMode(null);
      setActiveWithdrawal(null);
      setPayoutRef('');
      queryClient.invalidateQueries({ queryKey: ['staff-withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['staff-dashboard'] });
    },
    onError: (err: any) => {
      const msg = getFriendlyErrorMessage(err, 'withdrawal');
      setActionError(msg);
      if (err?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['staff-withdrawals'] });
        queryClient.invalidateQueries({ queryKey: ['staff-dashboard'] });
      }
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => verifyWithdrawal(id),
    onSuccess: () => {
      setDialogMode(null);
      setActiveWithdrawal(null);
      queryClient.invalidateQueries({ queryKey: ['staff-withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['staff-dashboard'] });
    },
    onError: (err: any) => {
      const msg = getFriendlyErrorMessage(err, 'withdrawal');
      setActionError(msg);
      if (err?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['staff-withdrawals'] });
        queryClient.invalidateQueries({ queryKey: ['staff-dashboard'] });
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectWithdrawal(id, reason),
    onSuccess: () => {
      setDialogMode(null);
      setActiveWithdrawal(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['staff-withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['staff-dashboard'] });
    },
    onError: (err: any) => {
      const msg = getFriendlyErrorMessage(err, 'withdrawal');
      setActionError(msg);
      if (err?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['staff-withdrawals'] });
        queryClient.invalidateQueries({ queryKey: ['staff-dashboard'] });
      }
    },
  });

  const handleConfirmMarkPaid = async () => {
    if (!activeWithdrawal || isSubmittingRef.current || markPaidMutation.isPending) return;

    if (!payoutRef.trim()) {
      setActionError('Payout reference is required to mark as paid');
      return;
    }

    isSubmittingRef.current = true;
    setActionError(null);
    try {
      await markPaidMutation.mutateAsync({
        id: activeWithdrawal.id,
        payoutRef: payoutRef.trim(),
      });
    } catch {
      // Handled in onError
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleConfirmVerify = async () => {
    if (!activeWithdrawal || isSubmittingRef.current || verifyMutation.isPending) return;

    isSubmittingRef.current = true;
    setActionError(null);
    try {
      await verifyMutation.mutateAsync(activeWithdrawal.id);
    } catch {
      // Handled in onError
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleConfirmReject = async () => {
    if (!activeWithdrawal || isSubmittingRef.current || rejectMutation.isPending) return;

    if (rejectReason.trim().length < 5) {
      setActionError('Rejection reason must be at least 5 characters');
      return;
    }

    isSubmittingRef.current = true;
    setActionError(null);
    try {
      await rejectMutation.mutateAsync({
        id: activeWithdrawal.id,
        reason: rejectReason.trim(),
      });
    } catch {
      // Handled in onError
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="space-y-6" data-testid="withdrawal-queue-container">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-100 tracking-tight flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-emerald-400" />
            Withdrawal Queue
          </h1>
          <p className="text-xs text-slate-400">
            Process player payout requests and record bank UPI transaction references
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (cursor) setCursor(undefined);
              refetch();
            }}
            disabled={isFetching}
            data-testid="refresh-withdrawals-btn"
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-3" data-testid="withdrawal-filters">
        {STATUS_FILTERS.map((sf) => (
          <button
            key={sf.value}
            type="button"
            onClick={() => handleFilterChange(sf.value)}
            data-testid={`filter-btn-${sf.value}`}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              filter === sf.value
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/10'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {sf.label}
          </button>
        ))}
      </div>

      {/* Table / Queue List */}
      {isLoading && allWithdrawals.length === 0 ? (
        <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <span className="text-xs font-semibold">Loading withdrawal requests...</span>
        </div>
      ) : allWithdrawals.length === 0 ? (
        <div
          className="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center space-y-3"
          data-testid="withdrawals-empty-state"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
            <Search className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-slate-200">No withdrawal requests found</p>
          <p className="text-xs text-slate-400">
            {filter === 'pending'
              ? 'All payout requests have been settled.'
              : `No requests matching "${filter}" status.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">User</th>
                  <th className="px-4 py-3.5">Amount</th>
                  <th className="px-4 py-3.5">Player UPI ID</th>
                  <th className="px-4 py-3.5">Age / Date</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allWithdrawals.map((wth) => {
                  const ageMinutes = Math.floor(
                    (Date.now() - new Date(wth.createdAt).getTime()) / 60000
                  );
                  const isOverdue =
                    (wth.status === 'pending' || wth.status === 'employee_approved') &&
                    isWithdrawalOverdue(ageMinutes);
                  const isCopied = copiedId === wth.id;

                  return (
                    <tr
                      key={wth.id}
                      data-testid={`withdrawal-row-${wth.id}`}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      {/* User */}
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProfileUserId(wth.userId);
                            setSelectedProfileUser({ name: wth.userName, email: wth.userEmail });
                          }}
                          data-testid={`user-profile-btn-${wth.id}`}
                          className="text-left group flex flex-col items-start focus:outline-none"
                          title="Click to view user profile"
                        >
                          <span className="font-bold text-emerald-400 group-hover:text-emerald-300 group-hover:underline flex items-center gap-1.5 transition-colors">
                            <User className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
                            <span>{wth.userName || wth.userEmail}</span>
                          </span>
                          <span className="text-[11px] text-slate-400 truncate max-w-[170px] mt-0.5">
                            {wth.userEmail}
                          </span>
                        </button>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-emerald-400 text-sm">
                          {formatIndianRupees(wth.amount)}
                        </span>
                      </td>

                      {/* UPI ID with copy button */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono text-xs text-slate-200 font-semibold select-all"
                            data-testid={`withdrawal-upi-${wth.id}`}
                          >
                            {wth.upiId}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyUpi(wth.id, wth.upiId)}
                            data-testid={`copy-upi-btn-${wth.id}`}
                            className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-emerald-400 transition-colors"
                            aria-label="Copy UPI ID"
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span className="text-emerald-400 font-bold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        {wth.payoutRef && (
                          <div className="mt-1 text-[10px] text-slate-400">
                            Ref: <span className="font-mono font-semibold text-slate-300">{wth.payoutRef}</span>
                          </div>
                        )}
                      </td>

                      {/* Age / Date */}
                      <td className="px-4 py-3.5">
                        <div
                          className={`flex items-center gap-1 font-semibold ${
                            isOverdue ? 'text-rose-400' : 'text-slate-300'
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          <span>{formatAgeMinutes(ageMinutes)}</span>
                          {isOverdue && (
                            <span className="rounded bg-rose-500/20 px-1 text-[9px] font-bold border border-rose-500/30">
                              Overdue (&gt;24h)
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {formatISTDate(wth.createdAt)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {wth.status === 'pending' && (
                          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                            Pending
                          </span>
                        )}
                        {wth.status === 'employee_approved' && (
                          <div>
                            <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-500/20">
                              Verified
                            </span>
                            {wth.employeeReviewedBy && (
                              <p className="text-[10px] text-slate-400 mt-1">
                                Verified by #{wth.employeeReviewedBy}
                              </p>
                            )}
                          </div>
                        )}
                        {wth.status === 'paid' && (
                          <div className="space-y-1">
                            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                              Paid
                            </span>
                            {!wth.employeeReviewedBy && (
                              <div className="text-[10px] text-blue-400 font-semibold" data-testid="direct-approved-tag">
                                approved directly by admin
                              </div>
                            )}
                          </div>
                        )}
                        {wth.status === 'rejected' && (
                          <div>
                            <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/20">
                              Rejected
                            </span>
                            {wth.rejectReason && (
                              <p className="text-[10px] text-slate-400 mt-1 max-w-[140px] truncate" title={wth.rejectReason}>
                                {wth.rejectReason}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        {wth.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {isEmployee ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveWithdrawal(wth);
                                  setDialogMode('verify');
                                  setActionError(null);
                                }}
                                data-testid={`verify-btn-${wth.id}`}
                                className="flex items-center gap-1 rounded-lg bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500 hover:text-slate-950 transition-all active:scale-[0.98]"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Verify</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveWithdrawal(wth);
                                  setDialogMode('pay');
                                  setPayoutRef('');
                                  setActionError(null);
                                }}
                                data-testid={`mark-paid-btn-${wth.id}`}
                                className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-slate-950 transition-all active:scale-[0.98]"
                              >
                                <span data-testid={`pay-btn-${wth.id}`} className="flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>Mark Paid</span>
                                </span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveWithdrawal(wth);
                                setDialogMode('reject');
                                setRejectReason('');
                                setActionError(null);
                              }}
                              data-testid={`reject-btn-${wth.id}`}
                              className="flex items-center gap-1 rounded-lg bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all active:scale-[0.98]"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : wth.status === 'employee_approved' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {isEmployee ? (
                              <button
                                type="button"
                                disabled
                                data-testid={`verify-btn-${wth.id}`}
                                className="flex items-center gap-1 rounded-lg bg-cyan-500/5 px-2.5 py-1 text-xs font-bold text-cyan-400/50 border border-cyan-500/10 opacity-60 cursor-not-allowed"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Verified</span>
                              </button>
                            ) : isAdmin ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveWithdrawal(wth);
                                    setDialogMode('pay');
                                    setPayoutRef('');
                                    setActionError(null);
                                  }}
                                  data-testid={`mark-paid-btn-${wth.id}`}
                                  className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-slate-950 transition-all active:scale-[0.98]"
                                >
                                  <span data-testid={`pay-btn-${wth.id}`} className="flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>Mark Paid</span>
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveWithdrawal(wth);
                                    setDialogMode('reject');
                                    setRejectReason('');
                                    setActionError(null);
                                  }}
                                  data-testid={`reject-btn-${wth.id}`}
                                  className="flex items-center gap-1 rounded-lg bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all active:scale-[0.98]"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">Processed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Load More Button (Requirement 9) */}
          {nextCursor && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isFetching}
                data-testid="load-more-withdrawals-btn"
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
              >
                {isFetching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    <span>Loading more...</span>
                  </>
                ) : (
                  <span>Load More Withdrawals</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mark Paid Modal (Requirement 4 snapshot) */}
      {dialogMode === 'pay' && activeWithdrawal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          data-testid="mark-paid-modal"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
              <h3 className="text-base font-bold text-slate-100">Confirm Withdrawal Settlement</h3>
            </div>

            {activeWithdrawal.status === 'pending' ? (
              <div
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2"
                data-testid="direct-approval-warning"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                <p className="font-semibold">
                  This request has not been verified by an employee. Approve directly?
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-300">
                Confirm that you have transferred funds to the player's UPI ID and enter the bank/payment gateway reference.
              </p>
            )}

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Withdrawal ID:</span>
                <span className="font-mono font-bold text-slate-200">#{activeWithdrawal.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="font-bold text-emerald-400" data-testid="confirm-dialog-amount">
                  {formatIndianRupees(activeWithdrawal.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Player UPI:</span>
                <span className="font-mono text-slate-200 select-all" data-testid="confirm-dialog-upi">
                  {activeWithdrawal.upiId}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="payout-ref" className="block text-xs font-semibold text-slate-300">
                Bank Payout Reference (UTR / Trans ID) <span className="text-rose-400">*</span>
              </label>
              <input
                id="payout-ref"
                type="text"
                required
                placeholder="e.g. 123456789012"
                value={payoutRef}
                onChange={(e) => {
                  setPayoutRef(e.target.value);
                  setActionError(null);
                }}
                data-testid="payout-ref-input"
                className="w-full font-mono rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {actionError && (
              <div
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-start gap-2"
                data-testid="withdrawal-action-error"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDialogMode(null);
                  setActiveWithdrawal(null);
                  setPayoutRef('');
                  setActionError(null);
                }}
                disabled={markPaidMutation.isPending}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMarkPaid}
                disabled={markPaidMutation.isPending || !payoutRef.trim()}
                data-testid="confirm-mark-paid-btn"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {markPaidMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Mark as Paid</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {dialogMode === 'reject' && activeWithdrawal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          data-testid="reject-withdrawal-modal"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <XCircle className="h-6 w-6" />
              <h3 className="text-base font-bold text-slate-100">Reject Withdrawal Request</h3>
            </div>

            <p className="text-xs text-slate-300">
              Rejecting withdrawal #{activeWithdrawal.id} will automatically refund {formatIndianRupees(activeWithdrawal.amount)} back to the player's Winning wallet balance.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="reject-reason" className="block text-xs font-semibold text-slate-300">
                Rejection Reason (min 5 characters) <span className="text-rose-400">*</span>
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                required
                placeholder="e.g. Invalid UPI ID returned payment failure"
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  setActionError(null);
                }}
                data-testid="reject-reason-input"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-rose-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 block text-right">
                {rejectReason.trim().length} / 5 chars minimum
              </span>
            </div>

            {actionError && (
              <div
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-start gap-2"
                data-testid="withdrawal-reject-error"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDialogMode(null);
                  setActiveWithdrawal(null);
                  setActionError(null);
                  setRejectReason('');
                }}
                disabled={rejectMutation.isPending}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejectMutation.isPending || rejectReason.trim().length < 5}
                data-testid="confirm-reject-btn"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-rose-500 py-2.5 text-xs font-bold text-white hover:bg-rose-400 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {rejectMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Confirm Rejection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Modal */}
      {dialogMode === 'verify' && activeWithdrawal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          data-testid="verify-withdrawal-modal"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-cyan-400">
              <CheckCircle2 className="h-6 w-6" />
              <h3 className="text-base font-bold text-slate-100">Verify Withdrawal Request</h3>
            </div>

            <p className="text-xs text-slate-300">
              Confirm that you have reviewed the player's withdrawal request and verified the destination UPI ID. This will move the withdrawal to administrator final payout approval.
            </p>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Withdrawal ID:</span>
                <span className="font-mono font-bold text-slate-200">#{activeWithdrawal.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="font-bold text-cyan-400" data-testid="verify-dialog-amount">
                  {formatIndianRupees(activeWithdrawal.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Player UPI:</span>
                <span className="font-mono text-slate-200 select-all" data-testid="verify-dialog-upi">
                  {activeWithdrawal.upiId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">User:</span>
                <span className="text-slate-300 truncate max-w-[200px]">{activeWithdrawal.userEmail}</span>
              </div>
            </div>

            {actionError && (
              <div
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-start gap-2"
                data-testid="withdrawal-action-error"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDialogMode(null);
                  setActiveWithdrawal(null);
                  setActionError(null);
                }}
                disabled={verifyMutation.isPending}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVerify}
                disabled={verifyMutation.isPending}
                data-testid="confirm-verify-btn"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {verifyMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Confirm Verification</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {selectedProfileUserId && (
        <UserProfileModal
          isOpen={true}
          userId={selectedProfileUserId}
          initialUserName={selectedProfileUser?.name}
          initialUserEmail={selectedProfileUser?.email}
          onClose={() => {
            setSelectedProfileUserId(null);
            setSelectedProfileUser(null);
          }}
        />
      )}
    </div>
  );
};
