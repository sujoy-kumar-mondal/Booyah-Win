import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { ErrorCodes } from '@booyah/shared';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { testOtpStore } from '../src/utils/email.js';
import { truncateAllTables } from './setup.js';
import { config, validateTestDatabaseUrl } from '../src/config/index.js';
import { hashOtp } from '../src/utils/crypto.js';

const app = createApp();

describe('Auth & Session Integration Tests', () => {
  beforeEach(async () => {
    testOtpStore.clear();
    await truncateAllTables();
  });

  describe('Database safety checks', () => {
    it('refuses to run tests if database name does not end in _test', () => {
      expect(() => {
        validateTestDatabaseUrl('postgres://localhost:5432/booyah_win_prod');
      }).toThrow(/does not end in "_test"/);
    });

    it('refuses to run tests if database URL points to Supabase or remote host', () => {
      expect(() => {
        validateTestDatabaseUrl('postgres://postgres:pass@db.project.supabase.co:5432/db_test');
      }).toThrow(/Must be a local database/);
    });
  });

  describe('OTP Expiry, Lockout, and Rate Limits', () => {
    it('verifying an expired OTP (> 10 minutes) fails with INVALID_OTP', async () => {
      const email = 'expire_test@example.com';
      await request(app)
        .post('/api/v1/auth/register/request-otp')
        .send({ email })
        .expect(200);

      const otp = testOtpStore.get(email);
      expect(otp).toBeDefined();

      // Expire the OTP in the database
      await query(
        `UPDATE otp_requests SET expires_at = now() - interval '1 minute' WHERE email = $1`,
        [email]
      );

      const res = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email, otp })
        .expect(400);

      expect(res.body.error.code).toBe(ErrorCodes.INVALID_OTP);
    });

    it('5 failed attempts lock out the OTP; 6th attempt fails even if correct', async () => {
      const email = 'lockout_test@example.com';
      await request(app)
        .post('/api/v1/auth/register/request-otp')
        .send({ email })
        .expect(200);

      const correctOtp = testOtpStore.get(email)!;
      const wrongOtp = '000000';

      // 5 wrong attempts
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/v1/auth/register/verify-otp')
          .send({ email, otp: wrongOtp })
          .expect(400);
        expect(res.body.error.code).toBe(ErrorCodes.INVALID_OTP);
      }

      // 6th attempt with correct OTP must fail
      const res6 = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email, otp: correctOtp })
        .expect(400);

      expect(res6.body.error.code).toBe(ErrorCodes.INVALID_OTP);
    });

    it('resend within 60s cooldown fails with OTP_RATE_LIMITED (429)', async () => {
      const email = 'cooldown@example.com';
      await request(app)
        .post('/api/v1/auth/register/request-otp')
        .send({ email })
        .expect(200);

      const res = await request(app)
        .post('/api/v1/auth/register/request-otp')
        .send({ email })
        .expect(429);

      expect(res.body.error.code).toBe(ErrorCodes.OTP_RATE_LIMITED);
    });

    it('hourly limit: requesting > 5 OTPs within 1 hour fails with OTP_RATE_LIMITED (429)', async () => {
      const email = 'hourly@example.com';

      // Insert 5 past OTPs within the last hour spaced out by 2 minutes
      for (let i = 1; i <= 5; i++) {
        await query(
          `INSERT INTO otp_requests (email, audience, purpose, code_hash, created_at, expires_at)
           VALUES ($1, 'user', 'register', $2, now() - interval '${i * 2} minutes', now() + interval '5 minutes')`,
          [email, hashOtp('123456')]
        );
      }

      // 6th request within the hour should fail with 429
      const res = await request(app)
        .post('/api/v1/auth/register/request-otp')
        .send({ email })
        .expect(429);

      expect(res.body.error.code).toBe(ErrorCodes.OTP_RATE_LIMITED);
    });

    it('cooldown and hourly limits apply to unknown/unregistered emails equally', async () => {
      const unknownEmail = 'unregistered_cooldown@example.com';

      // First request succeeds with generic 200
      const res1 = await request(app)
        .post('/api/v1/auth/login/request-otp')
        .send({ email: unknownEmail })
        .expect(200);
      expect(res1.body.data.message).toMatch(/If this email is registered/);

      // Immediate second request within 60s must return 429 OTP_RATE_LIMITED
      const res2 = await request(app)
        .post('/api/v1/auth/login/request-otp')
        .send({ email: unknownEmail })
        .expect(429);
      expect(res2.body.error.code).toBe(ErrorCodes.OTP_RATE_LIMITED);
    });
  });

  describe('User Registration Flow', () => {
    it('request and verify OTP does NOT create a row in users until complete succeeds', async () => {
      const email = 'pending_user@example.com';

      await request(app)
        .post('/api/v1/auth/register/request-otp')
        .send({ email })
        .expect(200);

      const otp = testOtpStore.get(email)!;
      const verifyRes = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email, otp })
        .expect(200);

      expect(verifyRes.body.data.registrationToken).toBeDefined();

      // Verify no user exists yet in the database
      const userCheck = await query('SELECT count(*)::int as count FROM users WHERE email = $1', [
        email,
      ]);
      expect(userCheck.rows[0].count).toBe(0);

      // Now complete registration
      const regRes = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: verifyRes.body.data.registrationToken,
          name: 'Rahul Sharma',
          mobile: '9876543210',
          ffId: '12345678',
          ffName: 'RahulSniper',
          upiId: 'rahul@oksbi',
          dateOfBirth: '2000-01-15',
          confirm18Plus: true,
        })
        .expect(200);

      expect(regRes.body.data.token).toBeDefined();
      expect(regRes.body.data.user.email).toBe(email);
      expect(regRes.body.data.user.referralCode).toHaveLength(8);

      // Users row and wallet now exist
      const userAfter = await query('SELECT count(*)::int as count FROM users WHERE email = $1', [
        email,
      ]);
      expect(userAfter.rows[0].count).toBe(1);

      const walletAfter = await query(
        `SELECT add_money, cashback, winning FROM wallets WHERE user_id = $1`,
        [regRes.body.data.user.id]
      );
      expect(walletAfter.rows[0].add_money).toBe('0.00');
    });

    it('marks the register OTP row consumed and rejects token reuse', async () => {
      const email = 'consumed_test@example.com';
      await request(app)
        .post('/api/v1/auth/register/request-otp')
        .send({ email })
        .expect(200);

      const otp = testOtpStore.get(email)!;
      const verifyRes = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email, otp })
        .expect(200);

      const regToken = verifyRes.body.data.registrationToken;

      await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: regToken,
          name: 'Amit Patel',
          mobile: '9123456780',
          ffId: '98765432',
          ffName: 'AmitPro',
          upiId: 'amit@okhdfc',
          dateOfBirth: '1998-05-20',
          confirm18Plus: true,
        })
        .expect(200);

      // Check consumed_at in database
      const otpRow = await query('SELECT consumed_at FROM otp_requests WHERE email = $1', [email]);
      expect(otpRow.rows[0].consumed_at).not.toBeNull();

      // Attempt to reuse registration token
      const reuseRes = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: regToken,
          name: 'Amit Patel',
          mobile: '9123456781',
          ffId: '98765433',
          ffName: 'AmitPro2',
          upiId: 'amit2@okhdfc',
          dateOfBirth: '1998-05-20',
          confirm18Plus: true,
        })
        .expect(401);

      expect(reuseRes.body.error.code).toBe(ErrorCodes.UNAUTHENTICATED);
    });

    it('rejects duplicate email, mobile, Free Fire ID, and UPI (case-insensitive)', async () => {
      // Register first user
      const email1 = 'user1@example.com';
      await request(app).post('/api/v1/auth/register/request-otp').send({ email: email1 });
      const otp1 = testOtpStore.get(email1)!;
      const ver1 = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email: email1, otp: otp1 });

      await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: ver1.body.data.registrationToken,
          name: 'Player One',
          mobile: '9000000001',
          ffId: '10000001',
          ffName: 'PlayerOne',
          upiId: 'player1@upi',
          dateOfBirth: '2000-01-01',
          confirm18Plus: true,
        })
        .expect(200);

      // 1. Duplicate email during request-otp
      const dupEmailRes = await request(app)
        .post('/api/v1/auth/register/request-otp')
        .send({ email: email1 })
        .expect(409);
      expect(dupEmailRes.body.error.code).toBe(ErrorCodes.EMAIL_EXISTS);

      // Setup user 2
      const email2 = 'user2@example.com';
      await request(app).post('/api/v1/auth/register/request-otp').send({ email: email2 });
      const otp2 = testOtpStore.get(email2)!;
      const ver2 = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email: email2, otp: otp2 });

      // 2. Duplicate mobile
      const dupMobileRes = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: ver2.body.data.registrationToken,
          name: 'Player Two',
          mobile: '9000000001', // same mobile as user 1
          ffId: '20000002',
          ffName: 'PlayerTwo',
          upiId: 'player2@upi',
          dateOfBirth: '2000-01-01',
          confirm18Plus: true,
        })
        .expect(409);
      expect(dupMobileRes.body.error.code).toBe(ErrorCodes.MOBILE_EXISTS);

      // 3. Duplicate Free Fire ID
      const dupFfRes = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: ver2.body.data.registrationToken,
          name: 'Player Two',
          mobile: '9000000002',
          ffId: '10000001', // same ffId as user 1
          ffName: 'PlayerTwo',
          upiId: 'player2@upi',
          dateOfBirth: '2000-01-01',
          confirm18Plus: true,
        })
        .expect(409);
      expect(dupFfRes.body.error.code).toBe(ErrorCodes.FF_ID_EXISTS);

      // 4. Duplicate UPI ID (case-insensitive test: 'PLAYER1@UPI')
      const dupUpiRes = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: ver2.body.data.registrationToken,
          name: 'Player Two',
          mobile: '9000000002',
          ffId: '20000002',
          ffName: 'PlayerTwo',
          upiId: 'PLAYER1@UPI', // uppercase version of player1@upi
          dateOfBirth: '2000-01-01',
          confirm18Plus: true,
        })
        .expect(409);
      expect(dupUpiRes.body.error.code).toBe(ErrorCodes.UPI_EXISTS);
    });

    it('rejects under-18 registration attempt', async () => {
      const email = 'underage@example.com';
      await request(app).post('/api/v1/auth/register/request-otp').send({ email });
      const otp = testOtpStore.get(email)!;
      const ver = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email, otp });

      // Born 10 years ago
      const recentDob = new Date();
      recentDob.setFullYear(recentDob.getFullYear() - 10);
      const dobStr = recentDob.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: ver.body.data.registrationToken,
          name: 'Young Player',
          mobile: '9888877777',
          ffId: '55555555',
          ffName: 'Youngster',
          upiId: 'young@upi',
          dateOfBirth: dobStr,
          confirm18Plus: true,
        })
        .expect(400);

      expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('rejects invalid referral code', async () => {
      const email = 'referral_test@example.com';
      await request(app).post('/api/v1/auth/register/request-otp').send({ email });
      const otp = testOtpStore.get(email)!;
      const ver = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email, otp });

      const res = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: ver.body.data.registrationToken,
          name: 'Referred Player',
          mobile: '9777766666',
          ffId: '66666666',
          ffName: 'RefUser',
          upiId: 'ref@upi',
          dateOfBirth: '1995-10-10',
          confirm18Plus: true,
          referralCode: 'NONEXIST',
        })
        .expect(400);

      expect(res.body.error.code).toBe(ErrorCodes.INVALID_REFERRAL);
    });
  });

  describe('User Login & Session Management', () => {
    let userToken: string;
    const userEmail = 'player_login@example.com';

    beforeEach(async () => {
      // Register user
      await request(app).post('/api/v1/auth/register/request-otp').send({ email: userEmail });
      const otp = testOtpStore.get(userEmail)!;
      const ver = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email: userEmail, otp });

      const reg = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: ver.body.data.registrationToken,
          name: 'Player Login',
          mobile: '9555544444',
          ffId: '77777777',
          ffName: 'LoginTester',
          upiId: 'login@upi',
          dateOfBirth: '1999-03-25',
          confirm18Plus: true,
        });

      userToken = reg.body.data.token;
      testOtpStore.clear();

      // Clear the registration OTP request so login tests are not affected by 60s cooldown
      await query('DELETE FROM otp_requests WHERE email = $1', [userEmail]);
    });

    it('unknown-email login returns identical generic response to known email', async () => {
      // Known email
      const knownRes = await request(app)
        .post('/api/v1/auth/login/request-otp')
        .send({ email: userEmail })
        .expect(200);

      // Unknown email
      const unknownRes = await request(app)
        .post('/api/v1/auth/login/request-otp')
        .send({ email: 'ghost_account@example.com' })
        .expect(200);

      expect(knownRes.body.data.message).toBe(unknownRes.body.data.message);
      expect(knownRes.body.data.message).toBe('If this email is registered, an OTP has been sent');
    });

    it('new login invalidates old token with SESSION_REPLACED (401)', async () => {
      // Access /me with current token
      const me1 = await request(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(me1.body.data.profile.email).toBe(userEmail);

      // Log in again from another device
      await request(app)
        .post('/api/v1/auth/login/request-otp')
        .send({ email: userEmail })
        .expect(200);

      const loginOtp = testOtpStore.get(userEmail)!;
      const loginRes = await request(app)
        .post('/api/v1/auth/login/verify-otp')
        .send({ email: userEmail, otp: loginOtp })
        .expect(200);

      const newToken = loginRes.body.data.token;

      // Old token must now fail with SESSION_REPLACED
      const oldReqRes = await request(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401);

      expect(oldReqRes.body.error.code).toBe(ErrorCodes.SESSION_REPLACED);

      // New token must succeed
      const newReqRes = await request(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      expect(newReqRes.body.data.profile.email).toBe(userEmail);
    });

    it('expired JWT is rejected with UNAUTHENTICATED (401)', async () => {
      const expiredToken = jwt.sign(
        { sub: '1', typ: 'user', sid: 'test-sid', role: 'user' },
        config.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(res.body.error.code).toBe(ErrorCodes.UNAUTHENTICATED);
    });

    it('deleted user cannot log in and existing session is rejected', async () => {
      // Soft-delete user
      await query(`UPDATE users SET deleted_at = now(), deleted_reason = 'Cheating' WHERE email = $1`, [
        userEmail,
      ]);

      // Old token fails
      await request(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401);

      // Request login OTP gives generic message, but no OTP is generated
      testOtpStore.clear();
      await request(app)
        .post('/api/v1/auth/login/request-otp')
        .send({ email: userEmail })
        .expect(200);

      expect(testOtpStore.get(userEmail)).toBeUndefined();
    });
  });

  describe('Audience and Token Type Isolation', () => {
    let userToken: string;
    let staffToken: string;
    const staffEmail = 'employee@booyah.win';
    const userEmail = 'user_isolation@example.com';

    beforeEach(async () => {
      // Create a staff member
      await query(
        `INSERT INTO staff (role, name, email, mobile) VALUES ('employee', 'Staff John', $1, '9876500000')`,
        [staffEmail]
      );

      // Login staff
      await request(app)
        .post('/api/v1/staff/auth/login/request-otp')
        .send({ email: staffEmail })
        .expect(200);

      const staffOtp = testOtpStore.get(staffEmail)!;
      const staffLogin = await request(app)
        .post('/api/v1/staff/auth/login/verify-otp')
        .send({ email: staffEmail, otp: staffOtp })
        .expect(200);

      staffToken = staffLogin.body.data.token;

      // Register and login user
      await request(app).post('/api/v1/auth/register/request-otp').send({ email: userEmail });
      const userOtp = testOtpStore.get(userEmail)!;
      const ver = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email: userEmail, otp: userOtp });

      const reg = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: ver.body.data.registrationToken,
          name: 'Player Isolation',
          mobile: '9333322222',
          ffId: '88888888',
          ffName: 'IsoPlayer',
          upiId: 'iso@upi',
          dateOfBirth: '2001-08-10',
          confirm18Plus: true,
        });

      userToken = reg.body.data.token;

      // Clear otp_requests to isolate tests
      await query('DELETE FROM otp_requests');
    });

    it('staff OTP cannot be verified on user endpoint, and user OTP cannot be verified on staff endpoint', async () => {
      testOtpStore.clear();

      await request(app)
        .post('/api/v1/staff/auth/login/request-otp')
        .send({ email: staffEmail })
        .expect(200);

      const staffOtp = testOtpStore.get(staffEmail)!;

      // Try verifying staff OTP on user endpoint
      const crossVerify = await request(app)
        .post('/api/v1/auth/login/verify-otp')
        .send({ email: staffEmail, otp: staffOtp })
        .expect(400);

      expect(crossVerify.body.error.code).toBe(ErrorCodes.INVALID_OTP);
    });

    it('user tokens fail on /staff/* and staff tokens fail on /me', async () => {
      // 1. User token on /staff/me -> must fail
      const userOnStaff = await request(app)
        .get('/api/v1/staff/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401);

      expect(userOnStaff.body.error.code).toBe(ErrorCodes.UNAUTHENTICATED);

      // 2. Staff token on /me -> must fail
      const staffOnUser = await request(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(401);

      expect(staffOnUser.body.error.code).toBe(ErrorCodes.UNAUTHENTICATED);

      // 3. Proper tokens succeed on their respective routes
      await request(app)
        .get('/api/v1/staff/me')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      await request(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });
  });
});
