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
import { logger } from '../../utils/logger.js';
import { getSignedUrl } from '../../utils/storage.js';

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'overall';

export interface WeekWindow {
  weekStart: Date;
  nextWeekStart: Date;
  weekEnd: Date;
  weekStartIso: string;
  nextWeekStartIso: string;
  weekEndIso: string;
  generatedAtIso: string;
  cycleStartIso: string;
}

// ─── Single-Flight In-Memory Multi-Period Cache ──────────────────────────────
const cachedLeaderboards = new Map<
  LeaderboardPeriod,
  {
    data: LeaderboardResponse;
    expiresAt: number;
    startIso: string;
    cycleStartIso: string;
  }
>();

const inFlightPromises = new Map<LeaderboardPeriod, Promise<LeaderboardResponse>>();

export function invalidateLeaderboardCache(period?: LeaderboardPeriod): void {
  if (period) {
    cachedLeaderboards.delete(period);
    inFlightPromises.delete(period);
  } else {
    cachedLeaderboards.clear();
    inFlightPromises.clear();
  }
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
    cycleStartIso: row.week_start.toISOString(),
  };
}

/**
 * Computes the window for a given leaderboard period (weekly, monthly, overall).
 */
export async function getDbLeaderboardWindow(
  period: LeaderboardPeriod = 'weekly',
  client?: PoolClient
): Promise<WeekWindow> {
  const runner = client ? client.query.bind(client) : query;

  if (period === 'monthly') {
    const res = await runner<{
      month_start: Date;
      next_month_start: Date;
      month_end: Date;
      db_now: Date;
    }>(`
      SELECT
        (date_trunc('month', timezone('Asia/Kolkata', now())) AT TIME ZONE 'Asia/Kolkata') AS month_start,
        ((date_trunc('month', timezone('Asia/Kolkata', now())) + interval '1 month') AT TIME ZONE 'Asia/Kolkata') AS next_month_start,
        ((date_trunc('month', timezone('Asia/Kolkata', now())) + interval '1 month - 1 second') AT TIME ZONE 'Asia/Kolkata') AS month_end,
        now() AS db_now
    `);
    const row = res.rows[0];
    return {
      weekStart: row.month_start,
      nextWeekStart: row.next_month_start,
      weekEnd: row.month_end,
      weekStartIso: row.month_start.toISOString(),
      nextWeekStartIso: row.next_month_start.toISOString(),
      weekEndIso: row.month_end.toISOString(),
      generatedAtIso: row.db_now.toISOString(),
      cycleStartIso: row.month_start.toISOString(),
    };
  }

  if (period === 'overall') {
    const res = await runner<{
      db_now: Date;
      month_start: Date;
    }>(`
      SELECT
        now() AS db_now,
        (date_trunc('month', timezone('Asia/Kolkata', now())) AT TIME ZONE 'Asia/Kolkata') AS month_start
    `);
    const row = res.rows[0];
    const start = new Date('1970-01-01T00:00:00.000Z');
    const end = new Date('2099-12-31T23:59:59.000Z');
    return {
      weekStart: start,
      nextWeekStart: end,
      weekEnd: end,
      weekStartIso: start.toISOString(),
      nextWeekStartIso: end.toISOString(),
      weekEndIso: end.toISOString(),
      generatedAtIso: row.db_now.toISOString(),
      cycleStartIso: row.month_start.toISOString(),
    };
  }

  // Default to weekly
  return getDbWeekWindow(client);
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
        u.avatar_key,
        SUM(mg.net_winnings) AS total_winnings,
        MAX(mg.latest_win_time) AS most_recent_win_time
      FROM match_groups mg
      JOIN users u ON u.id = mg.user_id
      WHERE u.deleted_at IS NULL
      GROUP BY mg.user_id, u.ff_name, u.avatar_key
      HAVING SUM(mg.net_winnings) > 0
    ),
    ranked_leaderboard AS (
      SELECT
        uw.user_id,
        uw.name,
        uw.avatar_key,
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
    SELECT rank, name, avatar_key, total_winnings
    FROM ranked_leaderboard
    WHERE rank <= 50
    ORDER BY rank ASC
  `);

  const res = await query<{
    rank: string | number;
    name: string;
    avatar_key: string | null;
    total_winnings: string | number;
  }>(sql, [window.weekStart, window.nextWeekStart]);

  const entries = await Promise.all(
    res.rows.map(async (row) => {
      let avatarUrl: string | undefined = undefined;
      if (row.avatar_key) {
        try {
          const signed = await getSignedUrl(row.avatar_key, 86400);
          if (signed) avatarUrl = signed;
        } catch {
          avatarUrl = undefined;
        }
      }
      const entry: {
        rank: number;
        name: string;
        avatarUrl?: string;
        winnings: string;
      } = {
        rank: Number(row.rank),
        name: row.name,
        winnings: paiseToString(stringToPaise(String(row.total_winnings))),
      };
      if (avatarUrl) {
        entry.avatarUrl = avatarUrl;
      }
      return entry;
    })
  );

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
export async function getLeaderboard(period: LeaderboardPeriod = 'weekly'): Promise<LeaderboardResponse> {
  const validPeriod: LeaderboardPeriod =
    period === 'monthly' || period === 'overall' ? period : 'weekly';
  const window = await getDbLeaderboardWindow(validPeriod);
  const now = Date.now();
  const cached = cachedLeaderboards.get(validPeriod);

  if (
    cached &&
    cached.cycleStartIso === window.cycleStartIso &&
    now < cached.expiresAt
  ) {
    return cached.data;
  }

  const inFlight = inFlightPromises.get(validPeriod);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async () => {
    try {
      const data = await computeLeaderboard(window);
      cachedLeaderboards.set(validPeriod, {
        data,
        expiresAt: Date.now() + 60_000,
        startIso: window.weekStartIso,
        cycleStartIso: window.cycleStartIso,
      });
      return data;
    } finally {
      inFlightPromises.delete(validPeriod);
    }
  })();

  inFlightPromises.set(validPeriod, promise);
  return promise;
}

export interface LeaderboardRefreshResult {
  weekly: boolean;
  monthly: boolean;
  overall: boolean;
  timestamp: string;
}

/**
 * Background periodic check to refresh leaderboards when periods rollover:
 * - Weekly refresh on every week (Monday 00:00:00 IST).
 * - Monthly refresh on every month (1st of month 00:00:00 IST).
 * - Overall refresh on every month (1st of month 00:00:00 IST).
 */
export async function checkAndRefreshLeaderboards(client?: PoolClient): Promise<LeaderboardRefreshResult> {
  const runner = client ? client.query.bind(client) : query;

  const clockRes = await runner<{
    week_start: Date;
    month_start: Date;
    db_now: Date;
  }>(`
    SELECT
      (date_trunc('week', timezone('Asia/Kolkata', now())) AT TIME ZONE 'Asia/Kolkata') AS week_start,
      (date_trunc('month', timezone('Asia/Kolkata', now())) AT TIME ZONE 'Asia/Kolkata') AS month_start,
      now() AS db_now
  `);

  const { week_start: weekStart, month_start: monthStart, db_now: dbNow } = clockRes.rows[0];
  const weekStartIso = weekStart.toISOString();
  const monthStartIso = monthStart.toISOString();

  const settingsRes = await runner<{ key: string; value: string }>(`
    SELECT key, value FROM app_settings
    WHERE key IN (
      'leaderboard_last_weekly_refresh',
      'leaderboard_last_monthly_refresh',
      'leaderboard_last_overall_refresh'
    )
  `);

  const settingsMap = new Map(settingsRes.rows.map((r) => [r.key, r.value]));
  const lastWeekly = settingsMap.get('leaderboard_last_weekly_refresh');
  const lastMonthly = settingsMap.get('leaderboard_last_monthly_refresh');
  const lastOverall = settingsMap.get('leaderboard_last_overall_refresh');

  const result: LeaderboardRefreshResult = {
    weekly: false,
    monthly: false,
    overall: false,
    timestamp: dbNow.toISOString(),
  };

  // Weekly refresh on every week
  if (!lastWeekly || lastWeekly !== weekStartIso) {
    invalidateLeaderboardCache('weekly');
    await getLeaderboard('weekly');
    await runner(
      `INSERT INTO app_settings (key, value)
       VALUES ('leaderboard_last_weekly_refresh', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [weekStartIso]
    );
    result.weekly = true;
    logger.info({ weekStartIso }, '[Leaderboard Scheduler] Weekly leaderboard refreshed for week');
  }

  // Monthly refresh on every month
  if (!lastMonthly || lastMonthly !== monthStartIso) {
    invalidateLeaderboardCache('monthly');
    await getLeaderboard('monthly');
    await runner(
      `INSERT INTO app_settings (key, value)
       VALUES ('leaderboard_last_monthly_refresh', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [monthStartIso]
    );
    result.monthly = true;
    logger.info({ monthStartIso }, '[Leaderboard Scheduler] Monthly leaderboard refreshed for month');
  }

  // Overall refresh on every month
  if (!lastOverall || lastOverall !== monthStartIso) {
    invalidateLeaderboardCache('overall');
    await getLeaderboard('overall');
    await runner(
      `INSERT INTO app_settings (key, value)
       VALUES ('leaderboard_last_overall_refresh', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [monthStartIso]
    );
    result.overall = true;
    logger.info({ monthStartIso }, '[Leaderboard Scheduler] Overall leaderboard refreshed for month');
  }

  return result;
}

