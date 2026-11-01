/**
 * Lone Wolf Game Mode Test Suite
 * Covers:
 * - Solo (1v1): min 2, max 2 players, 9 rounds, winner max 5 kills, loser max 4 kills, match total max 9 kills
 * - Duo (2v2): min 4, max 4 players, 2 confirmed teams, winner team max 14 kills, loser team max 13 kills, match total max 27 kills
 * - Squad disallowed for Lone Wolf
 * - Payout calculations and leader disbursement
 * - Rules API endpoint
 */

import crypto from 'crypto';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { truncateAllTables } from './setup.js';
import { query } from '../src/db/index.js';
import { createApp } from '../src/app.js';
import { signSessionToken } from '../src/utils/crypto.js';
import { ErrorCodes, formatDbNumeric } from '@booyah/shared';

const app = createApp({ enableRateLimiting: false });

const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
]);

let _ctr = 0;
const next = () => ++_ctr;

async function createUser(): Promise<{ id: string; email: string; ffId: string }> {
  const i = next();
  const res = await query(
    `INSERT INTO users (username, email, name, mobile, ff_id, ff_name, upi_id, date_of_birth)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '2000-01-01')
     RETURNING id, email, ff_id`,
    [
      `lwuser_${i}`,
      `lwuser_${i}@example.com`,
      `LW User ${i}`,
      '9' + String(i).padStart(9, '0'),
      `FF${String(i).padStart(8, '0')}`,
      `LW_FFN${i}`,
      `lw${i}@upi`,
    ]
  );
  const row = res.rows[0];
  await query('INSERT INTO wallets (user_id) VALUES ($1)', [row.id]);
  return { id: row.id.toString(), email: row.email, ffId: row.ff_id };
}

async function createUserToken(userId: string): Promise<string> {
  const sid = crypto.randomUUID();
  await query(
    `INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'user', $2)`,
    [sid, userId]
  );
  return signSessionToken({ sub: userId, typ: 'user', sid }, '12h');
}

