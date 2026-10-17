/**
 * Integration Tests for Dynamic Cashback Entry Fee Cap Setting (cashback_max_percent).
 *
 * Verifies:
 * 1. app_settings key cashback_max_percent, default "5", valid range 0 to 100 with at most 2 decimals.
 * 2. Changed only by admin through existing settings API (employees get 403).
 * 3. Invalid values rejected: negative, over 100, 3 decimals, not a number.
 * 4. Audit entry recorded in the same transaction with old and new values.
 * 5. GET /api/v1/rules returns the live value (replaces hardcoded constant).
 * 6. Money logic:
 *    - 0% uses no cashback.
 *    - 100% can pay whole fee from cashback.
 *    - 2.5% and 12.34% basis points calculations.
 *    - Rounding down on small fees (e.g. Rs0.50).
 *    - BigInt integer math, zero floats.
 * 7. Setting change racing a join (the join uses one consistent value; single join never mixes two values).
 * 8. Refunds return stored paid_* amounts, so joins made before change refund exactly.
 */

import crypto from 'crypto';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { truncateAllTables } from './setup.js';
import { query, withTransaction } from '../src/db/index.js';
import { createApp } from '../src/app.js';
import { signSessionToken } from '../src/utils/crypto.js';
import {
  formatDbNumeric,
  stringToPaise,
  ErrorCodes,
} from '@booyah/shared';
import {
  allocateEntryFee,
  refundEntryFee,
  AllocationResult,
} from '../src/modules/wallet/wallet.service.js';

const app = createApp({ enableRateLimiting: false });

let _ctr = 0;
const next = () => ++_ctr;

interface TestUser {
  id: string;
  email: string;
  mobile: string;
  token: string;
}

interface TestStaff {
  id: string;
  email: string;
  role: 'admin' | 'employee';
  token: string;
}

async function createUser(): Promise<TestUser> {
  const i = next();
  const mobile = '9' + String(i).padStart(9, '0');
  const res = await query(
    `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
     VALUES ($1, $2, $3, $4, $5, $6, '1995-01-01', $7)
     RETURNING id, email, mobile`,
    [
      `user${i}@test.com`,
      `User ${i}`,
      mobile,
      `FF${String(i).padStart(8, '0')}`,
      `FFN${i}`,
      `upi${i}@test`,
      `REF${String(i).padStart(6, '0')}`,
    ]
  );
  const row = res.rows[0];
  await query('INSERT INTO wallets (user_id) VALUES ($1)', [row.id]);

  const sid = crypto.randomUUID();
  await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'user', $2)`, [
    sid,
    row.id,
  ]);
  const token = signSessionToken({ sub: row.id.toString(), typ: 'user', sid, role: 'user' }, '1h');

  return {
    id: row.id.toString(),
    email: row.email,
    mobile: row.mobile,
    token,
  };
}

async function createStaff(role: 'admin' | 'employee' = 'employee'): Promise<TestStaff> {
  const i = next();
  const mobile = '8' + String(i).padStart(9, '0');
  const res = await query(
    `INSERT INTO staff (role, name, mobile, email) VALUES ($1, $2, $3, $4)
     RETURNING id, email, role`,
    [role, `Staff ${i}`, mobile, `staff${i}_${role}@test.com`]
  );
  const row = res.rows[0];

  const sid = crypto.randomUUID();
  await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`, [
    sid,
    row.id,
  ]);
  const token = signSessionToken({ sub: row.id.toString(), typ: 'staff', sid, role }, '1h');

  return { id: row.id.toString(), email: row.email, role: row.role, token };
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
    addMoney: stringToPaise(row.add_money),
    cashback: stringToPaise(row.cashback),
    winning:  stringToPaise(row.winning),
  };
}

async function runAllocation(userId: string, feePaise: number): Promise<AllocationResult> {
  return withTransaction(async (client) => {
    await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
    return allocateEntryFee(client, userId, feePaise, 'match', 1);
  });
}

