/**
 * Tests for GET /staff/matches/:id team membership additions
 *
 * Requirements:
 *  1. In GET /staff/matches/:id add teamId (string or null) to every roster player.
 *  2. Add new field "teams" to response with id, name, size, status, leaderId, memberUserIds.
 *  3. Solo match has teamId null and teams [].
 *  4. Duo, Squad, and Clash Squad matches return correct teamId, status, leaderId, memberUserIds.
 *  5. Disbanded team is listed as disbanded and its refunded members are not in memberUserIds.
 *  6. Confirmed team whose member was refunded has memberUserIds shorter than size.
 *  7. Backward compatibility: all original fields and values are unchanged.
 *  8. Both employee and admin can call the endpoint.
 *  9. User token returns 401 UNAUTHENTICATED (same behavior as before).
 */

import crypto from 'crypto';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { truncateAllTables } from './setup.js';
import { query } from '../src/db/index.js';
import { createApp } from '../src/app.js';
import { signSessionToken } from '../src/utils/crypto.js';
import {
  formatDbNumeric,
} from '@booyah/shared';
import {
  createMatchStaff,
  openRoomStaff,
} from '../src/modules/matches/matches.staff.service.js';
import {
  createTeam,
  acceptInvite,
  disbandTeam,
} from '../src/modules/matches/teams.service.js';
import { joinMatchSolo } from '../src/modules/matches/matches.service.js';

const app = createApp({ enableRateLimiting: false });

let _ctr = 0;
const next = () => ++_ctr;

interface TestUser {
  id: string;
  email: string;
  ffId: string;
  name: string;
}

interface TestStaff {
  id: string;
  email: string;
  role: 'admin' | 'employee';
}

async function createUser(): Promise<TestUser> {
  const i = next();
  const mobile = '9' + String(i).padStart(9, '0');
  const ffId = `FF${String(i).padStart(8, '0')}`;
  const res = await query(
    `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
     VALUES ($1, $2, $3, $4, $5, $6, '1990-01-01', $7)
     RETURNING id, email, ff_id, name`,
    [
      `tuser${i}@test.com`,
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
  return {
    id:    row.id.toString(),
    email: row.email,
    ffId:  row.ff_id,
    name:  row.name,
  };
}

async function createStaff(role: 'admin' | 'employee' = 'employee'): Promise<TestStaff> {
  const i = next();
  const mobile = '8' + String(i).padStart(9, '0');
  const res = await query(
    `INSERT INTO staff (role, name, mobile, email) VALUES ($1, $2, $3, $4)
     RETURNING id, email, role`,
    [role, `Staff ${i}`, mobile, `tstaff${i}@test.com`]
  );
  return { id: res.rows[0].id.toString(), email: res.rows[0].email, role: res.rows[0].role as any };
}

async function createAuthToken(user: TestUser): Promise<string> {
  const sid = crypto.randomUUID();
  await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'user', $2)`, [
    sid,
    user.id,
  ]);
  return signSessionToken({ sub: user.id, typ: 'user', sid }, '1h');
}

async function createStaffToken(staff: TestStaff): Promise<string> {
  const sid = crypto.randomUUID();
  await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`, [
    sid,
    staff.id,
  ]);
  return signSessionToken({ sub: staff.id, typ: 'staff', sid, role: staff.role }, '12h');
}

async function setWallet(userId: string, addMoneyPaise = 5000) {
  await query(
    `UPDATE wallets SET add_money = $1, cashback = 0, winning = 0 WHERE user_id = $2`,
    [formatDbNumeric(addMoneyPaise), userId]
  );
}

async function createTier(gameMode: 'battle_royale' | 'clash_squad', teamMode: 'solo' | 'duo' | 'squad'): Promise<string> {
  const maxPlayers = gameMode === 'clash_squad' ? 8 : 48;
  const minPlayers = gameMode === 'clash_squad' ? 8 : 24;
  const res = await query(
    `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
     VALUES ($1, $2, '10.00', '5.00', 2, $3, $4)
     RETURNING id`,
    [gameMode, teamMode, maxPlayers, minPlayers]
  );
  const tierId = res.rows[0].id.toString();
  await query(
    `INSERT INTO tier_position_prizes (tier_id, position, prize) VALUES
       ($1, 1, '100.00'), ($1, 2, '60.00'), ($1, 3, '40.00')`,
    [tierId]
  );
  return tierId;
}

