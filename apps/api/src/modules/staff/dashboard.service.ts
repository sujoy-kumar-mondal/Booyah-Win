import { query } from '../../db/index.js';

export interface DashboardMonthlyFinancial {
  month: string;
  deposits: number;
  withdrawals: number;
}

export interface DashboardActivityTrend {
  date: string;
  day: number;
  matches: number;
  deposits: number;
}

export interface DashboardMetrics {
  pendingDepositsCount: number;
  oldestPendingDepositAgeMinutes: number | null;
  isOldestDepositOver30Min: boolean;
  employeeApprovedDepositsCount: number;
  oldestEmployeeApprovedDepositAgeMinutes: number | null;
  isOldestEmployeeApprovedDepositOver30Min: boolean;
  pendingWithdrawalsCount: number;
  oldestPendingWithdrawalAgeMinutes: number | null;
  employeeApprovedWithdrawalsCount: number;
  oldestEmployeeApprovedWithdrawalAgeMinutes: number | null;
  isOldestEmployeeApprovedWithdrawalOver24Hours: boolean;
  liveMatchesCount: number;
  upcomingMatchesCount: number;
  roomOpenMatchesCount: number;
  completedMatchesCount: number;
  resultsWaitingApprovalCount: number;
  totalDepositsToday: number;
  totalDepositsMonth: number;
  totalWithdrawalsToday: number;
  totalWithdrawalsMonth: number;
  monthlyFinancials: DashboardMonthlyFinancial[];
  scheduledMatchDays: number[];
  recentActivityTrends: DashboardActivityTrend[];
}

