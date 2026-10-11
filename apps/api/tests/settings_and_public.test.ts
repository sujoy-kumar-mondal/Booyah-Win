import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { ErrorCodes } from '@booyah/shared';
import { createApp } from '../src/app.js';
import { query } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';
import { SettingsService } from '../src/modules/admin/settings/settings.service.js';
import crypto from 'crypto';

const app = createApp({ enableRateLimiting: false });

describe('Settings, Support & Payment Info (Sections 16.5, 14, 7.1)', () => {
  let adminToken: string;
  let employeeToken: string;

  beforeEach(async () => {
    await truncateAllTables();
    await SettingsService.seedDefaults();

    // Admin setup
    const adminRes = await query(
      `INSERT INTO staff (role, name, email, mobile) VALUES ('admin', 'Admin', 'admin@bw.in', '9999999999') RETURNING id`
    );
    const adminId = adminRes.rows[0].id.toString();
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
      `INSERT INTO staff (role, name, email, mobile) VALUES ('employee', 'Emp', 'emp@bw.in', '9888888888') RETURNING id`
    );
    const empId = empRes.rows[0].id.toString();
    const empSid = crypto.randomUUID();
    await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'staff', $2)`, [
      empSid,
      empId,
    ]);
    employeeToken = signSessionToken(
      { sub: empId, typ: 'staff', sid: empSid, role: 'employee' },
      '12h'
    );
  });

  describe('Public /support Endpoint (Section 14)', () => {
    it('returns shared support details without exposing individual employee phone numbers', async () => {
      const res = await request(app).get('/api/v1/support').expect(200);

      expect(res.body.data.supportName).toBeDefined();
      expect(res.body.data.supportHours).toBe('10:00 AM - 10:00 PM IST');
      expect(res.body.data.supportPhone).toBe(''); // Empty until configured
      // Item 8: No extra URLs on support endpoint
      expect(res.body.data.faq_url).toBeUndefined();
      expect(res.body.data.terms_url).toBeUndefined();
      expect(res.body.data.rules_url).toBeUndefined();
    });
  });

  describe('Public /payment-info Endpoint (Section 7.1 & Change #1)', () => {
    it('returns configured: false when payment_upi_id is empty', async () => {
      const res = await request(app).get('/api/v1/payment-info').expect(200);

      expect(res.body.data.configured).toBe(false);
      expect(res.body.data.message).toBe('Payment information not configured yet');
      expect(res.body.data.minDeposit).toBe('10.00');
      expect(res.body.data.maxDeposit).toBe('5000.00');
    });
  });

  describe('Admin Settings Management & Role Guards', () => {
    it('rejects regular employee from accessing /admin/settings with 403', async () => {
      await request(app)
        .get('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);

      await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ min_deposit: '20.00' })
        .expect(403);
    });

    it('returns default settings keys: min_deposit, max_deposit, and admin_approval_threshold', async () => {
      const res = await request(app)
        .get('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const settings = res.body.data.settings;
      expect(settings.min_deposit).toBe('10.00');
      expect(settings.max_deposit).toBe('5000.00');
      expect(settings.admin_approval_threshold).toBe('2000.00');
    });

    it('rejects invalid UPI format when admin sets it', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_upi_id: 'invalid-upi-without-at' })
        .expect(400);

      expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('Rule #7: rejects non-HTTPS URL for payment_qr_url', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_qr_url: 'http://insecure-http.com/qr.png' })
        .expect(400);

      expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('rejects max_deposit less than min_deposit', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ min_deposit: '500.00', max_deposit: '100.00' })
        .expect(400);

      expect(res.body.error.message).toMatch(/cannot be less than minimum deposit/);
    });

    it('updates settings, writes audit log, and activates /payment-info', async () => {
      const updateRes = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          payment_upi_id: 'booyahwin@oksbi',
          payment_qr_url: 'https://cdn.booyah.win/qr.png',
          support_name: 'Official Booyah Helpdesk',
          support_phone: '9876543210',
          support_email: 'help@booyah.win',
          min_deposit: '25.00',
        })
        .expect(200);

      expect(updateRes.body.data.settings.payment_upi_id).toBe('booyahwin@oksbi');
      expect(updateRes.body.data.settings.min_deposit).toBe('25.00');

      // Audit log was inserted in the same transaction
      const audit = await query(
        `SELECT action, target_type, details FROM audit_logs WHERE action = 'settings_updated'`
      );
      expect(audit.rowCount).toBe(1);
      expect(audit.rows[0].details.updatedKeys).toContain('payment_upi_id');

      // /api/v1/payment-info is now configured = true
      const infoRes = await request(app).get('/api/v1/payment-info').expect(200);
      expect(infoRes.body.data.configured).toBe(true);
      expect(infoRes.body.data.paymentUpiId).toBe('booyahwin@oksbi');
      expect(infoRes.body.data.paymentQrUrl).toBe('https://cdn.booyah.win/qr.png');
      expect(infoRes.body.data.minDeposit).toBe('25.00');
    });
  });
});
