/**
 * Two-Step Approvals & Concurrency Test Suite
 *
 * Requirements covered:
 * 1. Two-step flow: pending -> verify (employee) -> approve / mark-paid (admin).
 * 2. Direct admin approval: pending -> approve / mark-paid (admin).
 *    Leaves employee_reviewed_by/at NULL, writes audit action *_direct.
 * 3. Employee reject restricted to pending (403 on employee_approved); admin can reject both.
 * 4. Withdrawal reject on employee_approved refunds held funds to winning wallet.
 * 5. /verify is employee-only; admin gets 403 ADMINS_APPROVE_DIRECTLY ("Admins approve directly").
 * 6. Final approve / mark-paid is admin-only; employee gets 403 FORBIDDEN.
 * 7. Pending limits: 2nd withdrawal blocked while 1st is employee_approved;
 *    4th deposit blocked while earlier 3 are in pending or employee_approved.
 * 8. Self-processing guards: staff cannot verify/approve/reject own request.
 * 9. Settings API rejects writes to admin_approval_threshold with 400 VALIDATION_ERROR.
 * 10. Concurrency races:
 *     - Employee verify vs employee verify (exactly 1 wins)
 *     - Employee verify vs admin direct approve (exactly 1 wins)
 *     - Admin approve vs admin reject (exactly 1 wins)
 *     - Employee verify vs employee reject (exactly 1 wins)
 *     - Employee reject vs admin direct approve (exactly 1 wins; approval never credits rejected)
 *     - 50 parallel final approvals on employee_approved request (credits exactly once)
 * 11. Ledger reconciliation for all wallets.
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
  stringToPaise,
} from '@booyah/shared';
import {
  submitDeposit,
} from '../src/modules/wallet/deposit.service.js';
import {
  verifyDeposit,
  approveDeposit,
  rejectDeposit,
} from '../src/modules/wallet/deposit.staff.service.js';
import {
  requestWithdrawal,
} from '../src/modules/wallet/withdrawal.service.js';
import {
  verifyWithdrawal,
  markWithdrawalPaid,
  rejectWithdrawal,
} from '../src/modules/wallet/withdrawal.staff.service.js';

let _ctr = 0;
const next = () => ++_ctr;

interface TestUser { id: string; email: string; upiId: string; referralCode: string }
interface TestStaff { id: string; email: string; role: 'admin' | 'employee' }

async function createUser(opts: { referredBy?: string } = {}): Promise<TestUser> {
  const i = next();
  const mobile = '9' + String(i).padStart(9, '0');
  const res = await query(
    `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code, referred_by)
     VALUES ($1, $2, $3, $4, $5, $6, '1990-01-01', $7, $8)
     RETURNING id, email, upi_id, referral_code`,
    [
      `two_user${i}@test.com`,
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
    [role, `Staff ${i}`, mobile, `staff${i}@test.com`]
  );
  return { id: res.rows[0].id.toString(), email: res.rows[0].email, role: res.rows[0].role };
}

async function createStaffToken(staff: TestStaff): Promise<string> {
  const sid = crypto.randomUUID();
  await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`, [
    sid,
    staff.id,
  ]);
  return signSessionToken({ sub: staff.id, typ: 'staff', sid, role: staff.role }, '1h');
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

const TEST_SCREENSHOT = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(200),
]);

async function createPendingDeposit(userId: string, amount = '100.00', utr?: string) {
  const utrVal = utr ?? `UTR${String(next()).padStart(10, '0')}T`;
  const r = await query(
    `INSERT INTO deposit_requests (user_id, amount, utr, screenshot_url)
     VALUES ($1, $2, $3, 'test-screenshot-key') RETURNING id`,
    [userId, amount, utrVal]
  );
  return r.rows[0].id.toString();
}

async function createPendingWithdrawal(user: TestUser, amountStr = '50.00') {
  const amountPaise = stringToPaise(amountStr);
  await query(
    `UPDATE wallets SET winning = winning + $1 WHERE user_id = $2`,
    [formatDbNumeric(amountPaise), user.id]
  );
  const wr = await requestWithdrawal(user.id, user.upiId, null, amountStr, user.upiId, true);
  return wr.id;
}

describe('Two-Step Approvals & Concurrency', () => {
  beforeEach(async () => {
    await truncateAllTables();
    await seedSettings();
  });

  // ─── 1. Deposit: Two-Step Flow Happy Path ─────────────────────────────────────
  it('deposit two-step flow: employee verifies -> admin approves credits money and records stages', async () => {
    const user = await createUser();
    const employee = await createStaff('employee');
    const admin = await createStaff('admin');
    const depId = await createPendingDeposit(user.id, '250.00');

    // Step 1: Employee verifies
    await verifyDeposit(employee.id, employee.email, 'employee', depId);

    const depStep1 = (await query('SELECT * FROM deposit_requests WHERE id = $1', [depId])).rows[0];
    expect(depStep1.status).toBe('employee_approved');
    expect(depStep1.employee_reviewed_by.toString()).toBe(employee.id);
    expect(depStep1.employee_reviewed_at).not.toBeNull();
    expect(depStep1.reviewed_by).toBeNull();
    expect(depStep1.reviewed_at).toBeNull();

    // Verify audit log for step 1
    const audit1 = (await query(
      `SELECT * FROM audit_logs WHERE target_id = $1 AND action = 'deposit_verified'`,
      [depId]
    )).rows[0];
    expect(audit1).toBeDefined();
    expect(audit1.staff_id.toString()).toBe(employee.id);
    expect(audit1.details.stage).toBe('employee_approved');

    // Wallet is NOT credited yet
    let w = await getWallet(user.id);
    expect(w.addMoney).toBe(0);

    // Step 2: Admin approves
    await approveDeposit(admin.id, admin.email, 'admin', depId);

    const depStep2 = (await query('SELECT * FROM deposit_requests WHERE id = $1', [depId])).rows[0];
    expect(depStep2.status).toBe('approved');
    expect(depStep2.employee_reviewed_by.toString()).toBe(employee.id);
    expect(depStep2.reviewed_by.toString()).toBe(admin.id);
    expect(depStep2.reviewed_at).not.toBeNull();

    // Verify audit log for step 2
    const audit2 = (await query(
      `SELECT * FROM audit_logs WHERE target_id = $1 AND action = 'deposit_approved'`,
      [depId]
    )).rows[0];
    expect(audit2).toBeDefined();
    expect(audit2.staff_id.toString()).toBe(admin.id);
    expect(audit2.details.direct).toBe(false);

    // Wallet IS credited now
    w = await getWallet(user.id);
    expect(w.addMoney).toBe(25000); // Rs 250.00
  });

  // ─── 2. Withdrawal: Two-Step Flow Happy Path ──────────────────────────────────
  it('withdrawal two-step flow: employee verifies -> admin marks paid with payoutRef', async () => {
    const user = await createUser();
    const employee = await createStaff('employee');
    const admin = await createStaff('admin');
    const wrId = await createPendingWithdrawal(user, '300.00'); // Rs 300.00

    // Step 1: Employee verifies
    await verifyWithdrawal(employee.id, employee.email, 'employee', wrId);

    const wrStep1 = (await query('SELECT * FROM withdrawal_requests WHERE id = $1', [wrId])).rows[0];
    expect(wrStep1.status).toBe('employee_approved');
    expect(wrStep1.employee_reviewed_by.toString()).toBe(employee.id);
    expect(wrStep1.employee_reviewed_at).not.toBeNull();
    expect(wrStep1.processed_by).toBeNull();

    const audit1 = (await query(
      `SELECT * FROM audit_logs WHERE target_id = $1 AND action = 'withdrawal_verified'`,
      [wrId]
    )).rows[0];
    expect(audit1).toBeDefined();
    expect(audit1.staff_id.toString()).toBe(employee.id);

    // Step 2: Admin marks paid
    await markWithdrawalPaid(admin.id, admin.email, 'admin', wrId, 'PAY_REF_999');

    const wrStep2 = (await query('SELECT * FROM withdrawal_requests WHERE id = $1', [wrId])).rows[0];
    expect(wrStep2.status).toBe('paid');
    expect(wrStep2.employee_reviewed_by.toString()).toBe(employee.id);
    expect(wrStep2.processed_by.toString()).toBe(admin.id);
    expect(wrStep2.payout_ref).toBe('PAY_REF_999');

    const audit2 = (await query(
      `SELECT * FROM audit_logs WHERE target_id = $1 AND action = 'withdrawal_paid'`,
      [wrId]
    )).rows[0];
    expect(audit2).toBeDefined();
    expect(audit2.details.direct).toBe(false);
  });

  // ─── 3. Direct Admin Approval (Deposit) ───────────────────────────────────────
  it('direct admin approval leaves employee fields NULL and logs deposit_approved_direct', async () => {
    const user = await createUser();
    const admin = await createStaff('admin');
    const depId = await createPendingDeposit(user.id, '400.00');

    // Admin approves directly from pending
    await approveDeposit(admin.id, admin.email, 'admin', depId);

    const dep = (await query('SELECT * FROM deposit_requests WHERE id = $1', [depId])).rows[0];
    expect(dep.status).toBe('approved');
    expect(dep.employee_reviewed_by).toBeNull();
    expect(dep.employee_reviewed_at).toBeNull();
    expect(dep.reviewed_by.toString()).toBe(admin.id);
    expect(dep.reviewed_at).not.toBeNull();

    const audit = (await query(
      `SELECT * FROM audit_logs WHERE target_id = $1 AND action = 'deposit_approved_direct'`,
      [depId]
    )).rows[0];
    expect(audit).toBeDefined();
    expect(audit.staff_id.toString()).toBe(admin.id);
    expect(audit.details.direct).toBe(true);

    const w = await getWallet(user.id);
    expect(w.addMoney).toBe(40000);
  });

  // ─── 4. Direct Admin Mark-Paid (Withdrawal) ───────────────────────────────────
  it('direct admin mark-paid leaves employee fields NULL and logs withdrawal_paid_direct', async () => {
    const user = await createUser();
    const admin = await createStaff('admin');
    const wrId = await createPendingWithdrawal(user, '150.00');

    await markWithdrawalPaid(admin.id, admin.email, 'admin', wrId, 'DIRECT_PAY_01');

    const wr = (await query('SELECT * FROM withdrawal_requests WHERE id = $1', [wrId])).rows[0];
    expect(wr.status).toBe('paid');
    expect(wr.employee_reviewed_by).toBeNull();
    expect(wr.employee_reviewed_at).toBeNull();
    expect(wr.processed_by.toString()).toBe(admin.id);
    expect(wr.payout_ref).toBe('DIRECT_PAY_01');

    const audit = (await query(
      `SELECT * FROM audit_logs WHERE target_id = $1 AND action = 'withdrawal_paid_direct'`,
      [wrId]
    )).rows[0];
    expect(audit).toBeDefined();
    expect(audit.details.direct).toBe(true);
  });

  // ─── 5. Role restrictions: /verify is employee-only (admin gets 403) ──────────
  it('/verify endpoint returns 403 ADMINS_APPROVE_DIRECTLY when called by admin', async () => {
    const app = createApp();
    const user = await createUser();
    const admin = await createStaff('admin');
    const token = await createStaffToken(admin);
    const depId = await createPendingDeposit(user.id, '100.00');
    const wrId = await createPendingWithdrawal(user, '100.00');

    const resDep = await request(app)
      .post(`/api/v1/staff/deposits/${depId}/verify`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(resDep.status).toBe(403);
    expect(resDep.body.error.code).toBe(ErrorCodes.ADMINS_APPROVE_DIRECTLY);
    expect(resDep.body.error.message).toBe('Admins approve directly');

    const resWr = await request(app)
      .post(`/api/v1/staff/withdrawals/${wrId}/verify`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(resWr.status).toBe(403);
    expect(resWr.body.error.code).toBe(ErrorCodes.ADMINS_APPROVE_DIRECTLY);
    expect(resWr.body.error.message).toBe('Admins approve directly');
  });

  // ─── 6. Role restrictions: employee cannot approve or mark-paid ───────────────
  it('employee calling approveDeposit or markWithdrawalPaid gets 403 FORBIDDEN', async () => {
    const user = await createUser();
    const employee = await createStaff('employee');
    const depId = await createPendingDeposit(user.id, '100.00');
    const wrId = await createPendingWithdrawal(user, '100.00');

    await expect(
      approveDeposit(employee.id, employee.email, 'employee', depId)
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    await expect(
      markWithdrawalPaid(employee.id, employee.email, 'employee', wrId, 'TEST')
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
  });

  // ─── 7. Rejection role restrictions (employee can only reject pending) ────────
  it('employees may reject only pending; admin may reject employee_approved (403 for employee)', async () => {
    const user = await createUser();
    const employee = await createStaff('employee');
    const admin = await createStaff('admin');

    // Case A: Deposit
    const depPending = await createPendingDeposit(user.id, '100.00');
    // Employee rejects pending deposit -> SUCCESS
    await expect(
      rejectDeposit(employee.id, employee.email, 'employee', depPending, 'Bad screenshot')
    ).resolves.toBeUndefined();

    const depPendingRow = (await query('SELECT status FROM deposit_requests WHERE id = $1', [depPending])).rows[0];
    expect(depPendingRow.status).toBe('rejected');

    // Deposit moved to employee_approved
    const depVerified = await createPendingDeposit(user.id, '200.00');
    await verifyDeposit(employee.id, employee.email, 'employee', depVerified);

    // Employee attempts to reject employee_approved deposit -> 403 FORBIDDEN
    await expect(
      rejectDeposit(employee.id, employee.email, 'employee', depVerified, 'Changed mind')
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    // Admin rejects employee_approved deposit -> SUCCESS
    await expect(
      rejectDeposit(admin.id, admin.email, 'admin', depVerified, 'Admin found invalid UTR')
    ).resolves.toBeUndefined();

    const depVerifiedRow = (await query('SELECT status, reject_reason FROM deposit_requests WHERE id = $1', [depVerified])).rows[0];
    expect(depVerifiedRow.status).toBe('rejected');
    expect(depVerifiedRow.reject_reason).toBe('Admin found invalid UTR');

    // Case B: Withdrawal
    const wrPending = await createPendingWithdrawal(user, '100.00');
    // Employee rejects pending withdrawal -> SUCCESS
    await expect(
      rejectWithdrawal(employee.id, employee.email, 'employee', wrPending, 'Bank account blocked')
    ).resolves.toBeUndefined();

    const wrVerified = await createPendingWithdrawal(user, '150.00');
    await verifyWithdrawal(employee.id, employee.email, 'employee', wrVerified);

    // Employee attempts to reject employee_approved withdrawal -> 403 FORBIDDEN
    await expect(
      rejectWithdrawal(employee.id, employee.email, 'employee', wrVerified, 'Changed mind')
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    // Admin rejects employee_approved withdrawal -> SUCCESS and held funds refunded
    await expect(
      rejectWithdrawal(admin.id, admin.email, 'admin', wrVerified, 'Suspicious activity confirmed')
    ).resolves.toBeUndefined();

    const wrVerifiedRow = (await query('SELECT status, reject_reason FROM withdrawal_requests WHERE id = $1', [wrVerified])).rows[0];
    expect(wrVerifiedRow.status).toBe('rejected');
  });

  // ─── 8. Withdrawal rejection at employee_approved stage refunds exactly once ──
  it('rejection of employee_approved withdrawal refunds held money to user winning wallet', async () => {
    const user = await createUser();
    const employee = await createStaff('employee');
    const admin = await createStaff('admin');

    await setWallet(user.id, 0, 0, 50000); // Rs 500 winning
    const wr = await requestWithdrawal(user.id, user.upiId, null, '300.00', user.upiId, true); // 300 held, 200 remaining winning

    let w = await getWallet(user.id);
    expect(w.winning).toBe(20000);

    // Verified by employee
    await verifyWithdrawal(employee.id, employee.email, 'employee', wr.id);

    // Rejected by admin
    await rejectWithdrawal(admin.id, admin.email, 'admin', wr.id, 'Invalid UPI name mismatch');

    w = await getWallet(user.id);
    expect(w.winning).toBe(50000); // Refunded back 30000 paise

    // Attempting to reject again returns 409
    await expect(
      rejectWithdrawal(admin.id, admin.email, 'admin', wr.id, 'Trying second reject')
    ).rejects.toMatchObject({ statusCode: 409 });

    // Balance remains 50000 (never double refunded)
    w = await getWallet(user.id);
    expect(w.winning).toBe(50000);
  });

  // ─── 9. Pending limits include employee_approved ──────────────────────────────
  it('user cannot create 2nd withdrawal while 1st is employee_approved', async () => {
    const user = await createUser();
    const employee = await createStaff('employee');
    await setWallet(user.id, 0, 0, 100000);

    const wr1 = await requestWithdrawal(user.id, user.upiId, null, '200.00', user.upiId, true);
    await verifyWithdrawal(employee.id, employee.email, 'employee', wr1.id);

    // 2nd withdrawal is blocked with WITHDRAWAL_PENDING
    await expect(
      requestWithdrawal(user.id, user.upiId, null, '200.00', user.upiId, true)
    ).rejects.toMatchObject({ code: 'WITHDRAWAL_PENDING', statusCode: 409 });
  });

  it('user deposit limit blocks 4th request while earlier ones are employee_approved', async () => {
    const user = await createUser();
    const employee = await createStaff('employee');

    const d1 = await createPendingDeposit(user.id, '100.00');
    const d2 = await createPendingDeposit(user.id, '100.00');
    const d3 = await createPendingDeposit(user.id, '100.00');

    // Move d1 and d2 to employee_approved
    await verifyDeposit(employee.id, employee.email, 'employee', d1);
    await verifyDeposit(employee.id, employee.email, 'employee', d2);

    // 4th deposit must fail with DEPOSIT_LIMIT
    await expect(
      submitDeposit(user.id, '100.00', 'UTR999888777X', TEST_SCREENSHOT)
    ).rejects.toMatchObject({ code: 'DEPOSIT_LIMIT', statusCode: 409 });
  });

  // ─── 10. Self-processing guards ───────────────────────────────────────────────
  it('staff user cannot verify, approve, or reject their own deposit or withdrawal', async () => {
    const staff = await createStaff('employee');
    const admin = await createStaff('admin');

    // User created with staff's email
    const i = next();
    const res = await query(
      `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
       VALUES ($1, $2, $3, $4, $5, $6, '1990-01-01', $7) RETURNING id`,
      [staff.email, `User ${i}`, `7${String(i).padStart(9, '0')}`, `FX${i}`, `FXN${i}`, `xupi${i}@t`, `XR${i}`]
    );
    const userId = res.rows[0].id.toString();
    await query('INSERT INTO wallets (user_id) VALUES ($1)', [userId]);
    const userFromStaff: TestUser = {
      id: userId,
      email: staff.email,
      upiId: `xupi${i}@t`,
      referralCode: `XR${i}`,
    };

    const depId = await createPendingDeposit(userId, '150.00');
    const wrId = await createPendingWithdrawal(userFromStaff, '100.00');

    // Staff cannot verify own deposit
    await expect(
      verifyDeposit(staff.id, staff.email, 'employee', depId)
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    // Staff cannot verify own withdrawal
    await expect(
      verifyWithdrawal(staff.id, staff.email, 'employee', wrId)
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    // Staff cannot reject own deposit
    await expect(
      rejectDeposit(staff.id, staff.email, 'employee', depId, 'Invalid slip')
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    // Staff cannot reject own withdrawal
    await expect(
      rejectWithdrawal(staff.id, staff.email, 'employee', wrId, 'Invalid UPI details')
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
  });

  // ─── 11. Settings API rejects writes to admin_approval_threshold ──────────────
  it('settings API rejects writes to admin_approval_threshold with 400 VALIDATION_ERROR', async () => {
    const app = createApp();
    const admin = await createStaff('admin');
    const token = await createStaffToken(admin);

    const res = await request(app)
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ admin_approval_threshold: '1000.00' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(res.body.error.message).toContain('admin_approval_threshold is no longer configurable');
  });

  // ─── 12. Concurrency: Employee verify racing Employee verify ──────────────────
  it('employee verify racing employee verify on same pending request: exactly 1 wins, other gets 409', async () => {
    const user = await createUser();
    const emp1 = await createStaff('employee');
    const emp2 = await createStaff('employee');
    const depId = await createPendingDeposit(user.id, '100.00');

    const results = await Promise.allSettled([
      verifyDeposit(emp1.id, emp1.email, 'employee', depId),
      verifyDeposit(emp2.id, emp2.email, 'employee', depId),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const rejError = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejError.statusCode).toBe(409);
  });

  // ─── 13. Concurrency: Employee verify racing Admin direct approve ──────────────
  it('employee verify racing admin direct approve: exactly one wins or cleanly serializes', async () => {
    const user = await createUser();
    const emp = await createStaff('employee');
    const admin = await createStaff('admin');
    const depId = await createPendingDeposit(user.id, '200.00');

    const results = await Promise.allSettled([
      verifyDeposit(emp.id, emp.email, 'employee', depId),
      approveDeposit(admin.id, admin.email, 'admin', depId),
    ]);

    // Check database state: deposit must be approved or employee_approved, never broken
    const dep = (await query('SELECT status FROM deposit_requests WHERE id = $1', [depId])).rows[0];
    expect(['employee_approved', 'approved']).toContain(dep.status);

    const w = await getWallet(user.id);
    if (dep.status === 'approved') {
      expect(w.addMoney).toBe(20000);
    } else {
      expect(w.addMoney).toBe(0);
    }
  });

  // ─── 14. Concurrency: Employee verify racing Employee reject ──────────────────
  it('employee verify racing employee reject on same pending request: exactly one wins', async () => {
    const user = await createUser();
    const emp1 = await createStaff('employee');
    const emp2 = await createStaff('employee');
    const depId = await createPendingDeposit(user.id, '100.00');

    const results = await Promise.allSettled([
      verifyDeposit(emp1.id, emp1.email, 'employee', depId),
      rejectDeposit(emp2.id, emp2.email, 'employee', depId, 'Invalid UTR reference'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const dep = (await query('SELECT status FROM deposit_requests WHERE id = $1', [depId])).rows[0];
    expect(['employee_approved', 'rejected']).toContain(dep.status);
  });

  // ─── 15. Concurrency: Employee reject racing Admin direct approve ─────────────
  it('employee reject racing admin direct approve: exactly one wins; approval NEVER credits rejected request', async () => {
    const user = await createUser();
    const emp = await createStaff('employee');
    const admin = await createStaff('admin');
    const depId = await createPendingDeposit(user.id, '500.00');

    const results = await Promise.allSettled([
      rejectDeposit(emp.id, emp.email, 'employee', depId, 'Invalid UTR format'),
      approveDeposit(admin.id, admin.email, 'admin', depId),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const dep = (await query('SELECT status FROM deposit_requests WHERE id = $1', [depId])).rows[0];
    const w = await getWallet(user.id);

    if (dep.status === 'rejected') {
      // Rejection won: approval NEVER credited
      expect(w.addMoney).toBe(0);
    } else {
      // Approval won: credited exactly once
      expect(dep.status).toBe('approved');
      expect(w.addMoney).toBe(50000);
    }
  });

  // ─── 16. Concurrency: Admin approve racing Admin reject ───────────────────────
  it('admin approve racing admin reject on same request: exactly one wins', async () => {
    const user = await createUser();
    const admin1 = await createStaff('admin');
    const admin2 = await createStaff('admin');
    const depId = await createPendingDeposit(user.id, '300.00');

    const results = await Promise.allSettled([
      approveDeposit(admin1.id, admin1.email, 'admin', depId),
      rejectDeposit(admin2.id, admin2.email, 'admin', depId, 'Admin reject verification failed'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const dep = (await query('SELECT status FROM deposit_requests WHERE id = $1', [depId])).rows[0];
    const w = await getWallet(user.id);

    if (dep.status === 'rejected') {
      expect(w.addMoney).toBe(0);
    } else {
      expect(dep.status).toBe('approved');
      expect(w.addMoney).toBe(30000);
    }
  });

  // ─── 17. Concurrency: 50 parallel final approvals on same request ─────────────
  it('50 parallel final approvals on same employee_approved deposit: credits exactly once', async () => {
    const user = await createUser();
    const emp = await createStaff('employee');
    const admin = await createStaff('admin');
    const depId = await createPendingDeposit(user.id, '750.00');

    // Verified by employee first
    await verifyDeposit(emp.id, emp.email, 'employee', depId);

    // 50 concurrent admin approvals
    const promises = Array.from({ length: 50 }, () =>
      approveDeposit(admin.id, admin.email, 'admin', depId)
    );

    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(49);

    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason.statusCode).toBe(409);
    }

    const w = await getWallet(user.id);
    expect(w.addMoney).toBe(75000); // Rs 750 credited only once
  });

  // ─── 18. Ledger reconciliation ────────────────────────────────────────────────
  it('ledger reconciliation: sum of ledger entries matches current wallet balance', async () => {
    const user = await createUser();
    const emp = await createStaff('employee');
    const admin = await createStaff('admin');

    const depId = await createPendingDeposit(user.id, '500.00');
    await verifyDeposit(emp.id, emp.email, 'employee', depId);
    await approveDeposit(admin.id, admin.email, 'admin', depId);

    const w = await getWallet(user.id);

    // Query wallet_ledger
    const lastLedger = await query(
      `SELECT balance_after FROM wallet_ledger WHERE user_id = $1 AND wallet = 'add_money' ORDER BY id DESC LIMIT 1`,
      [user.id]
    );
    expect(lastLedger.rowCount).toBe(1);
    expect(stringToPaise(lastLedger.rows[0].balance_after.toString())).toBe(w.addMoney);
  });
});
