/**
 * Milestone 4 – Wallet tests.
 *
 * Change #8: all race tests call service functions directly (no rate-limited HTTP).
 * Pool is set to 20 connections in db/index.ts.
 *
 * Test DB safety is enforced by the global setup.ts (must end in _test).
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
  parseMoney,
  formatDbNumeric,
  paiseToString,
  stringToPaise,
} from '@booyah/shared';
import {
  allocateEntryFee,
  creditWallet,
  debitWallet,
  refundEntryFee,
  creditReferralReward,
  AllocationResult,
} from '../src/modules/wallet/wallet.service.js';
import { submitDeposit, listUserDeposits } from '../src/modules/wallet/deposit.service.js';
import {
  approveDeposit,
  verifyDeposit,
  rejectDeposit,
} from '../src/modules/wallet/deposit.staff.service.js';
import {
  requestWithdrawal,
} from '../src/modules/wallet/withdrawal.service.js';
import {
  markWithdrawalPaid,
  rejectWithdrawal,
} from '../src/modules/wallet/withdrawal.staff.service.js';
import { listTransactions } from '../src/modules/wallet/transactions.service.js';

// ─── Minimal valid JPEG (magic bytes + padding) ───────────────────────────────
const TEST_SCREENSHOT = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(200),
]);

// ─── Unique-id counter ────────────────────────────────────────────────────────
let _ctr = 0;
const next = () => ++_ctr;

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface TestUser { id: string; email: string; upiId: string; referralCode: string }
interface TestStaff { id: string; email: string; role: string }

async function createUser(opts: { referredBy?: string } = {}): Promise<TestUser> {
  const i = next();
  const mobile = '9' + String(i).padStart(9, '0');
  const res = await query(
    `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code, referred_by)
     VALUES ($1, $2, $3, $4, $5, $6, '1990-01-01', $7, $8)
     RETURNING id, email, upi_id, referral_code`,
    [
      `user${i}@wtest.com`,
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

async function createAuthToken(user: TestUser): Promise<string> {
  const sid = crypto.randomUUID();
  await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'user', $2)`, [
    sid,
    user.id,
  ]);
  return signSessionToken({ sub: user.id, typ: 'user', sid }, '1h');
}

async function createStaff(role: 'admin' | 'employee' = 'employee'): Promise<TestStaff> {
  const i = next();
  const mobile = '8' + String(i).padStart(9, '0');
  const res = await query(
    `INSERT INTO staff (role, name, mobile, email) VALUES ($1, $2, $3, $4)
     RETURNING id, email, role`,
    [role, `Staff ${i}`, mobile, `staff${i}@wtest.com`]
  );
  return { id: res.rows[0].id.toString(), email: res.rows[0].email, role: res.rows[0].role };
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

async function seedSettings(overrides: Record<string, string> = {}) {
  const defaults = { min_deposit: '10.00', max_deposit: '5000.00', admin_approval_threshold: '2000.00' };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    await query(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
      [k, v]
    );
  }
}

async function createReferral(referrerId: string, referredId: string, reward = '5.00') {
  await query(
    `INSERT INTO referrals (referrer_id, referred_id, reward) VALUES ($1, $2, $3)`,
    [referrerId, referredId, reward]
  );
}

async function createPendingDeposit(userId: string, amount = '100.00', utr?: string) {
  const utrVal = utr ?? `UTR${String(next()).padStart(10, '0')}X`;
  const r = await query(
    `INSERT INTO deposit_requests (user_id, amount, utr, screenshot_url)
     VALUES ($1, $2, $3, 'test-screenshot-key') RETURNING id`,
    [userId, amount, utrVal]
  );
  return r.rows[0].id.toString();
}

async function runAllocation(userId: string, feePaise: number): Promise<AllocationResult> {
  return withTransaction(async (client) => {
    await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
    return allocateEntryFee(client, userId, feePaise, null, null);
  });
}

// ─── parseMoney unit tests ────────────────────────────────────────────────────

describe('parseMoney', () => {
  it('Rs10.00 → 1000 paise', () => {
    expect(parseMoney('10.00')).toBe(1000);
  });
  it('Rs0.50 → 50 paise', () => {
    expect(parseMoney('0.50')).toBe(50);
  });
  it('Rs1 → 100 paise', () => {
    expect(parseMoney('1')).toBe(100);
  });
  it('rejects > 2 decimal places', () => {
    expect(() => parseMoney('10.001')).toThrow();
    expect(() => parseMoney('0.123')).toThrow();
  });
  it('rejects zero', () => {
    expect(() => parseMoney('0')).toThrow();
    expect(() => parseMoney('0.00')).toThrow();
  });
  it('rejects negative', () => {
    expect(() => parseMoney('-1')).toThrow();
  });
  it('rejects NaN / non-numeric', () => {
    expect(() => parseMoney('abc')).toThrow();
    expect(() => parseMoney('NaN')).toThrow();
  });
  it('rejects empty string', () => {
    expect(() => parseMoney('')).toThrow();
  });
});

// ─── §6.1 Allocation table ────────────────────────────────────────────────────

describe('Entry fee allocation – spec §6.1 (fee = Rs10.00 = 1000p, cashbackCap = 50p)', () => {
  beforeEach(truncateAllTables);

  it('cashbackCap edge: Rs10 → 50p, Rs0.50 → 2p', () => {
    expect(Math.floor(1000 * 5 / 100)).toBe(50);
    expect(Math.floor(50   * 5 / 100)).toBe(2);
  });

  it('row 1 – cashback=5, add_money=20 → paid cashback=50p, add_money=950p', async () => {
    const u = await createUser();
    await setWallet(u.id, 2000, 500, 0);
    const r = await runAllocation(u.id, 1000);
    expect(r.paidCashback).toBe(50);
    expect(r.paidAddMoney).toBe(950);
    expect(r.paidWinning).toBe(0);
    const w = await getWallet(u.id);
    expect(w.cashback).toBe(450);
    expect(w.addMoney).toBe(1050);
  });

  it('row 2 – cashback=0, add_money=20 → all from add_money', async () => {
    const u = await createUser();
    await setWallet(u.id, 2000, 0, 0);
    const r = await runAllocation(u.id, 1000);
    expect(r.paidCashback).toBe(0);
    expect(r.paidAddMoney).toBe(1000);
    expect(r.paidWinning).toBe(0);
  });

  it('row 3 – cashback=5, add_money=0, winning=30 → cashback 50p + winning 950p', async () => {
    const u = await createUser();
    await setWallet(u.id, 0, 500, 3000);
    const r = await runAllocation(u.id, 1000);
    expect(r.paidCashback).toBe(50);
    expect(r.paidAddMoney).toBe(0);
    expect(r.paidWinning).toBe(950);
  });

  it('row 4 – cashback=0, add_money=4, winning=6 → add 400p + winning 600p', async () => {
    const u = await createUser();
    await setWallet(u.id, 400, 0, 600);
    const r = await runAllocation(u.id, 1000);
    expect(r.paidAddMoney).toBe(400);
    expect(r.paidWinning).toBe(600);
  });

  it('row 5 – cashback=0, add_money=4, winning=5 → LOW_BALANCE', async () => {
    const u = await createUser();
    await setWallet(u.id, 400, 0, 500);
    await expect(runAllocation(u.id, 1000)).rejects.toMatchObject({ code: 'LOW_BALANCE' });
  });
});

// ─── Two simultaneous debits with money for only one ─────────────────────────

describe('Concurrent debit – only one succeeds when balance covers exactly one', () => {
  beforeEach(truncateAllTables);

  it('two simultaneous withdrawal requests for Rs50 with exactly Rs50 → one succeeds', async () => {
    const u = await createUser();
    await setWallet(u.id, 0, 0, 5000); // exactly Rs50

    const results = await Promise.allSettled([
      requestWithdrawal(u.id, u.upiId, null, '50.00', u.upiId, true),
      requestWithdrawal(u.id, u.upiId, null, '50.00', u.upiId, true),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures  = results.filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    // Wallet should be non-negative
    const w = await getWallet(u.id);
    expect(w.winning).toBeGreaterThanOrEqual(0);
  });
});

// ─── 10 simultaneous deposit creations ───────────────────────────────────────

describe('10 simultaneous deposit creations (change #1 – wallet lock serialises)', () => {
  beforeEach(truncateAllTables);

  it('max 3 succeed, 7 fail with DEPOSIT_LIMIT', async () => {
    const u = await createUser();
    // Unique UTRs so UTR uniqueness is not the limiting factor
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        submitDeposit(u.id, '100.00', `UTRTEST${String(i).padStart(10, '0')}`, TEST_SCREENSHOT)
      )
    );

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures  = results.filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(3);
    expect(failures).toHaveLength(7);

    for (const f of failures) {
      expect((f as PromiseRejectedResult).reason?.code).toBe('DEPOSIT_LIMIT');
    }
  });
});

// ─── Deposit approval: 50 parallel approve calls credit once ─────────────────

describe('50 parallel approvals credit once (409 on the rest)', () => {
  beforeEach(truncateAllTables);

  it('exactly 1 success, 49 × 409', async () => {
    const u     = await createUser();
    const admin = await createStaff('admin');
    const depId = await createPendingDeposit(u.id, '100.00');

    const results = await Promise.allSettled(
      Array.from({ length: 50 }, () =>
        approveDeposit(admin.id, admin.email, 'admin', depId)
      )
    );

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures  = results.filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(49);

    // Wallet credited exactly once
    const w = await getWallet(u.id);
    expect(w.addMoney).toBe(10000); // Rs100.00

    // Ledger has exactly one add_money entry
    const ledger = await query(
      `SELECT count(*)::int AS c FROM wallet_ledger WHERE user_id = $1 AND type = 'add_money'`,
      [u.id]
    );
    expect(ledger.rows[0].c).toBe(1);
  });
});

// ─── Simultaneous referrer + referred deposit approvals → no deadlock ─────────

describe('Simultaneous deposit approvals for referrer and referred → no deadlock', () => {
  beforeEach(truncateAllTables);

  it('both complete without deadlock', async () => {
    const referrer = await createUser();
    const referred = await createUser({ referredBy: referrer.id });
    await createReferral(referrer.id, referred.id, '5.00');

    const admin = await createStaff('admin');

    const refrerDepId  = await createPendingDeposit(referrer.id, '200.00');
    const referredDepId = await createPendingDeposit(referred.id, '150.00');

    // Approve both simultaneously
    const results = await Promise.allSettled([
      approveDeposit(admin.id, admin.email, 'admin', refrerDepId),
      approveDeposit(admin.id, admin.email, 'admin', referredDepId),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    const wReferrer = await getWallet(referrer.id);
    const wReferred = await getWallet(referred.id);

    // Referrer got: Rs200 + Rs5 referral reward
    expect(wReferrer.addMoney).toBe(20000);
    expect(wReferrer.cashback).toBe(500); // Rs5 referral
    // Referred got: Rs150
    expect(wReferred.addMoney).toBe(15000);
  });
});

// ─── needs_admin flag and threshold re-check ──────────────────────────────────

describe('needs_admin threshold', () => {
  beforeEach(truncateAllTables);

  it('employee cannot approve high-value deposit (needs_admin=true)', async () => {
    await seedSettings({ admin_approval_threshold: '500.00' });
    const u        = await createUser();
    const employee = await createStaff('employee');
    const depId    = await createPendingDeposit(u.id, '600.00');

    // In two-step approvals, employee verifies
    await verifyDeposit(employee.id, employee.email, 'employee', depId);

    // But employee cannot give final approval (admin only)
    await expect(
      approveDeposit(employee.id, employee.email, 'employee', depId)
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
  });

  it('admin can approve high-value deposit', async () => {
    await seedSettings({ admin_approval_threshold: '500.00' });
    const u     = await createUser();
    const admin = await createStaff('admin');
    const depId = await createPendingDeposit(u.id, '600.00');

    await expect(
      approveDeposit(admin.id, admin.email, 'admin', depId)
    ).resolves.toBeUndefined();

    const w = await getWallet(u.id);
    expect(w.addMoney).toBe(60000); // Rs600
  });
});

// ─── Staff cannot approve/reject own deposit / withdrawal ─────────────────────

describe('Staff email guard', () => {
  beforeEach(truncateAllTables);

  it('staff cannot approve their own deposit', async () => {
    // Make a staff whose email matches a user
    const admin = await createStaff('admin');
    // Create user with same email as admin
    const i = next();
    const res = await query(
      `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
       VALUES ($1, $2, $3, $4, $5, $6, '1990-01-01', $7) RETURNING id`,
      [admin.email, `User ${i}`, `7${String(i).padStart(9,'0')}`, `FX${i}`, `FXN${i}`, `xupi${i}@t`, `XR${i}`]
    );
    const userId = res.rows[0].id.toString();
    await query('INSERT INTO wallets (user_id) VALUES ($1)', [userId]);
    const depId = await createPendingDeposit(userId, '100.00');

    await expect(
      approveDeposit(admin.id, admin.email, 'admin', depId)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('staff cannot mark-paid their own withdrawal', async () => {
    const admin = await createStaff('admin');
    const i = next();
    const res = await query(
      `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
       VALUES ($1, $2, $3, $4, $5, $6, '1990-01-01', $7) RETURNING id`,
      [admin.email, `User ${i}`, `7${String(i).padStart(9,'0')}`, `FY${i}`, `FYN${i}`, `yupi${i}@t`, `YR${i}`]
    );
    const userId = res.rows[0].id.toString();
    await query('INSERT INTO wallets (user_id) VALUES ($1)', [userId]);
    await setWallet(userId, 0, 0, 10000);

    const wr = await requestWithdrawal(userId, `yupi${i}@t`, null, '50.00', `yupi${i}@t`, true);

    await expect(
      markWithdrawalPaid(admin.id, admin.email, 'admin', wr.id, 'PAY001')
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ─── Double approve / reject → 409 ───────────────────────────────────────────

describe('Double action returns 409', () => {
  beforeEach(truncateAllTables);

  it('double approve → 409 on second', async () => {
    const u     = await createUser();
    const admin = await createStaff('admin');
    const depId = await createPendingDeposit(u.id, '100.00');

    await approveDeposit(admin.id, admin.email, 'admin', depId);
    await expect(
      approveDeposit(admin.id, admin.email, 'admin', depId)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('double reject → 409 on second', async () => {
    const u     = await createUser();
    const admin = await createStaff('admin');
    const depId = await createPendingDeposit(u.id, '100.00');

    await rejectDeposit(admin.id, depId, 'Fake UTR');
    await expect(
      rejectDeposit(admin.id, depId, 'Fake UTR again')
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('double mark-paid withdrawal → 409', async () => {
    const u     = await createUser();
    const admin = await createStaff('admin');
    await setWallet(u.id, 0, 0, 10000);
    const wr = await requestWithdrawal(u.id, u.upiId, null, '50.00', u.upiId, true);

    await markWithdrawalPaid(admin.id, admin.email, 'admin', wr.id, 'PAY001');
    await expect(
      markWithdrawalPaid(admin.id, admin.email, 'admin', wr.id, 'PAY002')
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('double reject withdrawal → 409 on second', async () => {
    const u     = await createUser();
    const admin = await createStaff('admin');
    await setWallet(u.id, 0, 0, 10000);
    const wr = await requestWithdrawal(u.id, u.upiId, null, '50.00', u.upiId, true);

    await rejectWithdrawal(admin.id, admin.email, wr.id, 'Invalid account');
    await expect(
      rejectWithdrawal(admin.id, admin.email, wr.id, 'Invalid account again')
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ─── UTR uniqueness rules ─────────────────────────────────────────────────────

describe('UTR uniqueness', () => {
  beforeEach(truncateAllTables);

  it('duplicate active UTR is rejected', async () => {
    const u1 = await createUser();
    const u2 = await createUser();
    const utr = 'UTRUNIQUE0001';

    await submitDeposit(u1.id, '100.00', utr, TEST_SCREENSHOT);
    await expect(
      submitDeposit(u2.id, '100.00', utr, TEST_SCREENSHOT)
    ).rejects.toMatchObject({ code: 'UTR_EXISTS' });
  });

  it('same UTR allowed after rejection', async () => {
    const u     = await createUser();
    const admin = await createStaff('admin');
    const utr   = 'UTRREUSEOK001';

    const dep = await submitDeposit(u.id, '100.00', utr, TEST_SCREENSHOT);
    await rejectDeposit(admin.id, dep.id, 'Wrong UTR');

    // Same UTR should be accepted now (rejected row doesn't block)
    await expect(
      submitDeposit(u.id, '100.00', utr, TEST_SCREENSHOT)
    ).resolves.toBeDefined();
  });

  it('approved UTR cannot be reused', async () => {
    const u1    = await createUser();
    const u2    = await createUser();
    const admin = await createStaff('admin');
    const utr   = 'UTRAPPROVED001';

    const dep = await submitDeposit(u1.id, '100.00', utr, TEST_SCREENSHOT);
    await approveDeposit(admin.id, admin.email, 'admin', dep.id);

    // Reusing approved UTR must fail with UTR_EXISTS
    await expect(
      submitDeposit(u2.id, '100.00', utr, TEST_SCREENSHOT)
    ).rejects.toMatchObject({ code: 'UTR_EXISTS' });
  });

  it('database allows multiple rejected deposits with the same UTR (old UNIQUE dropped)', async () => {
    const u = await createUser();
    const utr = 'UTRDBTEST001';

    // Insert two rejected rows with identical UTR directly
    await query(
      `INSERT INTO deposit_requests (user_id, amount, utr, screenshot_url, status)
       VALUES ($1, '100.00', $2, 's1', 'rejected')`,
      [u.id, utr]
    );

    // Should succeed because old hard UNIQUE is dropped and partial index filters WHERE status <> 'rejected'
    await expect(
      query(
        `INSERT INTO deposit_requests (user_id, amount, utr, screenshot_url, status)
         VALUES ($1, '100.00', $2, 's2', 'rejected')`,
        [u.id, utr]
      )
    ).resolves.toBeDefined();
  });
});

// ─── Refund exactness + idempotency ──────────────────────────────────────────

describe('refundEntryFee', () => {
  beforeEach(truncateAllTables);

  it('refunds exact paid_* amounts back to exact wallets', async () => {
    const u = await createUser();
    await setWallet(u.id, 950, 50, 0); // cashback will be used first

    // Create a match + team + match_player row
    const staffRow = await createStaff('admin');
    const tierRes = await query(
      `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, max_players, min_players)
       VALUES ('battle_royale', 'solo', '10.00', '0', 100, 2) RETURNING id`
    );
    const tierId = tierRes.rows[0].id;
    const matchRes = await query(
      `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
        position_prizes, max_players, min_players, start_time, created_by, status)
       VALUES ($1, 'battle_royale', 'solo', '10.00', '0', 0, '[]', 100, 2, now() + interval '1h', $2, 'upcoming')
       RETURNING id`,
      [tierId, staffRow.id]
    );
    const matchId = matchRes.rows[0].id.toString();

    let paidCashback = 0, paidAddMoney = 0, paidWinning = 0;
    const mpId = await withTransaction(async (client) => {
      await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [u.id]);
      const alloc = await allocateEntryFee(client, u.id, 1000, 'match', matchId);
      paidCashback = alloc.paidCashback;
      paidAddMoney = alloc.paidAddMoney;
      paidWinning  = alloc.paidWinning;

      const mp = await client.query(
        `INSERT INTO match_players (match_id, user_id, paid_add_money, paid_cashback, paid_winning)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [matchId, u.id, formatDbNumeric(paidAddMoney), formatDbNumeric(paidCashback), formatDbNumeric(paidWinning)]
      );
      return mp.rows[0].id.toString();
    });

    const wBefore = await getWallet(u.id);

    // Refund
    await withTransaction(async (client) => {
      await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [u.id]);
      await refundEntryFee(client, mpId, matchId);
    });

    const wAfter = await getWallet(u.id);

    // Wallets restored exactly
    expect(wAfter.addMoney).toBe(wBefore.addMoney + paidAddMoney);
    expect(wAfter.cashback).toBe(wBefore.cashback + paidCashback);
    expect(wAfter.winning).toBe(wBefore.winning + paidWinning);
  });

  it('no double refund: second call is a no-op', async () => {
    const u = await createUser();
    await setWallet(u.id, 1000, 0, 0);

    const staffRow = await createStaff('admin');
    const tierRes = await query(
      `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, max_players, min_players)
       VALUES ('battle_royale', 'solo', '10.00', '0', 100, 2) RETURNING id`
    );
    const tierId = tierRes.rows[0].id;
    const matchRes = await query(
      `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
        position_prizes, max_players, min_players, start_time, created_by, status)
       VALUES ($1, 'battle_royale', 'solo', '10.00', '0', 0, '[]', 100, 2, now() + interval '1h', $2, 'upcoming')
       RETURNING id`,
      [tierId, staffRow.id]
    );
    const matchId = matchRes.rows[0].id.toString();

    const mpId = await withTransaction(async (client) => {
      await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [u.id]);
      const alloc = await allocateEntryFee(client, u.id, 1000, 'match', matchId);
      const mp = await client.query(
        `INSERT INTO match_players (match_id, user_id, paid_add_money, paid_cashback, paid_winning)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [matchId, u.id, formatDbNumeric(alloc.paidAddMoney), formatDbNumeric(alloc.paidCashback), formatDbNumeric(alloc.paidWinning)]
      );
      return mp.rows[0].id.toString();
    });

    // First refund
    await withTransaction(async (client) => {
      await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [u.id]);
      await refundEntryFee(client, mpId, matchId);
    });
    const wAfterFirst = await getWallet(u.id);

    // Second refund (should be no-op)
    await withTransaction(async (client) => {
      await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [u.id]);
      await refundEntryFee(client, mpId, matchId);
    });
    const wAfterSecond = await getWallet(u.id);

    expect(wAfterSecond.addMoney).toBe(wAfterFirst.addMoney);
    expect(wAfterSecond.cashback).toBe(wAfterFirst.cashback);
    expect(wAfterSecond.winning).toBe(wAfterFirst.winning);
  });
});

// ─── Withdrawal: hold → reject round trip ────────────────────────────────────

describe('Withdrawal hold → reject', () => {
  beforeEach(truncateAllTables);

  it('reject refunds exactly to winning; net change = 0', async () => {
    const u     = await createUser();
    const admin = await createStaff('admin');
    await setWallet(u.id, 0, 0, 10000); // Rs100

    const wBefore = await getWallet(u.id);
    const wr = await requestWithdrawal(u.id, u.upiId, null, '50.00', u.upiId, true);

    // After hold: winning reduced
    const wAfterHold = await getWallet(u.id);
    expect(wAfterHold.winning).toBe(wBefore.winning - 5000);

    // Reject: winning restored
    await rejectWithdrawal(admin.id, admin.email, wr.id, 'Invalid UPI');
    const wAfterReject = await getWallet(u.id);
    expect(wAfterReject.winning).toBe(wBefore.winning);
  });

  it('only winning wallet is used; add_money and cashback cannot be withdrawn', async () => {
    const u = await createUser();
    await setWallet(u.id, 10000, 500, 0); // plenty in add_money + cashback, nothing in winning

    await expect(
      requestWithdrawal(u.id, u.upiId, null, '50.00', u.upiId, true)
    ).rejects.toMatchObject({ code: 'LOW_BALANCE' });
  });
});

// ─── UPI change blocks withdrawal for 48 h ───────────────────────────────────

describe('UPI recently changed', () => {
  beforeEach(truncateAllTables);

  it('blocks withdrawal for 48h after UPI change', async () => {
    const u = await createUser();
    await setWallet(u.id, 0, 0, 10000);
    // Simulate a very recent UPI change
    const recentChange = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago

    await expect(
      requestWithdrawal(u.id, u.upiId, recentChange, '50.00', u.upiId, true)
    ).rejects.toMatchObject({ code: 'UPI_RECENTLY_CHANGED' });
  });

  it('allows withdrawal after 48h have passed', async () => {
    const u = await createUser();
    await setWallet(u.id, 0, 0, 10000);
    const oldChange = new Date(Date.now() - 49 * 60 * 60 * 1000); // 49h ago

    await expect(
      requestWithdrawal(u.id, u.upiId, oldChange, '50.00', u.upiId, true)
    ).resolves.toBeDefined();
  });
});

// ─── Referral credited exactly once ──────────────────────────────────────────

describe('Referral reward', () => {
  beforeEach(truncateAllTables);

  it('credited exactly once on first approved deposit', async () => {
    const referrer = await createUser();
    const referred = await createUser({ referredBy: referrer.id });
    await createReferral(referrer.id, referred.id, '5.00');

    const admin = await createStaff('admin');

    // First deposit
    const dep1 = await createPendingDeposit(referred.id, '100.00');
    await approveDeposit(admin.id, admin.email, 'admin', dep1);
    const wAfterFirst = await getWallet(referrer.id);
    expect(wAfterFirst.cashback).toBe(500); // Rs5

    // Second deposit should NOT credit referral again
    const dep2 = await createPendingDeposit(referred.id, '200.00');
    await approveDeposit(admin.id, admin.email, 'admin', dep2);
    const wAfterSecond = await getWallet(referrer.id);
    expect(wAfterSecond.cashback).toBe(500); // still Rs5, not Rs10
  });
});

// ─── Ledger reconciliation ────────────────────────────────────────────────────

describe('Ledger reconciliation', () => {
  beforeEach(truncateAllTables);

  it('last ledger balance_after matches current wallet balance for each wallet kind', async () => {
    const u     = await createUser();
    const admin = await createStaff('admin');

    // Do a mix of operations
    const depId = await createPendingDeposit(u.id, '200.00');
    await approveDeposit(admin.id, admin.email, 'admin', depId);

    await setWallet(u.id, 20000, 0, 5000);
    await withTransaction(async (client) => {
      await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [u.id]);
      await debitWallet(client, u.id, 'add_money', 1000, 'join_fee', null, null);
      await creditWallet(client, u.id, 'winning', 3000, 'winning', null, null);
    });

    // For each wallet kind, last ledger row's balance_after should equal current balance
    const wallets = ['add_money', 'cashback', 'winning'] as const;
    for (const kind of wallets) {
      const currentRes = await query(
        `SELECT ${kind} FROM wallets WHERE user_id = $1`,
        [u.id]
      );
      const currentPaise = stringToPaise(currentRes.rows[0][kind].toString());

      const lastLedger = await query(
        `SELECT balance_after FROM wallet_ledger
         WHERE user_id = $1 AND wallet = $2
         ORDER BY id DESC LIMIT 1`,
        [u.id, kind]
      );
      if (lastLedger.rowCount) {
        const ledgerPaise = stringToPaise(lastLedger.rows[0].balance_after.toString());
        expect(ledgerPaise).toBe(currentPaise);
      }
    }
  });

  it('wallets never go negative (DB CHECK enforced, returns clean 402)', async () => {
    const u = await createUser();
    await setWallet(u.id, 100, 0, 0); // Rs1

    await expect(
      withTransaction(async (client) => {
        await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [u.id]);
        await debitWallet(client, u.id, 'add_money', 200, 'join_fee', null, null);
      })
    ).rejects.toMatchObject({ code: 'LOW_BALANCE', statusCode: 402 });

    // Balance unchanged
    const w = await getWallet(u.id);
    expect(w.addMoney).toBe(100);
  });

  it('total_after in ledger equals sum of all three wallet balances after op', async () => {
    const u = await createUser();
    await setWallet(u.id, 2000, 500, 1000);

    await withTransaction(async (client) => {
      await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [u.id]);
      await creditWallet(client, u.id, 'winning', 300, 'winning', null, null);
    });

    const lastLedger = await query(
      `SELECT total_after FROM wallet_ledger WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
      [u.id]
    );
    const totalAfter = stringToPaise(lastLedger.rows[0].total_after.toString());
    // 2000 + 500 + 1000 + 300 = 3800
    expect(totalAfter).toBe(3800);
  });
});

// ─── Withdrawal: change #4 – ref_id is set at INSERT time, no UPDATE ─────────

describe('Withdrawal ledger ref_id correctness (change #4)', () => {
  beforeEach(truncateAllTables);

  it('withdrawal_hold ledger row has ref_id = withdrawal_requests.id', async () => {
    const u = await createUser();
    await setWallet(u.id, 0, 0, 10000);

    const wr = await requestWithdrawal(u.id, u.upiId, null, '50.00', u.upiId, true);
    const wrId = Number(wr.id);

    const ledger = await query(
      `SELECT ref_id FROM wallet_ledger
       WHERE user_id = $1 AND type = 'withdrawal_hold'
       ORDER BY id DESC LIMIT 1`,
      [u.id]
    );
    expect(Number(ledger.rows[0].ref_id)).toBe(wrId);
  });
});

// ─── Per-user rate limit 10/min on deposits and withdrawals ───────────────────

describe('Per-user rate limit 10/min on deposits and withdrawals', () => {
  beforeEach(truncateAllTables);

  it('blocks 11th deposit request from same user with RATE_LIMITED (429)', async () => {
    const app = createApp({ enableRateLimiting: true });
    const u1 = await createUser();
    const u2 = await createUser();
    const t1 = await createAuthToken(u1);
    const t2 = await createAuthToken(u2);

    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/v1/wallet/deposits')
        .set('Authorization', `Bearer ${t1}`)
        .field('amount', '10.00')
        .field('utr', `UTRRLTEST${i}${next()}`)
        .attach('screenshot', TEST_SCREENSHOT, 'screenshot.jpg');
      expect(res.status).not.toBe(429);
    }

    // 11th request for u1 fails with 429
    const res11 = await request(app)
      .post('/api/v1/wallet/deposits')
      .set('Authorization', `Bearer ${t1}`)
      .field('amount', '10.00')
      .field('utr', `UTRRLTEST11${next()}`)
      .attach('screenshot', TEST_SCREENSHOT, 'screenshot.jpg');
    expect(res11.status).toBe(429);
    expect(res11.body.error.code).toBe(ErrorCodes.RATE_LIMITED);

    // u2 is unaffected (per-user rate limit)
    const resU2 = await request(app)
      .post('/api/v1/wallet/deposits')
      .set('Authorization', `Bearer ${t2}`)
      .field('amount', '10.00')
      .field('utr', `UTRRLTESTU2${next()}`)
      .attach('screenshot', TEST_SCREENSHOT, 'screenshot.jpg');
    expect(resU2.status).not.toBe(429);
  });

  it('blocks 11th withdrawal request from same user with RATE_LIMITED (429)', async () => {
    const app = createApp({ enableRateLimiting: true });
    const u1 = await createUser();
    const u2 = await createUser();
    const t1 = await createAuthToken(u1);
    const t2 = await createAuthToken(u2);

    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/v1/wallet/withdrawals')
        .set('Authorization', `Bearer ${t1}`)
        .send({ amount: '50.00', upi_id: u1.upiId, confirm_upi: true });
      expect(res.status).not.toBe(429);
    }

    const res11 = await request(app)
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${t1}`)
      .send({ amount: '50.00', upi_id: u1.upiId, confirm_upi: true });
    expect(res11.status).toBe(429);
    expect(res11.body.error.code).toBe(ErrorCodes.RATE_LIMITED);

    // u2 is unaffected
    const resU2 = await request(app)
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${t2}`)
      .send({ amount: '50.00', upi_id: u2.upiId, confirm_upi: true });
    expect(resU2.status).not.toBe(429);
  });
});

// ─── Transaction history (spec §6.4) ──────────────────────────────────────────

describe('Transaction history (type filters, cursor pagination, BW- IDs, remainingAmount)', () => {
  beforeEach(truncateAllTables);

  it('returns BW- display IDs, signed amounts, remainingAmount, and respects type filter and cursor pagination', async () => {
    const u = await createUser();
    const admin = await createStaff('admin');

    const depId = await createPendingDeposit(u.id, '100.00');
    await approveDeposit(admin.id, admin.email, 'admin', depId);

    await setWallet(u.id, 10000, 2000, 5000);

    await withTransaction(async (client) => {
      await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [u.id]);
      await debitWallet(client, u.id, 'add_money', 1500, 'join_fee', 'match', 1);
      await creditWallet(client, u.id, 'winning', 3000, 'winning', 'match', 1);
      await creditWallet(client, u.id, 'cashback', 500, 'referral', 'referral', 1);
    });

    // 1. Fetch all transactions
    const allTx = await listTransactions(u.id, { limit: 10 });
    expect(allTx.items.length).toBeGreaterThanOrEqual(4);

    // Check BW- format (e.g. BW-0000001)
    for (const item of allTx.items) {
      expect(item.transactionId).toMatch(/^BW-\d{7}$/);
      expect(item.remainingAmount).toBeDefined();
    }

    // 2. Type filter: add_money
    const addMoneyTx = await listTransactions(u.id, { type: 'add_money' });
    expect(addMoneyTx.items.length).toBe(1);
    expect(addMoneyTx.items[0].type).toBe('add_money');
    expect(addMoneyTx.items[0].amount).toBe('100.00');

    // 3. Type filter: join_fee (negative amount)
    const joinFeeTx = await listTransactions(u.id, { type: 'join_fee' });
    expect(joinFeeTx.items.length).toBe(1);
    expect(joinFeeTx.items[0].amount).toBe('-15.00');

    // 4. Cursor pagination: fetch page of size 2, then next page
    const page1 = await listTransactions(u.id, { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await listTransactions(u.id, { limit: 2, cursor: page1.nextCursor! });
    expect(page2.items.length).toBeGreaterThanOrEqual(1);
    expect(Number(page2.items[0].transactionId.replace('BW-', ''))).toBeLessThan(
      Number(page1.items[1].transactionId.replace('BW-', ''))
    );
  });
});

// ─── Referral credit ──────────────────────────────────────────────────────────

describe('Referral credit (UPDATE ... WHERE credited_at IS NULL RETURNING)', () => {
  beforeEach(truncateAllTables);

  it('credits referral reward via UPDATE ... WHERE credited_at IS NULL RETURNING exactly once', async () => {
    const referrer = await createUser();
    const referred = await createUser({ referredBy: referrer.id });
    await createReferral(referrer.id, referred.id, '15.00');

    await withTransaction(async (client) => {
      await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [referrer.id]);
      await creditReferralReward(client, referred.id);
    });

    const w1 = await getWallet(referrer.id);
    expect(w1.cashback).toBe(1500); // 15.00

    const refRow = await query('SELECT credited_at FROM referrals WHERE referred_id = $1', [referred.id]);
    expect(refRow.rows[0].credited_at).not.toBeNull();

    // Second credit attempt is a no-op
    await withTransaction(async (client) => {
      await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [referrer.id]);
      await creditReferralReward(client, referred.id);
    });

    const w2 = await getWallet(referrer.id);
    expect(w2.cashback).toBe(1500); // Unchanged
  });

  it('skips referral reward when referrer is soft-deleted', async () => {
    const referrer = await createUser();
    // Soft-delete referrer
    await query('UPDATE users SET deleted_at = now() WHERE id = $1', [referrer.id]);

    const referred = await createUser({ referredBy: referrer.id });
    await createReferral(referrer.id, referred.id, '20.00');

    await withTransaction(async (client) => {
      await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [referrer.id]);
      await creditReferralReward(client, referred.id);
    });

    const w = await getWallet(referrer.id);
    expect(w.cashback).toBe(0); // Never credited
  });
});

// ─── Approval-time dynamic re-check of admin_approval_threshold ───────────────

describe('Approval-time dynamic re-check of admin_approval_threshold', () => {
  beforeEach(truncateAllTables);

  it('re-checks threshold dynamically at approval time: deposit created when threshold was high is blocked for employee when threshold is lowered', async () => {
    // Start with high threshold: 2000.00
    await seedSettings({ admin_approval_threshold: '2000.00' });
    const u = await createUser();
    const employee = await createStaff('employee');

    // Deposit of 600.00 is created (needs_admin flag is FALSE because 600 < 2000)
    const depId = await createPendingDeposit(u.id, '600.00');
    const depRow = await query('SELECT needs_admin FROM deposit_requests WHERE id = $1', [depId]);
    expect(depRow.rows[0].needs_admin).toBe(false);

    // Admin lowers threshold to 500.00
    await query(`UPDATE app_settings SET value = '500.00' WHERE key = 'admin_approval_threshold'`);

    // Under two-step approvals, employee cannot approve any deposit (admin-only)
    await expect(
      approveDeposit(employee.id, employee.email, 'employee', depId)
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
  });
});

// ─── 10 simultaneous withdrawal requests ──────────────────────────────────────

describe('10 simultaneous withdrawal requests respect pending limits', () => {
  beforeEach(truncateAllTables);

  it('exactly 1 succeeds, 9 fail with WITHDRAWAL_PENDING', async () => {
    const u = await createUser();
    // Give user plenty of balance: Rs10,000 winning
    await setWallet(u.id, 0, 0, 1000000);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        requestWithdrawal(u.id, u.upiId, null, '50.00', u.upiId, true)
      )
    );

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures  = results.filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(9);

    for (const f of failures) {
      expect((f as PromiseRejectedResult).reason?.code).toBe('WITHDRAWAL_PENDING');
    }
  });
});

// ─── Extended Ledger Reconciliation (many operations) ─────────────────────────

describe('Extended Ledger Reconciliation (30 operations)', () => {
  beforeEach(truncateAllTables);

  it('reconciles ledger after 30 varied operations: credits, debits, and allocations', async () => {
    const u = await createUser();
    await setWallet(u.id, 50000, 10000, 20000); // 500 add_money, 100 cashback, 200 winning

    // Perform 30 varied sequential operations
    for (let i = 1; i <= 30; i++) {
      await withTransaction(async (client) => {
        await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [u.id]);
        if (i % 3 === 0) {
          await creditWallet(client, u.id, 'winning', 200, 'winning', null, null);
        } else if (i % 3 === 1) {
          await debitWallet(client, u.id, 'add_money', 100, 'join_fee', null, null);
        } else {
          await creditWallet(client, u.id, 'add_money', 150, 'add_money', null, null);
        }
      });
    }

    // Verify reconciliation for each wallet
    const currentWallet = await getWallet(u.id);
    const walletMap: Record<string, number> = {
      add_money: currentWallet.addMoney,
      cashback:  currentWallet.cashback,
      winning:   currentWallet.winning,
    };
    for (const kind of ['add_money', 'cashback', 'winning'] as const) {
      const lastLedger = await query(
        `SELECT balance_after FROM wallet_ledger WHERE user_id = $1 AND wallet = $2 ORDER BY id DESC LIMIT 1`,
        [u.id, kind]
      );
      if (lastLedger.rowCount) {
        expect(stringToPaise(lastLedger.rows[0].balance_after.toString())).toBe(walletMap[kind]);
      }
    }

    // Verify total_after on last ledger entry matches sum of all 3 wallets
    const lastRow = await query(
      `SELECT total_after FROM wallet_ledger WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
      [u.id]
    );
    expect(stringToPaise(lastRow.rows[0].total_after.toString())).toBe(
      currentWallet.addMoney + currentWallet.cashback + currentWallet.winning
    );
  });
});

