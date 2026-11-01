import crypto from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { ErrorCodes } from '@booyah/shared';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';

describe('Public Matches (Logged Out Access & Join Protection)', () => {
  let app: any;

  beforeEach(async () => {
    app = createApp();
    await truncateAllTables();
  });

  async function insertMatch(teamMode = 'solo'): Promise<string> {
    const staffRes = await query<{ id: number }>(
      `INSERT INTO staff (role, name, email, mobile)
       VALUES ('admin', 'Admin User', 'admin@example.com', '9876543210')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const staffId = staffRes.rows[0].id;

    const tierRes = await query<{ id: number }>(
      `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
       VALUES ('battle_royale', $1, '20.00', '5.00', 2, 48, 2)
       RETURNING id`,
      [teamMode]
    );
    const tierId = tierRes.rows[0].id;

    const matchRes = await query<{ id: number }>(
      `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, position_prizes, min_players, max_players, start_time, created_by, status)
       VALUES ($1, 'battle_royale', $2, '20.00', '5.00', 2, '{"1": 100.00}'::jsonb, 2, 48, now() + INTERVAL '1 hour', $3, 'upcoming')
       RETURNING id`,
      [tierId, teamMode, staffId]
    );
    return matchRes.rows[0].id.toString();
  }

  it('allows unauthenticated logged-out players to fetch GET /api/v1/matches', async () => {
    const matchId = await insertMatch();

    const res = await request(app)
      .get('/api/v1/matches')
      .expect(200);

    expect(res.body.data.matches).toHaveLength(1);
    expect(res.body.data.matches[0].id).toBe(matchId);
    expect(res.body.data.matches[0].hasJoined).toBe(false);
    expect(res.body.data.matches[0].roomId).toBeUndefined();
    expect(res.body.data.matches[0].roomPassword).toBeUndefined();
  });

  it('allows players with invalid/expired tokens to fetch GET /api/v1/matches without 401', async () => {
    await insertMatch();

    const res = await request(app)
      .get('/api/v1/matches')
      .set('Authorization', 'Bearer invalid-or-expired-token-xyz')
      .expect(200);

    expect(res.body.data.matches).toHaveLength(1);
    expect(res.body.data.matches[0].hasJoined).toBe(false);
  });

  it('allows unauthenticated logged-out players to fetch GET /api/v1/matches/:id with credentials hidden', async () => {
    const matchId = await insertMatch();

    const res = await request(app)
      .get(`/api/v1/matches/${matchId}`)
      .expect(200);

    expect(res.body.data.match.id).toBe(matchId);
    expect(res.body.data.match.hasJoined).toBe(false);
    expect(res.body.data.match.roomId).toBeUndefined();
    expect(res.body.data.match.roomPassword).toBeUndefined();
  });

  it('rejects POST /api/v1/matches/:id/join with 401 UNAUTHENTICATED when unauthenticated', async () => {
    const matchId = await insertMatch();

    const res = await request(app)
      .post(`/api/v1/matches/${matchId}/join`)
      .expect(401);

    expect(res.body.error.code).toBe(ErrorCodes.UNAUTHENTICATED);
  });

  it('rejects POST /api/v1/matches/:id/teams with 401 UNAUTHENTICATED when unauthenticated', async () => {
    const matchId = await insertMatch('duo');

    const res = await request(app)
      .post(`/api/v1/matches/${matchId}/teams`)
      .send({ invites: ['9999999999'] })
      .expect(401);

    expect(res.body.error.code).toBe(ErrorCodes.UNAUTHENTICATED);
  });

  it('filters matches for my_matches status filter', async () => {
    const match1 = await insertMatch('solo');
    const match2 = await insertMatch('solo');

    // 1. Unauthenticated request to ?status=my_matches returns empty list
    const anonRes = await request(app)
      .get('/api/v1/matches?status=my_matches')
      .expect(200);
    expect(anonRes.body.data.matches).toHaveLength(0);

    // 2. Create user, session, and wallet
    const userRes = await query<{ id: number }>(
      `INSERT INTO users (username, email, name, mobile, ff_id, ff_name, upi_id, date_of_birth)
       VALUES ('my_match_user', 'my_match_user@example.com', 'Match User', '9123456789', 'FF12345678', 'ProPlayer', 'pro@upi', '2000-01-01')
       RETURNING id`
    );
    const userId = userRes.rows[0].id.toString();
    await query('INSERT INTO wallets (user_id, add_money) VALUES ($1, 100.00)', [userId]);
    const sid = crypto.randomUUID();
    await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'user', $2)`, [sid, userId]);
    const token = signSessionToken({ sub: userId, typ: 'user', sid }, '1h');

    // 3. User joins match1
    await query(
      `INSERT INTO match_players (match_id, user_id, paid_add_money)
       VALUES ($1, $2, '20.00')`,
      [match1, userId]
    );

    // 4. GET /api/v1/matches returns both matches with hasJoined marked
    const allRes = await request(app)
      .get('/api/v1/matches')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(allRes.body.data.matches).toHaveLength(2);

    // 5. GET /api/v1/matches?status=my_matches returns only match1 (since it is upcoming/active)
    const myRes = await request(app)
      .get('/api/v1/matches?status=my_matches')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(myRes.body.data.matches).toHaveLength(1);
    expect(myRes.body.data.matches[0].id).toBe(match1);
    expect(myRes.body.data.matches[0].hasJoined).toBe(true);

    // 6. When match1 is marked completed, it should NOT appear in my_matches
    await query(`UPDATE matches SET status = 'completed' WHERE id = $1`, [match1]);
    const afterCompletedRes = await request(app)
      .get('/api/v1/matches?status=my_matches')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(afterCompletedRes.body.data.matches).toHaveLength(0);
  });

  it('matches within 10 minutes cutoff are closed to registration, shown in live, hidden from upcoming, and inspectable', async () => {
    // matchFar: starts in 30 minutes (open)
    const matchFar = await insertMatch('solo');
    await query(`UPDATE matches SET start_time = now() + INTERVAL '30 minutes' WHERE id = $1`, [matchFar]);

    // matchNear: starts in 6 minutes (closed)
    const matchNear = await insertMatch('solo');
    await query(`UPDATE matches SET start_time = now() + INTERVAL '6 minutes' WHERE id = $1`, [matchNear]);

    // 1. Upcoming list only includes matchFar (> 10m away)
    const upcomingRes = await request(app)
      .get('/api/v1/matches?status=upcoming')
      .expect(200);
    const upcomingIds = upcomingRes.body.data.matches.map((m: any) => m.id);
    expect(upcomingIds).toContain(matchFar);
    expect(upcomingIds).not.toContain(matchNear);

    // 2. Live list includes matchNear (<= 10m away)
    const liveRes = await request(app)
      .get('/api/v1/matches?status=live')
      .expect(200);
    const liveIds = liveRes.body.data.matches.map((m: any) => m.id);
    expect(liveIds).toContain(matchNear);
    expect(liveIds).not.toContain(matchFar);

    // 3. User can inspect closed match details via GET /api/v1/matches/:id
    const inspectRes = await request(app)
      .get(`/api/v1/matches/${matchNear}`)
      .expect(200);
    expect(inspectRes.body.data.match.id).toBe(matchNear);

    // 4. Joining the closed match fails with 409 MATCH_NOT_JOINABLE
    const userRes = await query<{ id: number }>(
      `INSERT INTO users (username, email, name, mobile, ff_id, ff_name, upi_id, date_of_birth)
       VALUES ('cutoff_player', 'cutoff_player@example.com', 'Cutoff Player', '9876543299', 'FF88990011', 'CutoffPro', 'cutoff@upi', '2000-01-01')
       RETURNING id`
    );
    const userId = userRes.rows[0].id.toString();
    await query('INSERT INTO wallets (user_id, add_money) VALUES ($1, 100.00)', [userId]);
    const sid = crypto.randomUUID();
    await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'user', $2)`, [sid, userId]);
    const token = signSessionToken({ sub: userId, typ: 'user', sid }, '1h');

    const joinRes = await request(app)
      .post(`/api/v1/matches/${matchNear}/join`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(joinRes.body.error.code).toBe('MATCH_NOT_JOINABLE');
    expect(joinRes.body.error.message).toContain('closed');
  });

  it('completed section returns recent 50 matches including cancelled and completed matches', async () => {
    // 1. Create completed match
    const matchCompleted = await insertMatch('solo');
    await query(`UPDATE matches SET status = 'completed', start_time = now() - INTERVAL '2 hours' WHERE id = $1`, [matchCompleted]);

    // 2. Create cancelled match
    const matchCancelled = await insertMatch('solo');
    await query(`UPDATE matches SET status = 'cancelled', start_time = now() - INTERVAL '1 hour' WHERE id = $1`, [matchCancelled]);

    // 3. Create upcoming match (should NOT appear in completed)
    const matchUpcoming = await insertMatch('solo');
    await query(`UPDATE matches SET status = 'upcoming', start_time = now() + INTERVAL '1 hour' WHERE id = $1`, [matchUpcoming]);

    // Fetch ?status=completed
    const res = await request(app)
      .get('/api/v1/matches?status=completed')
      .expect(200);

    const matches = res.body.data.matches;
    const matchIds = matches.map((m: any) => m.id);

    expect(matchIds).toContain(matchCompleted);
    expect(matchIds).toContain(matchCancelled);
    expect(matchIds).not.toContain(matchUpcoming);

    // Cancelled match starts later than completed match (now - 1h vs now - 2h), so cancelled comes first (start_time DESC)
    const idxCancelled = matchIds.indexOf(matchCancelled);
    const idxCompleted = matchIds.indexOf(matchCompleted);
    expect(idxCancelled).toBeLessThan(idxCompleted);
  });

  it('GET /api/v1/matches/:id/players returns players with teamName and positions', async () => {
    const matchId = await insertMatch('duo');

    // Create 2 users
    const u1 = await query<{ id: number }>(
      `INSERT INTO users (username, email, name, mobile, ff_id, ff_name, upi_id, date_of_birth)
       VALUES ('leader_player', 'leader@example.com', 'Leader Player', '9999900001', '1000001', 'Leader_FF', 'leader@upi', '2000-01-01')
       RETURNING id`
    );
    const u2 = await query<{ id: number }>(
      `INSERT INTO users (username, email, name, mobile, ff_id, ff_name, upi_id, date_of_birth)
       VALUES ('teammate_player', 'teammate@example.com', 'Teammate Player', '9999900002', '1000002', 'Teammate_FF', 'teammate@upi', '2000-01-01')
       RETURNING id`
    );

    // Create team with custom name
    const teamRes = await query<{ id: number }>(
      `INSERT INTO teams (match_id, leader_id, name, size, status)
       VALUES ($1, $2, 'Thunder Strikers', 2, 'confirmed')
       RETURNING id`,
      [matchId, u1.rows[0].id]
    );
    const teamId = teamRes.rows[0].id;

    // Insert match players
    await query(
      `INSERT INTO match_players (match_id, user_id, team_id, paid_add_money, paid_cashback, paid_winning)
       VALUES ($1, $2, $3, 10.00, 0, 0), ($1, $4, $3, 10.00, 0, 0)`,
      [matchId, u1.rows[0].id, teamId, u2.rows[0].id]
    );

    const res = await request(app)
      .get(`/api/v1/matches/${matchId}/players`)
      .expect(200);

    expect(res.body.data.count).toBe(2);
    expect(res.body.data.players).toHaveLength(2);

    const [p1, p2] = res.body.data.players;
    expect(p1.team).toBe(1);
    expect(p1.position).toBe('A');
    expect(p1.name).toBe('Leader_FF');
    expect(p1.teamName).toBe('Thunder Strikers');

    expect(p2.team).toBe(1);
    expect(p2.position).toBe('B');
    expect(p2.name).toBe('Teammate_FF');
    expect(p2.teamName).toBe('Thunder Strikers');
  });

  it('sets and returns mapName across matches list and match details', async () => {
    const staffRes = await query<{ id: number }>(
      `INSERT INTO staff (role, name, email, mobile)
       VALUES ('admin', 'Admin Map Tester', 'admin_map@example.com', '9876543219')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const staffId = staffRes.rows[0].id;

    const tierRes = await query<{ id: number }>(
      `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
       VALUES ('battle_royale', 'solo', '20.00', '5.00', 2, 48, 2)
       RETURNING id`
    );
    const tierId = tierRes.rows[0].id;

    // 1. Default map name is Bermuda
    const defaultMatchRes = await query<{ id: number }>(
      `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, position_prizes, min_players, max_players, start_time, created_by, status)
       VALUES ($1, 'battle_royale', 'solo', '20.00', '5.00', 2, '{"1": 100.00}'::jsonb, 2, 48, now() + INTERVAL '1 hour', $2, 'upcoming')
       RETURNING id`,
      [tierId, staffId]
    );
    const defaultMatchId = defaultMatchRes.rows[0].id.toString();

    // 2. Custom map name (e.g. Kalahari)
    const customMatchRes = await query<{ id: number }>(
      `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, position_prizes, min_players, max_players, start_time, created_by, status, map_name)
       VALUES ($1, 'battle_royale', 'solo', '20.00', '5.00', 2, '{"1": 100.00}'::jsonb, 2, 48, now() + INTERVAL '2 hours', $2, 'upcoming', 'Kalahari')
       RETURNING id`,
      [tierId, staffId]
    );
    const customMatchId = customMatchRes.rows[0].id.toString();

    // Fetch public matches list
    const listRes = await request(app)
      .get('/api/v1/matches')
      .expect(200);

    const m1 = listRes.body.data.matches.find((m: any) => m.id === defaultMatchId);
    expect(m1.mapName).toBe('Bermuda');
    expect(m1.map).toBe('Bermuda');

    const m2 = listRes.body.data.matches.find((m: any) => m.id === customMatchId);
    expect(m2.mapName).toBe('Kalahari');
    expect(m2.map).toBe('Kalahari');

    // Fetch individual match details
    const detailRes = await request(app)
      .get(`/api/v1/matches/${customMatchId}`)
      .expect(200);

    expect(detailRes.body.data.match.mapName).toBe('Kalahari');
    expect(detailRes.body.data.match.map).toBe('Kalahari');
  });
});
