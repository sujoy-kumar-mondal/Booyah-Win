import crypto from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { truncateAllTables } from './setup.js';
import { query, withTransaction } from '../src/db/index.js';
import { signSessionToken } from '../src/utils/crypto.js';
import { creditWallet } from '../src/modules/wallet/wallet.service.js';

let _ctr = 0;
const next = () => ++_ctr;

const validPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function createUser() {
  const i = next();
  const mobile = '9' + String(i).padStart(9, '0');
  const res = await query(
    `INSERT INTO users (username, email, name, mobile, ff_id, ff_name, upi_id, date_of_birth)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '1990-01-01')
     RETURNING id, username, email, upi_id`,
    [`seq_user_${i}`, `seq_user${i}@test.com`, `User ${i}`, mobile, `FF${String(i).padStart(8, '0')}`, `FFN${i}`, `upi${i}@test`]
  );
  const row = res.rows[0];
  await query('INSERT INTO wallets (user_id) VALUES ($1)', [row.id]);
  return { id: row.id.toString(), email: row.email, upiId: row.upi_id };
}

async function createAuthToken(userId: string) {
  const sid = crypto.randomUUID();
  await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'user', $2)`, [sid, userId]);
  return signSessionToken({ sub: userId, typ: 'user', sid }, '1h');
}

async function createStaffUser(role: 'admin' | 'employee' = 'admin') {
  const i = next();
  const mobile = '8' + String(i).padStart(9, '0');
  const res = await query(
    `INSERT INTO staff (role, name, mobile, email) VALUES ($1, $2, $3, $4)
     RETURNING id, email, role`,
    [role, `Staff ${i}`, mobile, `staff${i}@test.com`]
  );
  return { id: res.rows[0].id.toString(), email: res.rows[0].email, role: res.rows[0].role };
}

async function createStaffToken(staff: { id: string; role: string }) {
  const sid = crypto.randomUUID();
  await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`, [sid, staff.id]);
  return signSessionToken({ sub: staff.id, typ: 'staff', sid, role: staff.role }, '1h');
}

