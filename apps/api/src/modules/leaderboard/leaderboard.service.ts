/**
 * Weekly Leaderboard Service
 *
 * Rules:
 * - Period: one week, Monday 00:00:00 to Sunday 23:59:59 IST (Asia/Kolkata).
 * - Window: half-open [weekStart, nextWeekStart) from the database clock.
 * - Score: computed per match (user_id, ref_id) group where net = sum(amounts of winning and reversal rows).
 *   Attributed to the week of the group's latest winning row.
 * - Ties broken by earlier time of user's most recent winning entry, then user_id ASC.
 * - Single-flight caching: 60-second in-memory cache keyed by weekStart; invalidated on result approval, reversal, and user deletion.
 * - Shared CTE for top-50 list and individual user rank.
 */

import { paiseToString, stringToPaise, LeaderboardResponse, LeaderboardRankResponse } from '@booyah/shared';
import { query } from '../../db/index.js';
import type { PoolClient } from 'pg';

export interface WeekWindow {
  weekStart: Date;
  nextWeekStart: Date;
  weekEnd: Date;
  weekStartIso: string;
  nextWeekStartIso: string;
  weekEndIso: string;
  generatedAtIso: string;
}

// ─── Single-Flight In-Memory Cache ───────────────────────────────────────────
let cachedLeaderboard: {
  data: LeaderboardResponse;
  expiresAt: number;
  weekStartIso: string;
} | null = null;

let inFlightPromise: Promise<LeaderboardResponse> | null = null;

export function invalidateLeaderboardCache(): void {
  cachedLeaderboard = null;
}

/**
 * Computes the exact IST week window using the database clock.
 */
export async function getDbWeekWindow(client?: PoolClient): Promise<WeekWindow> {
  const runner = client ? client.query.bind(client) : query;
  const res = await runner<{
    week_start: Date;
    next_week_start: Date;
    week_end: Date;
    db_now: Date;
  }>(`
    SELECT
      (date_trunc('week', timezone('Asia/Kolkata', now())) AT TIME ZONE 'Asia/Kolkata') AS week_start,
      ((date_trunc('week', timezone('Asia/Kolkata', now())) + interval '7 days') AT TIME ZONE 'Asia/Kolkata') AS next_week_start,
      ((date_trunc('week', timezone('Asia/Kolkata', now())) + interval '7 days - 1 second') AT TIME ZONE 'Asia/Kolkata') AS week_end,
      now() AS db_now
  `);

  const row = res.rows[0];
  return {
    weekStart: row.week_start,
    nextWeekStart: row.next_week_start,
    weekEnd: row.week_end,
    weekStartIso: row.week_start.toISOString(),
    nextWeekStartIso: row.next_week_start.toISOString(),
    weekEndIso: row.week_end.toISOString(),
    generatedAtIso: row.db_now.toISOString(),
  };
}

/**
 * Core SQL query using shared CTE for ranking calculation.
 */
function buildRankingCteSql(selectClause: string): string {
  return `
    WITH current_week_matches AS (
      SELECT DISTINCT user_id, ref_id
      FROM wallet_ledger
      WHERE type = 'winning'
        AND created_at >= $1 AND created_at < $2
        AND ref_id IS NOT NULL
    ),
    match_groups AS (
      SELECT
        l.user_id,
        l.ref_id,
        SUM(l.amount) AS net_winnings,
        MAX(CASE WHEN l.type = 'winning' THEN l.created_at END) AS latest_win_time
      FROM wallet_ledger l
      JOIN current_week_matches cwm ON cwm.user_id = l.user_id AND cwm.ref_id = l.ref_id
      WHERE l.type IN ('winning', 'reversal')
      GROUP BY l.user_id, l.ref_id
      HAVING MAX(CASE WHEN l.type = 'winning' THEN l.created_at END) >= $1
         AND MAX(CASE WHEN l.type = 'winning' THEN l.created_at END) < $2
    ),
    user_weekly AS (
      SELECT
        mg.user_id,
        u.ff_name AS name,
        SUM(mg.net_winnings) AS total_winnings,
        MAX(mg.latest_win_time) AS most_recent_win_time
      FROM match_groups mg
      JOIN users u ON u.id = mg.user_id
      WHERE u.deleted_at IS NULL
      GROUP BY mg.user_id, u.ff_name
      HAVING SUM(mg.net_winnings) > 0
    ),
    ranked_leaderboard AS (
      SELECT
        uw.user_id,
        uw.name,
        uw.total_winnings,
        uw.most_recent_win_time,
        ROW_NUMBER() OVER (
          ORDER BY uw.total_winnings DESC, uw.most_recent_win_time ASC, uw.user_id ASC
        ) AS rank
      FROM user_weekly uw
    )
    ${selectClause}
  `;
}

/**
 * Recomputes the top 50 leaderboard directly from the database.
 */
async function computeLeaderboard(window: WeekWindow): Promise<LeaderboardResponse> {
  const sql = buildRankingCteSql(`
    SELECT rank, name, total_winnings
    FROM ranked_leaderboard
    WHERE rank <= 50
    ORDER BY rank ASC
  `);

  const res = await query<{
    rank: string | number;
    name: string;
    total_winnings: string | number;
  }>(sql, [window.weekStart, window.nextWeekStart]);

  const entries = res.rows.map((row) => ({
    rank: Number(row.rank),
    name: row.name,
    winnings: paiseToString(stringToPaise(String(row.total_winnings))),
  }));

  return {
    weekStart: window.weekStartIso,
    weekEnd: window.weekEndIso,
    generatedAt: window.generatedAtIso,
    entries,
  };
}

/**
 * Public leaderboard with single-flight recomputation and 60s cache.
 */
export async function getWeeklyLeaderboard(): Promise<LeaderboardResponse> {
  const window = await getDbWeekWindow();
  const now = Date.now();

  if (
    cachedLeaderboard &&
    cachedLeaderboard.weekStartIso === window.weekStartIso &&
    now < cachedLeaderboard.expiresAt
  ) {
    return cachedLeaderboard.data;
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const data = await computeLeaderboard(window);
      cachedLeaderboard = {
        data,
        expiresAt: Date.now() + 60_000,
        weekStartIso: window.weekStartIso,
      };
      return data;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

/**
 * Gets a logged-in user's own rank and total winnings for the current week window.
 * Returns null if the user has no winnings or net <= 0.
 */
export async function getUserLeaderboardRank(
  userId: string
): Promise<LeaderboardRankResponse> {
  const window = await getDbWeekWindow();
  const sql = buildRankingCteSql(`
    SELECT rank, total_winnings
    FROM ranked_leaderboard
    WHERE user_id = $3
  `);

  const res = await query<{
    rank: string | number;
    total_winnings: string | number;
  }>(sql, [window.weekStart, window.nextWeekStart, userId]);

  if (!res.rows.length) {
    return null;
  }

  const row = res.rows[0];
  return {
    rank: Number(row.rank),
    winnings: paiseToString(stringToPaise(String(row.total_winnings))),
  };
}