/**
 * Force refresh specific or all leaderboard periods immediately.
 */
export async function forceRefreshLeaderboards(
  periods: LeaderboardPeriod[] = ['weekly', 'monthly', 'overall'],
  client?: PoolClient
): Promise<Record<LeaderboardPeriod, LeaderboardResponse>> {
  const runner = client ? client.query.bind(client) : query;
  const res: Partial<Record<LeaderboardPeriod, LeaderboardResponse>> = {};

  const clockRes = await runner<{
    week_start: Date;
    month_start: Date;
  }>(`
    SELECT
      (date_trunc('week', timezone('Asia/Kolkata', now())) AT TIME ZONE 'Asia/Kolkata') AS week_start,
      (date_trunc('month', timezone('Asia/Kolkata', now())) AT TIME ZONE 'Asia/Kolkata') AS month_start
  `);
  const weekStartIso = clockRes.rows[0].week_start.toISOString();
  const monthStartIso = clockRes.rows[0].month_start.toISOString();

  for (const period of periods) {
    invalidateLeaderboardCache(period);
    const data = await getLeaderboard(period);
    res[period] = data;

    if (period === 'weekly') {
      await runner(
        `INSERT INTO app_settings (key, value)
         VALUES ('leaderboard_last_weekly_refresh', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [weekStartIso]
      );
    } else if (period === 'monthly') {
      await runner(
        `INSERT INTO app_settings (key, value)
         VALUES ('leaderboard_last_monthly_refresh', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [monthStartIso]
      );
    } else if (period === 'overall') {
      await runner(
        `INSERT INTO app_settings (key, value)
         VALUES ('leaderboard_last_overall_refresh', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [monthStartIso]
      );
    }
  }

  return res as Record<LeaderboardPeriod, LeaderboardResponse>;
}

/**
 * Convenience alias for weekly leaderboard.
 */
export async function getWeeklyLeaderboard(): Promise<LeaderboardResponse> {
  return getLeaderboard('weekly');
}

/**
 * Gets a logged-in user's own rank and total winnings for the requested period window.
 * Returns null if the user has no winnings or net <= 0.
 */
export async function getUserLeaderboardRank(
  userId: string,
  period: LeaderboardPeriod = 'weekly'
): Promise<LeaderboardRankResponse> {
  const validPeriod: LeaderboardPeriod =
    period === 'monthly' || period === 'overall' ? period : 'weekly';
  const window = await getDbLeaderboardWindow(validPeriod);
  const sql = buildRankingCteSql(`
    SELECT rank, avatar_key, total_winnings
    FROM ranked_leaderboard
    WHERE user_id = $3
  `);

  const res = await query<{
    rank: string | number;
    avatar_key: string | null;
    total_winnings: string | number;
  }>(sql, [window.weekStart, window.nextWeekStart, userId]);

  if (!res.rows.length) {
    return null;
  }

  const row = res.rows[0];
  let avatarUrl: string | undefined = undefined;
  if (row.avatar_key) {
    try {
      const signed = await getSignedUrl(row.avatar_key, 86400);
      if (signed) avatarUrl = signed;
    } catch {
      avatarUrl = undefined;
    }
  }

  const result: {
    rank: number;
    avatarUrl?: string;
    winnings: string;
  } = {
    rank: Number(row.rank),
    winnings: paiseToString(stringToPaise(String(row.total_winnings))),
  };
  if (avatarUrl) {
    result.avatarUrl = avatarUrl;
  }
  return result;
}
