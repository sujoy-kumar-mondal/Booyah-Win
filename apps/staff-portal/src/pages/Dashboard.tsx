/**
 * Staff Dashboard (Section 15 & UI Transformation with 100% Real Data)
 *
 * Requirements:
 * - Real live data everywhere, ZERO hardcoded/demo data.
 * - Counts and financials from GET /staff/dashboard.
 * - Real monthly financial flows for Bar Chart (deposits & withdrawals).
 * - Real 14-day activity trends dynamically generating Bézier wave curves.
 * - Real current month match schedule in calendar (highlights only days with actual matches).
 * - Real dynamically computed tournament clearance / completion rate in Donut Chart.
 * - Oldest pending deposit age in minutes (highlighted in red when strictly > 30 minutes).
 * - Oldest pending withdrawal age in minutes (highlighted in red when strictly > 1440 minutes / 24h).
 * - Exact boundary rules:
 *   Deposit: 30 is NOT red, 30.01 IS red, null is NOT red
 *   Withdrawal: 1440 is NOT red, 1440.01 IS red, null is NOT red
 * - Auto-refreshes every 30 seconds while tab is visible.
 * - Preserves all data-testids for test suite compatibility.
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStaffDashboard } from '../api/staff.js';
import {
  formatAgeMinutes,
  isDepositOverdue,
  isWithdrawalOverdue,
} from '../utils/formatters.js';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Trophy,
  Activity,
  ArrowRight,
  Loader2,
  RefreshCw,
  Share2,
  ThumbsUp,
  Star,
  Calendar as CalendarIcon,
} from 'lucide-react';

/**
 * Generates a smooth cubic Bézier SVG path from an array of 2D points.
 */
function createSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i !== points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export const Dashboard: React.FC = () => {
  const [period, setPeriod] = useState<'day' | 'month'>('day');
  const [activeBarHover, setActiveBarHover] = useState<number | null>(null);

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

  // Deposit & Withdrawal amounts based on selected period (day/month)
  const depositAmount =
    period === 'day'
      ? (metrics?.totalDepositsToday ?? 0)
      : (metrics?.totalDepositsMonth ?? 0);

  const withdrawalAmount =
    period === 'day'
      ? (metrics?.totalWithdrawalsToday ?? 0)
      : (metrics?.totalWithdrawalsMonth ?? 0);

  // Helper for Indian Rupee formatting
  const formatRupeeAmount = (amount: number | string | null | undefined): string => {
    if (amount === null || amount === undefined) return '₹ 0.00';
    const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (isNaN(num)) return '₹ 0.00';
    return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formattedDeposit = formatRupeeAmount(depositAmount);
  const formattedWithdrawal = formatRupeeAmount(withdrawalAmount);

  // Operations efficiency for Donut Chart (Real tournament completion percentage)
  const totalMatchesCount =
    (metrics?.liveMatchesCount ?? 0) +
    (metrics?.upcomingMatchesCount ?? 0) +
    (metrics?.roomOpenMatchesCount ?? 0) +
    (metrics?.completedMatchesCount ?? 0);

  const efficiencyRate =
    totalMatchesCount > 0
      ? Math.round(((metrics?.completedMatchesCount ?? 0) / totalMatchesCount) * 100)
      : 0;

  // Donut SVG circumference and dynamic dash offset
  const circleRadius = 38;
  const circleCircumference = 2 * Math.PI * circleRadius; // 238.76
  const efficiencyOffset =
    circleCircumference - (efficiencyRate / 100) * circleCircumference;

  // ─── Real Monthly Financials for Bar Chart ───
  const monthlyData = useMemo(() => {
    if (metrics?.monthlyFinancials && metrics.monthlyFinancials.length > 0) {
      return metrics.monthlyFinancials;
    }
    // Fallback: Generate real month labels for current window if not yet returned
    const now = new Date();
    const months = [];
    for (let i = 8; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
        deposits: 0,
        withdrawals: 0,
      });
    }
    return months;
  }, [metrics?.monthlyFinancials]);

  // Max volume across months for scaling
  const maxMonthVolume = useMemo(() => {
    const maxVal = Math.max(
      ...monthlyData.map((m) => Math.max(m.deposits, m.withdrawals)),
      0
    );
    return maxVal > 0 ? maxVal : 50; // default ceiling if 0
  }, [monthlyData]);

  // Peak month index and value (only if > 0)
  const peakInfo = useMemo(() => {
    let peakIdx = -1;
    let peakVal = 0;
    monthlyData.forEach((m, idx) => {
      const highestInMonth = Math.max(m.deposits, m.withdrawals);
      if (highestInMonth > peakVal) {
        peakVal = highestInMonth;
        peakIdx = idx;
      }
    });
    return peakVal > 0 ? { idx: peakIdx, value: peakVal } : null;
  }, [monthlyData]);

  // Y-axis grid scale labels
  const yAxisLabels = useMemo(() => {
    if (maxMonthVolume <= 50) return [50, 40, 30, 20, 10];
    const step = Math.ceil(maxMonthVolume / 5);
    return [step * 5, step * 4, step * 3, step * 2, step];
  }, [maxMonthVolume]);

  // ─── Real 14-Day Activity Trends for Wave Chart ───
  const activityData = useMemo(() => {
    if (metrics?.recentActivityTrends && metrics.recentActivityTrends.length > 0) {
      return metrics.recentActivityTrends;
    }
    // Default 14 days zero-baseline
    const now = new Date();
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({
        date: d.toLocaleString('en-US', { day: '2-digit', month: 'short' }),
        day: d.getDate(),
        matches: 0,
        deposits: 0,
      });
    }
    return days;
  }, [metrics?.recentActivityTrends]);

  // Calculate dynamic wave SVG paths from real data points
  const { depositsPath, depositsFill, matchesPath, matchesFill } = useMemo(() => {
    const totalPoints = activityData.length;
    if (totalPoints < 2) {
      return {
        depositsPath: 'M 0,145 L 500,145',
        depositsFill: 'M 0,145 L 500,145 L 500,150 L 0,150 Z',
        matchesPath: 'M 0,145 L 500,145',
        matchesFill: 'M 0,145 L 500,145 L 500,150 L 0,150 Z',
      };
    }

    const maxMatches = Math.max(...activityData.map((d) => d.matches), 0);
    const maxDeposits = Math.max(...activityData.map((d) => d.deposits), 0);

    const matchPoints = activityData.map((d, i) => {
      const x = (i / (totalPoints - 1)) * 500;
      const y = maxMatches > 0 ? 140 - (d.matches / maxMatches) * 95 : 145;
      return { x, y };
    });

    const depositPoints = activityData.map((d, i) => {
      const x = (i / (totalPoints - 1)) * 500;
      const y = maxDeposits > 0 ? 140 - (d.deposits / maxDeposits) * 95 : 145;
      return { x, y };
    });

    const mPath = createSmoothPath(matchPoints);
    const dPath = createSmoothPath(depositPoints);

    return {
      matchesPath: mPath,
      matchesFill: `${mPath} L 500,150 L 0,150 Z`,
      depositsPath: dPath,
      depositsFill: `${dPath} L 500,150 L 0,150 Z`,
    };
  }, [activityData]);

  // ─── Real Calendar Days for Current Month ───
  const calendarInfo = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();
    const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

    const scheduledDays = new Set(metrics?.scheduledMatchDays ?? []);

    return {
      monthName,
      totalDays,
      firstDayIndex,
      currentDay,
      scheduledDays,
    };
  }, [metrics?.scheduledMatchDays]);

  return (
    <div
      className="-m-4 md:-m-8 p-4 md:p-8 bg-[#eef2f6] text-slate-800 min-h-[calc(100vh-4rem)] rounded-2xl space-y-6 shadow-inner"
      data-testid="staff-dashboard-container"
    >
      {/* ─── Top Header Bar ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Operations Dashboard
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time financial flows, liquidity queues & tournament operations
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Day / Month Period Toggle */}
          <div className="flex items-center bg-white rounded-xl p-1 shadow-sm border border-slate-200/80 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPeriod('day')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'day'
                  ? 'bg-[#0c2340] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'month'
                  ? 'bg-[#0c2340] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
          </div>

          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="refresh-dashboard-btn"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20 text-slate-500 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Loading Operations Metrics...
          </span>
        </div>
      ) : (
        <>
          {/* ─── Top Row: 4 KPI Cards ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Featured Dark Navy Card: Total Deposits */}
            <div className="rounded-2xl bg-[#0c2340] text-white p-5 sm:p-6 shadow-[0_8px_30px_rgb(12,35,64,0.18)] flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-300 block">Total Deposits</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => setPeriod((p) => (p === 'day' ? 'month' : 'day'))}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-semibold text-slate-200 transition-colors"
                      title="Click to toggle day / month"
                    >
                      <span>{period === 'day' ? 'Today' : 'This Month'}</span>
                      <span className="opacity-60 text-[9px]">⇄</span>
                    </button>
                  </div>
                </div>

                {/* Circular White Rupee Icon Badge */}
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0c2340] shadow-md font-black text-sm">
                  ₹
                </div>
              </div>

              <div className="mt-4 pt-2">
                <div
                  data-testid="total-deposits-value"
                  className="text-2xl sm:text-3xl font-black tracking-tight text-white"
                >
                  {formattedDeposit}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>Approved volume</span>
                  <Link to="/deposits" className="hover:text-amber-400 font-medium transition-colors">
                    View &rarr;
                  </Link>
                </div>
              </div>
            </div>

            {/* 2. White Card: Total Withdrawals */}
            <div className="rounded-2xl bg-white text-slate-800 p-5 sm:p-6 shadow-[0_4px_25px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500 block">Total Withdrawals</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => setPeriod((p) => (p === 'day' ? 'month' : 'day'))}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-600 transition-colors"
                      title="Click to toggle day / month"
                    >
                      <span>{period === 'day' ? 'Today' : 'This Month'}</span>
                      <span className="opacity-60 text-[9px]">⇄</span>
                    </button>
                  </div>
                </div>

                {/* Orange Share/Arrow Icon */}
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <Share2 className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-4 pt-2">
                <div
                  data-testid="total-withdrawals-value"
                  className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900"
                >
                  {formattedWithdrawal}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>Settled payouts</span>
                  <Link to="/withdrawals" className="hover:text-amber-600 font-medium transition-colors">
                    View &rarr;
                  </Link>
                </div>
              </div>
            </div>

            {/* 3. White Card: Total Pending Deposits */}
            <div
              className={`rounded-2xl bg-white text-slate-800 p-5 sm:p-6 shadow-[0_4px_25px_rgba(0,0,0,0.04)] border transition-all flex flex-col justify-between ${
                isDepOverdue ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-100'
              }`}
              data-testid="dashboard-deposits-card"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500 block">Pending Deposits</span>
                  {isDepOverdue ? (
                    <span
                      className="inline-flex items-center gap-1 mt-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600"
                      data-testid="deposit-overdue-badge"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Overdue (&gt;30m)
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                      Target review: &lt;30m
                    </span>
                  )}
                </div>

                {/* Orange Thumbs-Up Icon */}
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    isDepOverdue
                      ? 'bg-rose-100 text-rose-600'
                      : 'bg-amber-500/10 text-amber-500'
                  }`}
                >
                  <ThumbsUp className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-4 pt-2">
                <div className="flex items-baseline justify-between">
                  <span
                    className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900"
                    data-testid="deposit-count-value"
                  >
                    {metrics?.pendingDepositsCount ?? 0}
                  </span>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Oldest</span>
                    <span
                      className={`text-xs font-bold ${isDepOverdue ? 'text-rose-600' : 'text-slate-700'}`}
                      data-testid="deposit-oldest-age"
                    >
                      {formatAgeMinutes(depAge)}
                    </span>
                  </div>
                </div>

                {/* Two-step approval indicator */}
                <div className="mt-2 flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 text-slate-500">
                  <span>
                    <strong
                      className="text-slate-800 font-bold"
                      data-testid="employee-approved-deposits-count"
                    >
                      {metrics?.employeeApprovedDepositsCount ?? 0}
                    </strong>{' '}
                    awaiting final
                  </span>
                  <div className="flex items-center gap-1">
                    <span
                      className="font-semibold text-slate-600"
                      data-testid="employee-approved-deposits-age"
                    >
                      {formatAgeMinutes(metrics?.oldestEmployeeApprovedDepositAgeMinutes)}
                    </span>
                    {metrics?.isOldestEmployeeApprovedDepositOver30Min && (
                      <span
                        className="rounded bg-rose-100 px-1 py-0.2 text-[9px] font-bold text-rose-600"
                        data-testid="employee-approved-deposits-overdue"
                      >
                        &gt;30m
                      </span>
                    )}
                  </div>
                </div>

                {/* Deposit Queue Button */}
                <div className="mt-3 pt-2.5 border-t border-slate-100">
                  <Link
                    to="/deposits"
                    data-testid="view-deposits-queue-link"
                    className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.99] ${
                      isDepOverdue
                        ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-rose-500/20'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/10'
                    }`}
                  >
                    <span>Deposit Queue</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* 4. White Card: Total Pending Withdrawals */}
            <div
              className={`rounded-2xl bg-white text-slate-800 p-5 sm:p-6 shadow-[0_4px_25px_rgba(0,0,0,0.04)] border transition-all flex flex-col justify-between ${
                isWthOverdue ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-100'
              }`}
              data-testid="dashboard-withdrawals-card"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500 block">Pending Withdrawals</span>
                  {isWthOverdue ? (
                    <span
                      className="inline-flex items-center gap-1 mt-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600"
                      data-testid="withdrawal-overdue-badge"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Overdue (&gt;24h)
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                      Target payout: &lt;24h
                    </span>
                  )}
                </div>

                {/* Orange Star Icon */}
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    isWthOverdue
                      ? 'bg-rose-100 text-rose-600'
                      : 'bg-amber-500/10 text-amber-500'
                  }`}
                >
                  <Star className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-4 pt-2">
                <div className="flex items-baseline justify-between">
                  <span
                    className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900"
                    data-testid="withdrawal-count-value"
                  >
                    {metrics?.pendingWithdrawalsCount ?? 0}
                  </span>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Oldest</span>
                    <span
                      className={`text-xs font-bold ${isWthOverdue ? 'text-rose-600' : 'text-slate-700'}`}
                      data-testid="withdrawal-oldest-age"
                    >
                      {formatAgeMinutes(wthAge)}
                    </span>
                  </div>
                </div>

                {/* Two-step approval indicator */}
                <div className="mt-2 flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 text-slate-500">
                  <span>
                    <strong
                      className="text-slate-800 font-bold"
                      data-testid="employee-approved-withdrawals-count"
                    >
                      {metrics?.employeeApprovedWithdrawalsCount ?? 0}
                    </strong>{' '}
                    awaiting payout
                  </span>
                  <div className="flex items-center gap-1">
                    <span
                      className="font-semibold text-slate-600"
                      data-testid="employee-approved-withdrawals-age"
                    >
                      {formatAgeMinutes(metrics?.oldestEmployeeApprovedWithdrawalAgeMinutes)}
                    </span>
                    {metrics?.isOldestEmployeeApprovedWithdrawalOver24Hours && (
                      <span
                        className="rounded bg-rose-100 px-1 py-0.2 text-[9px] font-bold text-rose-600"
                        data-testid="employee-approved-withdrawals-overdue"
                      >
                        &gt;24h
                      </span>
                    )}
                  </div>
                </div>

                {/* Withdrawal Queue Button */}
                <div className="mt-3 pt-2.5 border-t border-slate-100">
                  <Link
                    to="/withdrawals"
                    data-testid="view-withdrawals-queue-link"
                    className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.99] ${
                      isWthOverdue
                        ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-rose-500/20'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/10'
                    }`}
                  >
                    <span>Withdrawal Queue</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Middle Section: 2-Column Grid ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* ─── Left Side: 2 Rows (Bar Chart + Wave Chart & Calendar) ─── */}
            <div className="lg:col-span-8 space-y-5">
              {/* Row 1: The "Result" Bar Chart Card */}
              <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-[0_4px_25px_rgba(0,0,0,0.04)] border border-slate-100">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Result</h2>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Platform Financial Flows & Liquidity Volume (INR)
                    </span>
                  </div>

                  <Link
                    to="/deposits"
                    className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs px-4 py-2 shadow-sm transition-all active:scale-95"
                  >
                    <span>Check Now</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {/* Real Data Bar Chart */}
                <div className="mt-6 relative">
                  <div className="flex items-start">
                    {/* Y-Axis Labels */}
                    <div className="flex flex-col justify-between h-48 text-[11px] font-semibold text-slate-400 pr-3 pb-6 text-right select-none min-w-[36px]">
                      {yAxisLabels.map((lbl, idx) => (
                        <span key={idx}>
                          {lbl >= 1000 ? `${Math.round(lbl / 1000)}k` : lbl}
                        </span>
                      ))}
                    </div>

                    {/* Chart Canvas Area */}
                    <div className="flex-1 relative pb-6">
                      {/* Horizontal Grid Lines */}
                      <div className="absolute inset-x-0 top-0 h-48 flex flex-col justify-between pointer-events-none">
                        <div className="border-b border-slate-200/60 w-full" />
                        <div className="border-b border-slate-200/60 w-full" />
                        <div className="border-b border-slate-200/60 w-full" />
                        <div className="border-b border-slate-200/60 w-full" />
                        <div className="border-b border-slate-200/60 w-full" />
                      </div>

                      {/* Real Monthly Bar Columns */}
                      <div className="relative h-48 flex items-end justify-between px-2 sm:px-4">
                        {monthlyData.map((col, idx) => {
                          const orangeHeight =
                            maxMonthVolume > 0 && col.deposits > 0
                              ? `${Math.max(Math.min((col.deposits / maxMonthVolume) * 100, 95), 4)}%`
                              : '0%';

                          const navyHeight =
                            maxMonthVolume > 0 && col.withdrawals > 0
                              ? `${Math.max(Math.min((col.withdrawals / maxMonthVolume) * 100, 95), 4)}%`
                              : '0%';

                          const isPeak = peakInfo && peakInfo.idx === idx;
                          const isHovered = activeBarHover === idx;

                          return (
                            <div
                              key={idx}
                              onMouseEnter={() => setActiveBarHover(idx)}
                              onMouseLeave={() => setActiveBarHover(null)}
                              className="flex flex-col items-center group relative h-full justify-end cursor-pointer"
                            >
                              {/* Real Peak Tooltip Badge (Only when real volume > 0) */}
                              {isPeak && !isHovered && (
                                <div className="absolute -top-7 z-10 flex flex-col items-center animate-fade-in pointer-events-none">
                                  <div className="rounded-md bg-[#0c2340] px-2 py-0.5 text-[10px] font-bold text-white shadow-md whitespace-nowrap">
                                    ₹{peakInfo.value >= 1000 ? `${(peakInfo.value / 1000).toFixed(1)}k` : peakInfo.value}
                                  </div>
                                  <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-[#0c2340]" />
                                </div>
                              )}

                              {/* Hover Details Popover */}
                              {isHovered && (
                                <div className="absolute -top-12 z-20 flex flex-col items-center pointer-events-none">
                                  <div className="rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white shadow-xl whitespace-nowrap space-y-0.5">
                                    <div className="text-amber-400">Dep: ₹{col.deposits.toLocaleString('en-IN')}</div>
                                    <div className="text-slate-300">Wth: ₹{col.withdrawals.toLocaleString('en-IN')}</div>
                                  </div>
                                  <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900" />
                                </div>
                              )}

                              {/* Bars Container */}
                              <div className="flex items-end gap-1 sm:gap-1.5 h-full">
                                {/* Orange Bar (Deposits) */}
                                <div
                                  style={{ height: orangeHeight }}
                                  className={`w-2 sm:w-3.5 rounded-t-sm transition-all shadow-sm ${
                                    col.deposits > 0
                                      ? 'bg-gradient-to-t from-amber-500 to-orange-400 group-hover:brightness-110'
                                      : 'bg-transparent'
                                  }`}
                                  title={`Deposits: ₹${col.deposits}`}
                                />
                                {/* Navy Bar (Withdrawals) */}
                                <div
                                  style={{ height: navyHeight }}
                                  className={`w-2 sm:w-3.5 rounded-t-sm transition-all shadow-sm ${
                                    col.withdrawals > 0
                                      ? 'bg-[#0c2340] group-hover:bg-[#13355d]'
                                      : 'bg-transparent'
                                  }`}
                                  title={`Withdrawals: ₹${col.withdrawals}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* X-Axis Real Month Labels */}
                      <div className="flex items-center justify-between px-2 sm:px-4 pt-2 border-t border-slate-300 text-[10px] font-bold text-slate-500 uppercase select-none">
                        {monthlyData.map((m, idx) => (
                          <span key={idx}>{m.month}</span>
                        ))}
                      </div>
                    </div>

                    {/* Right-Side Chart Legend */}
                    <div className="pl-4 sm:pl-6 flex flex-col justify-center gap-3 select-none text-xs font-semibold text-slate-600">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm bg-gradient-to-br from-amber-500 to-orange-400 shadow-sm" />
                        <span className="text-[11px]">Deposits</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm bg-[#0c2340] shadow-sm" />
                        <span className="text-[11px]">Withdrawals</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Real Dual Wave Area Chart + Real Match Calendar */}
              <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-[0_4px_25px_rgba(0,0,0,0.04)] border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  {/* Wave Curves Column (~60%) */}
                  <div className="md:col-span-7 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs font-semibold select-none">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-sm" />
                          <span className="text-slate-700">Daily Deposits</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#0c2340] shadow-sm" />
                          <span className="text-slate-700">Daily Matches</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">
                        Last 14 Days
                      </span>
                    </div>

                    {/* Dynamic Dual Wave SVG Graphic from Real Points */}
                    <div className="w-full h-36 relative overflow-hidden rounded-xl pt-2">
                      <svg
                        viewBox="0 0 500 150"
                        preserveAspectRatio="none"
                        className="w-full h-full"
                      >
                        <defs>
                          <linearGradient id="waveOrangeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.75" />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
                          </linearGradient>
                          <linearGradient id="waveNavyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#0c2340" stopOpacity="0.65" />
                            <stop offset="100%" stopColor="#0c2340" stopOpacity="0.05" />
                          </linearGradient>
                        </defs>

                        {/* Navy Matches Wave */}
                        <path d={matchesFill} fill="url(#waveNavyGrad)" />
                        <path
                          d={matchesPath}
                          fill="none"
                          stroke="#0c2340"
                          strokeWidth="2.5"
                        />

                        {/* Orange Deposits Wave */}
                        <path d={depositsFill} fill="url(#waveOrangeGrad)" />
                        <path
                          d={depositsPath}
                          fill="none"
                          stroke="#ea580c"
                          strokeWidth="2.5"
                        />
                      </svg>
                    </div>

                    {/* Timeline range indicator */}
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 px-1 pt-0.5">
                      <span>{activityData[0]?.date || '14 days ago'}</span>
                      <span>Today</span>
                    </div>
                  </div>

                  {/* Real Calendar Widget (~40%) */}
                  <div className="md:col-span-5 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                    <div className="flex items-center justify-between pb-2">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5 text-amber-500" />
                        Match Schedule
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {calendarInfo.monthName}
                      </span>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center select-none text-[11px]">
                      {/* Weekday Header in Terracotta */}
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, dIdx) => (
                        <div key={dIdx} className="font-bold text-[#e06d53] py-0.5">
                          {day}
                        </div>
                      ))}

                      {/* Empty padding for month offset */}
                      {Array.from({ length: calendarInfo.firstDayIndex }).map((_, padIdx) => (
                        <div key={`pad-${padIdx}`} />
                      ))}

                      {/* Real days of current month */}
                      {Array.from({ length: calendarInfo.totalDays }, (_, i) => i + 1).map((d) => {
                        const isToday = d === calendarInfo.currentDay;
                        const hasScheduledMatch = calendarInfo.scheduledDays.has(d);

                        return (
                          <div
                            key={d}
                            className={`h-6 w-6 mx-auto flex items-center justify-center rounded-md font-semibold text-[10px] transition-all ${
                              hasScheduledMatch
                                ? 'bg-[#0c2340] text-white shadow-sm font-bold ring-1 ring-amber-400'
                                : isToday
                                ? 'bg-amber-500 text-white shadow-sm font-bold'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                            title={
                              hasScheduledMatch
                                ? `Day ${d}: Tournaments scheduled`
                                : isToday
                                ? `Day ${d}: Today`
                                : undefined
                            }
                          >
                            {d}
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 text-[10px] text-slate-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Today
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-sm bg-[#0c2340] inline-block" /> Match Day (
                        {calendarInfo.scheduledDays.size})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Right Column: Tall Card (Circular Donut Chart & Tournament Operations) ─── */}
            <div className="lg:col-span-4 rounded-2xl bg-white p-5 sm:p-6 shadow-[0_4px_25px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between space-y-6">
              {/* Circular Donut Progress Chart with Real Dynamic Arcs */}
              <div className="flex flex-col items-center text-center">
                <div className="relative h-44 w-44 flex items-center justify-center">
                  <svg className="h-full w-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background Track Circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r={circleRadius}
                      stroke="#f1f5f9"
                      strokeWidth="11"
                      fill="transparent"
                    />
                    {/* Real Dynamic Navy Arc (Completion Ratio) */}
                    {efficiencyRate > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r={circleRadius}
                        stroke="#0c2340"
                        strokeWidth="11"
                        strokeDasharray={circleCircumference}
                        strokeDashoffset={efficiencyOffset}
                        strokeLinecap="round"
                        fill="transparent"
                        className="transition-all duration-1000 ease-out"
                      />
                    )}
                    {/* Amber Progress Arc */}
                    {efficiencyRate > 0 && efficiencyRate < 100 && (
                      <circle
                        cx="50"
                        cy="50"
                        r={circleRadius}
                        stroke="#f59e0b"
                        strokeWidth="11"
                        strokeDasharray={circleCircumference}
                        strokeDashoffset={
                          circleCircumference - ((100 - efficiencyRate) / 100) * circleCircumference
                        }
                        strokeLinecap="round"
                        fill="transparent"
                        className="transition-all duration-1000 ease-out drop-shadow-md"
                        transform="rotate(180 50 50)"
                      />
                    )}
                  </svg>

                  {/* Real Percentage in Center */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-slate-900 tracking-tight">
                      {efficiencyRate}%
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                      Efficiency
                    </span>
                  </div>
                </div>

                <div className="text-xs font-semibold text-slate-500 mt-1">
                  Tournament Clearance & Settlement
                </div>
              </div>

              {/* Tournament Operations Breakdown List */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-1">
                  <Activity className="h-3.5 w-3.5 text-amber-500" />
                  Tournament Operations
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {/* Row 1: Live Matches */}
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-semibold text-slate-700">Live Matches</span>
                    </div>
                    <span
                      className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md"
                      data-testid="live-matches-count"
                    >
                      {metrics?.liveMatchesCount ?? 0}
                    </span>
                  </div>

                  {/* Row 2: Upcoming Matches */}
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#0c2340]" />
                      <span className="font-semibold text-slate-700">Upcoming Matches</span>
                    </div>
                    <span
                      className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md"
                      data-testid="upcoming-matches-count"
                    >
                      {metrics?.upcomingMatchesCount ?? 0}
                    </span>
                  </div>

                  {/* Row 3: Room Open */}
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="font-semibold text-slate-700">Room Open</span>
                    </div>
                    <span
                      className="font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md"
                      data-testid="room-open-matches-count"
                    >
                      {metrics?.roomOpenMatchesCount ?? 0}
                    </span>
                  </div>

                  {/* Row 4: Completed Matches */}
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      <span className="font-semibold text-slate-700">Completed Matches</span>
                    </div>
                    <span
                      className="font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md"
                      data-testid="completed-matches-count"
                    >
                      {metrics?.completedMatchesCount ?? 0}
                    </span>
                  </div>

                  {/* Row 5: Results Approval */}
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" />
                      <span className="font-semibold text-slate-700">Results Approval</span>
                    </div>
                    <span
                      className="font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md"
                      data-testid="results-waiting-count"
                    >
                      {metrics?.resultsWaitingApprovalCount ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Orange Button */}
              <div className="pt-2">
                <Link
                  to="/matches"
                  className="w-full text-center block rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 px-4 shadow-md hover:shadow-lg transition-all active:scale-[0.98] text-xs"
                >
                  Check Now
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
