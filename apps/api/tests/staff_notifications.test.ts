import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';
import { SettingsService } from '../src/modules/admin/settings/settings.service.js';
import { TierService } from '../src/modules/admin/tiers/tier.service.js';
import { submitDeposit } from '../src/modules/wallet/deposit.service.js';
import { requestWithdrawal } from '../src/modules/wallet/withdrawal.service.js';
import { verifyDeposit } from '../src/modules/wallet/deposit.staff.service.js';
import { verifyWithdrawal } from '../src/modules/wallet/withdrawal.staff.service.js';
import { createMatchStaff, openRoomStaff, goLiveStaff, cancelMatchStaff } from '../src/modules/matches/matches.staff.service.js';
import { submitResultStaff, approveResultAdmin } from '../src/modules/matches/results.service.js';
import { runSchedulerTick } from '../src/modules/matches/scheduler.service.js';
import { notifyStaff } from '../src/modules/staff/notifications.service.js';

const VALID_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d470000000049454e44ae426082',
  'hex'
);

describe('Staff Web Notifications API & Role-based Routing', () => {
  const app = createApp({ enableRateLimiting: false });
  let adminToken: string;
  let adminId: string;
  let employeeToken: string;
  let employeeId: string;
  let testUserId: string;
  let tierId: string;

  beforeEach(async () => {
    await truncateAllTables();
    await SettingsService.seedDefaults();
    vi.restoreAllMocks();

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

    // Create a registered user and wallet with funds
    const userRes = await query(
      `INSERT INTO users (name, username, email, mobile, upi_id, ff_id, ff_name, date_of_birth)
       VALUES ('Sujoy Mondal', 'sujoy2003', 'sujoy@test.com', '9876543210', 'sujoy@upi', '12345678', 'SujoyFF', '2000-01-01')
       RETURNING id`
    );
    testUserId = userRes.rows[0].id.toString();
    await query(
      `INSERT INTO wallets (user_id, add_money, cashback, winning)
       VALUES ($1, 500, 0, 500)`,
      [testUserId]
    );

    // Seed an entry tier
    const { tier } = await TierService.createTier(adminId, {
      gameMode: 'battle_royale',
      teamMode: 'solo',
      entryFee: '50.00',
      killPrice: '20.00',
      minKillsForReward: 0,
      positions: [{ position: 1, prize: '150.00' }],
    });
    tierId = tier.id;
  });

  it('GET /api/v1/staff/notifications/push-key returns VAPID public key', async () => {
    const res = await request(app)
      .get('/api/v1/staff/notifications/push-key')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(res.body.publicKey).toBeDefined();
    expect(typeof res.body.publicKey).toBe('string');
  });

  it('POST /api/v1/staff/notifications/push-subscribe saves push subscription for staff', async () => {
    const sub = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-staff-token',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs6by0vU1guePG6VE18xLv1gX',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
    };

    await request(app)
      .post('/api/v1/staff/notifications/push-subscribe')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ subscription: sub })
      .expect(201);

    const check = await query(`SELECT * FROM push_subscriptions WHERE staff_id = $1`, [employeeId]);
    expect(check.rows.length).toBe(1);
    expect(check.rows[0].endpoint).toBe(sub.endpoint);
  });

  it('notifies both Admin and Employee when a user submits deposit', async () => {
    await submitDeposit(
      testUserId,
      '100.00',
      '123456789012',
      VALID_PNG_BUFFER
    );

    // Check Employee notifications
    const empRes = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(empRes.body.data.unreadCount).toBeGreaterThanOrEqual(1);
    const empDepositNotif = empRes.body.data.items.find(
      (n: any) => n.type === 'deposit_submitted'
    );
    expect(empDepositNotif).toBeDefined();
    expect(empDepositNotif.title).toContain('Deposit');

    // Check Admin notifications
    const adminRes = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(adminRes.body.data.unreadCount).toBeGreaterThanOrEqual(1);
    const adminDepositNotif = adminRes.body.data.items.find(
      (n: any) => n.type === 'deposit_submitted'
    );
    expect(adminDepositNotif).toBeDefined();
  });

  it('notifies both Admin and Employee when a user submits withdrawal', async () => {
    await requestWithdrawal(
      testUserId,
      'sujoy@upi',
      null,
      '100.00',
      'sujoy@upi',
      true
    );

    // Check Employee notifications
    const empRes = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const empWNotif = empRes.body.data.items.find(
      (n: any) => n.type === 'withdrawal_submitted'
    );
    expect(empWNotif).toBeDefined();
    expect(empWNotif.title).toContain('Withdrawal');

    // Check Admin notifications
    const adminRes = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const adminWNotif = adminRes.body.data.items.find(
      (n: any) => n.type === 'withdrawal_submitted'
    );
    expect(adminWNotif).toBeDefined();
  });

  it('only notifies Admin when a match is created, room opened, live, and canceled', async () => {
    // 1. Create match
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const createdMatch = await createMatchStaff(adminId, {
      tierId,
      startTime,
      mapName: 'Bermuda',
    });
    const matchId = createdMatch.id;

    // Admin should see match_status_created
    const adminAfterCreate = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const createdNotif = adminAfterCreate.body.data.items.find(
      (n: any) => n.type === 'match_status_created'
    );
    expect(createdNotif).toBeDefined();

    // Employee should NOT see match_status_created
    const empAfterCreate = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const empCreatedNotif = empAfterCreate.body.data.items.find(
      (n: any) => n.type === 'match_status_created'
    );
    expect(empCreatedNotif).toBeUndefined();

    // 2. Open room
    await openRoomStaff(employeeId, matchId, 'ROOM999', 'pass123');

    const adminAfterOpen = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const roomNotif = adminAfterOpen.body.data.items.find(
      (n: any) => n.type === 'match_status_open_room'
    );
    expect(roomNotif).toBeDefined();

    const empAfterOpen = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    expect(empAfterOpen.body.data.items.find((n: any) => n.type === 'match_status_open_room')).toBeUndefined();

    // 3. Cancel match
    await cancelMatchStaff(employeeId, 'employee', matchId, 'Technical difficulty');

    const adminAfterCancel = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const cancelNotif = adminAfterCancel.body.data.items.find(
      (n: any) => n.type === 'match_status_canceled'
    );
    expect(cancelNotif).toBeDefined();

    const empAfterCancel = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    expect(empAfterCancel.body.data.items.find((n: any) => n.type === 'match_status_canceled')).toBeUndefined();
  });

  it('marks single notification as read and marks all as read', async () => {
    await submitDeposit(
      testUserId,
      '50.00',
      '999999999999',
      VALID_PNG_BUFFER
    );

    const listRes = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const notifId = listRes.body.data.items[0].id;
    expect(listRes.body.data.unreadCount).toBeGreaterThanOrEqual(1);

    // Mark single as read
    await request(app)
      .patch(`/api/v1/staff/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    // Verify unread count decreased
    const afterSingle = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const item = afterSingle.body.data.items.find((n: any) => n.id === notifId);
    expect(item.isRead).toBe(true);

    // Mark all as read
    await request(app)
      .post('/api/v1/staff/notifications/mark-all-read')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const afterAll = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(afterAll.body.data.unreadCount).toBe(0);
  });

  it('notifies only Admin when result approval is required', async () => {
    await notifyStaff({
      targetRole: 'admin',
      type: 'result_approval_required',
      title: 'Result Approval Required',
      message: 'Staff submitted results for match #BW-MCH-999. Approval needed.',
      actionUrl: '/results/pending',
      metadata: { matchId: 'BW-MCH-999' },
    });

    const adminRes = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const notif = adminRes.body.data.items.find(
      (n: any) => n.type === 'result_approval_required'
    );
    expect(notif).toBeDefined();

    const empRes = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const empNotif = empRes.body.data.items.find(
      (n: any) => n.type === 'result_approval_required'
    );
    expect(empNotif).toBeUndefined();
  });

  it('notifies Admin when scheduler auto-cancels an unstarted expired match', async () => {
    // Insert an expired match past start_time (past 15-minute cancellation window)
    const pastTime = new Date(Date.now() - 16 * 60 * 1000).toISOString();
    await query(
      `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, position_prizes, max_players, min_players, start_time, status, map_name, created_by)
       VALUES ($1, 'battle_royale', 'solo', 5000, 2000, 0, '{"1": 15000}', 48, 2, $2, 'upcoming', 'Bermuda', $3)`,
      [tierId, pastTime, adminId]
    );

    await runSchedulerTick();

    const adminRes = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const autoCancelNotif = adminRes.body.data.items.find(
      (n: any) => n.type === 'match_status_canceled' && n.title === 'Match Auto-Canceled'
    );
    expect(autoCancelNotif).toBeDefined();
    expect(autoCancelNotif.metadata.auto).toBe(true);

    const empRes = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const empAutoCancel = empRes.body.data.items.find(
      (n: any) => n.type === 'match_status_canceled'
    );
    expect(empAutoCancel).toBeUndefined();
  });

  it('notifies only Admin when an employee verifies a deposit for final approval', async () => {
    const depDto = await submitDeposit(
      testUserId,
      '150.00',
      '987654321098',
      VALID_PNG_BUFFER
    );

    // Employee verifies the deposit
    await verifyDeposit(employeeId, 'employee@booyah.win', 'employee', depDto.id);

    // Admin should receive deposit_verified notification
    const adminRes = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const verifiedNotif = adminRes.body.data.items.find(
      (n: any) => n.type === 'deposit_verified'
    );
    expect(verifiedNotif).toBeDefined();
    expect(verifiedNotif.title).toContain('Deposit Final Approval Required');
    expect(verifiedNotif.message).toContain('150.00');
    expect(verifiedNotif.actionUrl).toBe('/deposits?status=employee_approved');
    expect(verifiedNotif.metadata.depositId).toBe(depDto.id);

    // Employee should NOT receive deposit_verified notification
    const empRes = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const empVerifiedNotif = empRes.body.data.items.find(
      (n: any) => n.type === 'deposit_verified'
    );
    expect(empVerifiedNotif).toBeUndefined();
  });

  it('notifies only Admin when an employee verifies a withdrawal for final approval', async () => {
    const wthDto = await requestWithdrawal(
      testUserId,
      'sujoy@upi',
      null,
      '200.00',
      'sujoy@upi',
      true
    );

    // Employee verifies the withdrawal
    await verifyWithdrawal(employeeId, 'employee@booyah.win', 'employee', wthDto.id);

    // Admin should receive withdrawal_verified notification
    const adminRes = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const verifiedNotif = adminRes.body.data.items.find(
      (n: any) => n.type === 'withdrawal_verified'
    );
    expect(verifiedNotif).toBeDefined();
    expect(verifiedNotif.title).toContain('Withdrawal Final Approval Required');
    expect(verifiedNotif.message).toContain('200.00');
    expect(verifiedNotif.actionUrl).toBe('/withdrawals?status=employee_approved');
    expect(verifiedNotif.metadata.withdrawalId).toBe(wthDto.id);

    // Employee should NOT receive withdrawal_verified notification
    const empRes = await request(app)
      .get('/api/v1/staff/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const empVerifiedNotif = empRes.body.data.items.find(
      (n: any) => n.type === 'withdrawal_verified'
    );
    expect(empVerifiedNotif).toBeUndefined();
  });
});
