import { apiClient } from './client.js';
import { runGuard, leaderboardResponseGuard, leaderboardRankResponseGuard } from './guards.js';
import type { LeaderboardResponse, LeaderboardRankResponse } from './types.js';

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'overall';

export async function getWeeklyLeaderboard(period: LeaderboardPeriod = 'weekly'): Promise<LeaderboardResponse> {
  const qs = period !== 'weekly' ? `period=${period}` : '';
  const data = await apiClient<LeaderboardResponse>(`/api/v1/leaderboard?${qs}`);
  return runGuard(leaderboardResponseGuard, data, 'GET /api/v1/leaderboard');
}

export async function getUserLeaderboardRank(period: LeaderboardPeriod = 'weekly'): Promise<LeaderboardRankResponse> {
  const qs = period !== 'weekly' ? `period=${period}` : '';
  const data = await apiClient<LeaderboardRankResponse>(`/api/v1/me/leaderboard-rank?${qs}`);
  return runGuard(leaderboardRankResponseGuard, data, 'GET /api/v1/me/leaderboard-rank');
}