const futureIso = (minutesAhead = 60) =>
  new Date(Date.now() + minutesAhead * 60 * 1000).toISOString();

describe('GET /staff/matches/:id - Team Membership & Teams Array', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  it('Requirement 1 & 2: solo match returns teamId null for every player and teams []', async () => {
    const admin = await createStaff('admin');
    const adminToken = await createStaffToken(admin);

    const soloTierId = await createTier('battle_royale', 'solo');
    const match = await createMatchStaff(admin.id, {
      tierId: soloTierId,
      startTime: futureIso(30),
    });

    const player1 = await createUser();
    const player2 = await createUser();
    await setWallet(player1.id);
    await setWallet(player2.id);

    await joinMatchSolo(player1.id, match.id);
    await joinMatchSolo(player2.id, match.id);

    const res = await request(app)
      .get(`/api/v1/staff/matches/${match.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const matchData = res.body.data.match;
    expect(matchData.teamMode).toBe('solo');
    expect(matchData.teams).toEqual([]);
    expect(matchData.players).toHaveLength(2);
    expect(matchData.players[0].teamId).toBeNull();
    expect(matchData.players[1].teamId).toBeNull();
  });

  it('Requirement 2: duo match returns correct teamId, team status, leaderId and memberUserIds', async () => {
    const admin = await createStaff('admin');
    const adminToken = await createStaffToken(admin);

    const duoTierId = await createTier('battle_royale', 'duo');
    const match = await createMatchStaff(admin.id, {
      tierId: duoTierId,
      startTime: futureIso(30),
    });

    const leader = await createUser();
    const member = await createUser();
    await setWallet(leader.id);
    await setWallet(member.id);

    const team = await createTeam(leader.id, match.id, {
      teamName: 'Duo Champs',
      memberFfIds: [member.ffId],
    });

    // Team is formed directly and confirmed immediately
    const res = await request(app)
      .get(`/api/v1/staff/matches/${match.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const matchData = res.body.data.match;
    expect(matchData.teams).toHaveLength(1);
    expect(matchData.teams[0].id).toBe(team.id);
    expect(matchData.teams[0].name).toBe('Duo Champs');
    expect(matchData.teams[0].size).toBe(2);
    expect(matchData.teams[0].status).toBe('confirmed');
    expect(matchData.teams[0].leaderId).toBe(leader.id);
    expect(matchData.teams[0].memberUserIds).toEqual([leader.id, member.id]);
    expect(matchData.players).toHaveLength(2);
    expect(matchData.players[0].teamId).toBe(team.id);
    expect(matchData.players[1].teamId).toBe(team.id);
  });

  it('Requirement 2: squad match returns correct teamId, status, and 4 memberUserIds', async () => {
    const admin = await createStaff('admin');
    const adminToken = await createStaffToken(admin);

    const squadTierId = await createTier('battle_royale', 'squad');
    const match = await createMatchStaff(admin.id, {
      tierId: squadTierId,
      startTime: futureIso(30),
    });

    const leader = await createUser();
    const m1 = await createUser();
    const m2 = await createUser();
    const m3 = await createUser();
    for (const u of [leader, m1, m2, m3]) {
      await setWallet(u.id);
    }

    const team = await createTeam(leader.id, match.id, {
      teamName: 'Squad 1',
      memberFfIds: [m1.ffId, m2.ffId, m3.ffId],
    });

    // Squad team formed directly and confirmed immediately
    const res = await request(app)
      .get(`/api/v1/staff/matches/${match.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const matchData = res.body.data.match;
    expect(matchData.teams).toHaveLength(1);
    expect(matchData.teams[0].size).toBe(4);
    expect(matchData.teams[0].status).toBe('confirmed');
    expect(matchData.teams[0].memberUserIds).toEqual([leader.id, m1.id, m2.id, m3.id]);
    expect(matchData.players.map((p: any) => p.teamId)).toEqual([team.id, team.id, team.id, team.id]);
  });

  it('Requirement 2: Clash Squad match returns both teams with members and leaderIds', async () => {
    const admin = await createStaff('admin');
    const adminToken = await createStaffToken(admin);

    const csTierId = await createTier('clash_squad', 'squad');
    const match = await createMatchStaff(admin.id, {
      tierId: csTierId,
      startTime: futureIso(30),
    });

    // Team 1
    const l1 = await createUser();
    const t1_m1 = await createUser();
    const t1_m2 = await createUser();
    const t1_m3 = await createUser();
    for (const u of [l1, t1_m1, t1_m2, t1_m3]) await setWallet(u.id);

    const team1 = await createTeam(l1.id, match.id, {
      teamName: 'CS Team 1',
      memberFfIds: [t1_m1.ffId, t1_m2.ffId, t1_m3.ffId],
    });

    // Team 2
    const l2 = await createUser();
    const t2_m1 = await createUser();
    const t2_m2 = await createUser();
    const t2_m3 = await createUser();
    for (const u of [l2, t2_m1, t2_m2, t2_m3]) await setWallet(u.id);

    const team2 = await createTeam(l2.id, match.id, {
      teamName: 'CS Team 2',
      memberFfIds: [t2_m1.ffId, t2_m2.ffId, t2_m3.ffId],
    });

    const res = await request(app)
      .get(`/api/v1/staff/matches/${match.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const matchData = res.body.data.match;
    expect(matchData.teams).toHaveLength(2);
    expect(matchData.teams[0].id).toBe(team1.id);
    expect(matchData.teams[0].leaderId).toBe(l1.id);
    expect(matchData.teams[1].id).toBe(team2.id);
    expect(matchData.teams[1].leaderId).toBe(l2.id);
    expect(matchData.players).toHaveLength(8);
  });

  it('Requirement 2 & 5: disbanded team is listed as disbanded and its refunded members are not in memberUserIds', async () => {
    const admin = await createStaff('admin');
    const adminToken = await createStaffToken(admin);

    const duoTierId = await createTier('battle_royale', 'duo');
    const match = await createMatchStaff(admin.id, {
      tierId: duoTierId,
      startTime: futureIso(30),
    });

    const leader = await createUser();
    const member = await createUser();
    await setWallet(leader.id);
    await setWallet(member.id);

    const team = await createTeam(leader.id, match.id, {
      teamName: 'To Be Disbanded',
      memberFfIds: [member.ffId],
    });

    // Simulate team disbanded & refunded (e.g. by scheduler cancellation)
    await query(`UPDATE teams SET status = 'disbanded' WHERE id = $1`, [team.id]);
    await query(`UPDATE match_players SET refunded_at = now() WHERE team_id = $1`, [team.id]);

    const res = await request(app)
      .get(`/api/v1/staff/matches/${match.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const matchData = res.body.data.match;
    expect(matchData.teams).toHaveLength(1);
    expect(matchData.teams[0].id).toBe(team.id);
    expect(matchData.teams[0].status).toBe('disbanded');
    // Leader was refunded, so memberUserIds is empty
    expect(matchData.teams[0].memberUserIds).toEqual([]);
    expect(matchData.players[0].refundedAt).not.toBeNull();
  });

  it('Change 5: confirmed team whose member was refunded has memberUserIds shorter than size', async () => {
    const admin = await createStaff('admin');
    const adminToken = await createStaffToken(admin);

    const duoTierId = await createTier('battle_royale', 'duo');
    const match = await createMatchStaff(admin.id, {
      tierId: duoTierId,
      startTime: futureIso(30),
    });

    const leader = await createUser();
    const member = await createUser();
    await setWallet(leader.id);
    await setWallet(member.id);

    const team = await createTeam(leader.id, match.id, {
      teamName: 'Confirmed Duo',
      memberFfIds: [member.ffId],
    });

    // Mark the member as refunded (simulating partial refund)
    await query(
      'UPDATE match_players SET refunded_at = now() WHERE match_id = $1 AND user_id = $2',
      [match.id, member.id]
    );

    const res = await request(app)
      .get(`/api/v1/staff/matches/${match.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const matchData = res.body.data.match;
    const teamData = matchData.teams[0];
    expect(teamData.status).toBe('confirmed');
    expect(teamData.size).toBe(2);
    // Only leader remains non-refunded
    expect(teamData.memberUserIds).toEqual([leader.id]);
    expect(teamData.memberUserIds.length).toBeLessThan(teamData.size);
  });

  it('Change 4: backward-compatibility snapshot proving all previous fields and values are unchanged', async () => {
    const employee = await createStaff('employee');
    const empToken = await createStaffToken(employee);

    const soloTierId = await createTier('battle_royale', 'solo');
    const match = await createMatchStaff(employee.id, {
      tierId: soloTierId,
      startTime: futureIso(30),
    });
    await openRoomStaff(employee.id, match.id, 'ROOM123', 'PW123');

    const player = await createUser();
    await setWallet(player.id);
    await joinMatchSolo(player.id, match.id);

    const res = await request(app)
      .get(`/api/v1/staff/matches/${match.id}`)
      .set('Authorization', `Bearer ${empToken}`)
      .expect(200);

    const m = res.body.data.match;

    // All fields that existed in previous versions of the API
    expect(m).toHaveProperty('id', match.id);
    expect(m).toHaveProperty('tierId', soloTierId);
    expect(m).toHaveProperty('gameMode', 'battle_royale');
    expect(m).toHaveProperty('teamMode', 'solo');
    expect(m).toHaveProperty('entryFee', '10.00');
    expect(m).toHaveProperty('killPrice', '5.00');
    expect(m).toHaveProperty('minKillsForReward', 2);
    expect(m).toHaveProperty('positionPrizes');
    expect(m).toHaveProperty('maxPlayers', 48);
    expect(m).toHaveProperty('minPlayers', 24);
    expect(m).toHaveProperty('startTime');
    expect(m).toHaveProperty('roomId', 'ROOM123');
    expect(m).toHaveProperty('roomPassword', 'PW123');
    expect(m).toHaveProperty('status', 'room_open');
    expect(m).toHaveProperty('cancelReason', null);
    expect(m).toHaveProperty('createdBy', employee.id);
    expect(m).toHaveProperty('createdAt');
    expect(m).toHaveProperty('joinedCount', 1);

    // Player object existing fields
    const p = m.players[0];
    expect(p).toHaveProperty('userId', player.id);
    expect(p).toHaveProperty('name', player.name);
    expect(p).toHaveProperty('ffId', player.ffId);
    expect(p).toHaveProperty('paidAddMoney', '10.00');
    expect(p).toHaveProperty('paidCashback', '0.00');
    expect(p).toHaveProperty('paidWinning', '0.00');
    expect(p).toHaveProperty('refundedAt', null);
    expect(p).toHaveProperty('joinedAt');

    // Additive fields
    expect(p).toHaveProperty('teamId', null);
    expect(m).toHaveProperty('teams', []);
  });

  it('Requirement 8: both employee and admin can call GET /staff/matches/:id', async () => {
    const admin = await createStaff('admin');
    const employee = await createStaff('employee');
    const adminToken = await createStaffToken(admin);
    const empToken = await createStaffToken(employee);

    const soloTierId = await createTier('battle_royale', 'solo');
    const match = await createMatchStaff(admin.id, {
      tierId: soloTierId,
      startTime: futureIso(30),
    });

    // Employee call
    const empRes = await request(app)
      .get(`/api/v1/staff/matches/${match.id}`)
      .set('Authorization', `Bearer ${empToken}`)
      .expect(200);
    expect(empRes.body.data.match.id).toBe(match.id);

    // Admin call
    const adminRes = await request(app)
      .get(`/api/v1/staff/matches/${match.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminRes.body.data.match.id).toBe(match.id);
  });

  it('Change 3: user token gets 401 UNAUTHENTICATED (exact guard behavior before change)', async () => {
    const admin = await createStaff('admin');
    const soloTierId = await createTier('battle_royale', 'solo');
    const match = await createMatchStaff(admin.id, {
      tierId: soloTierId,
      startTime: futureIso(30),
    });

    const user = await createUser();
    const userToken = await createAuthToken(user);

    const res = await request(app)
      .get(`/api/v1/staff/matches/${match.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('Requirement 8: missing auth token gets 401 UNAUTHENTICATED', async () => {
    const res = await request(app)
      .get(`/api/v1/staff/matches/999`)
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
