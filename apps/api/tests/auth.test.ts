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
          username: 'rahul_sniper',
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
      expect(regRes.body.data.user.username).toBe('rahul_sniper');
      expect(regRes.body.data.user.referralCode).toBe('rahul_sniper');

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
          username: 'amit_patel',
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
          username: 'amit_patel_2',
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
          username: 'player_one',
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
          username: 'player_two',
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

      // 3. Duplicate username (case-insensitive test: 'PLAYER_ONE')
      const dupUsernameRes = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: ver2.body.data.registrationToken,
          username: 'PLAYER_ONE',
          name: 'Player Two',
          mobile: '9000000002',
          ffId: '20000002',
          ffName: 'PlayerTwo',
          upiId: 'player2@upi',
          dateOfBirth: '2000-01-01',
          confirm18Plus: true,
        })
        .expect(409);
      expect(dupUsernameRes.body.error.code).toBe(ErrorCodes.USERNAME_EXISTS);

      // 4. Duplicate Free Fire ID is ALLOWED (a player can have two accounts)
      const allowedDupFfRes = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: ver2.body.data.registrationToken,
          username: 'player_two',
          name: 'Player Two',
          mobile: '9000000002',
          ffId: '10000001', // same ffId as user 1, allowed!
          ffName: 'PlayerTwo',
          upiId: 'player2@upi',
          dateOfBirth: '2000-01-01',
          confirm18Plus: true,
        })
        .expect(200);
      expect(allowedDupFfRes.body.data.user.ffId).toBe('10000001');

      // 5. Duplicate UPI ID (case-insensitive test: 'PLAYER1@UPI')
      const email3 = 'user3@example.com';
      await request(app).post('/api/v1/auth/register/request-otp').send({ email: email3 });
      const otp3 = testOtpStore.get(email3)!;
      const ver3 = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email: email3, otp: otp3 });

      const dupUpiRes = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: ver3.body.data.registrationToken,
          username: 'player_three',
          name: 'Player Three',
          mobile: '9000000003',
          ffId: '30000003',
          ffName: 'PlayerThree',
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
          username: 'young_player',
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
          username: 'referred_player',
          name: 'Referred Player',
          mobile: '9777766666',
          ffId: '66666666',
          ffName: 'RefUser',
          upiId: 'ref@upi',
          dateOfBirth: '1995-10-10',
          confirm18Plus: true,
          referralCode: 'non_exist_user',
        })
        .expect(400);

      expect(res.body.error.code).toBe(ErrorCodes.INVALID_REFERRAL);
    });

    it('successfully applies valid referral code using referrer username', async () => {
      // 1. Create referrer
      const refEmail = 'referrer_test@example.com';
      await request(app).post('/api/v1/auth/register/request-otp').send({ email: refEmail });
      const refOtp = testOtpStore.get(refEmail)!;
      const refVer = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email: refEmail, otp: refOtp });

      const refReg = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: refVer.body.data.registrationToken,
          username: 'cool_captain',
          name: 'Cool Captain',
          mobile: '9666655555',
          ffId: '55544433',
          ffName: 'CaptainCool',
          upiId: 'captain@upi',
          dateOfBirth: '1996-06-06',
          confirm18Plus: true,
        })
        .expect(200);

      expect(refReg.body.data.user.referralCode).toBe('cool_captain');

      // 2. Register new player using referrer username
      const newEmail = 'referred_guy@example.com';
      await request(app).post('/api/v1/auth/register/request-otp').send({ email: newEmail });
      const newOtp = testOtpStore.get(newEmail)!;
      const newVer = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email: newEmail, otp: newOtp });

      const newReg = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: newVer.body.data.registrationToken,
          username: 'new_sniper',
          name: 'New Sniper',
          mobile: '9444433333',
          ffId: '44433322',
          ffName: 'NewSniper',
          upiId: 'newsniper@upi',
          dateOfBirth: '1997-07-07',
          confirm18Plus: true,
          referralCode: 'COOL_CAPTAIN', // case-insensitive username match
        })
        .expect(200);

      expect(newReg.body.data.user.referredBy).toBe(refReg.body.data.user.id);

      // 3. Register another player using referrer username with '@' prefix (e.g. @cool_captain)
      const atEmail = 'referred_at@example.com';
      await request(app).post('/api/v1/auth/register/request-otp').send({ email: atEmail });
      const atOtp = testOtpStore.get(atEmail)!;
      const atVer = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email: atEmail, otp: atOtp });

      const atReg = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: atVer.body.data.registrationToken,
          username: 'at_sniper',
          name: 'At Sniper',
          mobile: '9444433334',
          ffId: '44433323',
          ffName: 'AtSniper',
          upiId: 'atsniper@upi',
          dateOfBirth: '1997-07-07',
          confirm18Plus: true,
          referralCode: '@cool_captain', // with leading @ prefix
        })
        .expect(200);

      expect(atReg.body.data.user.referredBy).toBe(refReg.body.data.user.id);
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
          username: 'player_login',
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
          username: 'player_isolation',
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

  describe('User Registration Joining Reward', () => {
    it('automatically credits joining reward to deposit wallet and creates ledger entry when joining_reward > 0', async () => {
      // 1. Set joining_reward = '10.00' in app_settings
      await query(
        `INSERT INTO app_settings (key, value) VALUES ('joining_reward', '10.00')
         ON CONFLICT (key) DO UPDATE SET value = '10.00'`
      );

      const email = 'reward_player@example.com';
      await request(app)
        .post('/api/v1/auth/register/request-otp')
        .send({ email })
        .expect(200);

      const otp = testOtpStore.get(email)!;
      const verifyRes = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email, otp })
        .expect(200);

      const regRes = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: verifyRes.body.data.registrationToken,
          username: 'reward_champ',
          name: 'Reward Champ',
          mobile: '9777777771',
          ffId: '77777771',
          ffName: 'RewardChampFF',
          upiId: 'reward@okhdfc',
          dateOfBirth: '2001-05-20',
          confirm18Plus: true,
        })
        .expect(200);

      const token = regRes.body.data.token;
      const userId = regRes.body.data.user.id;

      // 2. Verify wallet balances
      const meRes = await request(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(meRes.body.data.wallets.cashback).toBe('0.00');
      expect(meRes.body.data.wallets.addMoney).toBe('10.00');
      expect(meRes.body.data.wallets.winning).toBe('0.00');
      expect(meRes.body.data.wallets.total).toBe('10.00');

      // 3. Verify wallet_ledger record
      const ledgerRes = await query(
        `SELECT * FROM wallet_ledger WHERE user_id = $1 AND type = 'joining_reward'`,
        [userId]
      );
      expect(ledgerRes.rowCount).toBe(1);
      const row = ledgerRes.rows[0];
      expect(row.wallet).toBe('add_money');
      expect(row.amount).toBe('10.00');
      expect(row.balance_after).toBe('10.00');
      expect(row.total_after).toBe('10.00');
      expect(row.ref_type).toBe('joining_reward');

      // 4. Verify user notification was created
      const notifRes = await query(
        `SELECT * FROM notifications WHERE user_id = $1 AND type = 'reward'`,
        [userId]
      );
      expect(notifRes.rowCount).toBe(1);
      expect(notifRes.rows[0].title).toBe('Welcome Bonus Credited!');

      // 5. Verify user transaction list & detail
      const txnListRes = await request(app)
        .get('/api/v1/wallet/transactions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(txnListRes.body.data.items.length).toBe(1);
      expect(txnListRes.body.data.items[0].type).toBe('joining_reward');
      expect(txnListRes.body.data.items[0].wallet).toBe('add_money');
      expect(txnListRes.body.data.items[0].amount).toBe('10.00');

      const txnId = txnListRes.body.data.items[0].transactionId;
      const txnDetailRes = await request(app)
        .get(`/api/v1/wallet/transactions/${txnId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(txnDetailRes.body.data.type).toBe('joining_reward');
      expect(txnDetailRes.body.data.walletName).toBe('Deposited');
      expect(txnDetailRes.body.data.status).toBe('successful');
      expect(txnDetailRes.body.data.breakdown.deposited).toBe('10.00');
    });

    it('does not credit joining reward when joining_reward is 0.00', async () => {
      await query(
        `INSERT INTO app_settings (key, value) VALUES ('joining_reward', '0.00')
         ON CONFLICT (key) DO UPDATE SET value = '0.00'`
      );

      const email = 'zero_reward@example.com';
      await request(app)
        .post('/api/v1/auth/register/request-otp')
        .send({ email })
        .expect(200);

      const otp = testOtpStore.get(email)!;
      const verifyRes = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .send({ email, otp })
        .expect(200);

      const regRes = await request(app)
        .post('/api/v1/auth/register/complete')
        .send({
          registrationToken: verifyRes.body.data.registrationToken,
          username: 'zero_champ',
          name: 'Zero Champ',
          mobile: '9777777772',
          ffId: '77777772',
          ffName: 'ZeroChampFF',
          upiId: 'zero@okhdfc',
          dateOfBirth: '2001-05-20',
          confirm18Plus: true,
        })
        .expect(200);

      const token = regRes.body.data.token;
      const userId = regRes.body.data.user.id;

      const meRes = await request(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(meRes.body.data.wallets.cashback).toBe('0.00');
      expect(meRes.body.data.wallets.total).toBe('0.00');

      const ledgerRes = await query(
        `SELECT * FROM wallet_ledger WHERE user_id = $1`,
        [userId]
      );
      expect(ledgerRes.rowCount).toBe(0);
    });
  });
});