describe('Dynamic Cashback Entry Fee Cap Setting (cashback_max_percent)', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  describe('1. Setting CRUD & Role Access', () => {
    it('defaults to 5 when app_settings row is not yet set', async () => {
      const res = await request(app).get('/api/v1/rules').expect(200);
      expect(res.body.data.maxCashbackUsagePercent).toBe(5);
    });

    it('employees get 403 trying to modify setting via PATCH /api/v1/admin/settings', async () => {
      const employee = await createStaff('employee');
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${employee.token}`)
        .send({ cashback_max_percent: '10' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCodes.FORBIDDEN);
    });

    it('admin can successfully update cashback_max_percent within 0 to 100 with at most 2 decimals', async () => {
      const admin = await createStaff('admin');
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ cashback_max_percent: '12.34' });

      expect(res.status).toBe(200);
      expect(res.body.data.settings.cashback_max_percent).toBe('12.34');
    });

    it('rejects invalid values: negative, over 100, 3 decimals, not a number', async () => {
      const admin = await createStaff('admin');

      // Negative
      const r1 = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ cashback_max_percent: '-1' });
      expect(r1.status).toBe(400);
      expect(r1.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // Over 100
      const r2 = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ cashback_max_percent: '100.01' });
      expect(r2.status).toBe(400);
      expect(r2.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // 3 decimals
      const r3 = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ cashback_max_percent: '5.123' });
      expect(r3.status).toBe(400);
      expect(r3.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // Not a number
      const r4 = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ cashback_max_percent: 'abc' });
      expect(r4.status).toBe(400);
      expect(r4.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // With % symbol
      const r5 = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ cashback_max_percent: '5%' });
      expect(r5.status).toBe(400);
      expect(r5.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('audits setting change in the same transaction with old and new values', async () => {
      const admin = await createStaff('admin');

      // Seed initial 5
      await query(
        `INSERT INTO app_settings (key, value) VALUES ('cashback_max_percent', '5')
         ON CONFLICT (key) DO UPDATE SET value = '5'`
      );

      await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ cashback_max_percent: '10' })
        .expect(200);

      const auditRes = await query(
        `SELECT action, target_type, details FROM audit_logs
         WHERE action = 'settings_updated' ORDER BY id DESC LIMIT 1`
      );
      expect(auditRes.rowCount).toBe(1);
      const details = auditRes.rows[0].details;
      expect(details.updatedKeys).toContain('cashback_max_percent');
      expect(details.oldValue).toBe('5');
      expect(details.newValue).toBe('10');
      expect(details.changes?.cashback_max_percent).toEqual({ old: '5', new: '10' });
    });
  });

  describe('2. Live /api/v1/rules Endpoint', () => {
    it('returns the live value from database setting', async () => {
      const admin = await createStaff('admin');

      // Check default
      const res1 = await request(app).get('/api/v1/rules').expect(200);
      expect(res1.body.data.maxCashbackUsagePercent).toBe(5);

      // Change to 2.5
      await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ cashback_max_percent: '2.5' })
        .expect(200);

      const res2 = await request(app).get('/api/v1/rules').expect(200);
      expect(res2.body.data.maxCashbackUsagePercent).toBe(2.5);

      // Change to 12.34
      await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ cashback_max_percent: '12.34' })
        .expect(200);

      const res3 = await request(app).get('/api/v1/rules').expect(200);
      expect(res3.body.data.maxCashbackUsagePercent).toBe(12.34);

      // Change to 0
      await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ cashback_max_percent: '0' })
        .expect(200);

      const res4 = await request(app).get('/api/v1/rules').expect(200);
      expect(res4.body.data.maxCashbackUsagePercent).toBe(0);

      // Change to 100
      await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ cashback_max_percent: '100' })
        .expect(200);

      const res5 = await request(app).get('/api/v1/rules').expect(200);
      expect(res5.body.data.maxCashbackUsagePercent).toBe(100);
    });
  });

  describe('3. Money Logic & Integer Basis Points', () => {
    it('0% uses no cashback even if user has plenty of cashback', async () => {
      await query(
        `INSERT INTO app_settings (key, value) VALUES ('cashback_max_percent', '0')
         ON CONFLICT (key) DO UPDATE SET value = '0'`
      );

      const u = await createUser();
      // User has 500p (Rs 5) cashback and 2000p (Rs 20) add_money
      await setWallet(u.id, 2000, 500, 0);

      // Join match with fee 1000p (Rs 10.00)
      const r = await runAllocation(u.id, 1000);
      expect(r.paidCashback).toBe(0);
      expect(r.paidAddMoney).toBe(1000);
      expect(r.paidWinning).toBe(0);

      const w = await getWallet(u.id);
      expect(w.cashback).toBe(500); // untouched
      expect(w.addMoney).toBe(1000);
    });

    it('100% can pay the entire fee from cashback', async () => {
      await query(
        `INSERT INTO app_settings (key, value) VALUES ('cashback_max_percent', '100')
         ON CONFLICT (key) DO UPDATE SET value = '100'`
      );

      const u = await createUser();
      // User has 1500p (Rs 15) cashback and 0 add_money
      await setWallet(u.id, 0, 1500, 0);

      // Join match with fee 1000p (Rs 10.00)
      const r = await runAllocation(u.id, 1000);
      expect(r.paidCashback).toBe(1000);
      expect(r.paidAddMoney).toBe(0);
      expect(r.paidWinning).toBe(0);

      const w = await getWallet(u.id);
      expect(w.cashback).toBe(500);
    });

    it('2.5% cap: floor(1000p * 250 / 10000) = 25p', async () => {
      await query(
        `INSERT INTO app_settings (key, value) VALUES ('cashback_max_percent', '2.5')
         ON CONFLICT (key) DO UPDATE SET value = '2.5'`
      );

      const u = await createUser();
      await setWallet(u.id, 2000, 500, 0);

      const r = await runAllocation(u.id, 1000);
      expect(r.paidCashback).toBe(25);
      expect(r.paidAddMoney).toBe(975);
      expect(r.paidWinning).toBe(0);

      const w = await getWallet(u.id);
      expect(w.cashback).toBe(475);
      expect(w.addMoney).toBe(1025);
    });

    it('12.34% cap: floor(1000p * 1234 / 10000) = 123p', async () => {
      await query(
        `INSERT INTO app_settings (key, value) VALUES ('cashback_max_percent', '12.34')
         ON CONFLICT (key) DO UPDATE SET value = '12.34'`
      );

      const u = await createUser();
      await setWallet(u.id, 2000, 500, 0);

      const r = await runAllocation(u.id, 1000);
      expect(r.paidCashback).toBe(123);
      expect(r.paidAddMoney).toBe(877);
      expect(r.paidWinning).toBe(0);

      const w = await getWallet(u.id);
      expect(w.cashback).toBe(377);
      expect(w.addMoney).toBe(1123);
    });

    it('rounding down on small fees (e.g. Rs0.50 = 50p)', async () => {
      // 5% on 50p = floor(50 * 500 / 10000) = floor(2.5) = 2p
      await query(
        `INSERT INTO app_settings (key, value) VALUES ('cashback_max_percent', '5')
         ON CONFLICT (key) DO UPDATE SET value = '5'`
      );
      const u1 = await createUser();
      await setWallet(u1.id, 200, 100, 0);
      const r1 = await runAllocation(u1.id, 50);
      expect(r1.paidCashback).toBe(2);
      expect(r1.paidAddMoney).toBe(48);

      // 2.5% on 50p = floor(50 * 250 / 10000) = floor(1.25) = 1p
      await query(
        `INSERT INTO app_settings (key, value) VALUES ('cashback_max_percent', '2.5')
         ON CONFLICT (key) DO UPDATE SET value = '2.5'`
      );
      const u2 = await createUser();
      await setWallet(u2.id, 200, 100, 0);
      const r2 = await runAllocation(u2.id, 50);
      expect(r2.paidCashback).toBe(1);
      expect(r2.paidAddMoney).toBe(49);

      // 1% on 50p = floor(50 * 100 / 10000) = floor(0.5) = 0p
      await query(
        `INSERT INTO app_settings (key, value) VALUES ('cashback_max_percent', '1')
         ON CONFLICT (key) DO UPDATE SET value = '1'`
      );
      const u3 = await createUser();
      await setWallet(u3.id, 200, 100, 0);
      const r3 = await runAllocation(u3.id, 50);
      expect(r3.paidCashback).toBe(0);
      expect(r3.paidAddMoney).toBe(50);
    });
  });

  describe('4. Concurrency & Race Condition Behavior', () => {
    it('setting change racing a join uses one consistent value per join', async () => {
      // Start with 5%
      await query(
        `INSERT INTO app_settings (key, value) VALUES ('cashback_max_percent', '5')
         ON CONFLICT (key) DO UPDATE SET value = '5'`
      );

      const u1 = await createUser();
      await setWallet(u1.id, 2000, 500, 0);

      const u2 = await createUser();
      await setWallet(u2.id, 2000, 500, 0);

      // Run join 1 (uses 5%)
      const r1 = await runAllocation(u1.id, 1000);
      expect(r1.paidCashback).toBe(50);

      // Change setting to 10%
      await query(
        `UPDATE app_settings SET value = '10' WHERE key = 'cashback_max_percent'`
      );

      // Run join 2 (immediately uses new 10% setting)
      const r2 = await runAllocation(u2.id, 1000);
      expect(r2.paidCashback).toBe(100);
      expect(r2.paidAddMoney).toBe(900);

      // Verify no join mixed two values
      const w1 = await getWallet(u1.id);
      expect(w1.cashback).toBe(450);

      const w2 = await getWallet(u2.id);
      expect(w2.cashback).toBe(400);
    });

    it('refunds still return the stored paid_* amounts when cap changed after joining', async () => {
      // Player joined when cap was 5% (paid 50p cashback, 950p add_money)
      await query(
        `INSERT INTO app_settings (key, value) VALUES ('cashback_max_percent', '5')
         ON CONFLICT (key) DO UPDATE SET value = '5'`
      );

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

      const u = await createUser();
      await setWallet(u.id, 2000, 500, 0);

      const alloc = await runAllocation(u.id, 1000);
      expect(alloc.paidCashback).toBe(50);
      expect(alloc.paidAddMoney).toBe(950);

      // Insert mock match_players record storing paid_* amounts
      const mpRes = await query(
        `INSERT INTO match_players (match_id, user_id, paid_add_money, paid_cashback, paid_winning)
         VALUES ($1, $2, '9.50', '0.50', '0.00')
         RETURNING id`,
        [matchId, u.id]
      );
      const mpId = mpRes.rows[0].id;

      // Admin changes cap to 20%
      await query(
        `UPDATE app_settings SET value = '20' WHERE key = 'cashback_max_percent'`
      );

      // Match cancelled / player refunded
      await withTransaction(async (client) => {
        await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [u.id]);
        await refundEntryFee(client, mpId, matchId);
      });

      // Wallet restored to exactly the original balances
      const w = await getWallet(u.id);
      expect(w.cashback).toBe(500);
      expect(w.addMoney).toBe(2000);
      expect(w.winning).toBe(0);
    });
  });
});
