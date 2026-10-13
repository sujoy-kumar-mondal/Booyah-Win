import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { ErrorCodes } from '@booyah/shared';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';
import { SettingsService } from '../src/modules/admin/settings/settings.service.js';
import {
  DAILY_USER_DETAIL_VIEW_CAP,
  EMPLOYEE_USER_PROFILE_ALLOWLIST,
  maskMobile,
  maskUpiId,
} from '../src/modules/staff/users/staff.users.service.js';
import crypto from 'crypto';

describe('Staff Users & Activity (Requirements 3, 4, 5)', () => {
  const app = createApp({ enableRateLimiting: false });
  let adminToken: string;
  let adminId: string;
  let employeeToken: string;
  let employeeId: string;
  let testUserId: string;

  beforeEach(async () => {
    await truncateAllTables();
    await SettingsService.seedDefaults();

    // Admin setup
    const adminRes = await query(
      `INSERT INTO staff (role, name, email, mobile) VALUES ('admin', 'Admin User', 'admin@bw.in', '9999999999') RETURNING id`
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

    // Employee setup
    const empRes = await query(
      `INSERT INTO staff (role, name, email, mobile) VALUES ('employee', 'Staff Employee', 'emp@bw.in', '9888888888') RETURNING id`
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

    // User setup
    const userRes = await query(
      `INSERT INTO users (name, email, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
       VALUES ('John Doe', 'john@example.com', '9876547890', '12345678', 'JohnnyFF', 'merchant1234@upi', '1995-05-15', 'REFJOHND')
       RETURNING id`
    );
    testUserId = userRes.rows[0].id.toString();

    // Create wallet for test user
    await query(
      `INSERT INTO wallets (user_id, add_money, cashback, winning) VALUES ($1, 50.00, 0.00, 100.00)`,
      [testUserId]
    );
  });

  describe('Requirement 4: Pure Masking Functions and Formats', () => {
    it('masks mobile number to show only the last 4 digits ("******7890")', () => {
      expect(maskMobile('9876547890')).toBe('******7890');
      expect(maskMobile('+919876547890')).toBe('******7890');
      expect(maskMobile('1234')).toBe('1234');
      expect(maskMobile('')).toBe('');
    });

    it('masks UPI ID to show only last 4 chars of part before @ and preserves handle ("****1234@upi")', () => {
      expect(maskUpiId('merchant1234@upi')).toBe('****1234@upi');
      expect(maskUpiId('abcd1234@okhdfcbank')).toBe('****1234@okhdfcbank');
    });

    it('masks the whole local part when it is 4 characters or shorter', () => {
      expect(maskUpiId('abc@upi')).toBe('***@upi');
      expect(maskUpiId('ab@upi')).toBe('**@upi');
      expect(maskUpiId('a@upi')).toBe('*@upi');
      expect(maskUpiId('1234@upi')).toBe('****@upi');
    });

    it('allows searching by a full mobile number while returning masked results', async () => {
      const res = await request(app)
        .get('/api/v1/staff/users?q=9876547890')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(res.body.data.items).toHaveLength(1);
      const user = res.body.data.items[0];
      expect(user.id).toBe(testUserId);
      expect(user.mobile).toBe('******7890');
      expect(user.upiId).toBe('****1234@upi');
    });
  });

  describe('Requirement 5: Explicit Field Allowlist Enforcement', () => {
    it('employee user list and detail only contain allowlisted fields', async () => {
      const listRes = await request(app)
        .get('/api/v1/staff/users')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(listRes.body.data.items.length).toBeGreaterThan(0);
      const listItem = listRes.body.data.items[0];

      // Assert each key is in allowlist
      for (const key of Object.keys(listItem)) {
        expect(
          EMPLOYEE_USER_PROFILE_ALLOWLIST.includes(key as any),
          `Key "${key}" in user list item is NOT in EMPLOYEE_USER_PROFILE_ALLOWLIST`
        ).toBe(true);
      }

      // Assert sensitive fields are NEVER present
      expect(listItem.dateOfBirth).toBeUndefined();
      expect(listItem.date_of_birth).toBeUndefined();
      expect(listItem.referredBy).toBeUndefined();
      expect(listItem.referred_by).toBeUndefined();
      expect(listItem.pan).toBeUndefined();
      expect(listItem.aadhaar).toBeUndefined();

      // Detail endpoint
      const detailRes = await request(app)
        .get(`/api/v1/staff/users/${testUserId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      const profile = detailRes.body.data.profile;
      for (const key of Object.keys(profile)) {
        expect(
          EMPLOYEE_USER_PROFILE_ALLOWLIST.includes(key as any),
          `Key "${key}" in user detail profile is NOT in EMPLOYEE_USER_PROFILE_ALLOWLIST`
        ).toBe(true);
      }
      expect(profile.dateOfBirth).toBeUndefined();
      expect(profile.referredBy).toBeUndefined();
    });
  });

  describe('Requirement 3: Audit user_viewed & Daily Cap on Distinct User Detail Views', () => {
    it('logs user_viewed audit log for both employee and admin view of user detail', async () => {
      // Employee view
      await request(app)
        .get(`/api/v1/staff/users/${testUserId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      const empAudit = await query(
        `SELECT * FROM audit_logs WHERE action = 'user_viewed' AND staff_id = $1`,
        [employeeId]
      );
      expect(empAudit.rowCount).toBe(1);
      expect(empAudit.rows[0].target_id).toBe(testUserId);
      expect(empAudit.rows[0].target_type).toBe('user');

      // Admin view
      await request(app)
        .get(`/api/v1/staff/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const adminAudit = await query(
        `SELECT * FROM audit_logs WHERE action = 'user_viewed' AND staff_id = $1`,
        [adminId]
      );
      expect(adminAudit.rowCount).toBe(1);
      expect(adminAudit.rows[0].target_id).toBe(testUserId);
    });

    it('enforces daily cap of 300 distinct user views per employee returning RATE_LIMITED and auditing user_view_limit_exceeded', async () => {
      expect(DAILY_USER_DETAIL_VIEW_CAP).toBe(300);

      // Seed 300 existing distinct user views for today for this employee
      const entries = [];
      for (let i = 1000; i < 1300; i++) {
        entries.push(
          `(${employeeId}, 'user_viewed', 'user', '${i}', '{"distinctIndex": ${i}}', now())`
        );
      }
      await query(
        `INSERT INTO audit_logs (staff_id, action, target_type, target_id, details, created_at) VALUES ${entries.join(
          ','
        )}`
      );

      // Now the employee has viewed 300 distinct users today.
      // Trying to view testUserId (a 301st distinct user) must return 429 RATE_LIMITED
      const res = await request(app)
        .get(`/api/v1/staff/users/${testUserId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(429);

      expect(res.body.error.code).toBe(ErrorCodes.RATE_LIMITED);

      // Check audit log for user_view_limit_exceeded
      const capAudit = await query(
        `SELECT * FROM audit_logs WHERE action = 'user_view_limit_exceeded' AND staff_id = $1`,
        [employeeId]
      );
      expect(capAudit.rowCount).toBe(1);
      expect(capAudit.rows[0].target_id).toBe(testUserId);

      // However, re-viewing an already viewed user ID within the 300 does NOT exceed the distinct cap
      // Let's create user 1000 in DB
      await query(
        `INSERT INTO users (id, name, email, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code)
         VALUES (1000, 'User 1000', 'u1000@bw.in', '9111111000', '1111000', 'Pro1000', 'u1000@upi', '2000-01-01', 'REF1000')`
      );
      await query(
        `INSERT INTO wallets (user_id, add_money, cashback, winning) VALUES (1000, 0, 0, 0)`
      );

      const reViewRes = await request(app)
        .get('/api/v1/staff/users/1000')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(reViewRes.body.data.profile.id).toBe('1000');
    });

    it('does NOT enforce the daily view cap on administrators', async () => {
      // Seed 305 distinct views for admin
      const entries = [];
      for (let i = 2000; i < 2305; i++) {
        entries.push(
          `(${adminId}, 'user_viewed', 'user', '${i}', '{"distinctIndex": ${i}}', now())`
        );
      }
      await query(
        `INSERT INTO audit_logs (staff_id, action, target_type, target_id, details, created_at) VALUES ${entries.join(
          ','
        )}`
      );

      // Admin viewing testUserId still succeeds with 200
      const res = await request(app)
        .get(`/api/v1/staff/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.profile.id).toBe(testUserId);
    });
  });

  describe('Employee Permissions & Role Restrictions', () => {
    it('employee receives 403 FORBIDDEN on DELETE /admin/users/:id', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ reason: 'Cheating violation' })
        .expect(403);

      expect(res.body.error.code).toBe(ErrorCodes.FORBIDDEN);
    });

    it('employee receives 403 FORBIDDEN on POST /admin/users/:id/adjust', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/users/${testUserId}/adjust`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ wallet: 'add_money', amount: '10.00', reason: 'Test adjust' })
        .expect(403);

      expect(res.body.error.code).toBe(ErrorCodes.FORBIDDEN);
    });
  });
});
