import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { ErrorCodes } from '@booyah/shared';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { testOtpStore } from '../src/utils/email.js';
import { truncateAllTables } from './setup.js';
import { config } from '../src/config/index.js';

const app = createApp();

describe('Staff Session Survival & Step-Up Elevation Tests', () => {
  const adminEmail = 'admin_elevation@booyah.win';
  let adminId: string;

  beforeEach(async () => {
    testOtpStore.clear();
    await truncateAllTables();

    // Create Admin staff
    const adminRes = await query(
      `INSERT INTO staff (role, name, email, mobile) VALUES ('admin', 'Elevation Admin', $1, '9876543210') RETURNING id`,
      [adminEmail]
    );
    adminId = adminRes.rows[0].id.toString();
  });

  async function loginAdmin(remember: boolean = true): Promise<string> {
    await query('DELETE FROM otp_requests WHERE email = $1', [adminEmail]);

    await request(app)
      .post('/api/v1/staff/auth/login/request-otp')
      .send({ email: adminEmail })
      .expect(200);

    const otp = testOtpStore.get(adminEmail)!;
    const res = await request(app)
      .post('/api/v1/staff/auth/login/verify-otp')
      .send({ email: adminEmail, otp, remember })
      .expect(200);

    return res.body.data.token;
  }

  describe('1. Token Expiry: 30-Day Remembered vs 12-Hour Not-Remembered', () => {
    it('remember=true (or omitted default) issues a 30-day token', async () => {
      const token = await loginAdmin(true);
      const decoded = jwt.decode(token) as any;
      expect(decoded).toBeDefined();
      expect(decoded.typ).toBe('staff');

      const nowSec = Math.floor(Date.now() / 1000);
      const diffDays = (decoded.exp - nowSec) / (24 * 3600);
      expect(diffDays).toBeGreaterThan(29);
      expect(diffDays).toBeLessThanOrEqual(30.1);
    });

    it('remember=false issues a 12-hour token', async () => {
      const token = await loginAdmin(false);
      const decoded = jwt.decode(token) as any;
      expect(decoded).toBeDefined();
      expect(decoded.typ).toBe('staff');

      const nowSec = Math.floor(Date.now() / 1000);
      const diffHours = (decoded.exp - nowSec) / 3600;
      expect(diffHours).toBeGreaterThan(11);
      expect(diffHours).toBeLessThanOrEqual(12.1);
    });

    it('expired token returns HTTP 401 UNAUTHENTICATED', async () => {
      // Create an expired staff token
      const expiredToken = jwt.sign(
        { sub: adminId, typ: 'staff', sid: 'dummy-sid' },
        config.JWT_SECRET,
        { expiresIn: '-10s' }
      );

      const res = await request(app)
        .get('/api/v1/staff/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(res.body.error.code).toBe(ErrorCodes.UNAUTHENTICATED);
    });

    it('one-active-device rule: new login replaces previous session with SESSION_REPLACED', async () => {
      const token1 = await loginAdmin(true);

      // Verify token1 works
      await request(app)
        .get('/api/v1/staff/me')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      // Login again (simulating another device)
      const token2 = await loginAdmin(true);

      // token2 works
      await request(app)
        .get('/api/v1/staff/me')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      // token1 is replaced and returns 401 SESSION_REPLACED
      const res = await request(app)
        .get('/api/v1/staff/me')
        .set('Authorization', `Bearer ${token1}`)
        .expect(401);

      expect(res.body.error.code).toBe(ErrorCodes.SESSION_REPLACED);
      expect(res.body.error.message).toContain('another device');
    });
  });

  describe('2. Initial Elevation on Login and 1-Hour Expiry', () => {
    it('fresh login is elevated for 1 hour; sensitive actions succeed immediately', async () => {
      const token = await loginAdmin(true);

      // Check sessions table for elevated_until
      const sessionRow = await query(
        `SELECT last_otp_at, elevated_until FROM sessions WHERE account_type = 'staff' AND account_id = $1`,
        [adminId]
      );
      expect(sessionRow.rows.length).toBe(1);
      expect(sessionRow.rows[0].last_otp_at).toBeDefined();

      const elevatedUntil = new Date(sessionRow.rows[0].elevated_until).getTime();
      const diffMins = (elevatedUntil - Date.now()) / (60 * 1000);
      expect(diffMins).toBeGreaterThan(55);
      expect(diffMins).toBeLessThanOrEqual(61);

      // Sensitive action: update settings succeeds
      await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ payment_upi_id: 'fresh@upi' })
        .expect(200);
    });

    it('elevation expires after 1 hour: returns HTTP 403 REAUTH_REQUIRED (never 401)', async () => {
      const token = await loginAdmin(true);

      // Expire elevation
      await query(
        `UPDATE sessions SET elevated_until = now() - interval '1 second' WHERE account_type = 'staff' AND account_id = $1`,
        [adminId]
      );

      // Non-sensitive action still succeeds (user is still authenticated!)
      await request(app)
        .get('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Sensitive action fails with 403 REAUTH_REQUIRED
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ payment_upi_id: 'expired_elevation@upi' })
        .expect(403);

      expect(res.body.error.code).toBe(ErrorCodes.REAUTH_REQUIRED);
    });
  });

  describe('3. Step-Up OTP Verification Flow and Audit Log', () => {
    it('request-otp and verify-otp elevates the session and writes audit_logs entry', async () => {
      const token = await loginAdmin(true);

      // Expire elevation
      await query(
        `UPDATE sessions SET elevated_until = now() - interval '5 minutes' WHERE account_type = 'staff' AND account_id = $1`,
        [adminId]
      );

      // Clear otp_requests for staff to avoid 60s cooldown
      await query('DELETE FROM otp_requests WHERE email = $1', [adminEmail]);
      testOtpStore.clear();

      // Request step-up OTP
      const reqRes = await request(app)
        .post('/api/v1/staff/auth/step-up/request-otp')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(reqRes.body.data.message).toContain('sent to your email');

      const otp = testOtpStore.get(adminEmail);
      expect(otp).toBeDefined();

      // Verify step-up OTP
      const verifyRes = await request(app)
        .post('/api/v1/staff/auth/step-up/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ otp })
        .expect(200);

      expect(verifyRes.body.data.message).toContain('Session elevated successfully');
      expect(verifyRes.body.data.elevatedUntil).toBeDefined();

      // Check session table elevated_until is refreshed to ~1h in future
      const sessionRow = await query(
        `SELECT elevated_until FROM sessions WHERE account_type = 'staff' AND account_id = $1`,
        [adminId]
      );
      const elevatedUntil = new Date(sessionRow.rows[0].elevated_until).getTime();
      expect(elevatedUntil - Date.now()).toBeGreaterThan(50 * 60 * 1000);

      // Sensitive action now succeeds!
      await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ payment_upi_id: 'elevated@upi' })
        .expect(200);

      // Check audit_logs for action 'step_up'
      const auditRes = await query(
        `SELECT * FROM audit_logs WHERE staff_id = $1 AND action = 'step_up'`,
        [adminId]
      );
      expect(auditRes.rows.length).toBe(1);
      expect(auditRes.rows[0].target_type).toBe('session');
    });

    it('wrong step-up OTP fails with INVALID_OTP; 5 failures lock it out', async () => {
      const token = await loginAdmin(true);

      // Expire elevation
      await query(
        `UPDATE sessions SET elevated_until = now() - interval '1 second' WHERE account_type = 'staff' AND account_id = $1`,
        [adminId]
      );

      await query('DELETE FROM otp_requests WHERE email = $1', [adminEmail]);
      testOtpStore.clear();

      await request(app)
        .post('/api/v1/staff/auth/step-up/request-otp')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const correctOtp = testOtpStore.get(adminEmail)!;

      // 5 wrong attempts
      for (let i = 0; i < 5; i++) {
        const failRes = await request(app)
          .post('/api/v1/staff/auth/step-up/verify-otp')
          .set('Authorization', `Bearer ${token}`)
          .send({ otp: '000000' })
          .expect(400);

        expect(failRes.body.error.code).toBe(ErrorCodes.INVALID_OTP);
      }

      // 6th attempt with correct OTP fails because locked out
      const lockedRes = await request(app)
        .post('/api/v1/staff/auth/step-up/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ otp: correctOtp })
        .expect(400);

      expect(lockedRes.body.error.code).toBe(ErrorCodes.INVALID_OTP);
    });
  });

  describe('4. Every Protected Action Group Enforces Elevation', () => {
    let token: string;
    let targetUserId: string;
    let targetEmployeeId: string;
    const targetMatchId = '1';

    beforeEach(async () => {
      token = await loginAdmin(true);

      // Create a test user for balance adjustment and deletion
      const uRes = await query(
        `INSERT INTO users (email, name, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
         VALUES ('victim@example.com', 'Victim User', '9123456789', '112233', 'Victim', 'v@upi', '2000-01-01', 'VICTIM01')
         RETURNING id`
      );
      targetUserId = uRes.rows[0].id.toString();

      // Create a test employee
      const empRes = await query(
        `INSERT INTO staff (role, name, email, mobile) VALUES ('employee', 'Target Emp', 'target_emp@booyah.win', '9888877777') RETURNING id`
      );
      targetEmployeeId = empRes.rows[0].id.toString();

      // Expire elevation for the admin session
      await query(
        `UPDATE sessions SET elevated_until = now() - interval '1 second' WHERE account_type = 'staff' AND account_id = $1`,
        [adminId]
      );
    });

    it('Group 1: Payment settings require elevation', async () => {
      // UPI ID setting
      const res1 = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ payment_upi_id: 'new_blocked@upi' })
        .expect(403);
      expect(res1.body.error.code).toBe(ErrorCodes.REAUTH_REQUIRED);

      // Payment QR upload
      const res2 = await request(app)
        .post('/api/v1/admin/settings/payment-qr')
        .set('Authorization', `Bearer ${token}`)
        .attach('qr_image', Buffer.from('fake png image data'), 'qr.png')
        .expect(403);
      expect(res2.body.error.code).toBe(ErrorCodes.REAUTH_REQUIRED);
    });

    it('Group 2: Maintenance and Cashback settings require elevation', async () => {
      // Maintenance toggle
      const res1 = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ maintenance_enabled: true })
        .expect(403);
      expect(res1.body.error.code).toBe(ErrorCodes.REAUTH_REQUIRED);

      // Cashback max percent
      const res2 = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ cashback_max_percent: '10' })
        .expect(403);
      expect(res2.body.error.code).toBe(ErrorCodes.REAUTH_REQUIRED);
    });

    it('Group 3: User balance adjustment requires elevation', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/users/${targetUserId}/adjust`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletType: 'deposit',
          amountPaise: 500,
          direction: 'credit',
          reason: 'Test adjustment',
        })
        .expect(403);

      expect(res.body.error.code).toBe(ErrorCodes.REAUTH_REQUIRED);
    });

    it('Group 4: User deletion requires elevation', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.error.code).toBe(ErrorCodes.REAUTH_REQUIRED);
    });

    it('Group 5: Employee create, edit, delete require elevation', async () => {
      // Create employee
      const resCreate = await request(app)
        .post('/api/v1/admin/employees')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'New Emp',
          email: 'new_emp_blocked@booyah.win',
          mobile: '9777766666',
        })
        .expect(403);
      expect(resCreate.body.error.code).toBe(ErrorCodes.REAUTH_REQUIRED);

      // Edit employee
      const resEdit = await request(app)
        .patch(`/api/v1/admin/employees/${targetEmployeeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renamed Emp' })
        .expect(403);
      expect(resEdit.body.error.code).toBe(ErrorCodes.REAUTH_REQUIRED);

      // Delete employee
      const resDelete = await request(app)
        .delete(`/api/v1/admin/employees/${targetEmployeeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(resDelete.body.error.code).toBe(ErrorCodes.REAUTH_REQUIRED);
    });

    it('Group 6: Match result reversal requires elevation', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/results/${targetMatchId}/reverse`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Admin reversed result' })
        .expect(403);

      expect(res.body.error.code).toBe(ErrorCodes.REAUTH_REQUIRED);
    });
  });
});
