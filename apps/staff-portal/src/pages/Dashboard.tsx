/**
 * Staff Dashboard (Section 15)
 *
 * Requirements:
 * - Counts from GET /staff/dashboard
 * - Oldest pending deposit age in minutes (highlighted in red when strictly > 30 minutes)
 * - Oldest pending withdrawal age in minutes (highlighted in red when strictly > 1440 minutes / 24h)
 * - Exact boundary rules:
 *   Deposit: 30 is NOT red, 30.01 IS red, null is NOT red
 *   Withdrawal: 1440 is NOT red, 1440.01 IS red, null is NOT red
 * - Auto-refreshes every 30 seconds while tab is visible
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStaffDashboard } from '../api/staff.js';
import {
  formatAgeMinutes,
  isDepositOverdue,
  isWithdrawalOverdue,
} from '../utils/formatters.js';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  Trophy,
  Activity,
  ArrowRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const {
    data: metrics,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['staff-dashboard'],
    queryFn: getStaffDashboard,
    refetchInterval: 30000, // 30s auto-refresh
  });

  const depAge = metrics?.oldestPendingDepositAgeMinutes;
  const wthAge = metrics?.oldestPendingWithdrawalAgeMinutes;

  const isDepOverdue = isDepositOverdue(depAge);
  const isWthOverdue = isWithdrawalOverdue(wthAge);

  return (
    <div className="space-y-6" data-testid="staff-dashboard-container">
      {/* Title & Refresh Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-100 tracking-tight">Operations Dashboard</h1>
          <p className="text-xs text-slate-400">
            Real-time pending queues and tournament operation metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="refresh-dashboard-btn"
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <span className="text-xs font-semibold">Loading operations metrics...</span>
        </div>
      ) : (
        <>
          {/* Critical Financial Queues (Deposits & Withdrawals) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Deposits Card */}
            <div
              className={`rounded-2xl border p-5 shadow-xl transition-all ${
                isDepOverdue
                  ? 'border-rose-500/50 bg-rose-500/10 shadow-rose-500/5'
                  : 'border-slate-800 bg-slate-900/90'
              }`}
              data-testid="dashboard-deposits-card"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                      isDepOverdue
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    <ArrowDownToLine className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-200">Pending Deposits</h2>
                    <span className="text-[11px] text-slate-400">Target review time: &lt;30m</span>
                  </div>
                </div>
                {isDepOverdue && (
                  <span
                    className="flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30 animate-pulse"
                    data-testid="deposit-overdue-badge"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Overdue (&gt;30m)
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-baseline justify-between border-t border-slate-800/80 pt-4">
                <div>
                  <span className="text-3xl font-black text-slate-100" data-testid="deposit-count-value">
                    {metrics?.pendingDepositsCount ?? 0}
                  </span>
                  <span className="text-xs text-slate-400 ml-2">requests pending</span>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3" />
                    Oldest Request
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      isDepOverdue ? 'text-rose-400' : 'text-slate-200'
                    }`}
                    data-testid="deposit-oldest-age"
                  >
                    {formatAgeMinutes(depAge)}
                  </span>
                </div>
              </div>

              <Link
                to="/deposits"
                data-testid="view-deposits-queue-link"
                className="mt-4 flex items-center justify-center gap-1.5 w-full rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <span>Process Deposit Queue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Withdrawals Card */}
            <div
              className={`rounded-2xl border p-5 shadow-xl transition-all ${
                isWthOverdue
                  ? 'border-rose-500/50 bg-rose-500/10 shadow-rose-500/5'
                  : 'border-slate-800 bg-slate-900/90'
              }`}
              data-testid="dashboard-withdrawals-card"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                      isWthOverdue
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    <ArrowUpRight className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-200">Pending Withdrawals</h2>
                    <span className="text-[11px] text-slate-400">Target settlement: &lt;24h</span>
                  </div>
                </div>
                {isWthOverdue && (
                  <span
                    className="flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30 animate-pulse"
                    data-testid="withdrawal-overdue-badge"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Overdue (&gt;24h)
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-baseline justify-between border-t border-slate-800/80 pt-4">
                <div>
                  <span className="text-3xl font-black text-slate-100" data-testid="withdrawal-count-value">
                    {metrics?.pendingWithdrawalsCount ?? 0}
                  </span>
                  <span className="text-xs text-slate-400 ml-2">requests pending</span>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3" />
                    Oldest Request
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      isWthOverdue ? 'text-rose-400' : 'text-slate-200'
                    }`}
                    data-testid="withdrawal-oldest-age"
                  >
                    {formatAgeMinutes(wthAge)}
                  </span>
                </div>
              </div>

              <Link
                to="/withdrawals"
                data-testid="view-withdrawals-queue-link"
                className="mt-4 flex items-center justify-center gap-1.5 w-full rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <span>Process Withdrawal Queue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Tournament & Match Operations Metrics */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              Tournament Operations
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <span className="text-[11px] font-medium text-slate-400 block">Live Matches</span>
                <span className="text-xl font-bold text-emerald-400" data-testid="live-matches-count">
                  {metrics?.liveMatchesCount ?? 0}
                </span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <span className="text-[11px] font-medium text-slate-400 block">Upcoming</span>
                <span className="text-xl font-bold text-slate-100" data-testid="upcoming-matches-count">
                  {metrics?.upcomingMatchesCount ?? 0}
                </span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <span className="text-[11px] font-medium text-slate-400 block">Room Open</span>
                <span className="text-xl font-bold text-amber-400" data-testid="room-open-matches-count">
                  {metrics?.roomOpenMatchesCount ?? 0}
                </span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <span className="text-[11px] font-medium text-slate-400 block">Completed</span>
                <span className="text-xl font-bold text-slate-300" data-testid="completed-matches-count">
                  {metrics?.completedMatchesCount ?? 0}
                </span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <span className="text-[11px] font-medium text-slate-400 block flex items-center gap-1">
                  <Trophy className="h-3 w-3 text-amber-400" />
                  Results Approval
                </span>
                <span className="text-xl font-bold text-amber-400" data-testid="results-waiting-count">
                  {metrics?.resultsWaitingApprovalCount ?? 0}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
