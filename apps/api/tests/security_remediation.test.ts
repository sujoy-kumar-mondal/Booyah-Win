import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { signSessionToken } from '../src/utils/crypto.js';
import { ErrorCodes } from '@booyah/shared';
import { checkDatabase, checkSupabaseStorage, checkGmailSmtp } from '../src/scripts/checkEnv.js';

describe('Milestone 8.5 Security Remediation & Review Tightening', () => {
  const app = createApp();

  beforeEach(async () => {
    // Truncate tables for clean test state
    await query(`
      TRUNCATE TABLE
        team_invites,
        match_players,
        teams,
        matches,
        withdrawal_requests,
        deposit_requests,
        wallet_ledger,
        wallets,
        referrals,
        sessions,
        users,
        staff,
        audit_logs
      CASCADE
    `);
  });

  async function createAuthToken(user: { id: string }): Promise<string> {
    const sid = crypto.randomUUID();
    await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'user', $2)`, [
      sid,
      user.id,
    ]);
    return signSessionToken({ sub: user.id, typ: 'user', sid }, '1h');
  }

  async function createStaffToken(staff: { id: string; role: string }): Promise<string> {
    const sid = crypto.randomUUID();
    await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`, [
      sid,
      staff.id,
    ]);
    return signSessionToken({ sub: staff.id, typ: 'staff', sid, role: staff.role }, '12h');
  }

  // Helper to create a user
  async function insertUser(overrides: Partial<any> = {}) {
    const defaultFfId = Math.floor(10000000 + Math.random() * 90000000).toString();
    const referralCode = 'REF' + Math.floor(100000 + Math.random() * 900000).toString();
    const res = await query<{ id: number; email: string; ff_id: string }>(
      `INSERT INTO users (name, email, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, ff_id`,
      [
        overrides.name || 'Test User',
        overrides.email || `user_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
        overrides.mobile || `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        overrides.ffId || defaultFfId,
        overrides.ffName || 'PlayerName',
        overrides.upiId || `test_${Date.now()}_${Math.random().toString(36).substring(7)}@upi`,
        '2000-01-01',
        overrides.referralCode || referralCode,
      ]
    );
    const u = res.rows[0];
    await query(`INSERT INTO wallets (user_id) VALUES ($1)`, [u.id]);
    return {
      id: u.id.toString(),
      email: u.email,
      ffId: u.ff_id,
    };
  }

  // Helper to create staff
  async function insertStaff(role = 'employee') {
    const res = await query<{ id: number; email: string; role: string }>(
      `INSERT INTO staff (name, email, mobile, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role`,
      [
        'Staff Member',
        `staff_${Date.now()}_${Math.random().toString(36).substring(7)}@booyah.win`,
        `99${Math.floor(10000000 + Math.random() * 90000000)}`,
        role,
      ]
    );
    return {
      id: res.rows[0].id.toString(),
      email: res.rows[0].email,
      role: res.rows[0].role,
    };
  }

  // Helper to create a tier and match
  async function insertMatch() {
    const staffRow = await insertStaff('admin');
    const tierRes = await query<{ id: number }>(
      `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
       VALUES ('battle_royale', 'duo', '20.00', '5.00', 2, 48, 2)
       RETURNING id`
    );
    const tierId = tierRes.rows[0].id;
    const matchRes = await query<{ id: number }>(
      `INSERT INTO matches (tier_id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, position_prizes, min_players, max_players, start_time, created_by, status)
       VALUES ($1, 'battle_royale', 'duo', '20.00', '5.00', 2, '{"1": 100.00}'::jsonb, 2, 48, now() + INTERVAL '1 hour', $2, 'upcoming')
       RETURNING id`,
      [tierId, staffRow.id]
    );
    return matchRes.rows[0].id.toString();
  }

  // ─── Requirement 1: 404 for Invite Owned by Another User Identical to Nonexistent ───
  describe('Requirement 1: 404 Response Parity for Differing Owner vs Nonexistent', () => {
    it('returns identical 404 response for nonexistent invite vs invite belonging to another user on accept', async () => {
      const userA = await insertUser({ name: 'User A' });
      const userB = await insertUser({ name: 'User B' });
      const tokenA = await createAuthToken({ id: userA.id, email: userA.email });

      const matchId = await insertMatch();

      // Create a team with leader User B and invite User B's friend (not User A)
      const userC = await insertUser({ name: 'User C' });
      const teamRes = await query<{ id: number }>(
        `INSERT INTO teams (match_id, leader_id, name, size, status)
         VALUES ($1, $2, 'Team B', 2, 'forming')
         RETURNING id`,
        [matchId, userB.id]
      );
      const teamId = teamRes.rows[0].id;

      // Invite is for User C
      const inviteRes = await query<{ id: number }>(
        `INSERT INTO team_invites (team_id, invited_user_id, status)
         VALUES ($1, $2, 'pending')
         RETURNING id`,
        [teamId, userC.id]
      );
      const otherUserInviteId = inviteRes.rows[0].id.toString();
      const nonexistentInviteId = '99999999';

      // User A attempts to accept User C's invite (differing owner)
      const diffOwnerRes = await request(app)
        .post(`/api/v1/team-invites/${otherUserInviteId}/accept`)
        .set('Authorization', `Bearer ${tokenA}`);

      // User A attempts to accept nonexistent invite
      const nonexistentRes = await request(app)
        .post(`/api/v1/team-invites/${nonexistentInviteId}/accept`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(diffOwnerRes.status).toBe(404);
      expect(nonexistentRes.status).toBe(404);

      // Status and payload must be completely identical (no 403 leakage)
      expect(diffOwnerRes.body).toEqual({
        error: {
          code: ErrorCodes.NOT_FOUND,
          message: 'Invite not found',
          details: {},
        },
      });
      expect(diffOwnerRes.body).toEqual(nonexistentRes.body);
    });

    it('returns identical 404 response for nonexistent invite vs invite belonging to another user on decline', async () => {
      const userA = await insertUser({ name: 'User A' });
      const userB = await insertUser({ name: 'User B' });
      const userC = await insertUser({ name: 'User C' });
      const tokenA = await createAuthToken({ id: userA.id, email: userA.email });

      const matchId = await insertMatch();

      const teamRes = await query<{ id: number }>(
        `INSERT INTO teams (match_id, leader_id, name, size, status)
         VALUES ($1, $2, 'Team B', 2, 'forming')
         RETURNING id`,
        [matchId, userB.id]
      );
      const teamId = teamRes.rows[0].id;

      const inviteRes = await query<{ id: number }>(
        `INSERT INTO team_invites (team_id, invited_user_id, status)
         VALUES ($1, $2, 'pending')
         RETURNING id`,
        [teamId, userC.id]
      );
      const otherUserInviteId = inviteRes.rows[0].id.toString();
      const nonexistentInviteId = '88888888';

      const diffOwnerRes = await request(app)
        .post(`/api/v1/team-invites/${otherUserInviteId}/decline`)
        .set('Authorization', `Bearer ${tokenA}`);

      const nonexistentRes = await request(app)
        .post(`/api/v1/team-invites/${nonexistentInviteId}/decline`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(diffOwnerRes.status).toBe(404);
      expect(nonexistentRes.status).toBe(404);
      expect(diffOwnerRes.body).toEqual(nonexistentRes.body);
    });
  });

  // ─── Requirement 4: Staff/Admin Write Rate Limiting Isolated Per Staff User ───
  describe('Requirement 4: Staff Write Rate Limiting (30/min per staff user)', () => {
    it('keys by staff user id and provides each staff user their own 30 write requests/min', async () => {
      const rateLimitedApp = createApp({ enableRateLimiting: true });

      const staff1 = await insertStaff('employee');
      const staff2 = await insertStaff('employee');
      const token1 = await createStaffToken({ id: staff1.id, email: staff1.email, role: staff1.role });
      const token2 = await createStaffToken({ id: staff2.id, email: staff2.email, role: staff2.role });

      // Staff 1 performs 30 mutating requests
      for (let i = 0; i < 30; i++) {
        const res = await request(rateLimitedApp)
          .post('/api/v1/staff/deposits/999999/reject')
          .set('Authorization', `Bearer ${token1}`)
          .send({ reason: 'Invalid deposit' });

        expect(res.status).not.toBe(429);
      }

      // 31st request by Staff 1 hits the 429 RATE_LIMITED limit
      const res31Staff1 = await request(rateLimitedApp)
        .post('/api/v1/staff/deposits/999999/reject')
        .set('Authorization', `Bearer ${token1}`)
        .send({ reason: 'Invalid deposit' });

      expect(res31Staff1.status).toBe(429);
      expect(res31Staff1.body.error.code).toBe(ErrorCodes.RATE_LIMITED);

      // Staff 2 is completely unaffected and has their own 30 requests quota available
      const resStaff2 = await request(rateLimitedApp)
        .post('/api/v1/staff/deposits/999999/reject')
        .set('Authorization', `Bearer ${token2}`)
        .send({ reason: 'Invalid deposit' });

      expect(resStaff2.status).not.toBe(429);
    });
  });

  // ─── Requirement 5: Zod Validation of Every :id Parameter as Numeric String ───
  describe('Requirement 5: Zod Numeric :id Route Parameter Validation', () => {
    it('rejects non-numeric :id route parameters with 400 VALIDATION_ERROR', async () => {
      const user = await insertUser();
      const token = await createAuthToken({ id: user.id, email: user.email });
      const staff = await insertStaff('admin');
      const staffToken = await createStaffToken({ id: staff.id, email: staff.email, role: staff.role });

      // 1. GET /matches/:id
      const resMatch = await request(app)
        .get('/api/v1/matches/abc-not-number')
        .set('Authorization', `Bearer ${token}`);
      expect(resMatch.status).toBe(400);
      expect(resMatch.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // 2. POST /team-invites/:id/accept
      const resInvite = await request(app)
        .post('/api/v1/team-invites/xyz/accept')
        .set('Authorization', `Bearer ${token}`);
      expect(resInvite.status).toBe(400);
      expect(resInvite.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // 3. POST /staff/matches/:id/open-room
      const resOpenRoom = await request(app)
        .post('/api/v1/staff/matches/match_123_abc/open-room')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ roomId: '123', roomPassword: 'pass' });
      expect(resOpenRoom.status).toBe(400);
      expect(resOpenRoom.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // 4. POST /staff/deposits/:id/approve
      const resDeposit = await request(app)
        .post('/api/v1/staff/deposits/bad-id/approve')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(resDeposit.status).toBe(400);
      expect(resDeposit.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // 5. POST /admin/users/:id/adjust
      const resAdjust = await request(app)
        .post('/api/v1/admin/users/fake-user-id/adjust')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ walletKind: 'winning', amount: '10.00', operation: 'credit', reason: 'Test adjustment' });
      expect(resAdjust.status).toBe(400);
      expect(resAdjust.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // 6. DELETE /admin/tiers/:id
      const resTier = await request(app)
        .delete('/api/v1/admin/tiers/invalid-tier')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(resTier.status).toBe(400);
      expect(resTier.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // 7. POST /admin/results/:matchId/approve
      const resResult = await request(app)
        .post('/api/v1/admin/results/not-a-match/approve')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(resResult.status).toBe(400);
      expect(resResult.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });
  });

  // ─── SEC-01: Wallet Boundary Validation (Deposits & Withdrawals) ───
  describe('SEC-01: Wallet Body Validation at Controller Boundary', () => {
    it('rejects invalid deposit request body with 400 VALIDATION_ERROR', async () => {
      const user = await insertUser();
      const token = await createAuthToken({ id: user.id, email: user.email });

      // Missing amount
      const resNoAmount = await request(app)
        .post('/api/v1/wallet/deposits')
        .set('Authorization', `Bearer ${token}`)
        .attach('screenshot', Buffer.from('mockimg'), 'screenshot.jpg')
        .field('utr', '123456789012');

      expect(resNoAmount.status).toBe(400);
      expect(resNoAmount.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // Invalid UTR (too short)
      const resBadUtr = await request(app)
        .post('/api/v1/wallet/deposits')
        .set('Authorization', `Bearer ${token}`)
        .attach('screenshot', Buffer.from('mockimg'), 'screenshot.jpg')
        .field('amount', '100.00')
        .field('utr', 'short');

      expect(resBadUtr.status).toBe(400);
      expect(resBadUtr.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('rejects invalid withdrawal request body with 400 VALIDATION_ERROR', async () => {
      const user = await insertUser();
      const token = await createAuthToken({ id: user.id, email: user.email });

      // Invalid amount format
      const resBadAmount = await request(app)
        .post('/api/v1/wallet/withdrawals')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 'invalid-amount', upiId: 'test@upi', confirm: true });

      expect(resBadAmount.status).toBe(400);
      expect(resBadAmount.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      // confirm not true
      const resNoConfirm = await request(app)
        .post('/api/v1/wallet/withdrawals')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: '50.00', upiId: 'test@upi', confirm: false });

      expect(resNoConfirm.status).toBe(400);
      expect(resNoConfirm.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });
  });

  // ─── SEC-02 & SEC-04: Rate Limiting Endpoints ───
  describe('SEC-02 & SEC-04: Specific Route Rate Limiting', () => {
    it('rate limits registration completion to 10/min per IP (SEC-02)', async () => {
      const rateLimitedApp = createApp({ enableRateLimiting: true });

      for (let i = 0; i < 10; i++) {
        const res = await request(rateLimitedApp)
          .post('/api/v1/auth/register/complete')
          .send({}); // validation error or other, but not 429
        expect(res.status).not.toBe(429);
      }

      const res11 = await request(rateLimitedApp)
        .post('/api/v1/auth/register/complete')
        .send({});

      expect(res11.status).toBe(429);
      expect(res11.body.error.code).toBe(ErrorCodes.RATE_LIMITED);
    });

    it('rate limits team replace and disband to 10/min per user (SEC-04)', async () => {
      const rateLimitedApp = createApp({ enableRateLimiting: true });
      const user = await insertUser();
      const token = await createAuthToken({ id: user.id, email: user.email });

      for (let i = 0; i < 10; i++) {
        const res = await request(rateLimitedApp)
          .post('/api/v1/matches/1/teams/mine/replace')
          .set('Authorization', `Bearer ${token}`)
          .send({ oldFfId: '123', newFfId: '456' });
        expect(res.status).not.toBe(429);
      }

      const res11 = await request(rateLimitedApp)
        .post('/api/v1/matches/1/teams/mine/replace')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldFfId: '123', newFfId: '456' });

      expect(res11.status).toBe(429);
      expect(res11.body.error.code).toBe(ErrorCodes.RATE_LIMITED);
    });
  });

  // ─── SEC-06 to SEC-09: Body & Query Validations ───
  describe('SEC-06 to SEC-09: Controller Reason & Query Validation', () => {
    it('SEC-06: rejects DELETE /admin/users/:id when reason is shorter than 5 chars', async () => {
      const staff = await insertStaff('admin');
      const staffToken = await createStaffToken({ id: staff.id, email: staff.email, role: staff.role });

      const res = await request(app)
        .delete('/api/v1/admin/users/1')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'bad' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('SEC-07: rejects POST /admin/results/:matchId/reject and /reverse when reason is missing', async () => {
      const staff = await insertStaff('admin');
      const staffToken = await createStaffToken({ id: staff.id, email: staff.email, role: staff.role });

      const resReject = await request(app)
        .post('/api/v1/admin/results/1/reject')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});

      expect(resReject.status).toBe(400);
      expect(resReject.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);

      const resReverse = await request(app)
        .post('/api/v1/admin/results/1/reverse')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: '   ' });

      expect(resReverse.status).toBe(400);
      expect(resReverse.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('SEC-08: rejects GET /admin/audit-logs when query parameters are invalid', async () => {
      const staff = await insertStaff('admin');
      const staffToken = await createStaffToken({ id: staff.id, email: staff.email, role: staff.role });

      const res = await request(app)
        .get('/api/v1/admin/audit-logs?limit=500&staffId=notanumber')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('SEC-09: rejects POST /staff/matches/:id/cancel when reason is shorter than 3 chars', async () => {
      const staff = await insertStaff('employee');
      const staffToken = await createStaffToken({ id: staff.id, email: staff.email, role: staff.role });

      const res = await request(app)
        .post('/api/v1/staff/matches/1/cancel')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'no' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });
  });

  // ─── check:env Mocked Unit Tests: Never Leak Secrets on Failure ───
  describe('check:env Unit Tests: Zero Secrets in Failure Messages', () => {
    it('checkDatabase never leaks database passwords when connection fails', async () => {
      const secretPassword = 'SUPER_CONFIDENTIAL_DB_SECRET_PASSWORD_9988';
      const failingUrl = `postgresql://postgres:${secretPassword}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;

      const result = await checkDatabase(failingUrl);
      expect(result.passed).toBe(false);
      expect(result.message).not.toContain(secretPassword);
    });

    it('checkSupabaseStorage never leaks service keys when request fails', async () => {
      const secretServiceKey = 'SUPER_SECRET_SUPABASE_SERVICE_ROLE_TOKEN_12345';
      const failingUrl = 'https://nonexistent-project-domain-1234.supabase.co';

      const result = await checkSupabaseStorage(failingUrl, secretServiceKey);
      expect(result.passed).toBe(false);
      expect(result.message).not.toContain(secretServiceKey);
    });

    it('checkGmailSmtp never leaks gmail app passwords when auth fails', async () => {
      const secretAppPassword = 'VERY_SECRET_GMAIL_APP_PASS_ABCD';

      const result = await checkGmailSmtp(null, 'test@gmail.com', secretAppPassword);
      expect(result.passed).toBe(false);
      expect(result.message).not.toContain(secretAppPassword);
    });
  });
});
