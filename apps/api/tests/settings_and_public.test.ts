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
    it('uploads tournament match banner image and verifies via public /rules/match-rules', async () => {
      const TINY_PNG_BUFFER = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      // 1. Employee cannot upload match banner (403)
      await request(app)
        .post('/api/v1/admin/settings/match-banner')
        .set('Authorization', `Bearer ${employeeToken}`)
        .attach('banner', TINY_PNG_BUFFER, 'banner.png')
        .expect(403);

      // 2. Admin successfully uploads match banner
      const uploadRes = await request(app)
        .post('/api/v1/admin/settings/match-banner')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('banner', TINY_PNG_BUFFER, 'banner.png')
        .expect(200);

      expect(uploadRes.body.data.matchRulesImageKey).toBeDefined();
      expect(uploadRes.body.data.matchRulesImageUrl).toBeDefined();

      // 3. GET /api/v1/rules/match-rules reflects the newly uploaded image URL
      const rulesRes = await request(app).get('/api/v1/rules/match-rules').expect(200);
      expect(rulesRes.body.data.imageUrl).toContain(uploadRes.body.data.matchRulesImageKey);

      // 4. Admin deletes/resets tournament match banner
      await request(app)
        .delete('/api/v1/admin/settings/match-banner')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 5. GET /api/v1/rules/match-rules now returns empty imageUrl (falls back to default graphic)
      const afterResetRes = await request(app).get('/api/v1/rules/match-rules').expect(200);
      expect(afterResetRes.body.data.imageUrl).toBe('');
    });

    it('returns mode-specific rules for Clash Squad vs Battle Royale and allows admin to customize both', async () => {
      // 1. Query BR rules (default / explicit)
      const brRes = await request(app).get('/api/v1/rules/match-rules?gameMode=battle_royale').expect(200);
      expect(brRes.body.data.rulesEn).toContain('Horse [GHODA] is banned');
      expect(brRes.body.data.rulesEn).toContain('Double Vector & M79');

      // 2. Query CS rules
      const csRes = await request(app).get('/api/v1/rules/match-rules?gameMode=clash_squad').expect(200);
      expect(csRes.body.data.rulesEn).toContain('Room Structure:');
      expect(csRes.body.data.rulesEn).toContain('Default Coins : 9950');
      expect(csRes.body.data.rulesEn).toContain('Headshot rate must be below 70% in CS career');

      // 3. Admin updates Clash Squad rules
      await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          match_rules_cs_en: 'Custom Clash Squad Rules: Round 13 active',
          match_rules_cs_bn: 'কাস্টম ক্ল্যাশ স্কোয়াড নিয়মাবলী',
        })
        .expect(200);

      // 4. Verify updated CS rules returned via public endpoint
      const updatedCsRes = await request(app).get('/api/v1/rules/match-rules?gameMode=clash_squad').expect(200);
      expect(updatedCsRes.body.data.rulesEn).toBe('Custom Clash Squad Rules: Round 13 active');
      expect(updatedCsRes.body.data.rulesBn).toBe('কাস্টম ক্ল্যাশ স্কোয়াড নিয়মাবলী');
    });

    it('supports separate dedicated banners for Battle Royale and Clash Squad', async () => {
      const TINY_PNG_BUFFER = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      // 1. Upload Battle Royale banner
      const brUpload = await request(app)
        .post('/api/v1/admin/settings/match-banner?gameMode=battle_royale')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('banner', TINY_PNG_BUFFER, 'br_banner.png')
        .expect(200);

      // 2. Upload Clash Squad banner
      const csUpload = await request(app)
        .post('/api/v1/admin/settings/match-banner?gameMode=clash_squad')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('banner', TINY_PNG_BUFFER, 'cs_banner.png')
        .expect(200);

      expect(brUpload.body.data.matchRulesImageKey).toBeDefined();
      expect(csUpload.body.data.matchRulesImageKey).toBeDefined();
      expect(brUpload.body.data.matchRulesImageKey).not.toBe(csUpload.body.data.matchRulesImageKey);

      // 3. Verify public match-rules serves mode-specific banner
      const brRules = await request(app).get('/api/v1/rules/match-rules?gameMode=battle_royale').expect(200);
      const csRules = await request(app).get('/api/v1/rules/match-rules?gameMode=clash_squad').expect(200);

      expect(brRules.body.data.imageUrl).toContain(brUpload.body.data.matchRulesImageKey);
      expect(csRules.body.data.imageUrl).toContain(csUpload.body.data.matchRulesImageKey);
      expect(brRules.body.data.imageUrl).not.toBe(csRules.body.data.imageUrl);

      // 4. Reset CS banner only; BR banner must persist
      await request(app)
        .delete('/api/v1/admin/settings/match-banner?gameMode=clash_squad')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const csAfterReset = await request(app).get('/api/v1/rules/match-rules?gameMode=clash_squad').expect(200);
      const brAfterCsReset = await request(app).get('/api/v1/rules/match-rules?gameMode=battle_royale').expect(200);

      expect(csAfterReset.body.data.imageUrl).toBe('');
      expect(brAfterCsReset.body.data.imageUrl).toContain(brUpload.body.data.matchRulesImageKey);

      // 5. Reset BR banner
      await request(app)
        .delete('/api/v1/admin/settings/match-banner?gameMode=battle_royale')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const brAfterReset = await request(app).get('/api/v1/rules/match-rules?gameMode=battle_royale').expect(200);
      expect(brAfterReset.body.data.imageUrl).toBe('');
    });
  });
});
