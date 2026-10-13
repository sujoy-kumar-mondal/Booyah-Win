/**
 * Milestone 5 – Matches Lifecycle, Solo Join & Refunds Tests.
 *
 * Requirements & Changes:
 *  1. joinMatchSolo locks referral first, then match, then wallets in ascending user_id.
 *  2. Concurrency test: cancel and 20 joins simultaneously -> all joined refunded, wallets restored.
 *  3. Error code INVALID_TRANSITION (409) for invalid status transitions.
 *  4. 10 simultaneous joins by one user on same match -> 1 success, 1 charge, 9 ALREADY_JOINED.
 *  5. Match creation from soft-deleted tier is rejected.
 *  6. startTime must be ISO 8601 with timezone offset, compared against DB now().
 *  7. GET /matches/:id returns match details with room credential rules, never exposes other players.
 *  8. position_prizes snapshotted as string values parsed with shared money utility.
 *  9. Zero N+1 queries in match lists.
 *  10. Concurrency: 60 simultaneous joins on 48-seat match -> 48 successes, 12 MATCH_FULL.
 *  11. Concurrency: Referred user's first join and deposit approval simultaneously x20 -> no deadlock.
 */

import crypto from 'crypto';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { truncateAllTables } from './setup.js';
import { query, withTransaction } from '../src/db/index.js';
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
  listMatchesStaff,
  getMatchDetailStaff,
  openRoomStaff,
  goLiveStaff,
  cancelMatchStaff,
} from '../src/modules/matches/matches.staff.service.js';
import {
  listMatchesUser,
  getMatchUser,
  joinMatchSolo,
} from '../src/modules/matches/matches.service.js';
import {
  submitDeposit,
} from '../src/modules/wallet/deposit.service.js';
import {
  approveDeposit,
} from '../src/modules/wallet/deposit.staff.service.js';

const app = createApp({ enableRateLimiting: false });

// ─── Test Helpers ─────────────────────────────────────────────────────────────

let _ctr = 0;
const next = () => ++_ctr;

