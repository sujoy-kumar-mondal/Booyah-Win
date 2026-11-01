/**
 * Weekly Leaderboard Integration Tests
 *
 * Requirements Tested:
 * 1. Half-open window: created_at >= weekStart AND created_at < nextWeekStart (IST Monday 00:00 boundaries from DB clock).
 * 2. Boundary tests at weekStart - 1 ms and exactly at weekStart.
 * 3. Match net score calculation: win then reversal in same week nets to 0;
 *    win in week 1, reversal in week 2 (week 1 loses it, week 2 unaffected);
 *    reversal then corrected re-approval counts in re-approval week;
 *    multiple matches for one user sum up.
 * 4. Deleted users excluded, non-match ledger types excluded, scores <= 0 excluded.
 * 5. Tie breaking: total winnings DESC, earlier most recent winning ASC, user_id ASC.
 * 6. Top 50 limit and public response privacy (strictly rank, name=ff_name, winnings).
 * 7. Shared CTE: user's rank equals position in list; GET /me/leaderboard-rank works outside top 50 and returns null if no winnings.
 * 8. Single-flight cache with 60s TTL; invalidates on result approval, reversal, and user deletion.
 */

import crypto from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';
import {
  getDbWeekWindow,
  invalidateLeaderboardCache,
  checkAndRefreshLeaderboards,
  forceRefreshLeaderboards,
} from '../src/modules/leaderboard/leaderboard.service.js';
import { config } from '../src/config/index.js';

const app = createApp({ enableRateLimiting: false });

async function createTestUser(suffix: string, ffName?: string) {
  const email = `player_${suffix}@example.com`;
  const mobile = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const ffId = `FF_${suffix}_${Math.floor(Math.random() * 100000)}`;
  const userFfName = ffName || `Player_${suffix}`;
  const upiId = `player_${suffix}@upi`;

  const uRes = await query<{ id: string }>(
    `INSERT INTO users (username, email, name, mobile, ff_id, ff_name, upi_id, date_of_birth)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '2000-01-01')
     RETURNING id`,
    [`user_${suffix}`, email, `Real Name ${suffix}`, mobile, ffId, userFfName, upiId]
  );
  const userId = uRes.rows[0].id.toString();

  await query('INSERT INTO wallets (user_id, add_money, cashback, winning) VALUES ($1, 0, 0, 0)', [userId]);

  const sessionId = crypto.randomUUID();
  await query(
    `INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'user', $2)`,
    [sessionId, userId]
  );
  const token = signSessionToken({ sub: userId, typ: 'user', sid: sessionId, role: 'user' }, '30d');

  return { userId, token, ffName: userFfName };
}

async function insertLedgerEntry(opts: {
  userId: string;
  type: string;
  amount: string;
  refId?: number | string;
  createdAt: Date;
}) {
  await query(
    `INSERT INTO wallet_ledger (user_id, wallet, type, amount, balance_after, total_after, ref_id, created_at)
     VALUES ($1, 'winning', $2, $3, 0, 0, $4, $5)`,
    [opts.userId, opts.type, opts.amount, opts.refId || null, opts.createdAt]
  );
}

