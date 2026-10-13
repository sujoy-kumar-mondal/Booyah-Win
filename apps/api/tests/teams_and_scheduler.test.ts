/**
 * Milestone 6 – Teams Lifecycle, Teammate Invites, Scheduler Tick & Cutoffs.
 */

import crypto from 'crypto';
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
  createMatchStaff,
  goLiveStaff,
  openRoomStaff,
  cancelMatchStaff,
} from '../src/modules/matches/matches.staff.service.js';
import {
  listMatchesUser,
  getMatchUser,
  joinMatchSolo,
} from '../src/modules/matches/matches.service.js';
import {
  createTeam,
  listUserInvites,
  acceptInvite,
  declineInvite,
  replaceInvite,
  disbandTeam,
} from '../src/modules/matches/teams.service.js';
import { runSchedulerTick } from '../src/modules/matches/scheduler.service.js';

process.env.CRON_SECRET = 'test-cron-secret-12345';
const app = createApp({ enableRateLimiting: false });

let _ctr = 0;
const next = () => ++_ctr;

interface TestUser {
  id: string;
  email: string;
  ffId: string;
  upiId: string;
  referralCode: string;
}

interface TestStaff {
  id: string;
  email: string;
  role: 'admin' | 'employee';
}

async function createUser(opts: { referredBy?: string } = {}): Promise<TestUser> {
  const i = next();
  const mobile = '9' + String(i).padStart(9, '0');
  const ffId = `FF${String(i).padStart(8, '0')}`;
  const res = await query(
    `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code, referred_by)
     VALUES ($1, $2, $3, $4, $5, $6, '1990-01-01', $7, $8)
     RETURNING id, email, ff_id, upi_id, referral_code`,
    [
      `tuser${i}@test.com`,
      `User ${i}`,
      mobile,
      ffId,
      `FFN${i}`,
      `upi${i}@test`,
      `REF${String(i).padStart(6, '0')}`,
      opts.referredBy ?? null,
    ]
  );
  const row = res.rows[0];
  await query('INSERT INTO wallets (user_id) VALUES ($1)', [row.id]);
  return {
    id:           row.id.toString(),
    email:        row.email,
    ffId:         row.ff_id,
    upiId:        row.upi_id,
    referralCode: row.referral_code,
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

async function setWallet(userId: string, addMoney = 0, cashback = 0, winning = 0) {
  await query(
    `UPDATE wallets SET add_money = $1, cashback = $2, winning = $3 WHERE user_id = $4`,
    [formatDbNumeric(addMoney), formatDbNumeric(cashback), formatDbNumeric(winning), userId]
  );
}

async function getWallet(userId: string) {
  const r = await query('SELECT add_money, cashback, winning FROM wallets WHERE user_id = $1', [userId]);
  const row = r.rows[0];
  return {
    addMoney: stringToPaise(row.add_money.toString()),
    cashback:  stringToPaise(row.cashback.toString()),
    winning:   stringToPaise(row.winning.toString()),
  };
}

async function createReferral(referrerId: string, referredId: string, reward = '5.00') {
  await query(
    `INSERT INTO referrals (referrer_id, referred_id, reward) VALUES ($1, $2, $3)`,
    [referrerId, referredId, reward]
  );
}

async function createSquadBRTier(overrides: { entryFee?: string; maxPlayers?: number; minPlayers?: number } = {}): Promise<string> {
  const entryFee   = overrides.entryFee   ?? '10.00';
  const maxPlayers = overrides.maxPlayers ?? 48;
  const minPlayers = overrides.minPlayers ?? 24;

  const res = await query(
    `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
     VALUES ('battle_royale', 'squad', $1, '5.00', 2, $2, $3)
     RETURNING id`,
    [entryFee, maxPlayers, minPlayers]
  );
  const tierId = res.rows[0].id.toString();
  await query(
    `INSERT INTO tier_position_prizes (tier_id, position, prize) VALUES
       ($1, 1, '100.00'), ($1, 2, '60.00'), ($1, 3, '40.00')`,
    [tierId]
  );
  return tierId;
}

async function createDuoBRTier(overrides: { entryFee?: string; maxPlayers?: number; minPlayers?: number } = {}): Promise<string> {
  const entryFee   = overrides.entryFee   ?? '10.00';
  const maxPlayers = overrides.maxPlayers ?? 48;
  const minPlayers = overrides.minPlayers ?? 24;

  const res = await query(
    `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
     VALUES ('battle_royale', 'duo', $1, '5.00', 2, $2, $3)
     RETURNING id`,
    [entryFee, maxPlayers, minPlayers]
  );
  const tierId = res.rows[0].id.toString();
  await query(
    `INSERT INTO tier_position_prizes (tier_id, position, prize) VALUES ($1, 1, '50.00')`,
    [tierId]
  );
  return tierId;
}

async function createClashSquadTier(overrides: { entryFee?: string } = {}): Promise<string> {
  const entryFee = overrides.entryFee ?? '50.00';
  const res = await query(
    `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
     VALUES ('clash_squad', 'squad', $1, '0.00', 0, 8, 8)
     RETURNING id`,
    [entryFee]
  );
  const tierId = res.rows[0].id.toString();
  await query(
    `INSERT INTO tier_position_prizes (tier_id, position, prize) VALUES ($1, 1, '75.00')`,
    [tierId]
  );
  return tierId;
}

describe('Milestone 6: Teams, Invites, Disband, Scheduler & Cutoffs', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  // ─── 1. Capacity Conflicts (20 users creating teams on limited seats) ─────────
  it('20 users create capacity conflicts at once so no match ever exceeds max seats', async () => {
    const admin = await createStaff('admin');
    // Squad tier with max 8 seats (exactly 2 squad teams of 4)
    const tierId = await createSquadBRTier({ maxPlayers: 8, minPlayers: 8 });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    // 20 potential leaders, each with 3 teammates
    const leaders: TestUser[] = [];
    const teammatesPerLeader: TestUser[][] = [];

    for (let i = 0; i < 20; i++) {
      const leader = await createUser();
      await setWallet(leader.id, 5000, 0, 0);
      leaders.push(leader);

      const m1 = await createUser();
      const m2 = await createUser();
      const m3 = await createUser();
      teammatesPerLeader.push([m1, m2, m3]);
    }

    // Attempt 20 concurrent team creations
    const results = await Promise.allSettled(
      leaders.map((leader, idx) =>
        createTeam(leader.id, match.id, {
          teamName: `Team ${idx}`,
          memberFfIds: teammatesPerLeader[idx].map((m) => m.ffId),
        })
      )
    );

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // Exactly 2 teams can be created for 8 seats (4 seats each)
    expect(successes).toHaveLength(2);
    expect(failures).toHaveLength(18);

    for (const f of failures) {
      expect((f as PromiseRejectedResult).reason?.code).toBe(ErrorCodes.MATCH_FULL);
    }

    // Verify seats taken in DB
    const teamsInDb = await query(
      `SELECT count(*)::int AS count, SUM(size)::int AS seats FROM teams WHERE match_id = $1 AND status = 'forming'`,
      [match.id]
    );
    expect(teamsInDb.rows[0].count).toBe(2);
    expect(teamsInDb.rows[0].seats).toBe(8);
  });

  // ─── 2. Clash Squad rejects a third team ──────────────────────────────────────
  it('Clash Squad rejects a third team (allows at most 2 teams)', async () => {
    const admin = await createStaff('admin');
    const tierId = await createClashSquadTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const l1 = await createUser();
    const m1_1 = await createUser();
    const m1_2 = await createUser();
    const m1_3 = await createUser();
    await setWallet(l1.id, 5000, 0, 0);

    const l2 = await createUser();
    const m2_1 = await createUser();
    const m2_2 = await createUser();
    const m2_3 = await createUser();
    await setWallet(l2.id, 5000, 0, 0);

    const l3 = await createUser();
    const m3_1 = await createUser();
    const m3_2 = await createUser();
    const m3_3 = await createUser();
    await setWallet(l3.id, 5000, 0, 0);

    // Team 1 succeeds
    await expect(
      createTeam(l1.id, match.id, { memberFfIds: [m1_1.ffId, m1_2.ffId, m1_3.ffId] })
    ).resolves.toBeDefined();

    // Team 2 succeeds
    await expect(
      createTeam(l2.id, match.id, { memberFfIds: [m2_1.ffId, m2_2.ffId, m2_3.ffId] })
    ).resolves.toBeDefined();

    // Team 3 rejected
    await expect(
      createTeam(l3.id, match.id, { memberFfIds: [m3_1.ffId, m3_2.ffId, m3_3.ffId] })
    ).rejects.toMatchObject({ code: ErrorCodes.MATCH_FULL, statusCode: 409 });
  });

  // ─── 3. Forming team of 4 where 3 accept and 1 never does is disbanded at cutoff ─
  it('team of 4 where 3 accept and 1 never does is disbanded at cutoff with exact refunds', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSquadBRTier({ entryFee: '10.00' });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const leader = await createUser();
    const m1 = await createUser();
    const m2 = await createUser();
    const m3 = await createUser();

    await setWallet(leader.id, 1000, 0, 0); // Rs10
    await setWallet(m1.id, 1000, 0, 0);
    await setWallet(m2.id, 1000, 0, 0);
    await setWallet(m3.id, 1000, 0, 0);

    const team = await createTeam(leader.id, match.id, {
      memberFfIds: [m1.ffId, m2.ffId, m3.ffId],
    });

    // m1 and m2 accept
    const invites = await query<{ id: number; invited_user_id: number }>(
      `SELECT id, invited_user_id FROM team_invites WHERE team_id = $1`,
      [team.id]
    );
    const inv1 = invites.rows.find((r) => r.invited_user_id.toString() === m1.id)!;
    const inv2 = invites.rows.find((r) => r.invited_user_id.toString() === m2.id)!;
    const inv3 = invites.rows.find((r) => r.invited_user_id.toString() === m3.id)!;

    await acceptInvite(m1.id, inv1.id.toString());
    await acceptInvite(m2.id, inv2.id.toString());
    // m3 never accepts

    // Wallets charged for leader, m1, m2
    expect((await getWallet(leader.id)).addMoney).toBe(0);
    expect((await getWallet(m1.id)).addMoney).toBe(0);
    expect((await getWallet(m2.id)).addMoney).toBe(0);
    expect((await getWallet(m3.id)).addMoney).toBe(1000); // untouched

    // Move start_time to within 10 minutes of now() in DB
    await query(
      `UPDATE matches SET start_time = now() + INTERVAL '5 minutes' WHERE id = $1`,
      [match.id]
    );

    // Run tick
    const tickRes = await runSchedulerTick();
    expect(tickRes.disbandedTeamsCount).toBeGreaterThanOrEqual(1);

    // Team status is disbanded
    const teamDb = await query(`SELECT status FROM teams WHERE id = $1`, [team.id]);
    expect(teamDb.rows[0].status).toBe('disbanded');

    // All paid members refunded exactly
    expect((await getWallet(leader.id)).addMoney).toBe(1000);
    expect((await getWallet(m1.id)).addMoney).toBe(1000);
    expect((await getWallet(m2.id)).addMoney).toBe(1000);
    expect((await getWallet(m3.id)).addMoney).toBe(1000);

    // m3's pending invite is now expired
    const inv3Db = await query(`SELECT status FROM team_invites WHERE id = $1`, [inv3.id]);
    expect(inv3Db.rows[0].status).toBe('expired');
  });

  // ─── 4. Accept with low balance leaves invite pending ─────────────────────────
  it('accept with low balance leaves the invite pending', async () => {
    const admin = await createStaff('admin');
    const tierId = await createDuoBRTier({ entryFee: '10.00' });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const leader = await createUser();
    const teammate = await createUser();
    await setWallet(leader.id, 1000, 0, 0);
    await setWallet(teammate.id, 500, 0, 0); // only Rs5, fee is Rs10

    const team = await createTeam(leader.id, match.id, { memberFfIds: [teammate.ffId] });
    const invites = await listUserInvites(teammate.id);
    expect(invites).toHaveLength(1);
    const inviteId = invites[0].id;

    // Teammate attempts accept -> 402 LOW_BALANCE
    await expect(
      acceptInvite(teammate.id, inviteId)
    ).rejects.toMatchObject({ code: ErrorCodes.LOW_BALANCE, statusCode: 402 });

    // Invite is still pending in DB
    const invDb = await query(`SELECT status FROM team_invites WHERE id = $1`, [inviteId]);
    expect(invDb.rows[0].status).toBe('pending');

    // Teammate adds money and retries -> succeeds
    await setWallet(teammate.id, 1500, 0, 0);
    await expect(acceptInvite(teammate.id, inviteId)).resolves.toBeUndefined();

    // Now accepted and team confirmed
    const invDbAfter = await query(`SELECT status FROM team_invites WHERE id = $1`, [inviteId]);
    expect(invDbAfter.rows[0].status).toBe('accepted');
    const teamDbAfter = await query(`SELECT status FROM teams WHERE id = $1`, [team.id]);
    expect(teamDbAfter.rows[0].status).toBe('confirmed');
  });

  // ─── 5. Two simultaneous accepts of different invites on same team ────────────
  it('two simultaneous accepts of different invites succeed and confirm team', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSquadBRTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const leader = await createUser();
    const m1 = await createUser();
    const m2 = await createUser();
    const m3 = await createUser();
    await setWallet(leader.id, 1000, 0, 0);
    await setWallet(m1.id, 1000, 0, 0);
    await setWallet(m2.id, 1000, 0, 0);
    await setWallet(m3.id, 1000, 0, 0);

    const team = await createTeam(leader.id, match.id, {
      memberFfIds: [m1.ffId, m2.ffId, m3.ffId],
    });

    const inv1 = (await listUserInvites(m1.id))[0];
    const inv2 = (await listUserInvites(m2.id))[0];
    const inv3 = (await listUserInvites(m3.id))[0];

    // m1 accepts first
    await acceptInvite(m1.id, inv1.id);

    // m2 and m3 accept at the exact same instant
    const results = await Promise.allSettled([
      acceptInvite(m2.id, inv2.id),
      acceptInvite(m3.id, inv3.id),
    ]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('fulfilled');

    // All 4 members confirmed
    const teamDb = await query(`SELECT status FROM teams WHERE id = $1`, [team.id]);
    expect(teamDb.rows[0].status).toBe('confirmed');
  });

  // ─── 6. Leader disband vs teammate accept race ─────────────────────────────────
  it('leader disband versus teammate accept race: no double charge, no lost refund', async () => {
    const admin = await createStaff('admin');
    const tierId = await createDuoBRTier({ entryFee: '10.00' });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const leader = await createUser();
    const teammate = await createUser();
    await setWallet(leader.id, 1000, 0, 0);
    await setWallet(teammate.id, 1000, 0, 0);

    await createTeam(leader.id, match.id, { memberFfIds: [teammate.ffId] });
    const invite = (await listUserInvites(teammate.id))[0];

    // Race: leader disbands while teammate accepts
    await Promise.allSettled([
      disbandTeam(leader.id, match.id),
      acceptInvite(teammate.id, invite.id),
    ]);

    // Leader always refunded
    const leaderW = await getWallet(leader.id);
    expect(leaderW.addMoney).toBe(1000);

    // Teammate wallet must either have never been charged or refunded
    const teammateW = await getWallet(teammate.id);
    expect(teammateW.addMoney).toBe(1000);

    // If teammate had a match_players row inserted, it must be refunded
    const mpRows = await query(
      `SELECT refunded_at FROM match_players WHERE match_id = $1 AND user_id = $2`,
      [match.id, teammate.id]
    );
    if (mpRows.rowCount) {
      expect(mpRows.rows[0].refunded_at).not.toBeNull();
    }
  });

  // ─── 7. Replace flow ──────────────────────────────────────────────────────────
  it('leader replaces a declined/expired invite; new user receives invite and accepts', async () => {
    const admin = await createStaff('admin');
    const tierId = await createDuoBRTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const leader = await createUser();
    const mOld = await createUser();
    const mNew = await createUser();
    await setWallet(leader.id, 1000, 0, 0);
    await setWallet(mOld.id, 1000, 0, 0);
    await setWallet(mNew.id, 1000, 0, 0);

    const team = await createTeam(leader.id, match.id, { memberFfIds: [mOld.ffId] });
    const oldInv = (await listUserInvites(mOld.id))[0];

    // mOld declines
    await declineInvite(mOld.id, oldInv.id);

    // Leader replaces mOld with mNew
    await replaceInvite(leader.id, match.id, { oldFfId: mOld.ffId, newFfId: mNew.ffId });

    // mOld invite is expired in DB
    const oldDb = await query(`SELECT status FROM team_invites WHERE id = $1`, [oldInv.id]);
    expect(oldDb.rows[0].status).toBe('expired');

    // mNew has pending invite
    const newInvs = await listUserInvites(mNew.id);
    expect(newInvs).toHaveLength(1);
    expect(newInvs[0].status).toBe('pending');

    // mNew accepts
    await acceptInvite(mNew.id, newInvs[0].id);

    // Team confirmed
    const teamDb = await query(`SELECT status FROM teams WHERE id = $1`, [team.id]);
    expect(teamDb.rows[0].status).toBe('confirmed');
  });

  // ─── 8. First-match referral credits once per user across leader and member ───
  it('first-match referral credits once per user across leader and member paths', async () => {
    const admin = await createStaff('admin');
    const tierId = await createDuoBRTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const m1 = await createMatchStaff(admin.id, { tierId, startTime });
    const m2 = await createMatchStaff(admin.id, { tierId, startTime });

    const referrer = await createUser();
    const referred = await createUser({ referredBy: referrer.id });
    await createReferral(referrer.id, referred.id, '5.00');

    const buddy = await createUser();
    await setWallet(referred.id, 5000, 0, 0);
    await setWallet(buddy.id, 5000, 0, 0);

    // First match as team leader credits referrer
    await createTeam(referred.id, m1.id, { memberFfIds: [buddy.ffId] });
    const refW1 = await getWallet(referrer.id);
    expect(refW1.cashback).toBe(500); // Rs5.00

    // Second match as teammate member does not credit again
    const buddyTeam = await createTeam(buddy.id, m2.id, { memberFfIds: [referred.ffId] });
    const inv = (await listUserInvites(referred.id))[0];
    await acceptInvite(referred.id, inv.id);

    const refW2 = await getWallet(referrer.id);
    expect(refW2.cashback).toBe(500); // unchanged
  });

  // ─── 9. Concurrency: Leader & Member referrers overlap x20 with no deadlock ────
  it('no deadlock when leader and member referrers overlap (repeated 20 times)', async () => {
    const admin = await createStaff('admin');
    const tierId = await createDuoBRTier({ entryFee: '10.00' });
    const startTime = new Date(Date.now() + 3600000).toISOString();

    for (let round = 0; round < 20; round++) {
      const match = await createMatchStaff(admin.id, { tierId, startTime });

      const commonReferrer = await createUser();
      const leader = await createUser({ referredBy: commonReferrer.id });
      const member = await createUser({ referredBy: commonReferrer.id });
      await createReferral(commonReferrer.id, leader.id, '5.00');
      await createReferral(commonReferrer.id, member.id, '5.00');

      await setWallet(leader.id, 1000, 0, 0);
      await setWallet(member.id, 1000, 0, 0);

      const team = await createTeam(leader.id, match.id, { memberFfIds: [member.ffId] });
      const invite = (await listUserInvites(member.id))[0];

      // Simulate simultaneous accept and another concurrent wallet action on leader
      const results = await Promise.allSettled([
        acceptInvite(member.id, invite.id),
        setWallet(leader.id, 2000, 0, 0),
      ]);

      for (const r of results) {
        if (r.status === 'rejected') {
          const err = (r as PromiseRejectedResult).reason;
          expect(err?.code).not.toBe('40P01');
        }
      }
    }
  });

  // ─── 10. Change #1: Accept and Disband simultaneously 20x without deadlock ─────
  it('runs accept and disband simultaneously 20 times with no 40P01 errors', async () => {
    const admin = await createStaff('admin');
    const tierId = await createDuoBRTier({ entryFee: '10.00' });
    const startTime = new Date(Date.now() + 3600000).toISOString();

    for (let round = 0; round < 20; round++) {
      const match = await createMatchStaff(admin.id, { tierId, startTime });

      const leader = await createUser();
      const member = await createUser();
      await setWallet(leader.id, 1000, 0, 0);
      await setWallet(member.id, 1000, 0, 0);

      await createTeam(leader.id, match.id, { memberFfIds: [member.ffId] });
      const invite = (await listUserInvites(member.id))[0];

      const results = await Promise.allSettled([
        disbandTeam(leader.id, match.id),
        acceptInvite(member.id, invite.id),
      ]);

      for (const r of results) {
        if (r.status === 'rejected') {
          const err = (r as PromiseRejectedResult).reason;
          expect(err?.code).not.toBe('40P01');
        }
      }
    }
  });

  // ─── 11. Tick endpoint rejects missing / wrong secret ─────────────────────────
  it('tick endpoint rejects wrong or missing x-cron-secret with 401 UNAUTHENTICATED', async () => {
    // Missing header
    const res1 = await request(app).post('/api/v1/internal/jobs/tick');
    expect(res1.status).toBe(401);
    expect(res1.body.error.code).toBe(ErrorCodes.UNAUTHENTICATED);

    // Wrong header
    const res2 = await request(app)
      .post('/api/v1/internal/jobs/tick')
      .set('x-cron-secret', 'wrong-secret');
    expect(res2.status).toBe(401);
    expect(res2.body.error.code).toBe(ErrorCodes.UNAUTHENTICATED);

    // Correct header
    const res3 = await request(app)
      .post('/api/v1/internal/jobs/tick')
      .set('x-cron-secret', 'test-cron-secret-12345');
    expect(res3.status).toBe(200);
    expect(res3.body.data).toBeDefined();
  });

  // ─── 12. Idempotent Tick: Running tick twice at once refunds only once ─────────
  it('running tick twice at once refunds only once', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSquadBRTier({ entryFee: '10.00' });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const leader = await createUser();
    const m1 = await createUser();
    const m2 = await createUser();
    const m3 = await createUser();
    await setWallet(leader.id, 1000, 0, 0);
    await setWallet(m1.id, 1000, 0, 0);

    const team = await createTeam(leader.id, match.id, {
      memberFfIds: [m1.ffId, m2.ffId, m3.ffId],
    });
    const inv1 = (await listUserInvites(m1.id))[0];
    await acceptInvite(m1.id, inv1.id);

    // Set match within 10 minutes cutoff
    await query(
      `UPDATE matches SET start_time = now() + INTERVAL '5 minutes' WHERE id = $1`,
      [match.id]
    );

    // Run tick twice concurrently
    await Promise.all([runSchedulerTick(), runSchedulerTick()]);

    // Wallets refunded exactly once
    const leaderW = await getWallet(leader.id);
    const m1W = await getWallet(m1.id);
    expect(leaderW.addMoney).toBe(1000);
    expect(m1W.addMoney).toBe(1000);
  });

  // ─── 13. Auto-cancel underfilled matches past start_time ──────────────────────
  it('auto-cancel underfilled matches past start_time with reason Not enough players', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier({ entryFee: '10.00', minPlayers: 10 });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const u1 = await createUser();
    await setWallet(u1.id, 1000, 0, 0);
    await joinMatchSolo(u1.id, match.id);

    // Move start_time into the past
    await query(
      `UPDATE matches SET start_time = now() - INTERVAL '1 minute' WHERE id = $1`,
      [match.id]
    );

    // Run tick
    const tickRes = await runSchedulerTick();
    expect(tickRes.cancelledMatchesCount).toBeGreaterThanOrEqual(1);

    // Match cancelled with reason
    const mDb = await query(`SELECT status, cancel_reason FROM matches WHERE id = $1`, [match.id]);
    expect(mDb.rows[0].status).toBe('cancelled');
    expect(mDb.rows[0].cancel_reason).toBe('Not enough players');

    // u1 refunded
    const u1W = await getWallet(u1.id);
    expect(u1W.addMoney).toBe(1000);
  });

  it('auto-cancels expired matches past start_time that never went live and refuses openRoomStaff', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier({ entryFee: '10.00', minPlayers: 1 });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const u1 = await createUser();
    await setWallet(u1.id, 1000, 0, 0);
    await joinMatchSolo(u1.id, match.id);

    // Fast-forward start_time into the past
    await query(
      `UPDATE matches SET start_time = now() - INTERVAL '30 minutes' WHERE id = $1`,
      [match.id]
    );

    // Attempting to open room for an expired match must be refused
    await expect(
      openRoomStaff(admin.id, match.id, 'ROOM123', 'PASS123')
    ).rejects.toThrow(/expired/i);

    // Run scheduler tick
    const tickRes = await runSchedulerTick();
    expect(tickRes.cancelledMatchesCount).toBeGreaterThanOrEqual(1);

    // Verify match is cancelled and refund issued
    const mDb = await query(`SELECT status, cancel_reason FROM matches WHERE id = $1`, [match.id]);
    expect(mDb.rows[0].status).toBe('cancelled');
    expect(mDb.rows[0].cancel_reason).toBe('Match start time expired');

    const u1W = await getWallet(u1.id);
    expect(u1W.addMoney).toBe(1000);
  });

  // ─── 14. Ledger reconciliation after teams, disbands and cancels ──────────────
  it('ledger reconciliation after teams, disbands and cancels', async () => {
    const admin = await createStaff('admin');
    const tierId = await createDuoBRTier({ entryFee: '10.00' });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const leader = await createUser();
    const teammate = await createUser();
    await setWallet(leader.id, 2000, 50, 1000);
    await setWallet(teammate.id, 2000, 50, 1000);

    await createTeam(leader.id, match.id, { memberFfIds: [teammate.ffId] });
    const inv = (await listUserInvites(teammate.id))[0];
    await acceptInvite(teammate.id, inv.id);

    // Disband team
    await disbandTeam(leader.id, match.id);

    // Leader wallet matches ledger total_after
    const leaderLedger = await query(
      `SELECT total_after FROM wallet_ledger WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
      [leader.id]
    );
    const leaderW = await getWallet(leader.id);
    const leaderTotal = leaderW.addMoney + leaderW.cashback + leaderW.winning;
    expect(stringToPaise(leaderLedger.rows[0].total_after.toString())).toBe(leaderTotal);

    // Teammate wallet matches ledger total_after
    const teammateLedger = await query(
      `SELECT total_after FROM wallet_ledger WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
      [teammate.id]
    );
    const teammateW = await getWallet(teammate.id);
    const teammateTotal = teammateW.addMoney + teammateW.cashback + teammateW.winning;
    expect(stringToPaise(teammateLedger.rows[0].total_after.toString())).toBe(teammateTotal);
  });

  // ─── 15. Change #2: Partial unique index on match_players ─────────────────────
  it('partial unique index allows team recreation, solo rejoining, and capacity ignores refunded', async () => {
    const admin = await createStaff('admin');
    const tierId = await createDuoBRTier({ entryFee: '10.00', maxPlayers: 2 });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const leader = await createUser();
    const teammate = await createUser();
    await setWallet(leader.id, 5000, 0, 0);
    await setWallet(teammate.id, 5000, 0, 0);

    // 1. Create team & accept
    await createTeam(leader.id, match.id, { memberFfIds: [teammate.ffId] });
    const inv1 = (await listUserInvites(teammate.id))[0];
    await acceptInvite(teammate.id, inv1.id);

    // 2. Disband team
    await disbandTeam(leader.id, match.id);

    // 3. Leader can recreate a team on the same match without unique constraint failure
    await expect(
      createTeam(leader.id, match.id, { memberFfIds: [teammate.ffId] })
    ).resolves.toBeDefined();

    // 4. Capacity ignores refunded rows: seats taken is 2 (current forming team), not 4
    const list = await listMatchesUser(leader.id);
    const mInfo = list.find((m) => m.id === match.id);
    expect(mInfo?.seatsTaken).toBe(2);
  });

  // ─── 16. Change #4: Cutoff enforcement in endpoints with database clock ────────
  it('enforces 10m cutoff in endpoints: create, accept, replace, disband return 409 MATCH_NOT_JOINABLE', async () => {
    const admin = await createStaff('admin');
    const tierId = await createDuoBRTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const leader = await createUser();
    const teammate = await createUser();
    const replacer = await createUser();
    await setWallet(leader.id, 5000, 0, 0);
    await setWallet(teammate.id, 5000, 0, 0);
    await setWallet(replacer.id, 5000, 0, 0);

    await createTeam(leader.id, match.id, { memberFfIds: [teammate.ffId] });
    const inv = (await listUserInvites(teammate.id))[0];

    // Move start_time to within 10 minutes (now() + 5 minutes)
    await query(
      `UPDATE matches SET start_time = now() + INTERVAL '5 minutes' WHERE id = $1`,
      [match.id]
    );

    // 1. Another user cannot create team -> 409 MATCH_NOT_JOINABLE
    const l2 = await createUser();
    const m2 = await createUser();
    await setWallet(l2.id, 5000, 0, 0);
    await expect(
      createTeam(l2.id, match.id, { memberFfIds: [m2.ffId] })
    ).rejects.toMatchObject({ code: ErrorCodes.MATCH_NOT_JOINABLE, statusCode: 409 });

    // 2. Teammate cannot accept -> 409 MATCH_NOT_JOINABLE
    await expect(
      acceptInvite(teammate.id, inv.id)
    ).rejects.toMatchObject({ code: ErrorCodes.MATCH_NOT_JOINABLE, statusCode: 409 });

    // 3. Leader cannot replace -> 409 MATCH_NOT_JOINABLE
    await expect(
      replaceInvite(leader.id, match.id, { oldFfId: teammate.ffId, newFfId: replacer.ffId })
    ).rejects.toMatchObject({ code: ErrorCodes.MATCH_NOT_JOINABLE, statusCode: 409 });

    // 4. Leader cannot disband -> 409 MATCH_NOT_JOINABLE
    await expect(
      disbandTeam(leader.id, match.id)
    ).rejects.toMatchObject({ code: ErrorCodes.MATCH_NOT_JOINABLE, statusCode: 409 });
  });

  // ─── 17. Change #5: Expire replaced invites & allow re-inviting ───────────────
  it('expires replaced invites and allows re-inviting previously declined/expired user on same team', async () => {
    const admin = await createStaff('admin');
    const tierId = await createDuoBRTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const leader = await createUser();
    const playerA = await createUser();
    const playerB = await createUser();
    await setWallet(leader.id, 5000, 0, 0);
    await setWallet(playerA.id, 5000, 0, 0);
    await setWallet(playerB.id, 5000, 0, 0);

    const team = await createTeam(leader.id, match.id, { memberFfIds: [playerA.ffId] });
    const invA = (await listUserInvites(playerA.id))[0];

    // Replace A with B -> A is expired, B is pending
    await replaceInvite(leader.id, match.id, { oldFfId: playerA.ffId, newFfId: playerB.ffId });
    const invAExpired = await query(`SELECT status FROM team_invites WHERE id = $1`, [invA.id]);
    expect(invAExpired.rows[0].status).toBe('expired');

    // Replace B back with A -> reactivates A's row to pending!
    await replaceInvite(leader.id, match.id, { oldFfId: playerB.ffId, newFfId: playerA.ffId });
    const invAReactivated = await query(`SELECT status FROM team_invites WHERE id = $1`, [invA.id]);
    expect(invAReactivated.rows[0].status).toBe('pending');

    // A accepts -> team confirmed
    await acceptInvite(playerA.id, invA.id);
    const teamDb = await query(`SELECT status FROM teams WHERE id = $1`, [team.id]);
    expect(teamDb.rows[0].status).toBe('confirmed');
  });

  // ─── 18. Match cannot go live until minimum players requirement is fulfilled ─
  it("go-live rejects an underfilled match until minimum players requirement is fulfilled", async () => {
    const admin = await createStaff('admin');
    const employee = await createStaff('employee');
    const tierId = await createSoloBRTier({ minPlayers: 10 });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    // Open room
    await openRoomStaff(employee.id, match.id, 'ROOM1', 'PASS1');

    // Only 1 player joined (min is 10)
    const u1 = await createUser();
    await setWallet(u1.id, 1000, 0, 0);
    await joinMatchSolo(u1.id, match.id);

    // Employee cannot force live -> 400 INVALID_TRANSITION
    await expect(
      goLiveStaff(employee.id, match.id, employee.role)
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_TRANSITION, statusCode: 400 });

    // Admin also CANNOT force live when underfilled -> 400 INVALID_TRANSITION
    await expect(
      goLiveStaff(admin.id, match.id, admin.role)
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_TRANSITION, statusCode: 400 });

    // Fill remaining 9 players so min is reached (10/10)
    for (let i = 2; i <= 10; i++) {
      const u = await createUser();
      await setWallet(u.id, 1000, 0, 0);
      await joinMatchSolo(u.id, match.id);
    }

    // Now min requirement is fulfilled -> goes live successfully!
    await expect(
      goLiveStaff(admin.id, match.id, admin.role)
    ).resolves.toBeUndefined();

    const mDb = await query(`SELECT status FROM matches WHERE id = $1`, [match.id]);
    expect(mDb.rows[0].status).toBe('live');
  });

  // ─── 19. Change #7: Seat-count invariant test on 8-seat match ─────────────────
  it('seat-count invariant holds after a mix of creates, disbands and refunds on 8-seat match', async () => {
    const admin = await createStaff('admin');
    const tierId = await createClashSquadTier(); // 8 seats, 4 per team
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const l1 = await createUser();
    const m1_1 = await createUser();
    const m1_2 = await createUser();
    const m1_3 = await createUser();
    await setWallet(l1.id, 5000, 0, 0);

    const l2 = await createUser();
    const m2_1 = await createUser();
    const m2_2 = await createUser();
    const m2_3 = await createUser();
    await setWallet(l2.id, 5000, 0, 0);

    // Initial state: 0 seats taken
    let list = await listMatchesUser(l1.id);
    expect(list[0].seatsTaken).toBe(0);

    // Team 1 forms: 4 seats taken
    await createTeam(l1.id, match.id, { memberFfIds: [m1_1.ffId, m1_2.ffId, m1_3.ffId] });
    list = await listMatchesUser(l1.id);
    expect(list[0].seatsTaken).toBe(4);

    // Team 2 forms: 8 seats taken (full)
    await createTeam(l2.id, match.id, { memberFfIds: [m2_1.ffId, m2_2.ffId, m2_3.ffId] });
    list = await listMatchesUser(l1.id);
    expect(list[0].seatsTaken).toBe(8);

    // Team 1 disbands: exactly 4 seats taken remaining
    await disbandTeam(l1.id, match.id);
    list = await listMatchesUser(l1.id);
    expect(list[0].seatsTaken).toBe(4);

    // Team 2 disbands: 0 seats taken remaining
    await disbandTeam(l2.id, match.id);
    list = await listMatchesUser(l1.id);
    expect(list[0].seatsTaken).toBe(0);
  });

  // ─── 20. Rate limit on team creation (10/min per user) ────────────────────────
  it('rate limits team creation to 10/min per user (429 on 11th request)', async () => {
    const rateLimitedApp = createApp({ enableRateLimiting: true });
    const admin = await createStaff('admin');
    const tierId = await createDuoBRTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();

    const matches: string[] = [];
    for (let i = 0; i < 11; i++) {
      const m = await createMatchStaff(admin.id, { tierId, startTime });
      matches.push(m.id);
    }

    const leader = await createUser();
    await setWallet(leader.id, 50000, 0, 0);
    const token = await createAuthToken(leader);

    const teammate = await createUser();

    for (let i = 0; i < 10; i++) {
      const res = await request(rateLimitedApp)
        .post(`/api/v1/matches/${matches[i]}/teams`)
        .set('Authorization', `Bearer ${token}`)
        .send({ memberFfIds: [teammate.ffId] });
      expect(res.status).toBe(201);
    }

    // 11th request receives 429 RATE_LIMITED
    const res11 = await request(rateLimitedApp)
      .post(`/api/v1/matches/${matches[10]}/teams`)
      .set('Authorization', `Bearer ${token}`)
      .send({ memberFfIds: [teammate.ffId] });
    expect(res11.status).toBe(429);
    expect(res11.body.error.code).toBe(ErrorCodes.RATE_LIMITED);
  });

  // ─── 21. Generic player not found error (404) ─────────────────────────────────
  it('returns generic player not found (404 NOT_FOUND) for missing or soft-deleted FF IDs', async () => {
    const admin = await createStaff('admin');
    const tierId = await createDuoBRTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const leader = await createUser();
    await setWallet(leader.id, 1000, 0, 0);

    // Non-existent FF ID
    await expect(
      createTeam(leader.id, match.id, { memberFfIds: ['NON_EXISTENT_FF_ID'] })
    ).rejects.toMatchObject({ code: ErrorCodes.NOT_FOUND, statusCode: 404 });

    // Soft-deleted user
    const deletedUser = await createUser();
    await query(`UPDATE users SET deleted_at = now() WHERE id = $1`, [deletedUser.id]);
    await expect(
      createTeam(leader.id, match.id, { memberFfIds: [deletedUser.ffId] })
    ).rejects.toMatchObject({ code: ErrorCodes.NOT_FOUND, statusCode: 404 });
  });

  // ─── 22. Direct HTTP test for GET /me/team-invites ───────────────────────────
  it('direct HTTP test for GET /me/team-invites returns invites with match & leader info', async () => {
    const admin = await createStaff('admin');
    const tierId = await createDuoBRTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const leader = await createUser();
    const teammate = await createUser();
    await setWallet(leader.id, 1000, 0, 0);

    await createTeam(leader.id, match.id, { teamName: 'Alpha Duo', memberFfIds: [teammate.ffId] });
    const teammateToken = await createAuthToken(teammate);

    const res = await request(app)
      .get('/api/v1/me/team-invites')
      .set('Authorization', `Bearer ${teammateToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.invites).toHaveLength(1);
    const inv = res.body.data.invites[0];
    expect(inv.teamName).toBe('Alpha Duo');
    expect(inv.teamSize).toBe(2);
    expect(inv.matchId).toBe(match.id);
    expect(inv.status).toBe('pending');
    expect(inv.leaderId).toBe(leader.id);
  });

  // ─── 23. Direct HTTP test for POST /team-invites/:id/decline ─────────────────
  it('direct HTTP test for POST /team-invites/:id/decline marks invite declined and preserves reserved seats', async () => {
    const admin = await createStaff('admin');
    const tierId = await createDuoBRTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const leader = await createUser();
    const teammate = await createUser();
    await setWallet(leader.id, 1000, 0, 0);

    await createTeam(leader.id, match.id, { memberFfIds: [teammate.ffId] });
    const teammateToken = await createAuthToken(teammate);

    const listRes = await request(app)
      .get('/api/v1/me/team-invites')
      .set('Authorization', `Bearer ${teammateToken}`);
    const inviteId = listRes.body.data.invites[0].id;

    // Decline via HTTP
    const declineRes = await request(app)
      .post(`/api/v1/team-invites/${inviteId}/decline`)
      .set('Authorization', `Bearer ${teammateToken}`);

    expect(declineRes.status).toBe(200);

    // Invite is now declined
    const invDb = await query(`SELECT status FROM team_invites WHERE id = $1`, [inviteId]);
    expect(invDb.rows[0].status).toBe('declined');

    // Seat stays reserved (duo team takes 2 seats)
    const matchDetail = await getMatchUser(leader.id, match.id);
    expect(matchDetail.seatsTaken).toBe(2);
  });

  // ─── 24. Direct HTTP test for seatsTaken and isInTeam in match lists ──────────
  it('direct HTTP test for seatsTaken and isInTeam in user match lists', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSquadBRTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const leader = await createUser();
    const teammate = await createUser();
    const outsider = await createUser();
    await setWallet(leader.id, 1000, 0, 0);
    await setWallet(teammate.id, 1000, 0, 0);

    const leaderToken = await createAuthToken(leader);
    const teammateToken = await createAuthToken(teammate);
    const outsiderToken = await createAuthToken(outsider);

    // 1. Before team formation: seatsTaken = 0, isInTeam = false for everyone
    const resPre = await request(app)
      .get('/api/v1/matches')
      .set('Authorization', `Bearer ${leaderToken}`);
    expect(resPre.status).toBe(200);
    const matchPre = resPre.body.data.matches.find((m: any) => m.id === match.id);
    expect(matchPre.seatsTaken).toBe(0);
    expect(matchPre.isInTeam).toBe(false);

    // 2. Leader creates squad team (4 seats reserved)
    await createTeam(leader.id, match.id, {
      memberFfIds: [teammate.ffId, (await createUser()).ffId, (await createUser()).ffId],
    });

    // Leader sees seatsTaken = 4, isInTeam = true
    const resLeader = await request(app)
      .get(`/api/v1/matches/${match.id}`)
      .set('Authorization', `Bearer ${leaderToken}`);
    expect(resLeader.body.data.match.seatsTaken).toBe(4);
    expect(resLeader.body.data.match.isInTeam).toBe(true);

    // Outsider sees seatsTaken = 4, isInTeam = false
    const resOutsider = await request(app)
      .get(`/api/v1/matches/${match.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(resOutsider.body.data.match.seatsTaken).toBe(4);
    expect(resOutsider.body.data.match.isInTeam).toBe(false);

    // 3. Teammate accepts invite -> teammate now has isInTeam = true
    const inv = (await listUserInvites(teammate.id))[0];
    await acceptInvite(teammate.id, inv.id);

    const resTeammate = await request(app)
      .get(`/api/v1/matches/${match.id}`)
      .set('Authorization', `Bearer ${teammateToken}`);
    expect(resTeammate.body.data.match.seatsTaken).toBe(4);
    expect(resTeammate.body.data.match.isInTeam).toBe(true);
  });
});

async function createSoloBRTier(overrides: {
  entryFee?: string;
  killPrice?: string;
  maxPlayers?: number;
  minPlayers?: number;
} = {}): Promise<string> {
  const entryFee   = overrides.entryFee   ?? '10.00';
  const killPrice  = overrides.killPrice  ?? '5.00';
  const maxPlayers = overrides.maxPlayers ?? 48;
  const minPlayers = overrides.minPlayers ?? 24;

  const res = await query(
    `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
     VALUES ('battle_royale', 'solo', $1, $2, 2, $3, $4)
     RETURNING id`,
    [entryFee, killPrice, maxPlayers, minPlayers]
  );
  const tierId = res.rows[0].id.toString();
  await query(
    `INSERT INTO tier_position_prizes (tier_id, position, prize) VALUES
       ($1, 1, '50.00'), ($1, 2, '40.00'), ($1, 3, '30.00')`,
    [tierId]
  );
  return tierId;
}