export class DashboardService {
  static async getMetrics(): Promise<DashboardMetrics> {
    // 1. Pending deposits metrics
    const depRes = await query<{
      count: string;
      age_min: string | null;
    }>(
      `SELECT count(*)::text AS count,
              EXTRACT(EPOCH FROM (now() - min(created_at))) / 60 AS age_min
       FROM deposit_requests
       WHERE status = 'pending'`
    );
    const depCount = parseInt(depRes.rows[0]?.count || '0', 10);
    const depAge = depRes.rows[0]?.age_min !== null && depRes.rows[0]?.age_min !== undefined
      ? Math.round(parseFloat(depRes.rows[0].age_min) * 10) / 10
      : null;

    // 1b. Employee-approved deposits metrics (awaiting final admin approval)
    const depEmpRes = await query<{
      count: string;
      age_min: string | null;
    }>(
      `SELECT count(*)::text AS count,
              EXTRACT(EPOCH FROM (now() - min(created_at))) / 60 AS age_min
       FROM deposit_requests
       WHERE status = 'employee_approved'`
    );
    const depEmpCount = parseInt(depEmpRes.rows[0]?.count || '0', 10);
    const depEmpAge = depEmpRes.rows[0]?.age_min !== null && depEmpRes.rows[0]?.age_min !== undefined
      ? Math.round(parseFloat(depEmpRes.rows[0].age_min) * 10) / 10
      : null;

    // 2. Pending withdrawals metrics
    const wthRes = await query<{
      count: string;
      age_min: string | null;
    }>(
      `SELECT count(*)::text AS count,
              EXTRACT(EPOCH FROM (now() - min(created_at))) / 60 AS age_min
       FROM withdrawal_requests
       WHERE status = 'pending'`
    );
    const wthCount = parseInt(wthRes.rows[0]?.count || '0', 10);
    const wthAge = wthRes.rows[0]?.age_min !== null && wthRes.rows[0]?.age_min !== undefined
      ? Math.round(parseFloat(wthRes.rows[0].age_min) * 10) / 10
      : null;

    // 2b. Employee-approved withdrawals metrics (awaiting final admin approval)
    const wthEmpRes = await query<{
      count: string;
      age_min: string | null;
    }>(
      `SELECT count(*)::text AS count,
              EXTRACT(EPOCH FROM (now() - min(created_at))) / 60 AS age_min
       FROM withdrawal_requests
       WHERE status = 'employee_approved'`
    );
    const wthEmpCount = parseInt(wthEmpRes.rows[0]?.count || '0', 10);
    const wthEmpAge = wthEmpRes.rows[0]?.age_min !== null && wthEmpRes.rows[0]?.age_min !== undefined
      ? Math.round(parseFloat(wthEmpRes.rows[0].age_min) * 10) / 10
      : null;

    // 3. Match counts by status
    const matchRes = await query<{ status: string; count: string }>(
      `SELECT status, count(*)::text AS count
       FROM matches
       GROUP BY status`
    );
    const matchCounts: Record<string, number> = {
      upcoming: 0,
      room_open: 0,
      live: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const r of matchRes.rows) {
      matchCounts[r.status] = parseInt(r.count, 10);
    }

    // 4. Pending results waiting approval (Requirement 8: ONLY where match status is 'live')
    const resultsRes = await query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM match_results mr
       JOIN matches m ON m.id = mr.match_id
       WHERE mr.status = 'pending_approval' AND m.status = 'live'`
    );
    const resultsWaitingCount = parseInt(resultsRes.rows[0]?.count || '0', 10);

    // 5. Approved deposits totals (day and month)
    const depTotalsRes = await query<{
      total_today: string;
      total_month: string;
    }>(
      `SELECT
         coalesce(sum(CASE WHEN coalesce(reviewed_at, created_at) >= date_trunc('day', now()) THEN amount ELSE 0 END), 0)::text AS total_today,
         coalesce(sum(CASE WHEN coalesce(reviewed_at, created_at) >= date_trunc('month', now()) THEN amount ELSE 0 END), 0)::text AS total_month
       FROM deposit_requests
       WHERE status = 'approved'`
    );
    const totalDepositsToday = Math.round(parseFloat(depTotalsRes.rows[0]?.total_today || '0') * 100) / 100;
    const totalDepositsMonth = Math.round(parseFloat(depTotalsRes.rows[0]?.total_month || '0') * 100) / 100;

    // 6. Paid withdrawals totals (day and month)
    const wthTotalsRes = await query<{
      total_today: string;
      total_month: string;
    }>(
      `SELECT
         coalesce(sum(CASE WHEN coalesce(processed_at, created_at) >= date_trunc('day', now()) THEN amount ELSE 0 END), 0)::text AS total_today,
         coalesce(sum(CASE WHEN coalesce(processed_at, created_at) >= date_trunc('month', now()) THEN amount ELSE 0 END), 0)::text AS total_month
       FROM withdrawal_requests
       WHERE status = 'paid'`
    );
    const totalWithdrawalsToday = Math.round(parseFloat(wthTotalsRes.rows[0]?.total_today || '0') * 100) / 100;
    const totalWithdrawalsMonth = Math.round(parseFloat(wthTotalsRes.rows[0]?.total_month || '0') * 100) / 100;

    // 7. Real monthly financials (last 9 months)
    const monthlyRes = await query<{
      month: string;
      deposits: string | number;
      withdrawals: string | number;
    }>(
      `SELECT
         to_char(months.m, 'Mon') AS month,
         coalesce(dep.total, 0)::float AS deposits,
         coalesce(wth.total, 0)::float AS withdrawals
       FROM generate_series(
         date_trunc('month', now() - interval '8 months'),
         date_trunc('month', now()),
         interval '1 month'
       ) AS months(m)
       LEFT JOIN (
         SELECT date_trunc('month', coalesce(reviewed_at, created_at)) AS m, sum(amount) AS total
         FROM deposit_requests
         WHERE status = 'approved'
         GROUP BY 1
       ) dep ON dep.m = months.m
       LEFT JOIN (
         SELECT date_trunc('month', coalesce(processed_at, created_at)) AS m, sum(amount) AS total
         FROM withdrawal_requests
         WHERE status = 'paid'
         GROUP BY 1
       ) wth ON wth.m = months.m
       ORDER BY months.m ASC`
    );
    const monthlyFinancials: DashboardMonthlyFinancial[] = monthlyRes.rows.map(r => ({
      month: r.month,
      deposits: Math.round(Number(r.deposits) * 100) / 100,
      withdrawals: Math.round(Number(r.withdrawals) * 100) / 100,
    }));

    // 8. Real scheduled match days in current month
    const daysRes = await query<{ day: number }>(
      `SELECT DISTINCT EXTRACT(DAY FROM start_time)::int AS day
       FROM matches
       WHERE date_trunc('month', start_time) = date_trunc('month', now())
         AND status != 'cancelled'
       ORDER BY day ASC`
    );
    const scheduledMatchDays: number[] = daysRes.rows.map(r => Number(r.day));

    // 9. Real recent activity trends (last 14 days)
    const trendsRes = await query<{
      date: string;
      day: number;
      matches: string | number;
      deposits: string | number;
    }>(
      `SELECT
         to_char(days.d, 'DD Mon') AS date,
         EXTRACT(DAY FROM days.d)::int AS day,
         coalesce(m.cnt, 0)::int AS matches,
         coalesce(dep.total, 0)::float AS deposits
       FROM generate_series(
         date_trunc('day', now() - interval '13 days'),
         date_trunc('day', now()),
         interval '1 day'
       ) AS days(d)
       LEFT JOIN (
         SELECT date_trunc('day', start_time) AS d, count(*) AS cnt
         FROM matches
         WHERE status != 'cancelled'
         GROUP BY 1
       ) m ON m.d = days.d
       LEFT JOIN (
         SELECT date_trunc('day', coalesce(reviewed_at, created_at)) AS d, sum(amount) AS total
         FROM deposit_requests
         WHERE status = 'approved'
         GROUP BY 1
       ) dep ON dep.d = days.d
       ORDER BY days.d ASC`
    );
    const recentActivityTrends: DashboardActivityTrend[] = trendsRes.rows.map(r => ({
      date: r.date,
      day: Number(r.day),
      matches: Number(r.matches),
      deposits: Math.round(Number(r.deposits) * 100) / 100,
    }));

    return {
      pendingDepositsCount: depCount,
      oldestPendingDepositAgeMinutes: depAge,
      isOldestDepositOver30Min: (depAge ?? 0) > 30,
      employeeApprovedDepositsCount: depEmpCount,
      oldestEmployeeApprovedDepositAgeMinutes: depEmpAge,
      isOldestEmployeeApprovedDepositOver30Min: (depEmpAge ?? 0) > 30,
      pendingWithdrawalsCount: wthCount,
      oldestPendingWithdrawalAgeMinutes: wthAge,
      employeeApprovedWithdrawalsCount: wthEmpCount,
      oldestEmployeeApprovedWithdrawalAgeMinutes: wthEmpAge,
      isOldestEmployeeApprovedWithdrawalOver24Hours: (wthEmpAge ?? 0) > 1440,
      liveMatchesCount: matchCounts['live'] || 0,
      upcomingMatchesCount: matchCounts['upcoming'] || 0,
      roomOpenMatchesCount: matchCounts['room_open'] || 0,
      completedMatchesCount: matchCounts['completed'] || 0,
      resultsWaitingApprovalCount: resultsWaitingCount,
      totalDepositsToday,
      totalDepositsMonth,
      totalWithdrawalsToday,
      totalWithdrawalsMonth,
      monthlyFinancials,
      scheduledMatchDays,
      recentActivityTrends,
    };
  }
}
