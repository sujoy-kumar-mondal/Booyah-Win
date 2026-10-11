import { query } from '../../db/index.js';

export interface DashboardMetrics {
  pendingDepositsCount: number;
  oldestPendingDepositAgeMinutes: number | null;
  isOldestDepositOver30Min: boolean;
  pendingWithdrawalsCount: number;
  oldestPendingWithdrawalAgeMinutes: number | null;
  liveMatchesCount: number;
  upcomingMatchesCount: number;
  roomOpenMatchesCount: number;
  completedMatchesCount: number;
  resultsWaitingApprovalCount: number;
}

export class DashboardService {
  static async getMetrics(): Promise<DashboardMetrics> {
    // 1. Deposits metrics
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

    // 2. Withdrawals metrics
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

    return {
      pendingDepositsCount: depCount,
      oldestPendingDepositAgeMinutes: depAge,
      isOldestDepositOver30Min: (depAge ?? 0) > 30,
      pendingWithdrawalsCount: wthCount,
      oldestPendingWithdrawalAgeMinutes: wthAge,
      liveMatchesCount: matchCounts['live'] || 0,
      upcomingMatchesCount: matchCounts['upcoming'] || 0,
      roomOpenMatchesCount: matchCounts['room_open'] || 0,
      completedMatchesCount: matchCounts['completed'] || 0,
      resultsWaitingApprovalCount: resultsWaitingCount,
    };
  }
}
