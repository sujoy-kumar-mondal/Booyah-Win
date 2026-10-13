import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { ErrorCodes } from '@booyah/shared';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';

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
});
