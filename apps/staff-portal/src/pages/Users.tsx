/**
 * User Management & Directory Page
 * Section 15 & Section 16.3
 *
 * Requirements:
 * - Admin role: User management with balance adjustments, soft delete, full profile.
 * - Employee role: Read-only user directory with 5-tab detail drawer:
 *   1. Profile: strictly masked (mobile ******7890, upi ****1234@upi), no DOB/PAN/Aadhaar/referral code.
 *   2. Wallets: string-formatted Indian rupees for addMoney, cashback, winning, total.
 *   3. Transactions: recent ledger trace.
 *   4. Matches: recent match participation.
 *   5. Requests: pending deposit & withdrawal requests with 2-step approval statuses.
 *   Daily view cap of 300 enforced server-side. Delete/adjust buttons hidden.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getAdminUsers,
  getAdminUserDetail,
  deleteAdminUser,
  adjustUserBalance,
  type AdminUserListItem,
  type AdminUserProfileDto,
  type AdminUserLedgerItemDto,
  type AdminUserMatchHistoryItemDto,
} from '../api/admin.js';
import {
  getStaffUsers,
  getStaffUserDetail,
  type StaffUserListItem,
  type StaffUserProfileDto,
  type StaffUserLedgerItemDto,
  type StaffUserMatchItemDto,
  type StaffUserDepositItemDto,
  type StaffUserWithdrawalItemDto,
} from '../api/staffUsers.js';
import { useStaffAuth } from '../context/StaffAuthContext.js';
import { formatIndianRupees, formatISTDate } from '../utils/formatters.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import {
  UserCheck,
  Search,
  RefreshCw,
  Trash2,
  SlidersHorizontal,
  AlertCircle,
  X,
  Wallet,
  History,
  Swords,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  User,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';

type UserListItemType = AdminUserListItem | StaffUserListItem;

type UserDetailType = {
  profile: (AdminUserProfileDto | StaffUserProfileDto) & {
    dateOfBirth?: string;
    referralCode?: string;
    referredBy?: string | null;
    deletedReason?: string | null;
  };
  wallets: { addMoney: string; cashback: string; winning: string; total: string };
  recentLedger: (AdminUserLedgerItemDto | StaffUserLedgerItemDto)[];
  matchHistory?: (AdminUserMatchHistoryItemDto | StaffUserMatchItemDto)[];
  recentMatches?: StaffUserMatchItemDto[];
  depositHistory?: StaffUserDepositItemDto[];
  withdrawalHistory?: StaffUserWithdrawalItemDto[];
  pendingRequests?: {
    deposits: StaffUserDepositItemDto[];
    withdrawals: StaffUserWithdrawalItemDto[];
  };
};

export const Users: React.FC = () => {
  const { staff } = useStaffAuth();
  const isEmployee = staff?.role === 'employee';
  const isAdmin = !isEmployee;

  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  // Search & List state
  const [users, setUsers] = useState<UserListItemType[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Constraint 8: Race condition guard for search requests
  const latestSearchReqIdRef = useRef<number>(0);

  // User detail state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetailType | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // 5-Tab state for employee drawer
  const [employeeTab, setEmployeeTab] = useState<
    'profile' | 'wallets' | 'transactions' | 'matches' | 'requests'
  >('profile');

  // Delete modal state (Admin only)
  const [deleteTargetUser, setDeleteTargetUser] = useState<AdminUserListItem | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Balance adjustment modal state (Admin only, Constraint 5)
  const [adjustTargetUser, setAdjustTargetUser] = useState<AdminUserListItem | null>(null);
  const [adjustUserWallets, setAdjustUserWallets] = useState<{
    addMoney: string;
    cashback: string;
    winning: string;
    total: string;
  } | null>(null);
  const [adjustWallet, setAdjustWallet] = useState<'add_money' | 'cashback' | 'winning'>('add_money');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustConfirmTypedId, setAdjustConfirmTypedId] = useState('');
  const [isAdjustTimerActive, setIsAdjustTimerActive] = useState(true);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  // Fetch users
  const fetchUsers = async (query = searchQuery, cursor?: string) => {
    const reqId = ++latestSearchReqIdRef.current;
    if (!cursor) setIsLoading(true);
    else setIsLoadingMore(true);
    setListError(null);

    try {
      const data = isAdmin
        ? await getAdminUsers({
            q: query.trim() || undefined,
            cursor,
            limit: 20,
          })
        : await getStaffUsers(query.trim() || undefined, cursor, 20);

      // Constraint 8: Ignore stale search responses
      if (reqId !== latestSearchReqIdRef.current) return;

      if (cursor) {
        setUsers((prev) => [...prev, ...data.items]);
      } else {
        setUsers(data.items);
      }
      setNextCursor(data.nextCursor);
    } catch (err) {
      if (reqId === latestSearchReqIdRef.current) {
        setListError(getFriendlyErrorMessage(err, 'user'));
      }
    } finally {
      if (reqId === latestSearchReqIdRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    fetchUsers(searchQuery);
  }, [searchQuery, isAdmin]);

  // Fetch single user detail
  const loadUserDetail = async (id: string) => {
    setSelectedUserId(id);
    setIsDetailLoading(true);
    setDetailError(null);
    setEmployeeTab('profile');
    try {
      const data = isAdmin ? await getAdminUserDetail(id) : await getStaffUserDetail(id);
      setUserDetail(data as UserDetailType);
    } catch (err) {
      setDetailError(getFriendlyErrorMessage(err, 'user'));
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Open Delete Modal (Admin only)
  const handleOpenDelete = (u: AdminUserListItem) => {
    setDeleteTargetUser(u);
    setDeleteReason('');
    setDeleteError(null);
  };

  // Submit Delete (Admin only)
  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTargetUser || submitLockRef.current || isSubmitting) return;

    if (deleteReason.trim().length < 5) {
      setDeleteError('Delete reason must be at least 5 characters.');
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setDeleteError(null);

    try {
      await deleteAdminUser(deleteTargetUser.id, deleteReason.trim());
      const deletedId = deleteTargetUser.id;
      setDeleteTargetUser(null);
      setActionSuccess('User account soft deleted successfully.');
      setTimeout(() => setActionSuccess(null), 4000);

      // Constraint 9: If a user is deleted while their detail view is open, the view refreshes and shows "Deleted"
      if (selectedUserId === deletedId) {
        loadUserDetail(deletedId);
      }
      fetchUsers(searchQuery);
    } catch (err: any) {
      setDeleteError(getFriendlyErrorMessage(err, 'user'));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Open Adjust Modal (Admin only, Constraint 5)
  const handleOpenAdjust = async (u: AdminUserListItem) => {
    setAdjustTargetUser(u);
    setAdjustWallet('add_money');
    setAdjustAmount('');
    setAdjustReason('');
    setAdjustConfirmTypedId('');
    setAdjustError(null);

    // Fetch user current balances
    try {
      const detail = await getAdminUserDetail(u.id);
      setAdjustUserWallets(detail.wallets);
    } catch {
      setAdjustUserWallets(null);
    }

    // Constraint 5: Keep the confirm button disabled for 2 seconds after the dialog opens
    setIsAdjustTimerActive(true);
    setTimeout(() => {
      setIsAdjustTimerActive(false);
    }, 2000);
  };

  // Submit Adjust (Admin only)
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetUser || submitLockRef.current || isSubmitting) return;

    // Validate signed amount string with at most 2 decimals
    const amountRegex = /^-?\d+(\.\d{1,2})?$/;
    if (!amountRegex.test(adjustAmount.trim())) {
      setAdjustError('Amount must be a valid signed decimal string with at most 2 decimal places (e.g. 50.00 or -25.50).');
      return;
    }

    if (adjustReason.trim().length < 5) {
      setAdjustError('Reason must be at least 5 characters.');
      return;
    }

    // Verify confirmation typed user ID
    if (adjustConfirmTypedId.trim() !== adjustTargetUser.id) {
      setAdjustError(`Please type user ID "${adjustTargetUser.id}" to confirm.`);
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setAdjustError(null);

    try {
      const raw = adjustAmount.trim();
      const [whole, frac = ''] = raw.split('.');
      const normalizedAmount = `${whole}.${frac.padEnd(2, '0')}`;

      const res = await adjustUserBalance(adjustTargetUser.id, {
        wallet: adjustWallet,
        amount: normalizedAmount,
        reason: adjustReason.trim(),
      });

      const updatedUserId = adjustTargetUser.id;
      setAdjustTargetUser(null);
      setActionSuccess(`Balance adjusted for User #${updatedUserId}. New total balance: ${formatIndianRupees(res.balances.total)}`);
      setTimeout(() => setActionSuccess(null), 5000);

      // Refresh detail view if open
      if (selectedUserId === updatedUserId) {
        loadUserDetail(updatedUserId);
      }
    } catch (err: any) {
      setAdjustError(getFriendlyErrorMessage(err, 'user'));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="users-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <UserCheck className="h-6 w-6 text-emerald-400" />
            {isAdmin ? 'User Management' : 'User Directory'}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {isAdmin
              ? 'Search registered users, inspect wallets, view match & ledger traces, and adjust balances.'
              : 'Search registered players, view profile info, wallets, ledger transactions, match history, and requests.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchUsers(searchQuery)}
          disabled={isLoading}
          data-testid="refresh-users-btn"
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          Refresh
        </button>
      </div>

      {actionSuccess && (
        <div
          data-testid="user-action-success-banner"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2.5"
        >
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {listError && (
        <div
          data-testid="user-list-error-banner"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-center gap-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{listError}</span>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex items-center gap-3">
        <Search className="h-4 w-4 text-slate-500 shrink-0 ml-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, mobile, or Free Fire ID..."
          data-testid="user-search-input"
          className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-slate-500 hover:text-slate-300 text-xs px-2"
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Users Table */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" data-testid="users-table">
                <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Player Info</th>
                    <th className="px-4 py-3">Mobile</th>
                    <th className="px-4 py-3">Free Fire ID</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500" data-testid="users-loading-state">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-400" />
                        Loading users...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500" data-testid="users-empty-state">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr
                        key={u.id}
                        className={`hover:bg-slate-800/30 transition-colors cursor-pointer ${
                          selectedUserId === u.id ? 'bg-slate-800/50 border-l-2 border-emerald-400' : ''
                        }`}
                        onClick={() => loadUserDetail(u.id)}
                        data-testid={`user-row-${u.id}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-200">{u.name}</div>
                          <div className="text-[11px] text-slate-500">{u.email}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-300 font-mono">{u.mobile}</td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-slate-200">{u.ffId}</div>
                          <div className="text-[10px] text-slate-500">{u.ffName}</div>
                        </td>
                        <td className="px-4 py-3">
                          {u.isDeleted ? (
                            <span
                              data-testid={`user-deleted-badge-${u.id}`}
                              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            >
                              Deleted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {isAdmin ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenAdjust(u as AdminUserListItem)}
                                data-testid={`adjust-balance-btn-${u.id}`}
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                                title="Adjust Balance"
                              >
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                              </button>
                              {!u.isDeleted && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDelete(u as AdminUserListItem)}
                                  data-testid={`delete-user-btn-${u.id}`}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                  title="Delete User"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => loadUserDetail(u.id)}
                              className="text-[11px] text-slate-400 hover:text-emerald-400 font-medium px-2 py-1 rounded transition-colors"
                            >
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {nextCursor && (
              <div className="p-3 border-t border-slate-800 text-center">
                <button
                  type="button"
                  onClick={() => fetchUsers(searchQuery, nextCursor)}
                  disabled={isLoadingMore}
                  data-testid="load-more-users-btn"
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isLoadingMore ? 'Loading more...' : 'Load More Users'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* User Detail Panel (Constraint 9: Updates and shows Deleted if user is soft deleted) */}
        <div className="lg:col-span-5" data-testid="user-detail-panel">
          {isDetailLoading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center text-xs text-slate-500">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
              Loading player details...
            </div>
          ) : detailError ? (
            <div
              className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-xs text-rose-400"
              data-testid="user-detail-error"
            >
              {detailError}
            </div>
          ) : !userDetail ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-xs text-slate-500">
              Select a player from the list to view profile, wallet breakdown, recent ledger, and match history.
            </div>
          ) : isAdmin ? (
            /* ─── Admin Detail Layout (Full Profile & Actions) ─── */
            <div className="space-y-4">
              {/* Profile Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-100">{userDetail.profile.name}</h2>
                      {userDetail.profile.isDeleted && (
                        <span
                          data-testid="detail-deleted-badge"
                          className="rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        >
                          Deleted
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {userDetail.profile.email} • {userDetail.profile.mobile}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const u = users.find((x) => x.id === userDetail.profile.id) || {
                        id: userDetail.profile.id,
                        name: userDetail.profile.name,
                        email: userDetail.profile.email,
                        mobile: userDetail.profile.mobile,
                        ffId: userDetail.profile.ffId,
                        ffName: userDetail.profile.ffName,
                        upiId: userDetail.profile.upiId,
                        isDeleted: userDetail.profile.isDeleted,
                        deletedAt: userDetail.profile.deletedAt,
                        createdAt: userDetail.profile.createdAt,
                      };
                      handleOpenAdjust(u as AdminUserListItem);
                    }}
                    data-testid="detail-adjust-balance-btn"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
                    Adjust
                  </button>
                </div>

                {userDetail.profile.isDeleted && (
                  <div
                    data-testid="detail-deleted-info-box"
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 space-y-1"
                  >
                    <div className="font-semibold flex items-center gap-1.5 text-rose-200">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Account Terminated
                    </div>
                    <div className="text-[11px] text-rose-400">
                      Reason: {userDetail.profile.deletedReason || 'Unspecified'}
                    </div>
                    <div className="text-[10px] text-rose-400/80">
                      Deleted on: {formatISTDate(userDetail.profile.deletedAt)}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800 pt-3">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-semibold block">Free Fire ID / IGN</span>
                    <span className="font-mono text-slate-200">{userDetail.profile.ffId}</span> ({userDetail.profile.ffName})
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-semibold block">UPI ID</span>
                    <span className="font-mono text-slate-200">{userDetail.profile.upiId || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-semibold block">Date of Birth</span>
                    <span className="text-slate-300">{userDetail.profile.dateOfBirth || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-semibold block">Referral Code</span>
                    <span className="font-mono text-slate-300">{userDetail.profile.referralCode || '—'}</span>
                  </div>
                </div>
              </div>

              {/* 3 Wallets Summary (Always string formatted, never Number) */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                    Wallet Balances
                  </span>
                  <span className="text-sm font-bold text-emerald-400" data-testid="user-wallet-total">
                    Total: {formatIndianRupees(userDetail.wallets.total)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Add Money</span>
                    <span className="text-xs font-bold text-slate-200" data-testid="user-wallet-addMoney">
                      {formatIndianRupees(userDetail.wallets.addMoney)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Cashback</span>
                    <span className="text-xs font-bold text-slate-200" data-testid="user-wallet-cashback">
                      {formatIndianRupees(userDetail.wallets.cashback)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Winning</span>
                    <span className="text-xs font-bold text-emerald-400" data-testid="user-wallet-winning">
                      {formatIndianRupees(userDetail.wallets.winning)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Ledger */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-slate-400" />
                  Recent Ledger Activity
                </span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
                  {userDetail.recentLedger.length === 0 ? (
                    <p className="text-center py-4 text-[11px] text-slate-500">No ledger transactions recorded.</p>
                  ) : (
                    userDetail.recentLedger.map((row) => (
                      <div key={row.id} className="pt-1.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-slate-200 capitalize">{row.type.replace('_', ' ')}</div>
                          <div className="text-[10px] text-slate-500">
                            {formatISTDate(row.createdAt)} • {row.wallet}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`font-mono font-bold ${
                              row.amount.startsWith('-') ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {row.amount.startsWith('-') ? '' : '+'}
                            {formatIndianRupees(row.amount)}
                          </div>
                          <div className="text-[10px] text-slate-500">Bal: {formatIndianRupees(row.balanceAfter)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Match History */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Swords className="h-3.5 w-3.5 text-slate-400" />
                  Match Participation History
                </span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
                  {(!userDetail.matchHistory || userDetail.matchHistory.length === 0) ? (
                    <p className="text-center py-4 text-[11px] text-slate-500">No match participation recorded.</p>
                  ) : (
                    userDetail.matchHistory.map((m) => (
                      <div key={m.matchId} className="pt-1.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-mono font-bold text-slate-200">BW-MAT-{m.matchId}</div>
                          <div className="text-[10px] text-slate-500 capitalize">
                            {m.gameMode.replace('_', ' ')} • {m.teamMode}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-semibold text-slate-300">
                            {m.displayStatus} ({m.kills} kills)
                          </div>
                          <div className="text-[10px] text-emerald-400">Payout: {formatIndianRupees(m.payout)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ─── Employee 5-Tab Read-Only Drawer Layout (Section 15) ─── */
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
              {/* Header */}
              <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-100">{userDetail.profile.name}</h2>
                    {userDetail.profile.isDeleted ? (
                      <span
                        data-testid="detail-deleted-badge"
                        className="rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      >
                        Deleted
                      </span>
                    ) : (
                      <span className="rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {userDetail.profile.email} • <span className="font-mono">{userDetail.profile.mobile}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Balance</span>
                  <span className="text-sm font-bold text-emerald-400" data-testid="user-wallet-total">
                    {formatIndianRupees(userDetail.wallets.total)}
                  </span>
                </div>
              </div>

              {/* 5-Tab Navigation Bar */}
              <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs font-semibold px-2">
                <button
                  type="button"
                  onClick={() => setEmployeeTab('profile')}
                  data-testid="tab-profile"
                  className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-colors ${
                    employeeTab === 'profile'
                      ? 'border-emerald-400 text-emerald-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => setEmployeeTab('wallets')}
                  data-testid="tab-wallets"
                  className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-colors ${
                    employeeTab === 'wallets'
                      ? 'border-emerald-400 text-emerald-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Wallets
                </button>
                <button
                  type="button"
                  onClick={() => setEmployeeTab('transactions')}
                  data-testid="tab-transactions"
                  className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-colors ${
                    employeeTab === 'transactions'
                      ? 'border-emerald-400 text-emerald-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  Transactions
                </button>
                <button
                  type="button"
                  onClick={() => setEmployeeTab('matches')}
                  data-testid="tab-matches"
                  className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-colors ${
                    employeeTab === 'matches'
                      ? 'border-emerald-400 text-emerald-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Swords className="h-3.5 w-3.5" />
                  Matches
                </button>
                <button
                  type="button"
                  onClick={() => setEmployeeTab('requests')}
                  data-testid="tab-requests"
                  className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-colors ${
                    employeeTab === 'requests'
                      ? 'border-emerald-400 text-emerald-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Requests
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-4" data-testid="employee-tab-content">
                {/* 1. Profile Tab (Strict Allowlist: Name, Email, Masked Mobile, FF ID, FF Name, Masked UPI, CreatedAt, Status; NO DOB, NO PAN, NO Aadhaar, NO Referral) */}
                {employeeTab === 'profile' && (
                  <div className="space-y-4" data-testid="employee-profile-tab">
                    {userDetail.profile.isDeleted && (
                      <div
                        data-testid="detail-deleted-info-box"
                        className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 space-y-1"
                      >
                        <div className="font-semibold flex items-center gap-1.5 text-rose-200">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Account Terminated
                        </div>
                        <div className="text-[10px] text-rose-400/80">
                          Deleted on: {formatISTDate(userDetail.profile.deletedAt)}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <span className="text-slate-500 text-[10px] uppercase font-semibold block">Full Name</span>
                        <span className="text-slate-200 font-medium">{userDetail.profile.name}</span>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <span className="text-slate-500 text-[10px] uppercase font-semibold block">Email</span>
                        <span className="text-slate-200 font-medium">{userDetail.profile.email}</span>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <span className="text-slate-500 text-[10px] uppercase font-semibold block">Masked Mobile</span>
                        <span className="font-mono text-slate-200">{userDetail.profile.mobile}</span>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <span className="text-slate-500 text-[10px] uppercase font-semibold block">Masked UPI ID</span>
                        <span className="font-mono text-slate-200">{userDetail.profile.upiId || '—'}</span>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <span className="text-slate-500 text-[10px] uppercase font-semibold block">Free Fire ID / IGN</span>
                        <span className="font-mono text-slate-200">{userDetail.profile.ffId}</span>{' '}
                        <span className="text-slate-400">({userDetail.profile.ffName})</span>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <span className="text-slate-500 text-[10px] uppercase font-semibold block">Registration Date</span>
                        <span className="text-slate-300">{formatISTDate(userDetail.profile.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Wallets Tab */}
                {employeeTab === 'wallets' && (
                  <div className="space-y-4" data-testid="employee-wallets-tab">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">Add Money</span>
                        <span className="text-sm font-bold text-slate-200" data-testid="user-wallet-addMoney">
                          {formatIndianRupees(userDetail.wallets.addMoney)}
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">Cashback</span>
                        <span className="text-sm font-bold text-slate-200" data-testid="user-wallet-cashback">
                          {formatIndianRupees(userDetail.wallets.cashback)}
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">Winning</span>
                        <span className="text-sm font-bold text-emerald-400" data-testid="user-wallet-winning">
                          {formatIndianRupees(userDetail.wallets.winning)}
                        </span>
                      </div>
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                        <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Total Balance</span>
                        <span className="text-sm font-bold text-emerald-400">
                          {formatIndianRupees(userDetail.wallets.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Transactions Tab */}
                {employeeTab === 'transactions' && (
                  <div className="space-y-3" data-testid="employee-transactions-tab">
                    <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/40">
                      {userDetail.recentLedger.length === 0 ? (
                        <p className="text-center py-6 text-[11px] text-slate-500">No ledger transactions recorded.</p>
                      ) : (
                        userDetail.recentLedger.map((row) => (
                          <div key={row.id} className="pt-2 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-semibold text-slate-200 capitalize">{row.type.replace('_', ' ')}</div>
                              <div className="text-[10px] text-slate-500">
                                {formatISTDate(row.createdAt)} • {row.wallet}
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={`font-mono font-bold ${
                                  row.amount.startsWith('-') ? 'text-rose-400' : 'text-emerald-400'
                                }`}
                              >
                                {row.amount.startsWith('-') ? '' : '+'}
                                {formatIndianRupees(row.amount)}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Bal: {formatIndianRupees(row.balanceAfter)}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Matches Tab */}
                {employeeTab === 'matches' && (() => {
                  const matches = userDetail.recentMatches || userDetail.matchHistory || [];
                  return (
                    <div className="space-y-3" data-testid="employee-matches-tab">
                      <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/40">
                        {matches.length === 0 ? (
                          <p className="text-center py-6 text-[11px] text-slate-500">No match participation recorded.</p>
                        ) : (
                          matches.map((m) => (
                            <div key={m.matchId} className="pt-2 flex items-center justify-between text-xs">
                              <div>
                                <div className="font-mono font-bold text-slate-200">BW-MAT-{m.matchId}</div>
                                <div className="text-[10px] text-slate-500 capitalize">
                                  {m.gameMode.replace('_', ' ')} • {m.teamMode}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {formatISTDate(m.startTime || (m as any).joinedAt)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[11px] font-semibold text-slate-300">
                                  {m.displayStatus} ({m.kills} kills)
                                </div>
                                <div className="text-[10px] text-emerald-400">
                                  Payout: {formatIndianRupees(m.payout)}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 5. Requests Tab (Two-step approval statuses) */}
                {employeeTab === 'requests' && (() => {
                  const deposits = userDetail.pendingRequests?.deposits || userDetail.depositHistory || [];
                  const withdrawals = userDetail.pendingRequests?.withdrawals || userDetail.withdrawalHistory || [];
                  return (
                    <div className="space-y-4" data-testid="employee-requests-tab">
                      {/* Deposits */}
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
                          <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                          Pending Deposits
                        </span>
                        <div className="space-y-1.5">
                          {deposits.length === 0 ? (
                            <p className="text-center py-2 text-[11px] text-slate-500">No pending deposits.</p>
                          ) : (
                            deposits.map((d: any) => (
                              <div
                                key={d.id}
                                className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-mono font-bold text-slate-200">DEP-{d.id}</span>
                                  <div className="text-[10px] text-slate-500">{formatISTDate(d.createdAt)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-emerald-400">{formatIndianRupees(d.amount)}</div>
                                  <span
                                    className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                      d.status === 'employee_approved'
                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                        : d.status === 'approved'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : d.status === 'rejected'
                                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    }`}
                                  >
                                    {d.status.replace('_', ' ')}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Withdrawals */}
                      <div className="border-t border-slate-800 pt-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
                          <ArrowUpRight className="h-3.5 w-3.5 text-amber-400" />
                          Pending Withdrawals
                        </span>
                        <div className="space-y-1.5">
                          {withdrawals.length === 0 ? (
                            <p className="text-center py-2 text-[11px] text-slate-500">No pending withdrawals.</p>
                          ) : (
                            withdrawals.map((w: any) => (
                              <div
                                key={w.id}
                                className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-mono font-bold text-slate-200">WDR-{w.id}</span>
                                  <div className="text-[10px] text-slate-500">{formatISTDate(w.createdAt)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-slate-200">{formatIndianRupees(w.amount)}</div>
                                  <span
                                    className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                      w.status === 'employee_approved'
                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                        : w.status === 'approved'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : w.status === 'rejected'
                                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    }`}
                                  >
                                    {w.status.replace('_', ' ')}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Delete User Modal (Admin only) ─── */}
      {isAdmin && deleteTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" data-testid="delete-user-modal">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Soft Delete User</h3>
                <p className="text-[11px] text-slate-400">Terminate player account</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to delete user <span className="font-bold text-slate-100">{deleteTargetUser.name}</span> (ID: {deleteTargetUser.id})?
              Their active session will be terminated and pending team invites will be expired.
            </p>

            {deleteError && (
              <div
                data-testid="delete-user-error"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-400"
              >
                {deleteError}
              </div>
            )}

            <form onSubmit={handleDeleteSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Reason for Deletion (Min 5 chars) <span className="text-emerald-400">*</span>
                </label>
                <textarea
                  required
                  autoComplete="off"
                  rows={2}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g. Terms of service violation: cheating reported"
                  data-testid="delete-user-reason-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetUser(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || deleteReason.trim().length < 5}
                  data-testid="confirm-delete-user-btn"
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Balance Adjustment Modal (Admin only, Constraint 5) ─── */}
      {isAdmin && adjustTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" data-testid="adjust-balance-modal">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
                Adjust Balance: {adjustTargetUser.name} (ID: {adjustTargetUser.id})
              </h2>
              <button
                type="button"
                onClick={() => setAdjustTargetUser(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Constraint 5: Show the user's current wallet balances */}
            {adjustUserWallets && (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1.5" data-testid="adjust-user-current-wallets">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Current Balances
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Add Money</span>
                    <span className="font-bold text-slate-200">{formatIndianRupees(adjustUserWallets.addMoney)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Cashback</span>
                    <span className="font-bold text-slate-200">{formatIndianRupees(adjustUserWallets.cashback)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Winning</span>
                    <span className="font-bold text-emerald-400">{formatIndianRupees(adjustUserWallets.winning)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Constraint 5: Permanent audit log disclaimer */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">Immutable Audit Trace</p>
                <p className="text-[11px] text-amber-300/90 mt-0.5">
                  This adjustment is permanently recorded in the immutable audit log with your staff ID, timestamp, and explanation.
                </p>
              </div>
            </div>

            {adjustError && (
              <div
                data-testid="adjust-balance-error"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-400 flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{adjustError}</span>
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Target Wallet</label>
                <select
                  value={adjustWallet}
                  onChange={(e) => setAdjustWallet(e.target.value as any)}
                  data-testid="adjust-wallet-select"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="add_money">Add Money Wallet</option>
                  <option value="cashback">Cashback Wallet</option>
                  <option value="winning">Winning Wallet</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Signed Adjustment Amount (e.g. 50.00 or -25.50)
                </label>
                <input
                  type="text"
                  required
                  pattern="^-?\d+(\.\d{1,2})?$"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="e.g. 50.00 or -25.50"
                  data-testid="adjust-amount-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Reason (Min 5 chars) <span className="text-emerald-400">*</span>
                </label>
                <textarea
                  required
                  autoComplete="off"
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Tournament reward dispute compensation"
                  data-testid="adjust-reason-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Constraint 5: Require typing user ID to enable confirm */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Type User ID <span className="font-mono text-emerald-400 font-bold">{adjustTargetUser.id}</span> to Confirm <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={adjustConfirmTypedId}
                  onChange={(e) => setAdjustConfirmTypedId(e.target.value)}
                  placeholder={`Type "${adjustTargetUser.id}"`}
                  data-testid="adjust-confirm-id-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[10px] text-slate-500">
                  {isAdjustTimerActive ? 'Safety delay: 2s lock active...' : 'Safety lock released'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustTargetUser(null)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      isAdjustTimerActive ||
                      adjustConfirmTypedId.trim() !== adjustTargetUser.id ||
                      adjustReason.trim().length < 5 ||
                      !adjustAmount.trim()
                    }
                    data-testid="submit-adjust-balance-btn"
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Adjusting...' : 'Confirm Adjustment'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
