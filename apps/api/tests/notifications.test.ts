import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';

const app = createApp({ enableRateLimiting: false });

let counter = 1000;
function next(): number {
  return ++counter;
}

async function createTestUser(): Promise<{ id: string; token: string }> {
  const i = next();
  const mobile = '9' + String(i).padStart(9, '0');
  const res = await query(
    `INSERT INTO users (username, email, name, mobile, ff_id, ff_name, upi_id, date_of_birth)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '1995-01-01')
     RETURNING id`,
    [
      `player_${i}`,
      `player${i}@test.com`,
      `Player ${i}`,
      mobile,
      `FF${String(i).padStart(8, '0')}`,
      `FFName${i}`,
      `player${i}@upi`,
    ]
  );
  const userId = res.rows[0].id.toString();
  await query('INSERT INTO wallets (user_id) VALUES ($1)', [userId]);

  const sid = crypto.randomUUID();
  await query('INSERT INTO sessions (id, account_type, account_id) VALUES ($1, $2, $3)', [
    sid,
    'user',
    userId,
  ]);
  const token = signSessionToken({ sub: userId, typ: 'user', sid }, '1h');
  return { id: userId, token };
}

async function createTestTier(): Promise<string> {
  const res = await query(
    `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
     VALUES ('clash_squad', 'squad', '50.00', '10.00', 1, 8, 2)
     RETURNING id`
  );
  return res.rows[0].id.toString();
}

