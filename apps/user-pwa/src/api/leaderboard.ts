import { apiClient } from './client.js';
import { runGuard, leaderboardResponseGuard, leaderboardRankResponseGuard } from './guards.js';
import type { LeaderboardResponse, LeaderboardRankResponse } from './types.js';

export async function getWeeklyLeaderboard(): Promise<LeaderboardResponse> {
  const data = await apiClient<LeaderboardResponse>('/api/v1/leaderboard');
  return runGuard(leaderboardResponseGuard, data, 'GET /api/v1/leaderboard');
}

export async function getUserLeaderboardRank(): Promise<LeaderboardRankResponse> {
  const data = await apiClient<LeaderboardRankResponse>('/api/v1/me/leaderboard-rank');
  return runGuard(leaderboardRankResponseGuard, data, 'GET /api/v1/me/leaderboard-rank');
}