interface TestUser {
  id: string;
  email: string;
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
  const res = await query(
    `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code, referred_by)
     VALUES ($1, $2, $3, $4, $5, $6, '1990-01-01', $7, $8)
     RETURNING id, email, upi_id, referral_code`,
    [
      `muser${i}@test.com`,
      `User ${i}`,
      mobile,
      `FF${String(i).padStart(8, '0')}`,
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
    [role, `Staff ${i}`, mobile, `mstaff${i}@test.com`]
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
    `INSERT INTO tier_position_prizes (tier_id, position, prize)
     VALUES ($1, 1, '50.00'), ($1, 2, '40.00'), ($1, 3, '30.00')`,
    [tierId]
  );
  return tierId;
}

const TEST_SCREENSHOT = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(200),
]);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Milestone 5: Matches Lifecycle, Solo Join & Refunds', () => {
  beforeEach(truncateAllTables);

  // ─── 1. Concurrency: 60 simultaneous joins on 48-seat match ────────────────
  it('60 simultaneous joins on a 48-seat solo match give exactly 48 successes and 12 MATCH_FULL', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier({ maxPlayers: 48 });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    // Create 60 distinct users with Rs10 in wallet
    const users: TestUser[] = [];
    for (let i = 0; i < 60; i++) {
      const u = await createUser();
      await setWallet(u.id, 1000, 0, 0); // 1000 paise = Rs10
      users.push(u);
    }

    // 60 users attempt to join concurrently
    const results = await Promise.allSettled(
      users.map((u) => joinMatchSolo(u.id, match.id))
    );

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures  = results.filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(48);
    expect(failures).toHaveLength(12);

    for (const f of failures) {
      expect((f as PromiseRejectedResult).reason?.code).toBe(ErrorCodes.MATCH_FULL);
    }

    // Verify exactly 48 players in match_players
    const countRes = await query(
      `SELECT count(*)::int AS c FROM match_players WHERE match_id = $1`,
      [match.id]
    );
    expect(countRes.rows[0].c).toBe(48);
  });

  // ─── 2. Concurrency: Two simultaneous joins with funds for only one ────────
  it('two simultaneous joins by one user with money for only one -> exactly one succeeds, one fails with LOW_BALANCE', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier({ entryFee: '10.00' });
    const startTime = new Date(Date.now() + 3600000).toISOString();

    const m1 = await createMatchStaff(admin.id, { tierId, startTime });
    const m2 = await createMatchStaff(admin.id, { tierId, startTime });

    const u = await createUser();
    await setWallet(u.id, 1000, 0, 0); // exactly Rs10 (1000 paise)

    const results = await Promise.allSettled([
      joinMatchSolo(u.id, m1.id),
      joinMatchSolo(u.id, m2.id),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures  = results.filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect((failures[0] as PromiseRejectedResult).reason?.code).toBe(ErrorCodes.LOW_BALANCE);

    // Remaining balance is 0
    const w = await getWallet(u.id);
    expect(w.addMoney).toBe(0);
  });

  // ─── 3. Concurrency: Cancel and 20 joins fire at once ───────────────────────
  it('cancel and 20 joins fire at once on one match -> match cancelled, all joined refunded, wallets equal pre-join balance', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier({ entryFee: '10.00', maxPlayers: 48 });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const users: TestUser[] = [];
    for (let i = 0; i < 20; i++) {
      const u = await createUser();
      await setWallet(u.id, 1000, 0, 0); // Rs10
      users.push(u);
    }

    // Fire 20 joins and 1 cancel simultaneously
    const actions: Promise<any>[] = users.map((u) => joinMatchSolo(u.id, match.id));
    actions.push(cancelMatchStaff(admin.id, admin.role, match.id, 'Weather alert cancel'));

    await Promise.allSettled(actions);

    // Match must be cancelled
    const mRes = await query(`SELECT status FROM matches WHERE id = $1`, [match.id]);
    expect(mRes.rows[0].status).toBe('cancelled');

    // Every joined player in match_players must have refunded_at set
    const playersRes = await query(
      `SELECT refunded_at FROM match_players WHERE match_id = $1`,
      [match.id]
    );
    for (const p of playersRes.rows) {
      expect(p.refunded_at).not.toBeNull();
    }

    // Every user's wallet must equal pre-join balance (Rs10 = 1000 paise)
    for (const u of users) {
      const w = await getWallet(u.id);
      expect(w.addMoney).toBe(1000);
    }
  });

  // ─── 4. Concurrency: Referred join & deposit approval 20x without deadlock ──
  it('referred user first join and deposit approval run simultaneously 20 times with no deadlock (no 40P01)', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier({ entryFee: '10.00' });
    const startTime = new Date(Date.now() + 3600000).toISOString();

    for (let round = 0; round < 20; round++) {
      const referrer = await createUser();
      const referred = await createUser({ referredBy: referrer.id });
      await createReferral(referrer.id, referred.id, '5.00');

      const match = await createMatchStaff(admin.id, { tierId, startTime });
      await setWallet(referred.id, 1000, 0, 0); // Rs10 for match

      // Submit a pending deposit for the referred user
      const dep = await submitDeposit(
        referred.id,
        '50.00',
        `UTRDEADLOCK${round}${next()}`,
        TEST_SCREENSHOT
      );

      // Run joinMatchSolo and approveDeposit at the exact same moment
      const results = await Promise.allSettled([
        joinMatchSolo(referred.id, match.id),
        approveDeposit(admin.id, admin.email, admin.role, dep.id),
      ]);

      // Neither must fail with 40P01 deadlock
      for (const r of results) {
        if (r.status === 'rejected') {
          const err = (r as PromiseRejectedResult).reason;
          expect(err?.code).not.toBe('40P01');
        }
      }
    }
  });

  // ─── 5. 10 simultaneous joins by one user on the same match ─────────────────
  it('10 simultaneous joins by one user on the same match give exactly one success, one charge, and nine ALREADY_JOINED', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier({ entryFee: '10.00' });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const u = await createUser();
    await setWallet(u.id, 100000, 0, 0); // Plenty of money (Rs1,000)

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => joinMatchSolo(u.id, match.id))
    );

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures  = results.filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(9);

    for (const f of failures) {
      expect((f as PromiseRejectedResult).reason?.code).toBe(ErrorCodes.ALREADY_JOINED);
    }

    // Charged exactly once for Rs10 (1000 paise)
    const w = await getWallet(u.id);
    expect(w.addMoney).toBe(99000); // 100000 - 1000 = 99000

    // Exactly one row in match_players
    const countRes = await query(
      `SELECT count(*)::int AS c FROM match_players WHERE match_id = $1 AND user_id = $2`,
      [match.id, u.id]
    );
    expect(countRes.rows[0].c).toBe(1);
  });

  // ─── 6. Match cancel refunds exact amounts and cannot refund twice ─────────
  it('cancel refunds exact amounts to exact wallets and cannot refund twice', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier({ entryFee: '10.00' });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const u1 = await createUser();
    await setWallet(u1.id, 950, 50, 0); // split: Rs0.50 cashback (5% cap), Rs9.50 add_money

    const u2 = await createUser();
    await setWallet(u2.id, 0, 0, 1000); // Rs10 from winning

    await joinMatchSolo(u1.id, match.id);
    await joinMatchSolo(u2.id, match.id);

    // Cancel match
    await cancelMatchStaff(admin.id, admin.role, match.id, 'Cancelled for testing');

    // Wallets restored exactly
    const w1 = await getWallet(u1.id);
    expect(w1.cashback).toBe(50);
    expect(w1.addMoney).toBe(950);

    const w2 = await getWallet(u2.id);
    expect(w2.winning).toBe(1000);

    // Second cancel attempt must return 409 INVALID_TRANSITION and not refund again
    await expect(
      cancelMatchStaff(admin.id, admin.role, match.id, 'Cancel again')
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_TRANSITION, statusCode: 409 });

    // Wallets unchanged
    const w1After = await getWallet(u1.id);
    expect(w1After.cashback).toBe(50);
    expect(w1After.addMoney).toBe(950);
  });

  // ─── 7. Invalid status transitions return 409 INVALID_TRANSITION ───────────
  it('invalid status transitions return 409 INVALID_TRANSITION', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier({ minPlayers: 0 });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    // upcoming -> live directly is invalid
    await expect(
      goLiveStaff(admin.id, match.id)
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_TRANSITION, statusCode: 409 });

    // open room: upcoming -> room_open
    await openRoomStaff(admin.id, match.id, 'ROOM123', 'PASS123');

    // room_open -> upcoming is invalid
    await expect(
      openRoomStaff(admin.id, match.id, 'ROOM123', 'PASS123')
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_TRANSITION, statusCode: 409 });

    // go live: room_open -> live
    await goLiveStaff(admin.id, match.id);

    // live -> goLive again is invalid
    await expect(
      goLiveStaff(admin.id, match.id)
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_TRANSITION, statusCode: 409 });
  });

  // ─── 8. Room details hidden from non-joined users ───────────────────────────
  it('room details hidden from non-joined users; returned only when room_open or live to joined users', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const joinedUser = await createUser();
    await setWallet(joinedUser.id, 1000, 0, 0);
    const nonJoinedUser = await createUser();

    // Upcoming status: joined user has not joined yet
    const listBefore = await listMatchesUser(nonJoinedUser.id);
    expect(listBefore[0].roomId).toBeUndefined();
    expect(listBefore[0].roomPassword).toBeUndefined();

    // joinedUser joins
    await joinMatchSolo(joinedUser.id, match.id);

    // Open room
    await openRoomStaff(admin.id, match.id, 'ROOM_SECRET', 'PASS_SECRET');

    // Joined user CAN see room credentials
    const joinedList = await listMatchesUser(joinedUser.id);
    const joinedMatch = joinedList.find((m) => m.id === match.id);
    expect(joinedMatch?.roomId).toBe('ROOM_SECRET');
    expect(joinedMatch?.roomPassword).toBe('PASS_SECRET');

    // Non-joined user CANNOT see room credentials
    const nonJoinedList = await listMatchesUser(nonJoinedUser.id);
    const nonJoinedMatch = nonJoinedList.find((m) => m.id === match.id);
    expect(nonJoinedMatch?.roomId).toBeUndefined();
    expect(nonJoinedMatch?.roomPassword).toBeUndefined();
  });

  // ─── 9. GET /matches/:id never exposes other players' data ──────────────────
  it('GET /matches/:id returns match details with room rules and never exposes other players data', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const u1 = await createUser();
    await setWallet(u1.id, 1000, 0, 0);
    await joinMatchSolo(u1.id, match.id);

    const u2 = await createUser();
    const detail = await getMatchUser(u2.id, match.id);

    expect(detail.id).toBe(match.id);
    expect(detail.hasJoined).toBe(false);
    expect(detail.roomId).toBeUndefined();

    const detailU1 = await getMatchUser(u1.id, match.id);
    expect(detailU1.hasJoined).toBe(true);

    const listU1 = await listMatchesUser(u1.id);
    const matchInList = listU1.find((m) => m.id === match.id);
    expect(matchInList?.hasJoined).toBe(true);
    expect(matchInList?.joinedPlayers).toBe(1);
    // Must NOT contain player arrays or rosters
    expect((detail as any).players).toBeUndefined();
    expect((detail as any).playerList).toBeUndefined();
  });

  // ─── 10. Tier edit & soft-delete do not change existing matches ─────────────
  it('tier edit and soft-delete do not change existing matches (deferred from Milestone 3)', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier({ entryFee: '10.00', killPrice: '5.00' });
    const startTime = new Date(Date.now() + 3600000).toISOString();

    const match = await createMatchStaff(admin.id, { tierId, startTime });
    expect(match.entryFee).toBe('10.00');
    expect(match.killPrice).toBe('5.00');

    // Update tier in database
    await query(
      `UPDATE entry_tiers SET entry_fee = '25.00', kill_price = '12.00', deleted_at = now() WHERE id = $1`,
      [tierId]
    );

    // Existing match retains original snapshotted values
    const staffDetail = await getMatchDetailStaff(match.id);
    expect(staffDetail.entryFee).toBe('10.00');
    expect(staffDetail.killPrice).toBe('5.00');
  });

  // ─── 11. Creating a match from soft-deleted tier is rejected ────────────────
  it('creating a match from a soft-deleted tier is rejected', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier();

    // Soft delete the tier
    await query(`UPDATE entry_tiers SET deleted_at = now() WHERE id = $1`, [tierId]);

    const startTime = new Date(Date.now() + 3600000).toISOString();
    await expect(
      createMatchStaff(admin.id, { tierId, startTime })
    ).rejects.toMatchObject({ code: ErrorCodes.NOT_FOUND, statusCode: 404 });
  });

  // ─── 12. startTime must be ISO 8601 with timezone offset and in future ───────
  it('startTime must be ISO 8601 with timezone offset and in future', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier();

    // Missing timezone offset
    await expect(
      createMatchStaff(admin.id, { tierId, startTime: '2026-10-10T15:00:00' })
    ).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_ERROR, statusCode: 400 });

    // Past time with timezone
    await expect(
      createMatchStaff(admin.id, { tierId, startTime: '2020-01-01T00:00:00Z' })
    ).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_ERROR, statusCode: 400 });

    // Valid ISO 8601 with offset in the future succeeds
    const validFuture = new Date(Date.now() + 7200000).toISOString();
    await expect(
      createMatchStaff(admin.id, { tierId, startTime: validFuture })
    ).resolves.toBeDefined();
  });

  // ─── 13. Ledger reconciliation after joins and cancels ──────────────────────
  it('ledger reconciliation after joins and cancels', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier({ entryFee: '10.00' });
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const u = await createUser();
    await setWallet(u.id, 2000, 50, 1000); // 2000 add_money, 50 cashback, 1000 winning

    // Join match
    await joinMatchSolo(u.id, match.id);

    // Cancel match
    await cancelMatchStaff(admin.id, admin.role, match.id, 'Test cancel reconciliation');

    // Balance restored
    const w = await getWallet(u.id);
    expect(w.addMoney).toBe(2000);
    expect(w.cashback).toBe(50);
    expect(w.winning).toBe(1000);

    // Ledger reconciliation: sum of credits - sum of debits
    const ledgerRows = await query(
      `SELECT amount, total_after FROM wallet_ledger WHERE user_id = $1 ORDER BY id ASC`,
      [u.id]
    );
    expect(ledgerRows.rows.length).toBeGreaterThanOrEqual(2);

    // Last ledger row's total_after matches total wallet balance (3050 paise)
    const lastRow = ledgerRows.rows[ledgerRows.rows.length - 1];
    expect(stringToPaise(lastRow.total_after.toString())).toBe(3050);

    // Cancelled match displays how many users were joined instead of 0
    const staffMatches = await listMatchesStaff({ status: 'cancelled' });
    const cancelledMatch = staffMatches.items.find((m) => m.id === match.id);
    expect(cancelledMatch).toBeDefined();
    expect(cancelledMatch?.joinedCount).toBe(1);
    expect(cancelledMatch?.seatsTaken).toBe(1);
  });

  // ─── 14. Referral credited once on first join ───────────────────────────────
  it('referral credited once on first join; second join does not credit again', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier({ entryFee: '10.00' });
    const startTime = new Date(Date.now() + 3600000).toISOString();

    const m1 = await createMatchStaff(admin.id, { tierId, startTime });
    const m2 = await createMatchStaff(admin.id, { tierId, startTime });

    const referrer = await createUser();
    const referred = await createUser({ referredBy: referrer.id });
    await createReferral(referrer.id, referred.id, '5.00');

    await setWallet(referred.id, 5000, 0, 0);

    // First join credits referral reward
    await joinMatchSolo(referred.id, m1.id);
    const refW1 = await getWallet(referrer.id);
    expect(refW1.cashback).toBe(500); // Rs5.00

    // Second join does not credit referral again
    await joinMatchSolo(referred.id, m2.id);
    const refW2 = await getWallet(referrer.id);
    expect(refW2.cashback).toBe(500); // unchanged
  });

  // ─── 15. Employee cannot cancel a live match ────────────────────────────────
  it('employee cannot cancel a live match (403), admin can (200)', async () => {
    const admin = await createStaff('admin');
    const employee = await createStaff('employee');
    const tierId = await createSoloBRTier({ minPlayers: 0 });
    const startTime = new Date(Date.now() + 3600000).toISOString();

    const match = await createMatchStaff(admin.id, { tierId, startTime });
    await openRoomStaff(admin.id, match.id, 'ROOM1', 'PASS1');
    await goLiveStaff(admin.id, match.id);

    // Employee cannot cancel
    await expect(
      cancelMatchStaff(employee.id, employee.role, match.id, 'Employee trying')
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN, statusCode: 403 });

    // Admin can cancel
    await expect(
      cancelMatchStaff(admin.id, admin.role, match.id, 'Admin cancelling')
    ).resolves.toBeUndefined();

    const m = await query(`SELECT status FROM matches WHERE id = $1`, [match.id]);
    expect(m.rows[0].status).toBe('cancelled');
  });

  // ─── 16. Per-user rate limit 10/min on match join ───────────────────────────
  it('rate limits join to 10/min per user (429 RATE_LIMITED on 11th request)', async () => {
    const rateLimitedApp = createApp({ enableRateLimiting: true });
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();

    // Create 11 matches to join
    const matches: string[] = [];
    for (let i = 0; i < 11; i++) {
      const m = await createMatchStaff(admin.id, { tierId, startTime });
      matches.push(m.id);
    }

    const u1 = await createUser();
    await setWallet(u1.id, 100000, 0, 0);
    const t1 = await createAuthToken(u1);

    const u2 = await createUser();
    await setWallet(u2.id, 100000, 0, 0);
    const t2 = await createAuthToken(u2);

    // First 10 requests from u1 succeed
    for (let i = 0; i < 10; i++) {
      const res = await request(rateLimitedApp)
        .post(`/api/v1/matches/${matches[i]}/join`)
        .set('Authorization', `Bearer ${t1}`);
      expect(res.status).not.toBe(429);
    }

    // 11th request from u1 gets 429
    const res11 = await request(rateLimitedApp)
      .post(`/api/v1/matches/${matches[10]}/join`)
      .set('Authorization', `Bearer ${t1}`);
    expect(res11.status).toBe(429);
    expect(res11.body.error.code).toBe(ErrorCodes.RATE_LIMITED);

    // u2 is unaffected
    const resU2 = await request(rateLimitedApp)
      .post(`/api/v1/matches/${matches[0]}/join`)
      .set('Authorization', `Bearer ${t2}`);
    expect(resU2.status).not.toBe(429);
  });

  // ─── 17. Deleted user cannot join ───────────────────────────────────────────
  it('soft-deleted user cannot join matches', async () => {
    const admin = await createStaff('admin');
    const tierId = await createSoloBRTier();
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const u = await createUser();
    await setWallet(u.id, 1000, 0, 0);

    // Soft delete user
    await query(`UPDATE users SET deleted_at = now() WHERE id = $1`, [u.id]);

    await expect(
      joinMatchSolo(u.id, match.id)
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN, statusCode: 403 });
  });

  // ─── 18. Non-solo game modes return 400 TEAM_INVALID for now ────────────────
  it('non-solo match returns 400 TEAM_INVALID on join', async () => {
    const admin = await createStaff('admin');
    // Create duo tier
    const res = await query(
      `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
       VALUES ('battle_royale', 'duo', '20.00', '0', 2, 48, 24)
       RETURNING id`
    );
    const tierId = res.rows[0].id.toString();
    await query(`INSERT INTO tier_position_prizes (tier_id, position, prize) VALUES ($1, 1, '100.00')`, [tierId]);

    const startTime = new Date(Date.now() + 3600000).toISOString();
    const match = await createMatchStaff(admin.id, { tierId, startTime });

    const u = await createUser();
    await setWallet(u.id, 2000, 0, 0);

    await expect(
      joinMatchSolo(u.id, match.id)
    ).rejects.toMatchObject({ code: ErrorCodes.TEAM_INVALID, statusCode: 400 });
  });
});