describe('Player Notifications API (GET /api/v1/me/notifications)', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/me/notifications').expect(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns announcements when no user activity exists', async () => {
    const { token } = await createTestUser();

    // Create an active announcement
    await query(
      `INSERT INTO important_updates (title, category, date_display, heading, summary, sort_order, is_active)
       VALUES ('Tournaments Are Live', 'General', 'Today', 'Big update', 'Join and win prizes', 1, true)`
    );

    const res = await request(app)
      .get('/api/v1/me/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].type).toBe('announcement');
    expect(res.body.data[0].title).toBe('Tournaments Are Live');
    expect(res.body.data[0].actionUrl).toBe('/important-updates');
  });

  it('returns match_joined, room_open and room_live notifications for joined matches', async () => {
    const { id: userId, token } = await createTestUser();
    const tierId = await createTestTier();

    const staffRes = await query(
      `INSERT INTO staff (role, name, email, mobile) VALUES ('admin', 'Admin', 'admin_notif@bw.in', '9123456789') RETURNING id`
    );
    const staffId = staffRes.rows[0].id.toString();

    // Create an upcoming match
    const matchRes = await query(
      `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, position_prizes, min_players, max_players, start_time, status, created_by)
       VALUES ($1, 'clash_squad', 'squad', '50.00', '10.00', 1, '[]'::jsonb, 2, 8, now() + interval '1 hour', 'upcoming', $2)
       RETURNING id`,
      [tierId, staffId]
    );
    const matchId = matchRes.rows[0].id.toString();

    // Player joins match
    await query(
      `INSERT INTO match_players (match_id, user_id, team_id) VALUES ($1, $2, NULL)`,
      [matchId, userId]
    );

    // 1. Initial check: should have match_joined notification
    let res = await request(app)
      .get('/api/v1/me/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const joinedNotif = res.body.data.find((n: any) => n.type === 'match_joined');
    expect(joinedNotif).toBeDefined();
    expect(joinedNotif.title).toContain('Clash Squad [SQUAD]');
    expect(joinedNotif.actionUrl).toBe(`/matches/${matchId}`);

    // 2. Staff opens room credentials
    await query(
      `UPDATE matches SET status = 'room_open', room_id = '882319', room_password = '77' WHERE id = $1`,
      [matchId]
    );

    res = await request(app)
      .get('/api/v1/me/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const roomOpenNotif = res.body.data.find((n: any) => n.type === 'room_open');
    expect(roomOpenNotif).toBeDefined();
    expect(roomOpenNotif.roomId).toBe('882319');
    expect(roomOpenNotif.roomPassword).toBe('77');
    expect(roomOpenNotif.message).toContain('Room ID: 882319 | Password: 77');

    // 3. Match goes live
    await query(`UPDATE matches SET status = 'live' WHERE id = $1`, [matchId]);

    res = await request(app)
      .get('/api/v1/me/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const liveNotif = res.body.data.find((n: any) => n.type === 'room_live');
    expect(liveNotif).toBeDefined();
    expect(liveNotif.message).toContain('match is now in progress');
  });

  it('returns deposit and withdrawal notifications with amount and status', async () => {
    const { id: userId, token } = await createTestUser();

    // Create deposit
    const depRes = await query(
      `INSERT INTO deposit_requests (user_id, amount, status, utr, screenshot_url)
       VALUES ($1, '250.00', 'pending', 'UTR1234567890', 'https://example.com/ss.png')
       RETURNING id`,
      [userId]
    );
    const depId = depRes.rows[0].id.toString();

    // Check deposit submitted notification
    let res = await request(app)
      .get('/api/v1/me/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const depSubmitted = res.body.data.find((n: any) => n.id === `deposit-${depId}-submitted`);
    expect(depSubmitted).toBeDefined();
    expect(depSubmitted.title).toBe('Deposit Submitted: ₹250');
    expect(depSubmitted.actionUrl).toBe(`/wallet/transactions/${depId}`);

    // Approve deposit
    await query(
      `UPDATE deposit_requests SET status = 'approved', reviewed_at = now() WHERE id = $1`,
      [depId]
    );

    res = await request(app)
      .get('/api/v1/me/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const depApproved = res.body.data.find((n: any) => n.id === `deposit-${depId}-approved`);
    expect(depApproved).toBeDefined();
    expect(depApproved.title).toBe('Deposit Approved: ₹250');

    // Create withdrawal
    const wRes = await query(
      `INSERT INTO withdrawal_requests (user_id, amount, status, upi_id)
       VALUES ($1, '100.00', 'pending', 'player@upi')
       RETURNING id`,
      [userId]
    );
    const wId = wRes.rows[0].id.toString();

    // Approve / pay withdrawal
    await query(
      `UPDATE withdrawal_requests SET status = 'paid', processed_at = now() WHERE id = $1`,
      [wId]
    );

    res = await request(app)
      .get('/api/v1/me/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const wPaid = res.body.data.find((n: any) => n.id === `withdrawal-${wId}-paid`);
    expect(wPaid).toBeDefined();
    expect(wPaid.title).toBe('Withdrawal Successful: ₹100');
    expect(wPaid.message).toContain('player@upi');
  });

  it('returns tournament reward notification when match results are completed with payouts', async () => {
    const { id: userId, token } = await createTestUser();
    const tierId = await createTestTier();

    const staffRes = await query(
      `INSERT INTO staff (role, name, email, mobile) VALUES ('admin', 'Admin', 'admin_rew@bw.in', '9123456788') RETURNING id`
    );
    const staffId = staffRes.rows[0].id.toString();

    const matchRes = await query(
      `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, position_prizes, min_players, max_players, start_time, status, created_by)
       VALUES ($1, 'clash_squad', 'squad', '50.00', '10.00', 1, '[]'::jsonb, 2, 8, now() - interval '1 hour', 'completed', $2)
       RETURNING id`,
      [tierId, staffId]
    );
    const matchId = matchRes.rows[0].id.toString();

    // Insert winning match player
    await query(
      `INSERT INTO match_players (match_id, user_id, kills, position, payout, paid_add_money, paid_cashback, paid_winning)
       VALUES ($1, $2, 4, 1, '120.00', '50.00', '0.00', '0.00')`,
      [matchId, userId]
    );

    const res = await request(app)
      .get('/api/v1/me/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const rewardNotif = res.body.data.find((n: any) => n.type === 'reward');
    expect(rewardNotif).toBeDefined();
    expect(rewardNotif.title).toContain('Tournament Reward: ₹120');
    expect(rewardNotif.message).toContain('4 kills');
  });

  it('allows admin to create, list, and delete notifications', async () => {
    const i = next();
    const staffRes = await query(
      `INSERT INTO staff (role, name, email, mobile) VALUES ('admin', 'Admin User', 'admin_notifs_${i}@test.com', '9${String(i).padStart(9, '0')}') RETURNING id`
    );
    const staffId = staffRes.rows[0].id.toString();
    const sid = crypto.randomUUID();
    await query('INSERT INTO sessions (id, account_type, account_id) VALUES ($1, $2, $3)', [
      sid,
      'staff',
      staffId,
    ]);
    const adminToken = signSessionToken({ sub: staffId, typ: 'staff', role: 'admin', sid }, '1h');

    const { id: user1Id, token: user1Token } = await createTestUser();

    // 1. Admin sends a broadcast notification
    const createRes = await request(app)
      .post('/api/v1/admin/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: '🔥 Server Maintenance Alert 🔥',
        message: 'Server will undergo scheduled maintenance tonight at 2 AM IST.',
        type: 'alert',
        target: 'all',
        actionUrl: '/important-updates',
      })
      .expect(201);

    expect(createRes.body.data).toBeDefined();
    expect(createRes.body.data.title).toBe('🔥 Server Maintenance Alert 🔥');
    const notifId = createRes.body.data.id;

    // 2. Admin lists notifications
    const listRes = await request(app)
      .get('/api/v1/admin/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(listRes.body.data.items.length).toBeGreaterThan(0);
    const found = listRes.body.data.items.find((n: any) => n.id === notifId.toString());
    expect(found).toBeDefined();
    expect(found.isBroadcast).toBe(true);

    // 3. User receives this broadcast notification in their inbox
    const userRes = await request(app)
      .get('/api/v1/me/notifications')
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(200);

    const userNotif = userRes.body.data.find((n: any) => n.id === notifId.toString());
    expect(userNotif).toBeDefined();
    expect(userNotif.title).toBe('🔥 Server Maintenance Alert 🔥');
    expect(userNotif.actionUrl).toBe('/important-updates');

    // 4. Admin deletes notification
    await request(app)
      .delete(`/api/v1/admin/notifications/${notifId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Verify it is gone
    const listAfter = await request(app)
      .get('/api/v1/admin/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(listAfter.body.data.items.find((n: any) => n.id === notifId.toString())).toBeUndefined();
  });

  it('delivers deposit approval notification with valid transaction URL and deduplicates correctly', async () => {
    const { id: userId, token: userToken } = await createTestUser();

    const staffRes = await query(
      `INSERT INTO staff (role, name, email, mobile) VALUES ('admin', 'Admin Approver', 'admin_appr@bw.in', '9876543210') RETURNING id`
    );
    const staffId = staffRes.rows[0].id.toString();

    // 1. User submits deposit request
    const depRes = await query(
      `INSERT INTO deposit_requests (user_id, amount, utr, screenshot_url, status)
       VALUES ($1, '100.00', '123456789012', 'proof.jpg', 'pending')
       RETURNING id`,
      [userId]
    );
    const depositId = depRes.rows[0].id.toString();

    // 2. Admin approves deposit
    const { approveDeposit } = await import('../src/modules/wallet/deposit.staff.service.js');
    await approveDeposit(staffId, 'admin_appr@bw.in', 'admin', depositId);

    // 3. User fetches their notifications
    const userRes = await request(app)
      .get('/api/v1/me/notifications')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    const depositNotifs = userRes.body.data.filter((n: any) => n.type === 'wallet_deposit');
    expect(depositNotifs.length).toBe(1);
    expect(depositNotifs[0].title).toBe('Deposit Approved: ₹100');
    expect(depositNotifs[0].message).toContain('₹100.00 has been approved');
    expect(depositNotifs[0].actionUrl).toMatch(/\/wallet\/transactions\/BW-TRX-/);
  });
});