async function createStaff(role: 'admin' | 'employee' = 'admin'): Promise<{ id: string; token: string }> {
  const i = next();
  const res = await query(
    `INSERT INTO staff (role, name, mobile, email) VALUES ($1, $2, $3, $4)
     RETURNING id, email, role`,
    [role, `Staff ${i}`, '8' + String(i).padStart(9, '0'), `staff${i}@booyah.win`]
  );
  const staff = res.rows[0];
  const sid = crypto.randomUUID();
  await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`, [sid, staff.id]);
  const token = signSessionToken({ sub: staff.id.toString(), typ: 'staff', sid, role: staff.role }, '12h');
  return { id: staff.id.toString(), token };
}

async function setWallet(userId: string, paise = 10000) {
  await query(`UPDATE wallets SET add_money = $1 WHERE user_id = $2`, [formatDbNumeric(paise), userId]);
}

describe('Lone Wolf Game Mode', () => {
  let admin: { id: string; token: string };

  beforeEach(async () => {
    await truncateAllTables();
    admin = await createStaff('admin');
  });

  describe('Tier Creation & Validation', () => {
    it('creates Lone Wolf Solo tier with min_players=2 and max_players=2', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          gameMode: 'lone_wolf',
          teamMode: 'solo',
          entryFee: '20.00',
          killPrice: '0.00',
          minKillsForReward: 0,
          minPlayers: 2,
          maxPlayers: 2,
          positions: [{ position: 1, prize: '35.00' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.tier.gameMode).toBe('lone_wolf');
      expect(res.body.data.tier.teamMode).toBe('solo');
      expect(res.body.data.tier.minPlayers).toBe(2);
      expect(res.body.data.tier.maxPlayers).toBe(2);
    });

    it('creates Lone Wolf Duo tier with min_players=4 and max_players=4', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          gameMode: 'lone_wolf',
          teamMode: 'duo',
          entryFee: '25.00',
          killPrice: '0.00',
          minKillsForReward: 0,
          minPlayers: 4,
          maxPlayers: 4,
          positions: [{ position: 1, prize: '80.00' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.tier.gameMode).toBe('lone_wolf');
      expect(res.body.data.tier.teamMode).toBe('duo');
      expect(res.body.data.tier.minPlayers).toBe(4);
      expect(res.body.data.tier.maxPlayers).toBe(4);
    });

    it('rejects squad team mode for Lone Wolf', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          gameMode: 'lone_wolf',
          teamMode: 'squad',
          entryFee: '20.00',
          killPrice: '0.00',
          minKillsForReward: 0,
          minPlayers: 8,
          maxPlayers: 8,
          positions: [{ position: 1, prize: '70.00' }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('rejects more than 2 position prizes for Lone Wolf', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          gameMode: 'lone_wolf',
          teamMode: 'solo',
          entryFee: '20.00',
          killPrice: '0.00',
          minKillsForReward: 0,
          minPlayers: 2,
          maxPlayers: 2,
          positions: [
            { position: 1, prize: '25.00' },
            { position: 2, prize: '10.00' },
            { position: 3, prize: '5.00' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });
  });

  describe('Lone Wolf Solo Match Results & Kill Caps', () => {
    let soloMatchId: string;
    let player1: { id: string };
    let player2: { id: string };

    beforeEach(async () => {
      const tierRes = await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          gameMode: 'lone_wolf',
          teamMode: 'solo',
          entryFee: '10.00',
          killPrice: '2.00',
          minKillsForReward: 0,
          minPlayers: 2,
          maxPlayers: 2,
          positions: [{ position: 1, prize: '15.00' }],
        });
      const tierId = tierRes.body.data.tier.id;

      const matchRes = await request(app)
        .post('/api/v1/staff/matches')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ tierId, startTime: new Date(Date.now() + 3600000).toISOString() });
      soloMatchId = matchRes.body.data.match.id;

      player1 = await createUser();
      player2 = await createUser();
      await setWallet(player1.id, 5000);
      await setWallet(player2.id, 5000);

      // Join match
      const p1Token = await createUserToken(player1.id);
      const p2Token = await createUserToken(player2.id);
      const j1 = await request(app)
        .post(`/api/v1/matches/${soloMatchId}/join`)
        .set('Authorization', `Bearer ${p1Token}`);
      expect(j1.status).toBe(200);

      const j2 = await request(app)
        .post(`/api/v1/matches/${soloMatchId}/join`)
        .set('Authorization', `Bearer ${p2Token}`);
      expect(j2.status).toBe(200);

      // Set room & transition to live
      const roomRes = await request(app)
        .post(`/api/v1/staff/matches/${soloMatchId}/open-room`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ roomId: '112233', roomPassword: 'pass' });
      expect(roomRes.status).toBe(200);

      const liveRes = await request(app)
        .post(`/api/v1/staff/matches/${soloMatchId}/go-live`)
        .set('Authorization', `Bearer ${admin.token}`);
      expect(liveRes.status).toBe(200);
    });

    it('rejects Lone Wolf Solo result if winner kills > 5', async () => {
      const res = await request(app)
        .post(`/api/v1/staff/matches/${soloMatchId}/result`)
        .set('Authorization', `Bearer ${admin.token}`)
        .field(
          'entries',
          JSON.stringify([
            { userId: player1.id, kills: 6, position: 1 },
            { userId: player2.id, kills: 3, position: 2 },
          ])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'ss.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.RESULT_INVALID);
      expect(res.body.error.message).toContain('exceeds maximum allowed (5)');
    });

    it('rejects Lone Wolf Solo result if loser kills > 4', async () => {
      const res = await request(app)
        .post(`/api/v1/staff/matches/${soloMatchId}/result`)
        .set('Authorization', `Bearer ${admin.token}`)
        .field(
          'entries',
          JSON.stringify([
            { userId: player1.id, kills: 4, position: 1 },
            { userId: player2.id, kills: 5, position: 2 },
          ])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'ss.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.RESULT_INVALID);
      expect(res.body.error.message).toContain('Loser (position 2) cannot have more than 4 kills');
    });

    it('rejects Lone Wolf Solo result if total kills > 9', async () => {
      const res = await request(app)
        .post(`/api/v1/staff/matches/${soloMatchId}/result`)
        .set('Authorization', `Bearer ${admin.token}`)
        .field(
          'entries',
          JSON.stringify([
            { userId: player1.id, kills: 5, position: 1 },
            { userId: player2.id, kills: 5, position: 2 },
          ])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'ss.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.RESULT_INVALID);
    });

    it('accepts valid Lone Wolf Solo result (5 kills winner, 4 kills loser) and auto-approves', async () => {
      const res = await request(app)
        .post(`/api/v1/staff/matches/${soloMatchId}/result`)
        .set('Authorization', `Bearer ${admin.token}`)
        .field(
          'entries',
          JSON.stringify([
            { userId: player1.id, kills: 5, position: 1 },
            { userId: player2.id, kills: 4, position: 2 },
          ])
        )
        .field('autoApprove', 'true')
        .attach('screenshot', VALID_JPEG_BUFFER, 'ss.jpg');

      expect(res.status).toBe(201);
      expect(res.body.data.approved).toBe(true);

      // Verify winner wallet credited (prize 15.00 + 5 kills * 2.00 = 25.00 winning balance)
      const wRes = await query('SELECT winning FROM wallets WHERE user_id = $1', [player1.id]);
      expect(Number(wRes.rows[0].winning)).toBe(25);
    });
  });

  describe('Lone Wolf Duo Match Results & Kill Caps', () => {
    let duoMatchId: string;
    let t1Leader: { id: string };
    let t1Member: { id: string };
    let t2Leader: { id: string };
    let t2Member: { id: string };
    let team1Id: string;
    let team2Id: string;

    beforeEach(async () => {
      const tierRes = await request(app)
        .post('/api/v1/admin/tiers')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          gameMode: 'lone_wolf',
          teamMode: 'duo',
          entryFee: '20.00',
          killPrice: '1.00',
          minKillsForReward: 0,
          minPlayers: 4,
          maxPlayers: 4,
          positions: [{ position: 1, prize: '50.00' }],
        });
      const tierId = tierRes.body.data.tier.id;

      const matchRes = await request(app)
        .post('/api/v1/staff/matches')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ tierId, startTime: new Date(Date.now() + 3600000).toISOString() });
      duoMatchId = matchRes.body.data.match.id;

      t1Leader = await createUser();
      t1Member = await createUser();
      t2Leader = await createUser();
      t2Member = await createUser();

      // Set funds for leaders (entry fee is 20 per player * 2 = 40 for team = 4000 paise)
      await setWallet(t1Leader.id, 10000);
      await setWallet(t2Leader.id, 10000);

      const t1Token = await createUserToken(t1Leader.id);
      const t2Token = await createUserToken(t2Leader.id);

      const team1Res = await request(app)
        .post(`/api/v1/matches/${duoMatchId}/teams`)
        .set('Authorization', `Bearer ${t1Token}`)
        .send({ teamName: 'Alpha Wolves', memberFfIds: [t1Member.ffId] });
      expect(team1Res.status).toBe(201);
      team1Id = team1Res.body.data.team.id;

      const team2Res = await request(app)
        .post(`/api/v1/matches/${duoMatchId}/teams`)
        .set('Authorization', `Bearer ${t2Token}`)
        .send({ teamName: 'Beta Wolves', memberFfIds: [t2Member.ffId] });
      expect(team2Res.status).toBe(201);
      team2Id = team2Res.body.data.team.id;

      // Open room and go live
      const roomRes = await request(app)
        .post(`/api/v1/staff/matches/${duoMatchId}/open-room`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ roomId: '998877', roomPassword: 'pass' });
      expect(roomRes.status).toBe(200);

      const liveRes = await request(app)
        .post(`/api/v1/staff/matches/${duoMatchId}/go-live`)
        .set('Authorization', `Bearer ${admin.token}`);
      expect(liveRes.status).toBe(200);
    });

    it('rejects result if winning team total kills > 14', async () => {
      const res = await request(app)
        .post(`/api/v1/staff/matches/${duoMatchId}/result`)
        .set('Authorization', `Bearer ${admin.token}`)
        .field(
          'entries',
          JSON.stringify([
            { userId: t1Leader.id, kills: 10, position: 1 },
            { userId: t1Member.id, kills: 5, position: 1 }, // 10 + 5 = 15 kills > 14
            { userId: t2Leader.id, kills: 6, position: 2 },
            { userId: t2Member.id, kills: 6, position: 2 },
          ])
        )
        .field('winningTeamId', team1Id)
        .attach('screenshot', VALID_JPEG_BUFFER, 'ss.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.RESULT_INVALID);
      expect(res.body.error.message).toContain('Winning team total kills (15) exceeds maximum allowed');
    });

    it('rejects result if losing team total kills > 13', async () => {
      const res = await request(app)
        .post(`/api/v1/staff/matches/${duoMatchId}/result`)
        .set('Authorization', `Bearer ${admin.token}`)
        .field(
          'entries',
          JSON.stringify([
            { userId: t1Leader.id, kills: 8, position: 1 },
            { userId: t1Member.id, kills: 5, position: 1 },
            { userId: t2Leader.id, kills: 8, position: 2 },
            { userId: t2Member.id, kills: 6, position: 2 }, // 8 + 6 = 14 kills > 13
          ])
        )
        .field('winningTeamId', team1Id)
        .attach('screenshot', VALID_JPEG_BUFFER, 'ss.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.RESULT_INVALID);
      expect(res.body.error.message).toContain('Losing team total kills (14) exceeds maximum allowed');
    });

    it('accepts max possible kills in Duo (14 winner, 13 loser = 27 total) and awards leader', async () => {
      const res = await request(app)
        .post(`/api/v1/staff/matches/${duoMatchId}/result`)
        .set('Authorization', `Bearer ${admin.token}`)
        .field(
          'entries',
          JSON.stringify([
            { userId: t1Leader.id, kills: 8, position: 1 },
            { userId: t1Member.id, kills: 6, position: 1 }, // 14 team kills
            { userId: t2Leader.id, kills: 7, position: 2 },
            { userId: t2Member.id, kills: 6, position: 2 }, // 13 team kills
          ])
        )
        .field('winningTeamId', team1Id)
        .field('autoApprove', 'true')
        .attach('screenshot', VALID_JPEG_BUFFER, 'ss.jpg');

      expect(res.status).toBe(201);
      expect(res.body.data.approved).toBe(true);

      // Verify winning team leader wallet credited:
      // Position 1 prize: 50.00
      // Team 1 kills reward: 14 kills * 1.00 = 14.00
      // Total leader payout = 64.00 winning balance
      const wRes = await query('SELECT winning FROM wallets WHERE user_id = $1', [t1Leader.id]);
      expect(Number(wRes.rows[0].winning)).toBe(64);

      // Non-leader member gets 0 payout directly (leader receives for team)
      const mRes = await query('SELECT winning FROM wallets WHERE user_id = $1', [t1Member.id]);
      expect(Number(mRes.rows[0].winning)).toBe(0);
    });
  });

  describe('Lone Wolf Rules API', () => {
    it('returns lone wolf rules on GET /api/v1/rules/match-rules?gameMode=lone_wolf', async () => {
      const res = await request(app).get('/api/v1/rules/match-rules?gameMode=lone_wolf');
      expect(res.status).toBe(200);
      expect(res.body.data.rulesEn).toContain('Rounds : 9');
      expect(res.body.data.rulesEn).toContain('Total Teams : 2');
      expect(res.body.data.rulesBn).toContain('রাউন্ড : ৯');
    });
  });
});
