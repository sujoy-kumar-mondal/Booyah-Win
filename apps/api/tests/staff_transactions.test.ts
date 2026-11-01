import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';
import { SettingsService } from '../src/modules/admin/settings/settings.service.js';
import crypto from 'crypto';
import { formatUserId } from '@booyah/shared';

describe('Staff Transactions API (Platform-wide Ledger & Detail)', () => {
  const app = createApp({ enableRateLimiting: false });
  let adminToken: string;
  let adminId: string;
  let employeeToken: string;
  let employeeId: string;
  let testUserId: string;

  beforeEach(async () => {
    await truncateAllTables();
    await SettingsService.seedDefaults();

    // Create Admin staff
    const adminRes = await query(
      `INSERT INTO staff (role, name, email, mobile) VALUES ('admin', 'Admin Staff', 'admin@booyah.win', '9999999999') RETURNING id`
    );
    adminId = adminRes.rows[0].id.toString();
    const adminSid = crypto.randomUUID();
    await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`, [
      adminSid,
      adminId,
    ]);
    adminToken = signSessionToken(
      { sub: adminId, typ: 'staff', sid: adminSid, role: 'admin' },
      '12h'
    );

    // Create Employee staff
    const empRes = await query(
      `INSERT INTO staff (role, name, email, mobile) VALUES ('employee', 'Employee Staff', 'employee@booyah.win', '9888888888') RETURNING id`
    );
    employeeId = empRes.rows[0].id.toString();
    const empSid = crypto.randomUUID();
    await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`, [
      empSid,
      employeeId,
    ]);
    employeeToken = signSessionToken(
      { sub: employeeId, typ: 'staff', sid: empSid, role: 'employee' },
      '12h'
    );

    // Create a registered user
    const userRes = await query(
      `INSERT INTO users (name, username, email, mobile, upi_id, ff_id, ff_name, date_of_birth)
       VALUES ('Sujoy Mondal', 'sujoy2003', 'sujoy@test.com', '9876543210', 'sujoy@upi', '12345678', 'SujoyFF', '2000-01-01')
       RETURNING id`
    );
    testUserId = userRes.rows[0].id.toString();
  });

  it('rejects unauthenticated requests to /staff/transactions', async () => {
    const res = await request(app).get('/api/v1/staff/transactions');
    expect(res.status).toBe(401);
  });

  it('allows both Employees and Admins to list transactions', async () => {
    // Insert a deposit ledger row
    await query(
      `INSERT INTO wallet_ledger (user_id, wallet, type, amount, balance_after, total_after, ref_type, ref_id)
       VALUES ($1, 'add_money', 'add_money', 100.00, 100.00, 100.00, 'deposit', 'BW-DPT-1')`,
      [testUserId]
    );

    // Check with Employee token
    const empRes = await request(app)
      .get('/api/v1/staff/transactions')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(empRes.status).toBe(200);
    expect(empRes.body.data.items).toHaveLength(1);
    expect(empRes.body.data.items[0].transactionId).toMatch(/^BW-TRX-\d+$/);
    expect(empRes.body.data.items[0].userId).toBe(testUserId);
    expect(empRes.body.data.items[0].userName).toBe('Sujoy Mondal');
    expect(empRes.body.data.items[0].userEmail).toBe('sujoy@test.com');
    expect(empRes.body.data.items[0].amount).toBe('+100.00');

    // Check with Admin token
    const adminRes = await request(app)
      .get('/api/v1/staff/transactions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.items).toHaveLength(1);
  });

  it('filters transactions by search query (q), wallet, and type', async () => {
    // Insert multiple transactions
    await query(
      `INSERT INTO wallet_ledger (user_id, wallet, type, amount, balance_after, total_after, ref_type, ref_id)
       VALUES ($1, 'add_money', 'add_money', 500.00, 500.00, 500.00, 'deposit', 'BW-DPT-10')`,
      [testUserId]
    );
    await query(
      `INSERT INTO wallet_ledger (user_id, wallet, type, amount, balance_after, total_after, ref_type, ref_id)
       VALUES ($1, 'winning', 'winning', 250.00, 250.00, 750.00, 'match', 'BW-MCH-99')`,
      [testUserId]
    );
    await query(
      `INSERT INTO wallet_ledger (user_id, wallet, type, amount, balance_after, total_after, ref_type, ref_id)
       VALUES ($1, 'winning', 'withdrawal_hold', -100.00, 150.00, 650.00, 'withdrawal', 'BW-WDL-5')`,
      [testUserId]
    );

    // Search by UTR/ref_id
    const searchRes = await request(app)
      .get('/api/v1/staff/transactions?q=BW-MCH-99')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.items).toHaveLength(1);
    expect(searchRes.body.data.items[0].type).toBe('winning');

    // Search by "BW-TRX" matches all transactions
    const bwTrxRes = await request(app)
      .get('/api/v1/staff/transactions?q=BW-TRX')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(bwTrxRes.status).toBe(200);
    expect(bwTrxRes.body.data.items).toHaveLength(3);

    // Search by "TRX" matches all transactions
    const trxRes = await request(app)
      .get('/api/v1/staff/transactions?q=TRX')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(trxRes.status).toBe(200);
    expect(trxRes.body.data.items).toHaveLength(3);

    // Search by "BW - TRX" with spaces matches all transactions
    const spacedTrxRes = await request(app)
      .get('/api/v1/staff/transactions?q=BW%20-%20TRX')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(spacedTrxRes.status).toBe(200);
    expect(spacedTrxRes.body.data.items).toHaveLength(3);

    // Filter by wallet = winning
    const winningRes = await request(app)
      .get('/api/v1/staff/transactions?wallet=winning')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(winningRes.status).toBe(200);
    expect(winningRes.body.data.items).toHaveLength(2);

    // Filter by type = withdrawal
    const withdrawalRes = await request(app)
      .get('/api/v1/staff/transactions?type=withdrawal')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(withdrawalRes.status).toBe(200);
    expect(withdrawalRes.body.data.items).toHaveLength(1);
    expect(withdrawalRes.body.data.items[0].type).toBe('withdrawal_hold');
  });

  it('retrieves detailed transaction information via /staff/transactions/:id', async () => {
    // Insert a deposit request and corresponding ledger entry
    const depRes = await query(
      `INSERT INTO deposit_requests (user_id, amount, utr, screenshot_url, status, reviewed_by)
       VALUES ($1, 150.00, 'UTR1234567890', 'mock_screenshot.png', 'approved', $2)
       RETURNING id`,
      [testUserId, adminId]
    );
    const depId = depRes.rows[0].id.toString();

    const ledgerRes = await query(
      `INSERT INTO wallet_ledger (user_id, wallet, type, amount, balance_after, total_after, ref_type, ref_id)
       VALUES ($1, 'add_money', 'add_money', 150.00, 150.00, 150.00, 'deposit', $2)
       RETURNING id`,
      [testUserId, depId]
    );
    const txnId = ledgerRes.rows[0].id.toString();

    // Query by BW-TRX-... format
    const res = await request(app)
      .get(`/api/v1/staff/transactions/${txnId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    const detail = res.body.data;
    expect(detail.transactionId).toBe(txnId);
    expect(detail.userId).toBe(testUserId);
    expect(detail.userName).toBe('Sujoy Mondal');
    expect(detail.userEmail).toBe('sujoy@test.com');
    expect(detail.userMobile).toBe('9876543210');
    expect(detail.userFfId).toBe('12345678');
    expect(detail.amount).toBe('+150.00');
    expect(detail.wallet).toBe('add_money');
    expect(detail.walletName).toBe('Deposited');
    expect(detail.status).toBe('successful');
    expect(detail.deposit).toBeDefined();
    expect(detail.deposit.utr).toBe('UTR1234567890');
    expect(detail.deposit.status).toBe('approved');
  });

  it('returns 404 for nonexistent transaction ID', async () => {
    const res = await request(app)
      .get('/api/v1/staff/transactions/BW-TRX-999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('strictly filters transactions by user ID without returning other users records', async () => {
    // Insert transaction for testUserId
    await query(
      `INSERT INTO wallet_ledger (user_id, wallet, type, amount, balance_after, total_after, ref_type, ref_id)
       VALUES ($1, 'winning', 'refund', 20.00, 20.00, 20.00, 'match', 'BW-MCH-17')`,
      [testUserId]
    );

    // Create another user
    const otherUserRes = await query(
      `INSERT INTO users (username, email, name, mobile, ff_id, ff_name, upi_id, date_of_birth)
       VALUES ('otheruser', 'other@test.com', 'Other User', '9876543299', '87654321', 'OtherFF', 'other@upi', '2000-01-01')
       RETURNING id`
    );
    const otherUserId = formatUserId(otherUserRes.rows[0].id.toString());
    const formattedTestUserId = formatUserId(testUserId);

    // Insert transaction for other user with ref_id matching adminId (1)
    await query(
      `INSERT INTO wallet_ledger (user_id, wallet, type, amount, balance_after, total_after, ref_type, ref_id)
       VALUES ($1, 'winning', 'admin_adjustment', 100.00, 100.00, 100.00, NULL, $2)`,
      [otherUserRes.rows[0].id.toString(), adminId]
    );

    // Search specifically for formattedTestUserId (e.g. BW-USR-1)
    const res = await request(app)
      .get(`/api/v1/staff/transactions?q=${formattedTestUserId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    // Crucial check: none of the returned transactions belong to other user
    for (const item of res.body.data.items) {
      expect(item.userId).toBe(formattedTestUserId);
      expect(item.userId).not.toBe(otherUserId);
    }

    // Now search specifically for other user
    const otherRes = await request(app)
      .get(`/api/v1/staff/transactions?q=${otherUserId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(otherRes.status).toBe(200);
    expect(otherRes.body.data.items).toHaveLength(1);
    expect(otherRes.body.data.items[0].userId).toBe(otherUserId);
  });

  it('formats admin adjustment ref_id as BW-STF-<id> and allows filtering by BW-STF-<id>', async () => {
    // Insert admin adjustment transaction
    await query(
      `INSERT INTO wallet_ledger (user_id, wallet, type, amount, balance_after, total_after, ref_type, ref_id)
       VALUES ($1, 'winning', 'admin_adjustment', 50.00, 50.00, 50.00, 'admin_adjustment', $2)`,
      [testUserId, adminId]
    );

    const res = await request(app)
      .get('/api/v1/staff/transactions?type=admin_adjustment')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].refId).toMatch(/^BW-STF-\d+$/);

    // Search by staff ID
    const searchRes = await request(app)
      .get(`/api/v1/staff/transactions?q=${res.body.data.items[0].refId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.items).toHaveLength(1);
    expect(searchRes.body.data.items[0].refId).toBe(res.body.data.items[0].refId);
  });

  it('supports listing and fetching dedicated detail for joining_reward transactions', async () => {
    // Insert a joining_reward ledger row
    const insertRes = await query(
      `INSERT INTO wallet_ledger (user_id, wallet, type, amount, balance_after, total_after, ref_type, ref_id)
       VALUES ($1, 'cashback', 'joining_reward', 10.00, 10.00, 10.00, 'joining_reward', $1)
       RETURNING id`,
      [testUserId]
    );
    const ledgerTrxId = insertRes.rows[0].id;

    // 1. List transactions filtering by type=joining_reward
    const listRes = await request(app)
      .get('/api/v1/staff/transactions?type=joining_reward')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items).toHaveLength(1);
    expect(listRes.body.data.items[0].type).toBe('joining_reward');
    expect(listRes.body.data.items[0].wallet).toBe('cashback');
    expect(listRes.body.data.items[0].walletName).toBe('Cashback');
    expect(listRes.body.data.items[0].amount).toBe('+10.00');

    // 2. Fetch dedicated detail
    const detailRes = await request(app)
      .get(`/api/v1/staff/transactions/${ledgerTrxId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.type).toBe('joining_reward');
    expect(detailRes.body.data.walletName).toBe('Cashback');
    expect(detailRes.body.data.status).toBe('successful');
    expect(detailRes.body.data.breakdown.cashback).toBe('10.00');
  });
});
