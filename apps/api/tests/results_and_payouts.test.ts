/**
 * Milestone 7 – Results Submission, Validation, Approval, Preview, Payout Engine & Reversal.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { truncateAllTables } from './setup.js';
import { query } from '../src/db/index.js';
import { createApp } from '../src/app.js';
import { signSessionToken } from '../src/utils/crypto.js';
import {
  ErrorCodes,
  formatDbNumeric,
  paiseToString,
  stringToPaise,
} from '@booyah/shared';
import {
  calculatePlayerPayout,
  computePayouts,
} from '../src/modules/matches/results.service.js';

const app = createApp({ enableRateLimiting: false });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

// Valid JPEG buffer with magic bytes [0xff, 0xd8, 0xff]
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
]);

let _ctr = 0;
const next = () => ++_ctr;

interface TestUser {
  id: string;
  email: string;
  ffId: string;
}

interface TestStaff {
  id: string;
  email: string;
  role: 'admin' | 'employee';
}

async function createUser(opts: { email?: string } = {}): Promise<TestUser> {
  const i = next();
  const mobile = '9' + String(i).padStart(9, '0');
  const ffId = `FF${String(i).padStart(8, '0')}`;
  const email = opts.email ?? `resuser${i}@test.com`;

  const res = await query(
    `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
     VALUES ($1, $2, $3, $4, $5, $6, '1990-01-01', $7)
     RETURNING id, email, ff_id`,
    [
      email,
      `User ${i}`,
      mobile,
      ffId,
      `FFN${i}`,
      `upi${i}@test`,
      `REF${String(i).padStart(6, '0')}`,
    ]
  );
  const row = res.rows[0];
  await query('INSERT INTO wallets (user_id) VALUES ($1)', [row.id]);
  return { id: row.id.toString(), email: row.email, ffId: row.ff_id };
}

async function createStaff(
  role: 'admin' | 'employee' = 'employee',
  email?: string
): Promise<TestStaff> {
  const i = next();
  const mobile = '8' + String(i).padStart(9, '0');
  const staffEmail = email ?? `staff${i}@booyah.win`;
  const res = await query(
    `INSERT INTO staff (role, name, mobile, email) VALUES ($1, $2, $3, $4)
     RETURNING id, email, role`,
    [role, `Staff ${i}`, mobile, staffEmail]
  );
  return {
    id: res.rows[0].id.toString(),
    email: res.rows[0].email,
    role: res.rows[0].role as any,
  };
}

async function createStaffToken(staff: TestStaff): Promise<string> {
  const sid = crypto.randomUUID();
  await query(
    `INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`,
    [sid, staff.id]
  );
  return signSessionToken(
    { sub: staff.id, typ: 'staff', sid, role: staff.role },
    '12h'
  );
}

async function setWallet(
  userId: string,
  addMoney = 0,
  cashback = 0,
  winning = 0
) {
  await query(
    `UPDATE wallets SET add_money = $1, cashback = $2, winning = $3 WHERE user_id = $4`,
    [
      formatDbNumeric(addMoney),
      formatDbNumeric(cashback),
      formatDbNumeric(winning),
      userId,
    ]
  );
}

async function createTier(opts: {
  gameMode?: string;
  teamMode?: string;
  entryFee?: string;
  killPrice?: string;
  minKills?: number;
  positionPrizes?: Record<string, string>;
  minPlayers?: number;
  maxPlayers?: number;
} = {}): Promise<string> {
  const res = await query(
    `INSERT INTO entry_tiers
     (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
      min_players, max_players)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      opts.gameMode ?? 'battle_royale',
      opts.teamMode ?? 'solo',
      opts.entryFee ?? '10.00',
      opts.killPrice ?? '5.00',
      opts.minKills ?? 2,
      opts.minPlayers ?? 2,
      opts.maxPlayers ?? 48,
    ]
  );
  const tierId = res.rows[0].id.toString();

  const prizes = opts.positionPrizes ?? { '1': '50.00', '2': '40.00', '3': '30.00' };
  for (const [pos, prize] of Object.entries(prizes)) {
    await query(
      `INSERT INTO tier_position_prizes (tier_id, position, prize) VALUES ($1, $2, $3)`,
      [tierId, Number(pos), prize]
    );
  }
  return tierId;
}

async function createMatchInDb(opts: {
  gameMode?: string;
  teamMode?: string;
  entryFee?: string;
  killPrice?: string;
  minKills?: number;
  positionPrizes?: Record<string, string>;
  status?: string;
  maxPlayers?: number;
  minPlayers?: number;
  createdBy?: string;
} = {}): Promise<string> {
  const tierId = await createTier(opts);
  let staffId = opts.createdBy;
  if (!staffId) {
    const s = await createStaff('employee');
    staffId = s.id;
  }
  const startTime = new Date(Date.now() + 3600 * 1000).toISOString();
  const res = await query(
    `INSERT INTO matches
     (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
      position_prizes, max_players, min_players, start_time, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      tierId,
      opts.gameMode ?? 'battle_royale',
      opts.teamMode ?? 'solo',
      opts.entryFee ?? '10.00',
      opts.killPrice ?? '5.00',
      opts.minKills ?? 2,
      JSON.stringify(
        opts.positionPrizes ?? { '1': '50.00', '2': '40.00', '3': '30.00' }
      ),
      opts.maxPlayers ?? 48,
      opts.minPlayers ?? 2,
      startTime,
      opts.status ?? 'live',
      staffId,
    ]
  );
  return res.rows[0].id.toString();
}

async function joinPlayerInDb(
  matchId: string,
  userId: string,
  teamId: string | null = null,
  paidFee = '10.00',
  refunded = false
): Promise<string> {
  const res = await query(
    `INSERT INTO match_players
     (match_id, user_id, team_id, paid_add_money, refunded_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [matchId, userId, teamId, paidFee, refunded ? new Date() : null]
  );
  return res.rows[0].id.toString();
}

async function createTeamInDb(
  matchId: string,
  leaderId: string,
  size = 2,
  status = 'confirmed'
): Promise<string> {
  const res = await query(
    `INSERT INTO teams (match_id, leader_id, name, size, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [matchId, leaderId, `Team ${next()}`, size, status]
  );
  return res.rows[0].id.toString();
}

describe('Milestone 7: Results Submission, Payout Calculation, Approval, and Reversal', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Payout rules & Section 12.4 four examples
  // ───────────────────────────────────────────────────────────────────────────
  describe('Section 12.4 Four Examples & Core Payout Rules', () => {
    it('accurately computes Section 12.4 four examples (A=75, B=30, C=40, D=0)', () => {
      const positionPrizes = { '1': '50.00', '2': '40.00', '3': '30.00' };
      const killPricePaise = stringToPaise('5.00'); // 500 paise
      const minKills = 2;

      // Player A: 5 kills, Booyah (1)
      const pA = calculatePlayerPayout({
        kills: 5,
        position: 1,
        killPricePaise,
        minKillsForReward: minKills,
        positionPrizes,
      });
      expect(pA.killRewardPaise).toBe(2500); // 25.00
      expect(pA.positionPrizePaise).toBe(5000); // 50.00
      expect(pA.totalPaise).toBe(7500); // 75.00

      // Player B: 6 kills, Lost (null)
      const pB = calculatePlayerPayout({
        kills: 6,
        position: null,
        killPricePaise,
        minKillsForReward: minKills,
        positionPrizes,
      });
      expect(pB.killRewardPaise).toBe(3000); // 30.00
      expect(pB.positionPrizePaise).toBe(0);
      expect(pB.totalPaise).toBe(3000); // 30.00

      // Player C: 1 kill, Second (2)
      const pC = calculatePlayerPayout({
        kills: 1,
        position: 2,
        killPricePaise,
        minKillsForReward: minKills,
        positionPrizes,
      });
      expect(pC.killRewardPaise).toBe(0); // 1 kill < 2 min -> 0
      expect(pC.positionPrizePaise).toBe(4000); // 40.00
      expect(pC.totalPaise).toBe(4000); // 40.00

      // Player D: 1 kill, Lost (null)
      const pD = calculatePlayerPayout({
        kills: 1,
        position: null,
        killPricePaise,
        minKillsForReward: minKills,
        positionPrizes,
      });
      expect(pD.killRewardPaise).toBe(0);
      expect(pD.positionPrizePaise).toBe(0);
      expect(pD.totalPaise).toBe(0); // 0.00
    });

    it('min-kills boundary: 1 kill pays 0, 2 kills pays 2 x kill price', () => {
      const positionPrizes = { '1': '50.00' };
      const killPricePaise = stringToPaise('10.00'); // 1000 paise

      const p1 = calculatePlayerPayout({
        kills: 1,
        position: null,
        killPricePaise,
        minKillsForReward: 2,
        positionPrizes,
      });
      expect(p1.totalPaise).toBe(0);

      const p2 = calculatePlayerPayout({
        kills: 2,
        position: null,
        killPricePaise,
        minKillsForReward: 2,
        positionPrizes,
      });
      expect(p2.totalPaise).toBe(2000); // 20.00
    });

    it('kill price with decimals such as 2.50 handles exact integer paise', () => {
      const positionPrizes = { '1': '10.00' };
      const killPricePaise = stringToPaise('2.50'); // 250 paise

      const p = calculatePlayerPayout({
        kills: 3,
        position: null,
        killPricePaise,
        minKillsForReward: 2,
        positionPrizes,
      });
      expect(p.killRewardPaise).toBe(750); // 7.50
      expect(p.totalPaise).toBe(750);
    });

    it('position beyond the defined prizes pays 0 position prize', () => {
      const positionPrizes = { '1': '50.00', '2': '30.00' }; // prizes for 1 and 2 only
      const p = calculatePlayerPayout({
        kills: 0,
        position: 4, // 4th place
        killPricePaise: 500,
        minKillsForReward: 2,
        positionPrizes,
      });
      expect(p.positionPrizePaise).toBe(0);
      expect(p.totalPaise).toBe(0);
    });

    it('duo and squad payouts: position prize goes to leader, kill reward to individual killer', () => {
      const match = {
        game_mode: 'battle_royale',
        team_mode: 'duo',
        kill_price: '5.00',
        min_kills_for_reward: 2,
        position_prizes: { '1': '60.00' },
      };

      const leader = {
        id: '1',
        user_id: '101',
        team_id: '10',
        leader_id: '101',
        deleted_at: null,
      };
      const member = {
        id: '2',
        user_id: '102',
        team_id: '10',
        leader_id: '101',
        deleted_at: null,
      };

      const entries = [
        { userId: '101', kills: 2, position: 1 }, // Leader 2 kills, Booyah
        { userId: '102', kills: 3, position: 1 }, // Member 3 kills, Booyah
      ];

      const computed = computePayouts(match, entries, [leader, member]);
      const leaderCalc = computed.find((c) => c.userId === '101')!;
      const memberCalc = computed.find((c) => c.userId === '102')!;

      // Leader: 2 kills (1000 paise) + position prize 1 (6000 paise) = 7000 paise
      expect(leaderCalc.killRewardPaise).toBe(1000);
      expect(leaderCalc.positionPrizePaise).toBe(6000);
      expect(leaderCalc.payoutPaise).toBe(7000);

      // Member: 3 kills (1500 paise) + position prize 0 = 1500 paise
      expect(memberCalc.killRewardPaise).toBe(1500);
      expect(memberCalc.positionPrizePaise).toBe(0);
      expect(memberCalc.payoutPaise).toBe(1500);
    });

    it('Requirement 1: Clash Squad tier with a Rs100 prize pays exactly Rs100 to winning leader (no 75.00 fallback)', async () => {
      const match = {
        game_mode: 'clash_squad',
        team_mode: 'squad',
        kill_price: '0.00',
        min_kills_for_reward: 2,
        position_prizes: { '1': '100.00' }, // Tier defines Rs 100 prize
      };

      const winLeader = {
        id: '1',
        user_id: '201',
        team_id: '1',
        leader_id: '201',
        deleted_at: null,
      };
      const winMember = {
        id: '2',
        user_id: '202',
        team_id: '1',
        leader_id: '201',
        deleted_at: null,
      };
      const loseLeader = {
        id: '3',
        user_id: '203',
        team_id: '2',
        leader_id: '203',
        deleted_at: null,
      };

      const entries = [
        { userId: '201', kills: 0, position: 1 },
        { userId: '202', kills: 0, position: 1 },
        { userId: '203', kills: 0, position: null },
      ];

      const computed = computePayouts(match, entries, [
        winLeader,
        winMember,
        loseLeader,
      ]);
      const wLeaderRes = computed.find((c) => c.userId === '201')!;
      const wMemberRes = computed.find((c) => c.userId === '202')!;
      const lLeaderRes = computed.find((c) => c.userId === '203')!;

      expect(wLeaderRes.payoutPaise).toBe(10000); // Exactly Rs 100.00
      expect(wMemberRes.payoutPaise).toBe(0);
      expect(lLeaderRes.payoutPaise).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Result submission & validation
  // ───────────────────────────────────────────────────────────────────────────
  describe('Result Submission and Validation', () => {
    it('submits a valid solo result and sets status to pending_approval', async () => {
      const employee = await createStaff('employee');
      const token = await createStaffToken(employee);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      const u2 = await createUser();
      await joinPlayerInDb(matchId, u1.id);
      await joinPlayerInDb(matchId, u2.id);

      const entries = [
        { userId: u1.id, kills: 1, position: 1 },
        { userId: u2.id, kills: 0, position: 2 },
      ];

      const res = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${token}`)
        .field('entries', JSON.stringify(entries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('pending_approval');
      expect(res.body.data.approved).toBe(false);

      // Verify DB row
      const checkRes = await query(
        'SELECT status, submitted_by FROM match_results WHERE match_id = $1',
        [matchId]
      );
      expect(checkRes.rows[0].status).toBe('pending_approval');
      expect(checkRes.rows[0].submitted_by.toString()).toBe(employee.id);
    });

    it('rejects submission with refunded player included in entries with RESULT_INVALID (400)', async () => {
      const employee = await createStaff('employee');
      const token = await createStaffToken(employee);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      const u2 = await createUser();
      await joinPlayerInDb(matchId, u1.id);
      await joinPlayerInDb(matchId, u2.id, null, '10.00', true); // refunded player

      const entries = [
        { userId: u1.id, kills: 0, position: 1 },
        { userId: u2.id, kills: 0, position: 2 },
      ];

      const res = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${token}`)
        .field('entries', JSON.stringify(entries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.RESULT_INVALID);
    });

    it('rejects submission with duplicate player entries with RESULT_INVALID (400)', async () => {
      const employee = await createStaff('employee');
      const token = await createStaffToken(employee);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      await joinPlayerInDb(matchId, u1.id);

      const entries = [
        { userId: u1.id, kills: 0, position: 1 },
        { userId: u1.id, kills: 0, position: 1 },
      ];

      const res = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${token}`)
        .field('entries', JSON.stringify(entries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.RESULT_INVALID);
    });

    it('rejects submission with multiple position 1s with RESULT_INVALID (400)', async () => {
      const employee = await createStaff('employee');
      const token = await createStaffToken(employee);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      const u2 = await createUser();
      await joinPlayerInDb(matchId, u1.id);
      await joinPlayerInDb(matchId, u2.id);

      const entries = [
        { userId: u1.id, kills: 0, position: 1 },
        { userId: u2.id, kills: 0, position: 1 }, // multiple pos 1 in solo
      ];

      const res = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${token}`)
        .field('entries', JSON.stringify(entries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.RESULT_INVALID);
    });

    it('Requirement 9: in team modes player kills may not exceed N minus team size; total kills <= N-1', async () => {
      const employee = await createStaff('employee');
      const token = await createStaffToken(employee);
      // Duo match: 4 players (2 teams of 2), teamSize = 2, N = 4
      // Max individual kills = N - teamSize = 4 - 2 = 2
      // Max total kills = N - 1 = 3
      const matchId = await createMatchInDb({
        gameMode: 'battle_royale',
        teamMode: 'duo',
        maxPlayers: 4,
      });

      const u1 = await createUser();
      const u2 = await createUser();
      const u3 = await createUser();
      const u4 = await createUser();

      const t1 = await createTeamInDb(matchId, u1.id, 2);
      const t2 = await createTeamInDb(matchId, u3.id, 2);

      await joinPlayerInDb(matchId, u1.id, t1);
      await joinPlayerInDb(matchId, u2.id, t1);
      await joinPlayerInDb(matchId, u3.id, t2);
      await joinPlayerInDb(matchId, u4.id, t2);

      // Player 1 has 3 kills > max individual kills (2) -> fails
      const entriesTooManyKills = [
        { userId: u1.id, kills: 3, position: 1 },
        { userId: u2.id, kills: 0, position: 1 },
        { userId: u3.id, kills: 0, position: 2 },
        { userId: u4.id, kills: 0, position: 2 },
      ];

      const res1 = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${token}`)
        .field('entries', JSON.stringify(entriesTooManyKills))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe(ErrorCodes.RESULT_INVALID);

      // Valid individual kills (2 and 1) but total kills = 2 + 1 + 1 = 4 > max total (3) -> fails
      const entriesTotalTooHigh = [
        { userId: u1.id, kills: 2, position: 1 },
        { userId: u2.id, kills: 1, position: 1 },
        { userId: u3.id, kills: 1, position: 2 },
        { userId: u4.id, kills: 0, position: 2 },
      ];

      const res2 = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${token}`)
        .field('entries', JSON.stringify(entriesTotalTooHigh))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe(ErrorCodes.RESULT_INVALID);
    });

    it('rejects team result if teammates do not share the exact same position', async () => {
      const employee = await createStaff('employee');
      const token = await createStaffToken(employee);
      const matchId = await createMatchInDb({
        gameMode: 'battle_royale',
        teamMode: 'duo',
      });

      const u1 = await createUser();
      const u2 = await createUser();
      const t1 = await createTeamInDb(matchId, u1.id, 2);
      await joinPlayerInDb(matchId, u1.id, t1);
      await joinPlayerInDb(matchId, u2.id, t1);

      // Teammate 1 has pos 1, Teammate 2 has pos 2 -> rejected
      const entries = [
        { userId: u1.id, kills: 0, position: 1 },
        { userId: u2.id, kills: 0, position: 2 },
      ];

      const res = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${token}`)
        .field('entries', JSON.stringify(entries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.RESULT_INVALID);
    });

    it('rejects submission with non-lost position not in snapshot', async () => {
      const employee = await createStaff('employee');
      const token = await createStaffToken(employee);
      const matchId = await createMatchInDb({
        positionPrizes: { '1': '50.00', '2': '30.00' }, // Only pos 1 and 2 defined
      });

      const u1 = await createUser();
      const u2 = await createUser();
      await joinPlayerInDb(matchId, u1.id);
      await joinPlayerInDb(matchId, u2.id);

      const entries = [
        { userId: u1.id, kills: 0, position: 1 },
        { userId: u2.id, kills: 0, position: 5 }, // 5 not in snapshot
      ];

      const res = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${token}`)
        .field('entries', JSON.stringify(entries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.RESULT_INVALID);
    });

    it('Requirement 6: staff member whose email matches a player in match cannot submit result (403 FORBIDDEN)', async () => {
      const sharedEmail = 'conflict@booyah.win';
      const staffMember = await createStaff('employee', sharedEmail);
      const token = await createStaffToken(staffMember);

      const matchId = await createMatchInDb();
      const playerWithSameEmail = await createUser({ email: sharedEmail });
      const p2 = await createUser();

      await joinPlayerInDb(matchId, playerWithSameEmail.id);
      await joinPlayerInDb(matchId, p2.id);

      const entries = [
        { userId: playerWithSameEmail.id, kills: 1, position: 1 },
        { userId: p2.id, kills: 0, position: 2 },
      ];

      const res = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${token}`)
        .field('entries', JSON.stringify(entries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCodes.FORBIDDEN);
    });

    it('Requirement 11: rejects wrong file type and file over 2 MB; deletes uploaded file on failed submission', async () => {
      const employee = await createStaff('employee');
      const token = await createStaffToken(employee);
      const matchId = await createMatchInDb();
      const u1 = await createUser();
      await joinPlayerInDb(matchId, u1.id);

      // 1. Wrong file type (text/plain)
      const resWrongType = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${token}`)
        .field('entries', JSON.stringify([{ userId: u1.id, kills: 0, position: 1 }]))
        .attach('screenshot', Buffer.from('hello world'), 'file.txt');

      expect(resWrongType.status).toBe(400);
      expect(resWrongType.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // 2. File over 2 MB
      const bigBuffer = Buffer.alloc(2 * 1024 * 1024 + 100);
      // Put JPEG magic bytes at front so it passes magic check if size wasn't checked
      VALID_JPEG_BUFFER.copy(bigBuffer, 0, 0, VALID_JPEG_BUFFER.length);

      const resBigFile = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${token}`)
        .field('entries', JSON.stringify([{ userId: u1.id, kills: 0, position: 1 }]))
        .attach('screenshot', bigBuffer, 'screenshot.jpg');

      expect(resBigFile.status).toBe(400);
      expect(resBigFile.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // 3. Uploaded file deleted on failed validation (e.g. invalid kills)
      const beforeFiles = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [];
      const resFailedVal = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${token}`)
        .field('entries', JSON.stringify([{ userId: u1.id, kills: -5, position: 1 }])) // invalid kills
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      expect(resFailedVal.status).toBe(400);
      const afterFiles = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [];
      expect(afterFiles.length).toBe(beforeFiles.length);
    });

    it('GET /staff/matches/:id/result returns submitted result with signed screenshot URL', async () => {
      const employee = await createStaff('employee');
      const token = await createStaffToken(employee);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      await joinPlayerInDb(matchId, u1.id);

      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${token}`)
        .field(
          'entries',
          JSON.stringify([{ userId: u1.id, kills: 0, position: 1 }])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      const res = await request(app)
        .get(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('pending_approval');
      expect(res.body.data.signedScreenshotUrl).toContain('/api/v1/files/');
      expect(res.body.data.signedScreenshotUrl).toContain('token=');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Approval, Preview, Auto-Approve, Roles
  // ───────────────────────────────────────────────────────────────────────────
  describe('Approval, Preview, and Role Security', () => {
    it('employee cannot approve result (403 FORBIDDEN)', async () => {
      const employee = await createStaff('employee');
      const empToken = await createStaffToken(employee);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      await joinPlayerInDb(matchId, u1.id);

      // Submit
      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${empToken}`)
        .field(
          'entries',
          JSON.stringify([{ userId: u1.id, kills: 0, position: 1 }])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      // Employee tries to approve
      const res = await request(app)
        .post(`/api/v1/admin/results/${matchId}/approve`)
        .set('Authorization', `Bearer ${empToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCodes.FORBIDDEN);
    });

    it('Requirement 10: employee sending autoApprove gets 403', async () => {
      const employee = await createStaff('employee');
      const empToken = await createStaffToken(employee);
      const matchId = await createMatchInDb();
      const u1 = await createUser();
      await joinPlayerInDb(matchId, u1.id);

      const res = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result?autoApprove=true`)
        .set('Authorization', `Bearer ${empToken}`)
        .field(
          'entries',
          JSON.stringify([{ userId: u1.id, kills: 0, position: 1 }])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCodes.FORBIDDEN);
    });

    it('admin submit-and-approve in one action executes and audits in one transaction', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb({
        killPrice: '5.00',
        minKills: 2,
        positionPrizes: { '1': '50.00', '2': '40.00', '3': '30.00' },
      });

      const u1 = await createUser();
      const u2 = await createUser();
      const u3 = await createUser();
      const u4 = await createUser();
      await joinPlayerInDb(matchId, u1.id);
      await joinPlayerInDb(matchId, u2.id);
      await joinPlayerInDb(matchId, u3.id);
      await joinPlayerInDb(matchId, u4.id);
      await setWallet(u1.id, 0, 0, 0);

      const res = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result?autoApprove=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field(
          'entries',
          JSON.stringify([
            { userId: u1.id, kills: 3, position: 1 },
            { userId: u2.id, kills: 0, position: 2 },
            { userId: u3.id, kills: 0, position: 3 },
            { userId: u4.id, kills: 0, position: null },
          ])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('approved');
      expect(res.body.data.approved).toBe(true);

      // Wallet credited: 3 kills * 5 (15) + pos 1 (50) = 65.00
      const wRes = await query(
        'SELECT winning FROM wallets WHERE user_id = $1',
        [u1.id]
      );
      expect(wRes.rows[0].winning).toBe('65.00');

      // Match status completed
      const mRes = await query('SELECT status FROM matches WHERE id = $1', [
        matchId,
      ]);
      expect(mRes.rows[0].status).toBe('completed');

      // Audit log records action
      const aRes = await query(
        `SELECT action FROM audit_logs WHERE target_id = $1 AND action = 'match_result_submitted_and_approved'`,
        [matchId]
      );
      expect(aRes.rowCount).toBe(1);
    });

    it('Requirement 8: GET /admin/results/:matchId/preview returns total collected, total payout, difference, warning', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      // Entry fee: Rs 10.00, Kill price: Rs 5.00, pos 1: 50.00
      const matchId = await createMatchInDb({
        entryFee: '10.00',
        killPrice: '5.00',
        positionPrizes: { '1': '50.00', '2': '40.00', '3': '30.00' },
      });

      const u1 = await createUser();
      const u2 = await createUser();
      const u3 = await createUser();
      const u4 = await createUser();
      await joinPlayerInDb(matchId, u1.id, null, '10.00');
      await joinPlayerInDb(matchId, u2.id, null, '10.00');
      await joinPlayerInDb(matchId, u3.id, null, '10.00');
      await joinPlayerInDb(matchId, u4.id, null, '10.00');

      // Submit result: u1 3 kills (15 + 50 = 65), u2 0 pos 2 (40), u3 0 pos 3 (30), u4 0 pos null (0)
      // Total payout = 65 + 40 + 30 = 135.00
      // Total collected = 4 * 10 = 40.00
      const entries = [
        { userId: u1.id, kills: 3, position: 1 },
        { userId: u2.id, kills: 0, position: 2 },
        { userId: u3.id, kills: 0, position: 3 },
        { userId: u4.id, kills: 0, position: null },
      ];

      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('entries', JSON.stringify(entries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      // Preview
      const prevRes = await request(app)
        .get(`/api/v1/admin/results/${matchId}/preview`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(prevRes.status).toBe(200);
      const data = prevRes.body.data;
      expect(data.totalCollected).toBe('40.00');
      expect(data.totalPayout).toBe('135.00');
      expect(data.difference).toBe('-95.00');
      expect(data.warning).toBe('Payout exceeds total entry fees collected');
      expect(data.entries).toHaveLength(4);

      // Check dry run: no writes took place
      const checkRes = await query(
        'SELECT status FROM match_results WHERE match_id = $1',
        [matchId]
      );
      expect(checkRes.rows[0].status).toBe('pending_approval');
    });

    it('approval transaction: locks wallets, credits winning, stores stats on match_players, marks match completed', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      const u2 = await createUser();
      const u3 = await createUser();
      const u4 = await createUser();
      await joinPlayerInDb(matchId, u1.id);
      await joinPlayerInDb(matchId, u2.id);
      await joinPlayerInDb(matchId, u3.id);
      await joinPlayerInDb(matchId, u4.id);

      await setWallet(u1.id, 0, 0, 0);
      await setWallet(u2.id, 0, 0, 0);
      await setWallet(u3.id, 0, 0, 0);
      await setWallet(u4.id, 0, 0, 0);

      // Submit result: u1 Booyah 2 kills (60), u2 2nd 0 kills (40), u3 3rd 0 kills (30), u4 lost 0 kills (0)
      const entries = [
        { userId: u1.id, kills: 2, position: 1 }, // 2*5 + 50 = 60
        { userId: u2.id, kills: 0, position: 2 }, // 0 + 40 = 40
        { userId: u3.id, kills: 0, position: 3 }, // 0 + 30 = 30
        { userId: u4.id, kills: 0, position: null }, // 0 + 0 = 0
      ];

      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('entries', JSON.stringify(entries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      // Approve
      const appRes = await request(app)
        .post(`/api/v1/admin/results/${matchId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(appRes.status).toBe(200);

      // Verify wallets
      const w1 = await query(
        'SELECT winning FROM wallets WHERE user_id = $1',
        [u1.id]
      );
      const w2 = await query(
        'SELECT winning FROM wallets WHERE user_id = $1',
        [u2.id]
      );
      expect(w1.rows[0].winning).toBe('60.00');
      expect(w2.rows[0].winning).toBe('40.00');

      // Verify match_players stored kills, position, payout
      const mp1 = await query(
        'SELECT kills, position, payout FROM match_players WHERE match_id = $1 AND user_id = $2',
        [matchId, u1.id]
      );
      expect(mp1.rows[0].kills).toBe(2);
      expect(mp1.rows[0].position).toBe(1);
      expect(mp1.rows[0].payout).toBe('60.00');

      // Verify ledger rows
      const ledgers = await query(
        `SELECT type, amount, ref_id FROM wallet_ledger WHERE ref_id = $1 ORDER BY id ASC`,
        [matchId]
      );
      expect(ledgers.rows).toHaveLength(3); // u1 (60), u2 (40), u3 (30)
      expect(ledgers.rows[0].type).toBe('winning');
      expect(ledgers.rows[0].amount).toBe('60.00');
      expect(ledgers.rows[1].amount).toBe('40.00');
      expect(ledgers.rows[2].amount).toBe('30.00');
    });

    it('soft-deleted payee is skipped (payout recorded as 0, no wallet credit)', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      const u2 = await createUser();
      await joinPlayerInDb(matchId, u1.id);
      await joinPlayerInDb(matchId, u2.id);
      await setWallet(u1.id, 0, 0, 0);

      // Soft delete u1
      await query(
        `UPDATE users SET deleted_at = now(), deleted_reason = 'Cheating' WHERE id = $1`,
        [u1.id]
      );

      // Submit & Approve: u1 1 kill pos 1 (deleted), u2 0 kills pos null (lost)
      const entries = [
        { userId: u1.id, kills: 1, position: 1 },
        { userId: u2.id, kills: 0, position: null },
      ];
      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('entries', JSON.stringify(entries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      await request(app)
        .post(`/api/v1/admin/results/${matchId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Wallet stays 0 for deleted user
      const w1 = await query(
        'SELECT winning FROM wallets WHERE user_id = $1',
        [u1.id]
      );
      expect(w1.rows[0].winning).toBe('0.00');

      // match_players records payout 0.00
      const mp1 = await query(
        'SELECT payout FROM match_players WHERE match_id = $1 AND user_id = $2',
        [matchId, u1.id]
      );
      expect(mp1.rows[0].payout).toBe('0.00');

      // No ledger row created
      const lRes = await query(
        'SELECT count(*) FROM wallet_ledger WHERE ref_id = $1',
        [matchId]
      );
      expect(Number(lRes.rows[0].count)).toBe(0);

      // Requirement (c): Audit log records skipped payee and unpaid amount
      const auditRes = await query(
        `SELECT action, details FROM audit_logs WHERE target_id = $1 AND action = 'match_result_approved'`,
        [matchId]
      );
      expect(auditRes.rowCount).toBe(1);
      const details = auditRes.rows[0].details;
      expect(details.skippedPayees).toBeDefined();
      expect(details.skippedPayees).toHaveLength(1);
      expect(details.skippedPayees[0].userId).toBe(u1.id);
      expect(details.skippedPayees[0].unpaidAmount).toBe('50.00');
    });

    it('Step 0 (a): player refunded between submission and approval causes approval to fail with RESULT_INVALID', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      const u2 = await createUser();
      await joinPlayerInDb(matchId, u1.id);
      await joinPlayerInDb(matchId, u2.id);

      // Submit result with u1 (pos 1) and u2 (pos 2)
      const entries = [
        { userId: u1.id, kills: 1, position: 1 },
        { userId: u2.id, kills: 0, position: 2 },
      ];
      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('entries', JSON.stringify(entries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      // Now u2 is refunded between submission and approval
      await query(
        'UPDATE match_players SET refunded_at = now() WHERE match_id = $1 AND user_id = $2',
        [matchId, u2.id]
      );

      // Approval attempts to re-validate against current active roster
      const appRes = await request(app)
        .post(`/api/v1/admin/results/${matchId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(appRes.status).toBe(400);
      expect(appRes.body.error.code).toBe(ErrorCodes.RESULT_INVALID);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Rejection and Resubmission
  // ───────────────────────────────────────────────────────────────────────────
  describe('Rejection and Resubmission', () => {
    it('Requirement 4 & 11: reject requires reason, sets status to rejected without touching approved_by', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb();
      const u1 = await createUser();
      await joinPlayerInDb(matchId, u1.id);

      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field(
          'entries',
          JSON.stringify([{ userId: u1.id, kills: 0, position: 1 }])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      // Reject without reason fails (400)
      const resNoReason = await request(app)
        .post(`/api/v1/admin/results/${matchId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(resNoReason.status).toBe(400);

      // Reject with reason succeeds
      const res = await request(app)
        .post(`/api/v1/admin/results/${matchId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Screenshot unreadable' });

      expect(res.status).toBe(200);

      const rRes = await query(
        'SELECT status, reject_reason, approved_by FROM match_results WHERE match_id = $1',
        [matchId]
      );
      expect(rRes.rows[0].status).toBe('rejected');
      expect(rRes.rows[0].reject_reason).toBe('Screenshot unreadable');
      expect(rRes.rows[0].approved_by).toBeNull();
    });

    it('resubmits rejected result back to pending_approval and preserves old version in audit log', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb();
      const u1 = await createUser();
      const u2 = await createUser();
      const u3 = await createUser();
      const u4 = await createUser();
      await joinPlayerInDb(matchId, u1.id);
      await joinPlayerInDb(matchId, u2.id);
      await joinPlayerInDb(matchId, u3.id);
      await joinPlayerInDb(matchId, u4.id);

      // 1. Submit
      const initialEntries = [
        { userId: u1.id, kills: 0, position: 1 },
        { userId: u2.id, kills: 0, position: 2 },
        { userId: u3.id, kills: 0, position: 3 },
        { userId: u4.id, kills: 0, position: null },
      ];
      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('entries', JSON.stringify(initialEntries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      // 2. Reject
      await request(app)
        .post(`/api/v1/admin/results/${matchId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Wrong player placement' });

      // 3. Resubmit
      const fixedEntries = [
        { userId: u1.id, kills: 2, position: 1 },
        { userId: u2.id, kills: 0, position: 2 },
        { userId: u3.id, kills: 0, position: 3 },
        { userId: u4.id, kills: 0, position: null },
      ];
      const resFix = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('entries', JSON.stringify(fixedEntries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'fixed.jpg');

      expect(resFix.status).toBe(201);
      expect(resFix.body.data.status).toBe('pending_approval');

      // Audit log records previous version
      const auditRes = await query(
        `SELECT action, details FROM audit_logs WHERE target_id = $1 AND action = 'match_result_resubmitted'`,
        [matchId]
      );
      expect(auditRes.rowCount).toBe(1);
      expect(auditRes.rows[0].details.previousStatus).toBe('rejected');
      expect(auditRes.rows[0].details.oldEntries[0].kills).toBe(0);
    });

    it('resubmitting after approval is blocked with RESULT_LOCKED (409)', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb();
      const u1 = await createUser();
      await joinPlayerInDb(matchId, u1.id);

      // Submit and approve
      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result?autoApprove=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field(
          'entries',
          JSON.stringify([{ userId: u1.id, kills: 0, position: 1 }])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      // Resubmit attempt
      const res = await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field(
          'entries',
          JSON.stringify([{ userId: u1.id, kills: 0, position: 1 }])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe(ErrorCodes.RESULT_LOCKED);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Reversal Mechanics
  // ───────────────────────────────────────────────────────────────────────────
  describe('Reversal Mechanics', () => {
    it('Requirement 5: reversal restores wallet balances exactly and audit log stores old entries and payouts', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      await joinPlayerInDb(matchId, u1.id);
      await setWallet(u1.id, 0, 0, 1000); // 10.00 pre-win

      // Submit and approve: pays 50.00 winning
      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result?autoApprove=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field(
          'entries',
          JSON.stringify([{ userId: u1.id, kills: 0, position: 1 }])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      // Verify wallet post-win = 60.00
      const wPost = await query(
        'SELECT winning FROM wallets WHERE user_id = $1',
        [u1.id]
      );
      expect(wPost.rows[0].winning).toBe('60.00');

      // Reverse result
      const revRes = await request(app)
        .post(`/api/v1/admin/results/${matchId}/reverse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Mistake in position' });

      expect(revRes.status).toBe(200);

      // Verify wallet restored exactly to 10.00
      const wRev = await query(
        'SELECT winning FROM wallets WHERE user_id = $1',
        [u1.id]
      );
      expect(wRev.rows[0].winning).toBe('10.00');

      // Match reset to live and result reset to rejected
      const mRes = await query('SELECT status FROM matches WHERE id = $1', [
        matchId,
      ]);
      const rRes = await query(
        'SELECT status, reject_reason FROM match_results WHERE match_id = $1',
        [matchId]
      );
      expect(mRes.rows[0].status).toBe('live');
      expect(rRes.rows[0].status).toBe('rejected');
      expect(rRes.rows[0].reject_reason).toBe('Mistake in position');

      // Reversal ledger row created
      const revLedger = await query(
        `SELECT type, amount FROM wallet_ledger WHERE ref_id = $1 AND type = 'reversal'`,
        [matchId]
      );
      expect(revLedger.rowCount).toBe(1);
      expect(revLedger.rows[0].amount).toBe('-50.00');

      // Audit log records old entries and player payouts
      const auditRes = await query(
        `SELECT action, details FROM audit_logs WHERE target_id = $1 AND action = 'result_reversed'`,
        [matchId]
      );
      expect(auditRes.rowCount).toBe(1);
      expect(auditRes.rows[0].details.old_entries).toBeDefined();
      expect(auditRes.rows[0].details.player_payouts).toBeDefined();
      expect(auditRes.rows[0].details.player_payouts[0].payout).toBe('50.00');
    });

    it('reversal fails atomically with LOW_BALANCE when a payee has withdrawn winning balance', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      const u2 = await createUser();
      await joinPlayerInDb(matchId, u1.id);
      await joinPlayerInDb(matchId, u2.id);

      await setWallet(u1.id, 0, 0, 0);
      await setWallet(u2.id, 0, 0, 0);

      // Submit and approve: u1 gets 50, u2 gets 40
      const entries = [
        { userId: u1.id, kills: 0, position: 1 },
        { userId: u2.id, kills: 0, position: 2 },
      ];
      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result?autoApprove=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('entries', JSON.stringify(entries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      // User 1 spends or withdraws their winning balance: set winning to 10.00 (< 50.00 required)
      await setWallet(u1.id, 0, 0, 1000);

      // Reverse attempt
      const revRes = await request(app)
        .post(`/api/v1/admin/results/${matchId}/reverse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Re-evaluating winner' });

      expect(revRes.status).toBe(400);
      expect(revRes.body.error.code).toBe(ErrorCodes.LOW_BALANCE);
      expect(revRes.body.error.details.affectedUsers).toHaveLength(1);
      expect(revRes.body.error.details.affectedUsers[0].userId).toBe(u1.id);

      // Atomicity check: User 2's balance untouched (still 40.00)
      const w2 = await query(
        'SELECT winning FROM wallets WHERE user_id = $1',
        [u2.id]
      );
      expect(w2.rows[0].winning).toBe('40.00');

      // Match remains completed
      const mRes = await query('SELECT status FROM matches WHERE id = $1', [
        matchId,
      ]);
      expect(mRes.rows[0].status).toBe('completed');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Concurrency & Race Conditions
  // ───────────────────────────────────────────────────────────────────────────
  describe('Concurrency and Race Conditions', () => {
    it('approve twice returns 409 RESULT_LOCKED on second approve and pays once', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      await joinPlayerInDb(matchId, u1.id);
      await setWallet(u1.id, 0, 0, 0);

      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field(
          'entries',
          JSON.stringify([{ userId: u1.id, kills: 0, position: 1 }])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      const res1 = await request(app)
        .post(`/api/v1/admin/results/${matchId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res1.status).toBe(200);

      // Second approve
      const res2 = await request(app)
        .post(`/api/v1/admin/results/${matchId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe(ErrorCodes.RESULT_LOCKED);

      // Wallet credited once
      const w1 = await query(
        'SELECT winning FROM wallets WHERE user_id = $1',
        [u1.id]
      );
      expect(w1.rows[0].winning).toBe('50.00');
    });

    it('50 parallel approvals of the same match execute once and credit wallets exactly once', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      await joinPlayerInDb(matchId, u1.id);
      await setWallet(u1.id, 0, 0, 0);

      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field(
          'entries',
          JSON.stringify([{ userId: u1.id, kills: 0, position: 1 }])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      // Fire 50 simultaneous approvals
      const promises = Array.from({ length: 50 }, () =>
        request(app)
          .post(`/api/v1/admin/results/${matchId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
      );

      const results = await Promise.all(promises);
      const successes = results.filter((r) => r.status === 200);
      const locked = results.filter((r) => r.status === 409);

      expect(successes).toHaveLength(1);
      expect(locked).toHaveLength(49);

      // Verify wallet credited exactly once
      const w1 = await query(
        'SELECT winning FROM wallets WHERE user_id = $1',
        [u1.id]
      );
      expect(w1.rows[0].winning).toBe('50.00');

      const ledgers = await query(
        'SELECT count(*) FROM wallet_ledger WHERE ref_id = $1',
        [matchId]
      );
      expect(Number(ledgers.rows[0].count)).toBe(1);
    });

    it('cancel versus submit race: exactly one wins; never pays and cancels simultaneously', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      await joinPlayerInDb(matchId, u1.id, null, '10.00');

      // Concurrently fire cancel and submit
      const cancelPromise = request(app)
        .post(`/api/v1/staff/matches/${matchId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Match cancelled due to weather' });

      const submitPromise = request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field(
          'entries',
          JSON.stringify([{ userId: u1.id, kills: 0, position: 1 }])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      const [cancelRes, submitRes] = await Promise.all([
        cancelPromise,
        submitPromise,
      ]);

      // Exactly one succeeds first
      if (cancelRes.status === 200) {
        // Cancel won -> submit must have seen non-live match and returned 409 INVALID_TRANSITION
        expect(submitRes.status).toBe(409);
        expect(submitRes.body.error.code).toBe(ErrorCodes.INVALID_TRANSITION);
      } else {
        // Submit won -> cancel may succeed or fail depending on lock timing
        expect(submitRes.status).toBe(201);
      }

      // Step 0 (b) explicit assertion: Prove the match is NEVER cancelled with an approvable result
      const matchRow = await query('SELECT status FROM matches WHERE id = $1', [matchId]);
      if (matchRow.rows[0].status === 'cancelled') {
        const approveAttempt = await request(app)
          .post(`/api/v1/admin/results/${matchId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`);
        // Approval must be rejected with 404 or 409 INVALID_TRANSITION; never succeeds
        expect([404, 409]).toContain(approveAttempt.status);
        if (approveAttempt.status === 409) {
          expect(approveAttempt.body.error.code).toBe(ErrorCodes.INVALID_TRANSITION);
        }
      }
    });

    it('approve versus admin cancel racing: never both a payout and a refund', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      await joinPlayerInDb(matchId, u1.id, null, '10.00');
      await setWallet(u1.id, 0, 0, 0);

      // Submit result first
      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field(
          'entries',
          JSON.stringify([{ userId: u1.id, kills: 0, position: 1 }])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      // Concurrently fire approve and cancel
      const approvePromise = request(app)
        .post(`/api/v1/admin/results/${matchId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      const cancelPromise = request(app)
        .post(`/api/v1/staff/matches/${matchId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Admin cancel' });

      const [appRes, canRes] = await Promise.all([
        approvePromise,
        cancelPromise,
      ]);

      // Exactly one succeeds
      const appOk = appRes.status === 200;
      const canOk = canRes.status === 200;
      expect(appOk !== canOk).toBe(true);

      // Verify ledger never has both winning and refund
      const ledgerRes = await query(
        `SELECT type FROM wallet_ledger WHERE ref_id = $1`,
        [matchId]
      );
      const types = ledgerRes.rows.map((r) => r.type);
      const hasWinning = types.includes('winning');
      const hasRefund = types.includes('refund');
      expect(hasWinning && hasRefund).toBe(false);
    });

    it('approve versus reverse race: handled safely without deadlock or inconsistent state', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb();

      const u1 = await createUser();
      await joinPlayerInDb(matchId, u1.id);
      await setWallet(u1.id, 0, 0, 1000);

      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field(
          'entries',
          JSON.stringify([{ userId: u1.id, kills: 0, position: 1 }])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      // Race approve and reverse simultaneously
      const [appRes, revRes] = await Promise.all([
        request(app)
          .post(`/api/v1/admin/results/${matchId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`),
        request(app)
          .post(`/api/v1/admin/results/${matchId}/reverse`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason: 'Racing reverse' }),
      ]);

      // Reverse requires approved result, so reverse either fails with 409 INVALID_TRANSITION or runs after approve
      expect([200, 409]).toContain(appRes.status);
      expect([200, 409]).toContain(revRes.status);

      // Verify no deadlock error (40P01) occurred
      expect(appRes.status).not.toBe(500);
      expect(revRes.status).not.toBe(500);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Full Ledger Reconciliation & Preview Equality
  // ───────────────────────────────────────────────────────────────────────────
  describe('Ledger Reconciliation and Preview Equality', () => {
    it('preview equals what approval actually pays out', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb({
        entryFee: '20.00',
        killPrice: '4.00',
        minKills: 2,
        positionPrizes: { '1': '70.00', '2': '30.00' },
      });

      const u1 = await createUser();
      const u2 = await createUser();
      const u3 = await createUser();
      const u4 = await createUser();
      const u5 = await createUser();
      const u6 = await createUser();
      const u7 = await createUser();
      const u8 = await createUser();
      for (const u of [u1, u2, u3, u4, u5, u6, u7, u8]) {
        await joinPlayerInDb(matchId, u.id, null, '20.00');
        await setWallet(u.id, 0, 0, 0);
      }

      const entries = [
        { userId: u1.id, kills: 4, position: 1 }, // 4*4 (16) + 70 = 86.00
        { userId: u2.id, kills: 2, position: 2 }, // 2*4 (8) + 30 = 38.00
        { userId: u3.id, kills: 0, position: null },
        { userId: u4.id, kills: 0, position: null },
        { userId: u5.id, kills: 0, position: null },
        { userId: u6.id, kills: 0, position: null },
        { userId: u7.id, kills: 0, position: null },
        { userId: u8.id, kills: 0, position: null },
      ];

      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('entries', JSON.stringify(entries))
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      // 1. Get preview
      const prevRes = await request(app)
        .get(`/api/v1/admin/results/${matchId}/preview`)
        .set('Authorization', `Bearer ${adminToken}`);

      const prevData = prevRes.body.data;

      // 2. Approve
      await request(app)
        .post(`/api/v1/admin/results/${matchId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      // 3. Compare
      const w1 = await query(
        'SELECT winning FROM wallets WHERE user_id = $1',
        [u1.id]
      );
      const w2 = await query(
        'SELECT winning FROM wallets WHERE user_id = $1',
        [u2.id]
      );

      const p1Prev = prevData.entries.find((e: any) => e.userId === u1.id);
      const p2Prev = prevData.entries.find((e: any) => e.userId === u2.id);

      expect(w1.rows[0].winning).toBe(p1Prev.payout);
      expect(w2.rows[0].winning).toBe(p2Prev.payout);
      expect(stringToPaise(w1.rows[0].winning) + stringToPaise(w2.rows[0].winning)).toBe(
        stringToPaise(p1Prev.payout) + stringToPaise(p2Prev.payout)
      );
    });

    it('ledger reconciliation across deposit, join, win, and reversal', async () => {
      const admin = await createStaff('admin');
      const adminToken = await createStaffToken(admin);
      const matchId = await createMatchInDb();

      const u = await createUser();
      await joinPlayerInDb(matchId, u.id);

      // Start with 50.00 in winning wallet
      await setWallet(u.id, 0, 0, 5000);
      await query(
        `INSERT INTO wallet_ledger
         (user_id, wallet, type, amount, balance_after, total_after, ref_id)
         VALUES ($1, 'winning', 'add_money', '50.00', '50.00', '50.00', 1)`,
        [u.id]
      );

      // Win match: gets 50.00 winning payout
      await request(app)
        .post(`/api/v1/staff/matches/${matchId}/result?autoApprove=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field(
          'entries',
          JSON.stringify([{ userId: u.id, kills: 0, position: 1 }])
        )
        .attach('screenshot', VALID_JPEG_BUFFER, 'screenshot.jpg');

      // Reverse match
      await request(app)
        .post(`/api/v1/admin/results/${matchId}/reverse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Reconciliation test' });

      // Reconcile: sum of amounts in ledger == winning wallet balance
      const ledgerSumRes = await query<{ sum: string }>(
        `SELECT sum(amount)::numeric(12,2) AS sum FROM wallet_ledger WHERE user_id = $1 AND wallet = 'winning'`,
        [u.id]
      );
      const walletRes = await query<{ winning: string }>(
        `SELECT winning FROM wallets WHERE user_id = $1`,
        [u.id]
      );

      expect(ledgerSumRes.rows[0].sum).toBe(walletRes.rows[0].winning);
      expect(walletRes.rows[0].winning).toBe('50.00');
    });
  });
});
