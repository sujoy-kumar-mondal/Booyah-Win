/**
 * Staff Portal - Transactions List Page
 *
 * Displays platform-wide transactions in a responsive table.
 * Includes search bar, wallet filter dropdown, transaction type filter dropdown,
 * and direct links to dedicated transaction detail pages.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStaffTransactions } from '../api/staff.js';
import type { StaffTransactionListItemDto } from '../api/types.js';
import {
  formatSignedRupees,
  formatIndianRupees,
  formatISTDate,
  formatTransactionId,
  formatUserId,
  formatLedgerRefId,
  copyToClipboard,
} from '../utils/formatters.js';
import { UserProfileModal } from '../components/common/UserProfileModal.js';
import {
  ArrowLeftRight,
  Search,
  RefreshCw,
  Copy,
  Check,
  Eye,
  ArrowDownLeft,
  ArrowUpRight,
  Trophy,
  Swords,
  RotateCcw,
  Sliders,
  Users,
  Gift,
  Coins,
  ChevronDown,
  Loader2,
  X,
} from 'lucide-react';

const WALLET_OPTIONS = [
  { label: 'All Wallets', value: 'all' },
  { label: 'Deposited', value: 'add_money' },
  { label: 'Winning', value: 'winning' },
  { label: 'Cashback', value: 'cashback' },
];

const TYPE_OPTIONS = [
  { label: 'All Types', value: 'all' },
  { label: 'Deposits', value: 'add_money' },
  { label: 'Match Entry Fees', value: 'join_fee' },
  { label: 'Match Winnings', value: 'winning' },
  { label: 'Fee Refunds', value: 'refund' },
  { label: 'Withdrawals', value: 'withdrawal' },
  { label: 'Referral Rewards', value: 'referral' },
  { label: 'Joining Rewards', value: 'joining_reward' },
  { label: 'Balance Adjustments', value: 'admin_adjustment' },
];

export const Transactions: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const urlQ = searchParams.get('q') || searchParams.get('search') || searchParams.get('user') || '';
  const [searchQuery, setSearchQuery] = useState(urlQ);

  useEffect(() => {
    const qFromUrl = searchParams.get('q') || searchParams.get('search') || searchParams.get('user') || '';
    if (qFromUrl) {
      setSearchQuery(qFromUrl);
    }
  }, [searchParams]);

  const [selectedWallet, setSelectedWallet] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState<{ id: string; name?: string; email?: string } | null>(null);

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allTransactions, setAllTransactions] = useState<StaffTransactionListItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // When filters or search change, reset pagination back to first page
  useEffect(() => {
    setCursor(undefined);
    setAllTransactions([]);
    setNextCursor(null);
  }, [searchQuery, selectedWallet, selectedType, fromDate, toDate]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['staff-transactions', searchQuery, selectedWallet, selectedType, fromDate, toDate, cursor],
    queryFn: () =>
      getStaffTransactions({
        q: searchQuery.trim() || undefined,
        wallet: selectedWallet !== 'all' ? selectedWallet : undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        limit: 50,
        cursor,
      }),
  });

  // Sync incoming query data into allTransactions and update nextCursor
  useEffect(() => {
    if (!data) return;
    if (!cursor) {
      setAllTransactions(data.items);
    } else {
      setAllTransactions((prev) => {
        const existingIds = new Set(prev.map((t) => t.transactionId));
        const uniqueItems = data.items.filter((t) => !existingIds.has(t.transactionId));
        return [...prev, ...uniqueItems];
      });
    }
    setNextCursor(data.nextCursor ?? null);
  }, [data, cursor]);

  const transactions = allTransactions.length > 0 ? allTransactions : (data?.items || []);

  const handleRefresh = () => {
    setCursor(undefined);
    setAllTransactions([]);
    refetch();
  };

  const handleLoadMore = () => {
    if (nextCursor && !isFetching) {
      setCursor(nextCursor);
    }
  };

  const handleCopy = async (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'add_money':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
            Deposit
          </span>
        );
      case 'join_fee':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Swords className="w-3 h-3 text-blue-400" />
            Join Fee
          </span>
        );
      case 'winning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Trophy className="w-3 h-3 text-yellow-400" />
            Winning
          </span>
        );
      case 'refund':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <RotateCcw className="w-3 h-3 text-cyan-400" />
            Refund
          </span>
        );
      case 'withdrawal_hold':
      case 'withdrawal':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <ArrowUpRight className="w-3 h-3 text-orange-400" />
            Withdrawal
          </span>
        );
      case 'withdrawal_refund':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <RotateCcw className="w-3 h-3 text-amber-400" />
            Withdrawal Refund
          </span>
        );
      case 'referral':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Users className="w-3 h-3 text-purple-400" />
            Referral
          </span>
        );
      case 'joining_reward':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Gift className="w-3 h-3 text-emerald-400" />
            Joining Reward
          </span>
        );
      case 'admin_adjustment':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Sliders className="w-3 h-3 text-indigo-400" />
            Adjustment
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/40 text-slate-300 border border-slate-600/30">
            {type.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  const getWalletBadge = (wallet: string) => {
    switch (wallet) {
      case 'winning':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-950/40 text-amber-300 border border-amber-800/40">
            Winning
          </span>
        );
      case 'cashback':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-950/40 text-purple-300 border border-purple-800/40">
            Cashback
          </span>
        );
      case 'all':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-950/40 text-cyan-300 border border-cyan-800/40">
            All Wallets
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
            Deposited
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Transactions</h1>
              <p className="text-sm text-slate-400">
                Platform-wide wallet ledger and financial transactions
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors text-sm font-medium self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4 space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="xl:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Transaction ID, User ID, name, email, UTR, ref..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>

          {/* Date Filter: From Date to To Date */}
          <div className="xl:col-span-3 flex items-center gap-1.5">
            <div className="flex-1 flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs">
              <span className="text-slate-400 text-[11px] font-semibold whitespace-nowrap">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                data-testid="filter-from-date"
                className="w-full bg-transparent text-slate-200 text-xs focus:outline-none [color-scheme:dark]"
                title="From Date"
              />
            </div>
            <div className="flex-1 flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs">
              <span className="text-slate-400 text-[11px] font-semibold whitespace-nowrap">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                data-testid="filter-to-date"
                className="w-full bg-transparent text-slate-200 text-xs focus:outline-none [color-scheme:dark]"
                title="To Date"
              />
            </div>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                title="Clear date filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Wallet Dropdown */}
          <div className="xl:col-span-2 relative">
            <select
              value={selectedWallet}
              onChange={(e) => setSelectedWallet(e.target.value)}
              className="w-full appearance-none pl-3.5 pr-8 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 cursor-pointer"
            >
              {WALLET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Type Dropdown */}
          <div className="xl:col-span-2 relative">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full appearance-none pl-3.5 pr-8 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 cursor-pointer"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Transaction ID</th>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Wallet</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5 text-right">Total After</th>
                <th className="px-5 py-3.5">Date (IST)</th>
                <th className="px-5 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading && transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-400" />
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-slate-400">
                    <Coins className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                    <p className="text-base font-semibold text-slate-300">No transactions found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Try adjusting your search query or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => {
                  const isPositive = txn.amount.startsWith('+');
                  const isNegative = txn.amount.startsWith('-');

                  return (
                    <tr
                      key={txn.transactionId}
                      onClick={() => navigate(`/transactions/${txn.transactionId}`)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Transaction ID */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-white group-hover:text-emerald-400 transition-colors">
                            {formatTransactionId(txn.transactionId)}
                          </span>
                          <button
                            onClick={(e) => handleCopy(e, formatTransactionId(txn.transactionId))}
                            title="Copy Transaction ID"
                            className="p-1 text-slate-500 hover:text-white rounded transition-colors"
                          >
                            {copiedId === formatTransactionId(txn.transactionId) ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {Boolean(formatLedgerRefId(txn.refId, txn.type, txn.refType)) && (
                          <div className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-[160px]">
                            ref: {formatLedgerRefId(txn.refId, txn.type, txn.refType)}
                          </div>
                        )}
                      </td>

                      {/* User */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-start gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProfileUser({ id: txn.userId, name: txn.userName, email: txn.userEmail });
                            }}
                            className="text-left group/user hover:underline focus:outline-none"
                          >
                            <div className="font-medium text-slate-200 group-hover/user:text-emerald-400 transition-colors">
                              {txn.userName}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-emerald-400/90 font-medium">
                                {formatUserId(txn.userId)}
                              </span>
                              {txn.userUsername && (
                                <span className="text-slate-500">@{txn.userUsername}</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 truncate max-w-[180px]">
                              {txn.userEmail}
                            </div>
                          </button>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {getTypeBadge(txn.type)}
                      </td>

                      {/* Wallet */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {getWalletBadge(txn.wallet)}
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <span
                          className={`font-semibold font-mono ${
                            isPositive
                              ? 'text-emerald-400'
                              : isNegative
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {formatSignedRupees(txn.amount)}
                        </span>
                      </td>

                      {/* Total After */}
                      <td className="px-5 py-4 whitespace-nowrap text-right font-mono text-slate-300">
                        {formatIndianRupees(txn.totalAfter)}
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-400">
                        {formatISTDate(txn.createdAt)}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/transactions/${txn.transactionId}`);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors border border-slate-700 hover:border-emerald-500"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* View More Transactions Button */}
        {nextCursor && (
          <div className="p-4 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isFetching}
              data-testid="view-more-transactions-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50 border border-slate-700 hover:border-slate-600 shadow-sm"
            >
              {isFetching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Loading more...</span>
                </>
              ) : (
                <span>View More Transactions</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* User Profile Modal */}
      {selectedProfileUser && (
        <UserProfileModal
          isOpen={true}
          userId={selectedProfileUser.id}
          initialUserName={selectedProfileUser.name}
          initialUserEmail={selectedProfileUser.email}
          onClose={() => setSelectedProfileUser(null)}
        />
      )}
    </div>
  );
};
