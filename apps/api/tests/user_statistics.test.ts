import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';

const app = createApp({ enableRateLimiting: false });

let counter = 5000;
function next(): number {
  return ++counter;
}

async function createTestUser(): Promise<{ id: string; token: string }> {
  const i = next();
  const mobile = '9' + String(i).padStart(9, '0');
  const res = await query(
    `INSERT INTO users (username, email, name, mobile, ff_id, ff_name, upi_id, date_of_birth)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '1995-01-01')
     RETURNING id`,
    [
      `player_${i}`,
      `player${i}@test.com`,
      `Player ${i}`,
      mobile,
      `FF${String(i).padStart(8, '0')}`,
      `FFName${i}`,
      `player${i}@upi`,
    ]
  );
  const userId = res.rows[0].id.toString();
  await query('INSERT INTO wallets (user_id) VALUES ($1)', [userId]);

  const sid = crypto.randomUUID();
  await query('INSERT INTO sessions (id, account_type, account_id) VALUES ($1, $2, $3)', [
    sid,
    'user',
    userId,
  ]);
  const token = signSessionToken({ sub: userId, typ: 'user', sid }, '1h');
  return { id: userId, token };
}

async function createTestStaff(): Promise<string> {
  const res = await query(
    `INSERT INTO staff (role, name, email, mobile) VALUES ('admin', 'Admin Staff', 'admin_stats@bw.in', '9898989898') RETURNING id`
  );
  return res.rows[0].id.toString();
}

async function createTestTier(): Promise<string> {
  const res = await query(
    `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
     VALUES ('battle_royale', 'solo', '10.00', '5.00', 1, 48, 2)
     RETURNING id`
  );
  return res.rows[0].id.toString();
}

describe('User Statistics and Community APIs', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  it('GET /api/v1/community returns default community links', async () => {
    const res = await request(app).get('/api/v1/community').expect(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.whatsapp).toContain('whatsapp.com');
    expect(res.body.data.instagram).toContain('instagram.com');
    expect(res.body.data.telegram).toContain('t.me');
    expect(res.body.data.youtube).toContain('youtube.com');
  });

  it('GET /api/v1/me/statistics rejects unauthenticated requests with 401', async () => {
    await request(app).get('/api/v1/me/statistics').expect(401);
  });

  it('GET /api/v1/me/statistics returns 0 stats when user has played 0 matches', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .get('/api/v1/me/statistics')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toEqual({
      played: 0,
      kills: 0,
      totalWinnings: '0.00',
    });
  });

  it('GET /api/v1/me/statistics aggregates played count, kills, and winnings for completed matches only', async () => {
    const { id: userId, token } = await createTestUser();
    const staffId = await createTestStaff();
    const tierId = await createTestTier();

    // 1. Completed match with 3 kills and 50 payout
    const m1 = await query(
      `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, position_prizes, min_players, max_players, start_time, status, created_by)
       VALUES ($1, 'battle_royale', 'solo', '10.00', '5.00', 1, '[]'::jsonb, 2, 48, now() - interval '2 hours', 'completed', $2)
       RETURNING id`,
      [tierId, staffId]
    );
    await query(
      `INSERT INTO match_players (match_id, user_id, paid_add_money, kills, position, payout)
       VALUES ($1, $2, '10.00', 3, 1, '50.00')`,
      [m1.rows[0].id, userId]
    );

    // 2. Completed match with 2 kills and 10 payout
    const m2 = await query(
      `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, position_prizes, min_players, max_players, start_time, status, created_by)
       VALUES ($1, 'battle_royale', 'solo', '10.00', '5.00', 1, '[]'::jsonb, 2, 48, now() - interval '1 hour', 'completed', $2)
       RETURNING id`,
      [tierId, staffId]
    );
    await query(
      `INSERT INTO match_players (match_id, user_id, paid_add_money, kills, position, payout)
       VALUES ($1, $2, '10.00', 2, 5, '10.00')`,
      [m2.rows[0].id, userId]
    );

    // 3. Cancelled/refunded match (should NOT count toward played)
    const m3 = await query(
      `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, position_prizes, min_players, max_players, start_time, status, created_by)
       VALUES ($1, 'battle_royale', 'solo', '10.00', '5.00', 1, '[]'::jsonb, 2, 48, now() - interval '30 mins', 'cancelled', $2)
       RETURNING id`,
      [tierId, staffId]
    );
    await query(
      `INSERT INTO match_players (match_id, user_id, paid_add_money, kills, position, payout, refunded_at)
       VALUES ($1, $2, '10.00', 0, NULL, NULL, now())`,
      [m3.rows[0].id, userId]
    );

    // 4. Upcoming match (not yet played)
    const m4 = await query(
      `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, position_prizes, min_players, max_players, start_time, status, created_by)
       VALUES ($1, 'battle_royale', 'solo', '10.00', '5.00', 1, '[]'::jsonb, 2, 48, now() + interval '1 hour', 'upcoming', $2)
       RETURNING id`,
      [tierId, staffId]
    );
    await query(
      `INSERT INTO match_players (match_id, user_id, paid_add_money)
       VALUES ($1, $2, '10.00')`,
      [m4.rows[0].id, userId]
    );

    // Fetch stats
    const res = await request(app)
      .get('/api/v1/me/statistics')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toEqual({
      played: 2,
      kills: 5,
      totalWinnings: '60.00',
    });
  });
});