describe('Unified Transaction Sequence and Collision Prevention', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  it('allocates globally unique sequential BW-TRX IDs across deposits, withdrawals, and ledger', async () => {
    const app = createApp({ enableRateLimiting: false });
    const user1 = await createUser();
    const user2 = await createUser();
    const admin = await createStaffUser('admin');

    const user1Token = await createAuthToken(user1.id);
    const user2Token = await createAuthToken(user2.id);
    const adminToken = await createStaffToken(admin);

    // Initial wallet balance for user2 so they can withdraw
    await withTransaction(async (client) => {
      await creditWallet(client, user2.id, 'winning', 50000, 'winning', null, null);
    });

    // Check user2's credit ledger ID
    const initialLedger = await query('SELECT id FROM wallet_ledger ORDER BY created_at DESC LIMIT 1');
    expect(initialLedger.rows[0].id).toBe('BW-TRX-1');

    // 1. User 1 submits a deposit request
    const depRes = await request(app)
      .post('/api/v1/wallet/deposits')
      .set('Authorization', `Bearer ${user1Token}`)
      .field('amount', '100.00')
      .field('utr', '123456789012')
      .attach('screenshot', validPngBuffer, 'deposit.png');
    expect(depRes.status).toBe(201);
    const depositId = depRes.body.data.id;
    // Must be sequential after initial ledger transaction: BW-TRX-2
    expect(depositId).toBe('BW-TRX-2');

    // 2. User 2 requests a withdrawal
    const wrRes = await request(app)
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        amount: '200.00',
        upiId: user2.upiId,
        confirm: true,
      });
    expect(wrRes.status).toBe(201);
    const withdrawalId = wrRes.body.data.id;
    // Must be next in sequence: BW-TRX-3
    expect(withdrawalId).toBe('BW-TRX-3');

    // Verify withdrawal hold in ledger has the exact same transaction ID BW-TRX-3
    const wthLedger = await query('SELECT id, ref_id FROM wallet_ledger WHERE type = $1', ['withdrawal_hold']);
    expect(wthLedger.rows[0].id).toBe('BW-TRX-3');
    expect(wthLedger.rows[0].ref_id).toBe('BW-TRX-3');

    // 3. Admin approves User 1's deposit BW-TRX-2
    const approveRes = await request(app)
      .post(`/api/v1/staff/deposits/${depositId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(approveRes.status).toBe(200);

    // Verify approved deposit ledger row uses the deposit's transaction ID BW-TRX-2
    const depLedger = await query('SELECT id, ref_id FROM wallet_ledger WHERE ref_type = $1 AND ref_id = $2', ['deposit', depositId]);
    expect(depLedger.rows[0].id).toBe('BW-TRX-2');
    expect(depLedger.rows[0].ref_id).toBe('BW-TRX-2');

    // 4. User 1 submits a second deposit request
    const dep2Res = await request(app)
      .post('/api/v1/wallet/deposits')
      .set('Authorization', `Bearer ${user1Token}`)
      .field('amount', '50.00')
      .field('utr', '987654321098')
      .attach('screenshot', validPngBuffer, 'deposit2.png');
    expect(dep2Res.status).toBe(201);
    const deposit2Id = dep2Res.body.data.id;
    // Must be sequential: BW-TRX-4
    expect(deposit2Id).toBe('BW-TRX-4');

    // Verify all transactions in ledger and requests are distinct and no collisions exist
    const allDeposits = await query('SELECT id FROM deposit_requests');
    const allWithdrawals = await query('SELECT id FROM withdrawal_requests');
    const allLedger = await query('SELECT id FROM wallet_ledger');

    const depositIds = allDeposits.rows.map((r: any) => r.id);
    const withdrawalIds = allWithdrawals.rows.map((r: any) => r.id);
    const ledgerIds = allLedger.rows.map((r: any) => r.id);

    // No overlap between distinct requests
    const overlapDepositWithdrawal = depositIds.filter((id: string) => withdrawalIds.includes(id));
    expect(overlapDepositWithdrawal).toEqual([]);

    // Deposit queue item matches ledger item
    expect(ledgerIds).toContain(depositId);
    // Withdrawal queue item matches ledger item
    expect(ledgerIds).toContain(withdrawalId);
  });

  it('handles rejected deposits and refunded withdrawals with monotonic non-colliding IDs', async () => {
    const app = createApp({ enableRateLimiting: false });
    const user = await createUser();
    const admin = await createStaffUser('admin');

    const userToken = await createAuthToken(user.id);
    const adminToken = await createStaffToken(admin);

    // 1. Submit deposit that gets rejected
    const depRes = await request(app)
      .post('/api/v1/wallet/deposits')
      .set('Authorization', `Bearer ${userToken}`)
      .field('amount', '100.00')
      .field('utr', '111122223333')
      .attach('screenshot', validPngBuffer, 'deposit.png');
    expect(depRes.status).toBe(201);
    const depId = depRes.body.data.id;
    expect(depId).toBe('BW-TRX-1');

    // Admin rejects deposit
    const rejectDepRes = await request(app)
      .post(`/api/v1/staff/deposits/${depId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Invalid screenshot proof provided' });
    expect(rejectDepRes.status).toBe(200);

    // Can fetch rejected deposit details via staff transaction API
    const txDepRes = await request(app)
      .get(`/api/v1/staff/transactions/${depId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(txDepRes.status).toBe(200);
    expect(txDepRes.body.data.status).toBe('rejected');
    expect(txDepRes.body.data.transactionId).toBe(depId);

    // 2. Add money to user winning wallet
    await withTransaction(async (client) => {
      await creditWallet(client, user.id, 'winning', 50000, 'winning', null, null);
    });
    // This credit should take BW-TRX-2
    const creditLedger = await query('SELECT id FROM wallet_ledger WHERE type = $1', ['winning']);
    expect(creditLedger.rows[0].id).toBe('BW-TRX-2');

    // 3. User requests withdrawal -> gets BW-TRX-3
    const wrRes = await request(app)
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: '100.00',
        upiId: user.upiId,
        confirm: true,
      });
    expect(wrRes.status).toBe(201);
    const wrId = wrRes.body.data.id;
    expect(wrId).toBe('BW-TRX-3');

    // 4. Admin rejects withdrawal -> refund takes BW-TRX-4
    const rejectWrRes = await request(app)
      .post(`/api/v1/staff/withdrawals/${wrId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Incorrect account name on UPI' });
    expect(rejectWrRes.status).toBe(200);

    const refundLedger = await query('SELECT id, ref_id FROM wallet_ledger WHERE type = $1', ['withdrawal_refund']);
    expect(refundLedger.rows[0].id).toBe('BW-TRX-4');
    expect(refundLedger.rows[0].ref_id).toBe('BW-TRX-3');
  });

  it('displays pending deposits and pending/rejected withdrawals in user transaction history', async () => {
    const app = createApp({ enableRateLimiting: false });
    const user = await createUser();
    const admin = await createStaffUser('admin');

    const userToken = await createAuthToken(user.id);
    const adminToken = await createStaffToken(admin);

    // 1. Submit pending deposit
    const depRes = await request(app)
      .post('/api/v1/wallet/deposits')
      .set('Authorization', `Bearer ${userToken}`)
      .field('amount', '25.00')
      .field('utr', '123456789012')
      .attach('screenshot', validPngBuffer, 'deposit.png');
    expect(depRes.status).toBe(201);
    const depTxId = depRes.body.data.id;

    // Check user history: all transactions
    const historyRes = await request(app)
      .get('/api/v1/wallet/transactions')
      .set('Authorization', `Bearer ${userToken}`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.items).toHaveLength(1);
    expect(historyRes.body.data.items[0]).toMatchObject({
      transactionId: depTxId,
      type: 'add_money',
      status: 'pending',
      statusReason: 'Verification in progress',
      amount: '25.00',
    });

    // Check user history with type=add_money filter (Deposited tab)
    const depositHistoryRes = await request(app)
      .get('/api/v1/wallet/transactions?type=add_money')
      .set('Authorization', `Bearer ${userToken}`);
    expect(depositHistoryRes.status).toBe(200);
    expect(depositHistoryRes.body.data.items).toHaveLength(1);
    expect(depositHistoryRes.body.data.items[0].transactionId).toBe(depTxId);
    expect(depositHistoryRes.body.data.items[0].status).toBe('pending');

    // 2. Admin approves deposit
    await request(app)
      .post(`/api/v1/staff/deposits/${depTxId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    // Now approved deposit shows as 'successful' in history
    const approvedHistoryRes = await request(app)
      .get('/api/v1/wallet/transactions?type=add_money')
      .set('Authorization', `Bearer ${userToken}`);
    expect(approvedHistoryRes.body.data.items[0].status).toBe('successful');

    // 3. User has balance, credit winning so they can withdraw
    await withTransaction(async (client) => {
      await creditWallet(client, user.id, 'winning', 10000, 'winning', null, null);
    });

    // User submits withdrawal request
    const wrRes = await request(app)
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: '50.00',
        upiId: user.upiId,
        confirm: true,
      });
    expect(wrRes.status).toBe(201);
    const wrTxId = wrRes.body.data.id;

    // Check user history with type=withdrawal filter (Withdrawal tab)
    const wrHistoryRes = await request(app)
      .get('/api/v1/wallet/transactions?type=withdrawal')
      .set('Authorization', `Bearer ${userToken}`);
    expect(wrHistoryRes.status).toBe(200);
    const wrItem = wrHistoryRes.body.data.items.find((it: any) => it.transactionId === wrTxId);
    expect(wrItem).toBeDefined();
    expect(wrItem.status).toBe('pending');
    expect(wrItem.statusReason).toBe('Verification in progress');

    // Admin rejects withdrawal
    await request(app)
      .post(`/api/v1/staff/withdrawals/${wrTxId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'UPI ID invalid' });

    // History now shows rejected status
    const wrRejectedHistory = await request(app)
      .get('/api/v1/wallet/transactions?type=withdrawal')
      .set('Authorization', `Bearer ${userToken}`);
    const wrRejectedItem = wrRejectedHistory.body.data.items.find((it: any) => it.transactionId === wrTxId);
    expect(wrRejectedItem.status).toBe('rejected');
    expect(wrRejectedItem.statusReason).toBe('UPI ID invalid');
  });

  it('filters user transaction history by fromDate and toDate', async () => {
    const app = createApp({ enableRateLimiting: false });
    const user = await createUser();
    const userToken = await createAuthToken(user.id);

    // Insert 3 transactions with different dates
    await withTransaction(async (client) => {
      // 1. Transaction on 2026-10-20
      await creditWallet(client, user.id, 'add_money', 1000, 'add_money', null, null);
      await client.query(
        `UPDATE wallet_ledger SET created_at = '2026-10-20T10:00:00.000Z' WHERE user_id = $1 AND amount = 10.00`,
        [user.id]
      );

      // 2. Transaction on 2026-10-25
      await creditWallet(client, user.id, 'add_money', 2000, 'add_money', null, null);
      await client.query(
        `UPDATE wallet_ledger SET created_at = '2026-10-25T10:00:00.000Z' WHERE user_id = $1 AND amount = 20.00`,
        [user.id]
      );

      // 3. Transaction on 2026-10-31
      await creditWallet(client, user.id, 'add_money', 3000, 'add_money', null, null);
      await client.query(
        `UPDATE wallet_ledger SET created_at = '2026-10-31T10:00:00.000Z' WHERE user_id = $1 AND amount = 30.00`,
        [user.id]
      );
    });

    // 1. Unfiltered: returns all 3
    const allRes = await request(app)
      .get('/api/v1/wallet/transactions')
      .set('Authorization', `Bearer ${userToken}`);
    expect(allRes.status).toBe(200);
    expect(allRes.body.data.items).toHaveLength(3);

    // 2. Filter fromDate = 2026-10-25: returns 2026-10-25 and 2026-10-31 (2 items)
    const fromRes = await request(app)
      .get('/api/v1/wallet/transactions?fromDate=2026-10-25')
      .set('Authorization', `Bearer ${userToken}`);
    expect(fromRes.status).toBe(200);
    expect(fromRes.body.data.items).toHaveLength(2);
    expect(fromRes.body.data.items.map((it: any) => it.amount)).toEqual(['30.00', '20.00']);

    // 3. Filter toDate = 2026-10-24: returns only 2026-10-20 (1 item)
    const toRes = await request(app)
      .get('/api/v1/wallet/transactions?toDate=2026-10-24')
      .set('Authorization', `Bearer ${userToken}`);
    expect(toRes.status).toBe(200);
    expect(toRes.body.data.items).toHaveLength(1);
    expect(toRes.body.data.items[0].amount).toBe('10.00');

    // 4. Filter range: 2026-10-22 to 2026-10-28: returns only 2026-10-25 (1 item)
    const rangeRes = await request(app)
      .get('/api/v1/wallet/transactions?fromDate=2026-10-22&toDate=2026-10-28')
      .set('Authorization', `Bearer ${userToken}`);
    expect(rangeRes.status).toBe(200);
    expect(rangeRes.body.data.items).toHaveLength(1);
    expect(rangeRes.body.data.items[0].amount).toBe('20.00');

    // 5. Filter range with no matches: 2026-10-01 to 2026-10-05
    const emptyRes = await request(app)
      .get('/api/v1/wallet/transactions?fromDate=2026-10-01&toDate=2026-10-05')
      .set('Authorization', `Bearer ${userToken}`);
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.data.items).toHaveLength(0);
  });

  it('displays pending deposits and pending/rejected withdrawals in user transaction history', async () => {
    const app = createApp({ enableRateLimiting: false });
    const user = await createUser();
    const admin = await createStaffUser('admin');

    const userToken = await createAuthToken(user.id);
    const adminToken = await createStaffToken(admin);

    // 1. Submit pending deposit
    const depRes = await request(app)
      .post('/api/v1/wallet/deposits')
      .set('Authorization', `Bearer ${userToken}`)
      .field('amount', '25.00')
      .field('utr', '123456789012')
      .attach('screenshot', validPngBuffer, 'deposit.png');
    expect(depRes.status).toBe(201);
    const depTxId = depRes.body.data.id;

    // Check user history: all transactions
    const historyRes = await request(app)
      .get('/api/v1/wallet/transactions')
      .set('Authorization', `Bearer ${userToken}`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.items).toHaveLength(1);
    expect(historyRes.body.data.items[0]).toMatchObject({
      transactionId: depTxId,
      type: 'add_money',
      status: 'pending',
      statusReason: 'Verification in progress',
      amount: '25.00',
    });

    // Check user history with type=add_money filter (Deposited tab)
    const depositHistoryRes = await request(app)
      .get('/api/v1/wallet/transactions?type=add_money')
      .set('Authorization', `Bearer ${userToken}`);
    expect(depositHistoryRes.status).toBe(200);
    expect(depositHistoryRes.body.data.items).toHaveLength(1);
    expect(depositHistoryRes.body.data.items[0].transactionId).toBe(depTxId);
    expect(depositHistoryRes.body.data.items[0].status).toBe('pending');

    // 2. Admin approves deposit
    await request(app)
      .post(`/api/v1/staff/deposits/${depTxId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    // Now approved deposit shows as 'successful' in history
    const approvedHistoryRes = await request(app)
      .get('/api/v1/wallet/transactions?type=add_money')
      .set('Authorization', `Bearer ${userToken}`);
    expect(approvedHistoryRes.body.data.items[0].status).toBe('successful');

    // 3. User has balance, credit winning so they can withdraw
    await withTransaction(async (client) => {
      await creditWallet(client, user.id, 'winning', 10000, 'winning', null, null);
    });

    // User submits withdrawal request
    const wrRes = await request(app)
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: '50.00',
        upiId: user.upiId,
        confirm: true,
      });
    expect(wrRes.status).toBe(201);
    const wrTxId = wrRes.body.data.id;

    // Check user history with type=withdrawal filter (Withdrawal tab)
    const wrHistoryRes = await request(app)
      .get('/api/v1/wallet/transactions?type=withdrawal')
      .set('Authorization', `Bearer ${userToken}`);
    expect(wrHistoryRes.status).toBe(200);
    const wrItem = wrHistoryRes.body.data.items.find((it: any) => it.transactionId === wrTxId);
    expect(wrItem).toBeDefined();
    expect(wrItem.status).toBe('pending');
    expect(wrItem.statusReason).toBe('Verification in progress');

    // Admin rejects withdrawal
    await request(app)
      .post(`/api/v1/staff/withdrawals/${wrTxId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'UPI ID invalid' });

    // History now shows rejected status
    const wrRejectedHistory = await request(app)
      .get('/api/v1/wallet/transactions?type=withdrawal')
      .set('Authorization', `Bearer ${userToken}`);
    const wrRejectedItem = wrRejectedHistory.body.data.items.find((it: any) => it.transactionId === wrTxId);
    expect(wrRejectedItem.status).toBe('rejected');
    expect(wrRejectedItem.statusReason).toBe('UPI ID invalid');
  });

  it('returns adjustment reason in user transaction detail for balance adjustment', async () => {
    const app = createApp({ enableRateLimiting: false });
    const user = await createUser();
    const admin = await createStaffUser('admin');

    const userToken = await createAuthToken(user.id);
    const adminToken = await createStaffToken(admin);
    await query("UPDATE sessions SET elevated_until = NOW() + INTERVAL '1 hour' WHERE account_id = $1", [admin.id]);

    // Admin adjusts user's winning wallet by +Rs50 with a reason
    const adjRes = await request(app)
      .post(`/api/v1/admin/users/${user.id}/adjust`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        wallet: 'winning',
        amount: '50.00',
        reason: 'Compensation for tournament glitch',
      });
    expect(adjRes.status).toBe(200);

    // Fetch user's transactions to find the transaction ID
    const txRes = await request(app)
      .get('/api/v1/wallet/transactions')
      .set('Authorization', `Bearer ${userToken}`);
    expect(txRes.status).toBe(200);
    const adjTx = txRes.body.data.items.find((it: any) => it.type === 'admin_adjustment');
    expect(adjTx).toBeDefined();

    // Fetch transaction detail
    const detailRes = await request(app)
      .get(`/api/v1/wallet/transactions/${adjTx.transactionId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.type).toBe('admin_adjustment');
    expect(detailRes.body.data.adjustment).toBeDefined();
    expect(detailRes.body.data.adjustment.reason).toBe('Compensation for tournament glitch');
  });
});