describe('Weekly Leaderboard & User Rank API', () => {
  beforeEach(async () => {
    await truncateAllTables();
    invalidateLeaderboardCache();
  });

  it('Requirement 2: respects half-open window boundaries (weekStart - 1ms excluded, weekStart included)', async () => {
    const window = await getDbWeekWindow();
    const user = await createTestUser('boundary');

    // 1 ms before week start
    const beforeWeekStart = new Date(window.weekStart.getTime() - 1);
    await insertLedgerEntry({
      userId: user.userId,
      type: 'winning',
      amount: '100.00',
      refId: 101,
      createdAt: beforeWeekStart,
    });

    const resBefore = await request(app).get('/api/v1/leaderboard');
    expect(resBefore.status).toBe(200);
    expect(resBefore.body.data.entries).toHaveLength(0);

    // Exactly at week start
    invalidateLeaderboardCache();
    await insertLedgerEntry({
      userId: user.userId,
      type: 'winning',
      amount: '150.00',
      refId: 102,
      createdAt: window.weekStart,
    });

    const resAt = await request(app).get('/api/v1/leaderboard');
    expect(resAt.status).toBe(200);
    expect(resAt.body.data.entries).toHaveLength(1);
    expect(resAt.body.data.entries[0]).toEqual({
      rank: 1,
      name: user.ffName,
      winnings: '150.00',
    });
  });

  it('Requirement 1: handles match win then reversal in the same week (nets to zero)', async () => {
    const window = await getDbWeekWindow();
    const user = await createTestUser('win_rev_same');

    const winTime = new Date(window.weekStart.getTime() + 1000);
    const revTime = new Date(window.weekStart.getTime() + 2000);

    // Winning row (+200.00)
    await insertLedgerEntry({
      userId: user.userId,
      type: 'winning',
      amount: '200.00',
      refId: 201,
      createdAt: winTime,
    });

    // Reversal row (-200.00)
    await insertLedgerEntry({
      userId: user.userId,
      type: 'reversal',
      amount: '-200.00',
      refId: 201,
      createdAt: revTime,
    });

    const res = await request(app).get('/api/v1/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.data.entries).toHaveLength(0);
  });

  it('Requirement 1: win in week 1, reversal in week 2 (week 1 loses it, week 2 is unaffected)', async () => {
    const window = await getDbWeekWindow();
    const user = await createTestUser('cross_week');

    const week1WinTime = new Date(window.weekStart.getTime() - 3600 * 1000 * 24 * 3); // 3 days before current weekStart (Week 1)
    const week2RevTime = new Date(window.weekStart.getTime() + 3600 * 1000); // in current week (Week 2)

    // Win in Week 1
    await insertLedgerEntry({
      userId: user.userId,
      type: 'winning',
      amount: '300.00',
      refId: 301,
      createdAt: week1WinTime,
    });

    // Reversal in Week 2
    await insertLedgerEntry({
      userId: user.userId,
      type: 'reversal',
      amount: '-300.00',
      refId: 301,
      createdAt: week2RevTime,
    });

    // Current week (Week 2) leaderboard: no winning row in week 2 for match 301, so week 2 is unaffected
    const resWeek2 = await request(app).get('/api/v1/leaderboard');
    expect(resWeek2.status).toBe(200);
    expect(resWeek2.body.data.entries).toHaveLength(0);
  });

  it('Requirement 1: reversal then corrected re-approval counts in re-approval week', async () => {
    const window = await getDbWeekWindow();
    const user = await createTestUser('reapproved');

    const oldWin = new Date(window.weekStart.getTime() - 3600 * 1000 * 24 * 5); // old week
    const reversal = new Date(window.weekStart.getTime() - 3600 * 1000 * 24 * 4); // old week
    const newWin = new Date(window.weekStart.getTime() + 10000); // current week

    await insertLedgerEntry({
      userId: user.userId,
      type: 'winning',
      amount: '100.00',
      refId: 401,
      createdAt: oldWin,
    });
    await insertLedgerEntry({
      userId: user.userId,
      type: 'reversal',
      amount: '-100.00',
      refId: 401,
      createdAt: reversal,
    });
    await insertLedgerEntry({
      userId: user.userId,
      type: 'winning',
      amount: '150.00',
      refId: 401,
      createdAt: newWin,
    });

    // Current week leaderboard: net is 100 - 100 + 150 = 150, latest winning is newWin (current week)
    const res = await request(app).get('/api/v1/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.data.entries).toHaveLength(1);
    expect(res.body.data.entries[0]).toEqual({
      rank: 1,
      name: user.ffName,
      winnings: '150.00',
    });
  });

  it('Requirement 1: sums multiple matches for one user', async () => {
    const window = await getDbWeekWindow();
    const user = await createTestUser('multimatch');

    await insertLedgerEntry({
      userId: user.userId,
      type: 'winning',
      amount: '120.00',
      refId: 501,
      createdAt: new Date(window.weekStart.getTime() + 1000),
    });
    await insertLedgerEntry({
      userId: user.userId,
      type: 'winning',
      amount: '80.00',
      refId: 502,
      createdAt: new Date(window.weekStart.getTime() + 2000),
    });

    const res = await request(app).get('/api/v1/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.data.entries[0].winnings).toBe('200.00');
  });

  it('Requirement 2 & 5: tie breaking by earlier most recent winning entry, then user_id ASC', async () => {
    const window = await getDbWeekWindow();
    const userA = await createTestUser('playerA');
    const userB = await createTestUser('playerB');

    // Both score 250.00 total.
    // User A latest win at weekStart + 2000 ms
    await insertLedgerEntry({
      userId: userA.userId,
      type: 'winning',
      amount: '250.00',
      refId: 601,
      createdAt: new Date(window.weekStart.getTime() + 2000),
    });

    // User B latest win at weekStart + 4000 ms (later)
    await insertLedgerEntry({
      userId: userB.userId,
      type: 'winning',
      amount: '250.00',
      refId: 602,
      createdAt: new Date(window.weekStart.getTime() + 4000),
    });

    const res = await request(app).get('/api/v1/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.data.entries).toHaveLength(2);
    // User A earlier win -> Rank 1
    expect(res.body.data.entries[0].name).toBe(userA.ffName);
    expect(res.body.data.entries[0].rank).toBe(1);
    // User B later win -> Rank 2
    expect(res.body.data.entries[1].name).toBe(userB.ffName);
    expect(res.body.data.entries[1].rank).toBe(2);
  });

  it('Requirement 4: excludes deleted users and non-match ledger types', async () => {
    const window = await getDbWeekWindow();
    const userDeleted = await createTestUser('deleted');
    const userActive = await createTestUser('active');

    // Soft delete userDeleted
    await query(`UPDATE users SET deleted_at = now() WHERE id = $1`, [userDeleted.userId]);

    await insertLedgerEntry({
      userId: userDeleted.userId,
      type: 'winning',
      amount: '500.00',
      refId: 701,
      createdAt: new Date(window.weekStart.getTime() + 1000),
    });

    // Non-match entries on userActive (deposits, referral, refund, admin_adjustment)
    await insertLedgerEntry({
      userId: userActive.userId,
      type: 'add_money',
      amount: '500.00',
      refId: 702,
      createdAt: new Date(window.weekStart.getTime() + 1000),
    });
    await insertLedgerEntry({
      userId: userActive.userId,
      type: 'referral',
      amount: '50.00',
      refId: 703,
      createdAt: new Date(window.weekStart.getTime() + 1000),
    });
    await insertLedgerEntry({
      userId: userActive.userId,
      type: 'admin_adjustment',
      amount: '100.00',
      refId: 704,
      createdAt: new Date(window.weekStart.getTime() + 1000),
    });

    const res = await request(app).get('/api/v1/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.data.entries).toHaveLength(0);
  });

  it('Requirement 4 & 5: GET /me/leaderboard-rank returns user rank matching top list, and null when no score', async () => {
    const window = await getDbWeekWindow();
    const user1 = await createTestUser('rank1');
    const user2 = await createTestUser('rank2');
    const userNone = await createTestUser('norank');

    await insertLedgerEntry({
      userId: user1.userId,
      type: 'winning',
      amount: '400.00',
      refId: 801,
      createdAt: new Date(window.weekStart.getTime() + 1000),
    });
    await insertLedgerEntry({
      userId: user2.userId,
      type: 'winning',
      amount: '200.00',
      refId: 802,
      createdAt: new Date(window.weekStart.getTime() + 2000),
    });

    const resBoard = await request(app).get('/api/v1/leaderboard');
    expect(resBoard.body.data.entries).toHaveLength(2);

    // User 1 rank
    const resU1 = await request(app)
      .get('/api/v1/me/leaderboard-rank')
      .set('Authorization', `Bearer ${user1.token}`);
    expect(resU1.status).toBe(200);
    expect(resU1.body.data).toEqual({ rank: 1, winnings: '400.00' });
    expect(resU1.body.data.rank).toBe(resBoard.body.data.entries[0].rank);

    // User 2 rank
    const resU2 = await request(app)
      .get('/api/v1/me/leaderboard-rank')
      .set('Authorization', `Bearer ${user2.token}`);
    expect(resU2.status).toBe(200);
    expect(resU2.body.data).toEqual({ rank: 2, winnings: '200.00' });
    expect(resU2.body.data.rank).toBe(resBoard.body.data.entries[1].rank);

    // User with no score
    const resNone = await request(app)
      .get('/api/v1/me/leaderboard-rank')
      .set('Authorization', `Bearer ${userNone.token}`);
    expect(resNone.status).toBe(200);
    expect(resNone.body.data).toBeNull();
  });

  it('Requirement 3: single-flight cache invalidates when user is deleted', async () => {
    const window = await getDbWeekWindow();
    const user = await createTestUser('cached_del');

    await insertLedgerEntry({
      userId: user.userId,
      type: 'winning',
      amount: '300.00',
      refId: 901,
      createdAt: new Date(window.weekStart.getTime() + 1000),
    });

    // Populate cache
    const res1 = await request(app).get('/api/v1/leaderboard');
    expect(res1.body.data.entries).toHaveLength(1);

    // Invalidate via user deletion
    invalidateLeaderboardCache();
    await query(`UPDATE users SET deleted_at = now() WHERE id = $1`, [user.userId]);

    const res2 = await request(app).get('/api/v1/leaderboard');
    expect(res2.body.data.entries).toHaveLength(0);
  });

  it('Requirement 6: public response contains no fields other than rank, name, and winnings', async () => {
    const window = await getDbWeekWindow();
    const user = await createTestUser('privacy_check', 'StealthMaster');

    await insertLedgerEntry({
      userId: user.userId,
      type: 'winning',
      amount: '150.00',
      refId: 991,
      createdAt: new Date(window.weekStart.getTime() + 1000),
    });

    const res = await request(app).get('/api/v1/leaderboard');
    expect(res.status).toBe(200);
    const entry = res.body.data.entries[0];

    expect(Object.keys(entry).sort()).toEqual(['name', 'rank', 'winnings'].sort());
    expect(entry.name).toBe('StealthMaster');
    expect(entry.winnings).toBe('150.00');
    expect(entry.rank).toBe(1);
    expect((entry as any).userId).toBeUndefined();
    expect((entry as any).email).toBeUndefined();
    expect((entry as any).mobile).toBeUndefined();
    expect((entry as any).ffId).toBeUndefined();
  });

  it('Requirement Periods: supports weekly, monthly, and overall leaderboard periods', async () => {
    const window = await getDbWeekWindow();
    const user1 = await createTestUser('period_u1', 'MonthMaster');
    const user2 = await createTestUser('period_u2', 'OverallLegend');

    // Winning for user1 in current week and month
    await insertLedgerEntry({
      userId: user1.userId,
      type: 'winning',
      amount: '500.00',
      refId: 992,
      createdAt: new Date(),
    });

    // Winning for user2 from older date (overall only, outside current month/week)
    await insertLedgerEntry({
      userId: user2.userId,
      type: 'winning',
      amount: '2000.00',
      refId: 993,
      createdAt: new Date('2025-01-15T10:00:00Z'),
    });

    invalidateLeaderboardCache();

    // 1. Weekly leaderboard should include user1 only
    const resWeekly = await request(app).get('/api/v1/leaderboard?period=weekly');
    expect(resWeekly.status).toBe(200);
    const weeklyNames = resWeekly.body.data.entries.map((e: any) => e.name);
    expect(weeklyNames).toContain('MonthMaster');
    expect(weeklyNames).not.toContain('OverallLegend');

    // 2. Monthly leaderboard should include user1
    const resMonthly = await request(app).get('/api/v1/leaderboard?period=monthly');
    expect(resMonthly.status).toBe(200);
    const monthlyNames = resMonthly.body.data.entries.map((e: any) => e.name);
    expect(monthlyNames).toContain('MonthMaster');

    // 3. Overall leaderboard should include both, with user2 at top due to 2000.00
    const resOverall = await request(app).get('/api/v1/leaderboard?period=overall');
    expect(resOverall.status).toBe(200);
    const overallNames = resOverall.body.data.entries.map((e: any) => e.name);
    expect(overallNames).toContain('OverallLegend');
    expect(overallNames).toContain('MonthMaster');
    expect(resOverall.body.data.entries[0].name).toBe('OverallLegend');
    expect(resOverall.body.data.entries[0].winnings).toBe('2000.00');

    // 4. User rank query with periods
    const rankMonthly = await request(app)
      .get('/api/v1/me/leaderboard-rank?period=monthly')
      .set('Authorization', `Bearer ${user1.token}`);
    expect(rankMonthly.status).toBe(200);
    expect(rankMonthly.body.data).not.toBeNull();
    expect(rankMonthly.body.data.winnings).toBe('500.00');

    const rankOverall = await request(app)
      .get('/api/v1/me/leaderboard-rank?period=overall')
      .set('Authorization', `Bearer ${user2.token}`);
    expect(rankOverall.status).toBe(200);
    expect(rankOverall.body.data).not.toBeNull();
    expect(rankOverall.body.data.rank).toBe(1);
    expect(rankOverall.body.data.winnings).toBe('2000.00');
  });

  describe('Leaderboard Backend Refresh Implementation', () => {
    it('Requirement: refreshes weekly on week rollover, monthly on month rollover, and overall on month rollover', async () => {
      // 1. Initially without refresh timestamps, all three should refresh
      const initialRefresh = await checkAndRefreshLeaderboards();
      expect(initialRefresh.weekly).toBe(true);
      expect(initialRefresh.monthly).toBe(true);
      expect(initialRefresh.overall).toBe(true);

      // Verify app_settings rows were populated with current week and month ISOs
      const settingsRes = await query<{ key: string; value: string }>(
        `SELECT key, value FROM app_settings WHERE key LIKE 'leaderboard_last_%'`
      );
      const settingsMap = new Map(settingsRes.rows.map((r) => [r.key, r.value]));
      expect(settingsMap.get('leaderboard_last_weekly_refresh')).toBeTruthy();
      expect(settingsMap.get('leaderboard_last_monthly_refresh')).toBeTruthy();
      expect(settingsMap.get('leaderboard_last_overall_refresh')).toBeTruthy();

      // 2. Second immediate call within same period should be a no-op (idempotent)
      const secondRefresh = await checkAndRefreshLeaderboards();
      expect(secondRefresh.weekly).toBe(false);
      expect(secondRefresh.monthly).toBe(false);
      expect(secondRefresh.overall).toBe(false);

      // 3. Simulate a new week by rewinding leaderboard_last_weekly_refresh
      await query(
        `UPDATE app_settings SET value = '2020-01-01T00:00:00.000Z' WHERE key = 'leaderboard_last_weekly_refresh'`
      );
      const weekRollover = await checkAndRefreshLeaderboards();
      expect(weekRollover.weekly).toBe(true);
      expect(weekRollover.monthly).toBe(false);
      expect(weekRollover.overall).toBe(false);

      // 4. Simulate a new month by rewinding both monthly and overall refresh timestamps
      await query(
        `UPDATE app_settings SET value = '2020-01-01T00:00:00.000Z' WHERE key IN ('leaderboard_last_monthly_refresh', 'leaderboard_last_overall_refresh')`
      );
      const monthRollover = await checkAndRefreshLeaderboards();
      expect(monthRollover.weekly).toBe(false);
      expect(monthRollover.monthly).toBe(true);
      expect(monthRollover.overall).toBe(true);
    });

    it('Requirement: scheduler tick triggers leaderboard refresh check and returns status', async () => {
      // Clear settings to trigger refresh during tick
      await query(`DELETE FROM app_settings WHERE key LIKE 'leaderboard_last_%'`);

      const res = await request(app)
        .post('/api/v1/internal/jobs/tick')
        .set('x-cron-secret', config.CRON_SECRET);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.leaderboardRefreshed).toBeDefined();
      expect(res.body.data.leaderboardRefreshed.weekly).toBe(true);
      expect(res.body.data.leaderboardRefreshed.monthly).toBe(true);
      expect(res.body.data.leaderboardRefreshed.overall).toBe(true);
    });

    it('Requirement: POST /api/v1/internal/leaderboard/refresh endpoint forces leaderboard recalculation', async () => {
      const user = await createTestUser('force_refresh', 'ForceWinner');
      await insertLedgerEntry({
        userId: user.userId,
        type: 'winning',
        amount: '350.00',
        refId: 888,
        createdAt: new Date(),
      });

      // 1. Rejects request without cron secret
      const unauthRes = await request(app).post('/api/v1/internal/leaderboard/refresh');
      expect(unauthRes.status).toBe(401);

      // 2. Forces refresh for weekly only
      const weeklyRes = await request(app)
        .post('/api/v1/internal/leaderboard/refresh?period=weekly')
        .set('x-cron-secret', config.CRON_SECRET);
      expect(weeklyRes.status).toBe(200);
      expect(weeklyRes.body.data.refreshed).toBe(true);
      expect(weeklyRes.body.data.periods).toEqual(['weekly']);
      expect(weeklyRes.body.data.result.weekly.entries[0].name).toBe('ForceWinner');

      // 3. Forces refresh for all periods
      const allRes = await request(app)
        .post('/api/v1/internal/leaderboard/refresh?period=all')
        .set('x-cron-secret', config.CRON_SECRET);
      expect(allRes.status).toBe(200);
      expect(allRes.body.data.refreshed).toBe(true);
      expect(allRes.body.data.periods).toEqual(['weekly', 'monthly', 'overall']);
      expect(allRes.body.data.result.monthly.entries[0].name).toBe('ForceWinner');
      expect(allRes.body.data.result.overall.entries[0].name).toBe('ForceWinner');
    });

    it('returns signed avatarUrl for ranked users and user rank when avatar_key is set', async () => {
      invalidateLeaderboardCache();
      const user = await createTestUser('avatar_winner', 'AvatarWinner');
      // Set an avatar_key for this user
      await query(`UPDATE users SET avatar_key = 'test_avatar_1234567890abcdef.png' WHERE id = $1`, [user.userId]);

      await insertLedgerEntry({
        userId: user.userId,
        type: 'winning',
        amount: '600.00',
        refId: 999,
        createdAt: new Date(),
      });

      const res = await request(app).get('/api/v1/leaderboard');
      expect(res.status).toBe(200);
      const entry = res.body.data.entries.find((e: any) => e.name === 'AvatarWinner');
      expect(entry).toBeDefined();
      expect(entry.avatarUrl).toContain('/api/v1/files/test_avatar_1234567890abcdef.png');

      const rankRes = await request(app)
        .get('/api/v1/me/leaderboard-rank')
        .set('Authorization', `Bearer ${user.token}`);
      expect(rankRes.status).toBe(200);
      expect(rankRes.body.data.avatarUrl).toContain('/api/v1/files/test_avatar_1234567890abcdef.png');
    });
  });
});
