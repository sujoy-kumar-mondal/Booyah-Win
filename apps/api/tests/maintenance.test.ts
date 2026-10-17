import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { ErrorCodes } from '@booyah/shared';
import { createApp } from '../src/app.js';
import { query, getPool } from '../src/db/index.js';
import { truncateAllTables } from './setup.js';
import { signSessionToken } from '../src/utils/crypto.js';
import { SettingsService } from '../src/modules/admin/settings/settings.service.js';
import { invalidateMaintenanceCache } from '../src/middleware/maintenance.js';
import { config } from '../src/config/index.js';
import crypto from 'crypto';

function extractExpressRoutes(app: any): Array<{ method: string; path: string }> {
  const routes: Array<{ method: string; path: string }> = [];

  function traverse(layer: any, basePath = '') {
    if (layer.route) {
      const routePath = (basePath + (layer.route.path === '/' ? '' : layer.route.path)) || '/';
      for (const m of Object.keys(layer.route.methods)) {
        routes.push({ method: m.toUpperCase(), path: routePath });
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      let mountPath = '';
      const match = layer.regexp?.source?.match(/^\^\\\/([a-zA-Z0-9_\-\\\/]+?)\\\/\?\(\?=\\\/\|\$\)/);
      if (match) {
        mountPath = '/' + match[1].replace(/\\\//g, '/').replace(/\\/g, '');
      }
      const nextBase = basePath + mountPath;
      for (const sub of layer.handle.stack) {
        traverse(sub, nextBase);
      }
    }
  }

  for (const layer of (app as any)._router.stack) {
    traverse(layer, '');
  }
  return routes;
}

describe('Maintenance Mode (Requirements 1, 2, 6, 9, 10)', () => {
  const app = createApp({ enableRateLimiting: false });
  let adminToken: string;
  let userToken: string;
  let userId: string;

  beforeEach(async () => {
    invalidateMaintenanceCache();
    await truncateAllTables();
    await SettingsService.seedDefaults();

    // Setup Admin
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

    // Setup User
    const userRes = await query(
      `INSERT INTO users (name, email, mobile, ff_id, ff_name, upi_id, date_of_birth, referral_code) VALUES ('Test User', 'user@bw.in', '9876543210', '12345678', 'TestPro', 'user@upi', '2000-01-01', 'REF12345') RETURNING id`
    );
    userId = userRes.rows[0].id.toString();
    const userSid = crypto.randomUUID();
    await query(`INSERT INTO sessions (id, account_type, account_id) VALUES ($1, 'user', $2)`, [
      userSid,
      userId,
    ]);
    userToken = signSessionToken(
      { sub: userId, typ: 'user', sid: userSid },
      '12h'
    );
  });

  afterEach(() => {
    invalidateMaintenanceCache();
  });

  describe('Requirement 1: Real Router Table Classification & Exhaustive Iteration Test', () => {
    const ALLOWLISTED_AUTH_ROUTES = new Set([
      'POST /api/v1/auth/register/request-otp',
      'POST /api/v1/auth/register/verify-otp',
      'POST /api/v1/auth/register/complete',
      'POST /api/v1/auth/login/request-otp',
      'POST /api/v1/auth/login/verify-otp',
      'POST /api/v1/auth/logout',
      'PATCH /api/v1/me/language',
      'PATCH /api/v1/language',
      'PATCH /api/v1/users/me/language',
      'PATCH /api/v1/users/language',
    ]);

    it('iterates EVERY registered user-area POST, PATCH and DELETE route and asserts it is either allowlisted or returns 503 MAINTENANCE_MODE', async () => {
      // Enable maintenance mode
      await query(`UPDATE app_settings SET value = 'true' WHERE key = 'maintenance_enabled'`);
      invalidateMaintenanceCache();

      const allRoutes = extractExpressRoutes(app);

      // Filter for user-area mutating routes:
      // Must start with /api/v1, must NOT be admin, staff, internal, or public GET routes
      const mutatingUserRoutes = allRoutes.filter((r) => {
        const isMutating = ['POST', 'PATCH', 'DELETE'].includes(r.method);
        const isApiV1 = r.path.startsWith('/api/v1');
        const isStaffOrAdminOrInternal =
          r.path.startsWith('/api/v1/staff') ||
          r.path.startsWith('/api/v1/admin') ||
          r.path.startsWith('/api/v1/internal') ||
          r.path.startsWith('/internal');
        return isMutating && isApiV1 && !isStaffOrAdminOrInternal;
      });

      expect(mutatingUserRoutes.length).toBeGreaterThan(0);

      for (const route of mutatingUserRoutes) {
        const routeKey = `${route.method} ${route.path}`;

        if (ALLOWLISTED_AUTH_ROUTES.has(routeKey)) {
          // Allowlisted auth route must NOT return 503 MAINTENANCE_MODE
          let reqBuilder: any;
          if (route.method === 'POST') reqBuilder = request(app).post(route.path);
          else if (route.method === 'PATCH') reqBuilder = request(app).patch(route.path);
          else reqBuilder = request(app).delete(route.path);

          const res = await reqBuilder.send({});
          // It should fail with validation error or unauthenticated, but NOT 503 MAINTENANCE_MODE
          expect(res.status).not.toBe(503);
          expect(res.body?.error?.code).not.toBe(ErrorCodes.MAINTENANCE_MODE);
        } else {
          // Blocked user mutating route MUST return 503 MAINTENANCE_MODE
          // Replace params like :id with dummy "1"
          const testPath = route.path.replace(/:[a-zA-Z0-9_]+/g, '1');

          let reqBuilder: any;
          if (route.method === 'POST') reqBuilder = request(app).post(testPath);
          else if (route.method === 'PATCH') reqBuilder = request(app).patch(testPath);
          else reqBuilder = request(app).delete(testPath);

          reqBuilder.set('Authorization', `Bearer ${userToken}`);
          const res = await reqBuilder.send({});

          expect(
            res.status,
            `Route ${routeKey} (tested at ${testPath}) was expected to return 503 MAINTENANCE_MODE during maintenance, but returned ${res.status} (${JSON.stringify(res.body)})`
          ).toBe(503);

          expect(res.body.error?.code).toBe(ErrorCodes.MAINTENANCE_MODE);
        }
      }
    });

    it('allows read requests, login, logout, and registration during maintenance', async () => {
      await query(`UPDATE app_settings SET value = 'true' WHERE key = 'maintenance_enabled'`);
      invalidateMaintenanceCache();

      // Reads: GET /api/v1/me
      const profileRes = await request(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(profileRes.status).toBe(200);

      // Reads: GET /api/v1/matches
      const matchesRes = await request(app)
        .get('/api/v1/matches')
        .set('Authorization', `Bearer ${userToken}`);
      expect(matchesRes.status).toBe(200);

      // Reads: GET /api/v1/wallet/transactions
      const txnRes = await request(app)
        .get('/api/v1/wallet/transactions')
        .set('Authorization', `Bearer ${userToken}`);
      expect(txnRes.status).toBe(200);

      // Auth: POST /api/v1/auth/login/request-otp
      const otpRes = await request(app)
        .post('/api/v1/auth/login/request-otp')
        .send({ email: 'user@bw.in' });
      expect(otpRes.status).toBe(200);

      // Logout: POST /api/v1/auth/logout
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${userToken}`);
      expect(logoutRes.status).toBe(200);
    });

    it('allows user language update (PATCH /api/v1/me/language) during maintenance', async () => {
      await query(`UPDATE app_settings SET value = 'true' WHERE key = 'maintenance_enabled'`);
      invalidateMaintenanceCache();

      const langRes = await request(app)
        .patch('/api/v1/me/language')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ language: 'bn' });

      expect(langRes.status).toBe(200);
      expect(langRes.body?.data?.language).toBe('bn');
    });

    it('allows staff and admin mutating requests during maintenance', async () => {
      await query(`UPDATE app_settings SET value = 'true' WHERE key = 'maintenance_enabled'`);
      invalidateMaintenanceCache();

      // Admin patch settings
      const settingsRes = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maintenance_message: 'Updated maintenance message' });
      expect(settingsRes.status).toBe(200);
    });
  });

  describe('Requirement 2: Team Disband blocked for users, allowed for scheduler', () => {
    it('blocks user team disband (DELETE /matches/:id/teams/mine) during maintenance', async () => {
      await query(`UPDATE app_settings SET value = 'true' WHERE key = 'maintenance_enabled'`);
      invalidateMaintenanceCache();

      const res = await request(app)
        .delete('/api/v1/matches/1/teams/mine')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(503);

      expect(res.body.error.code).toBe(ErrorCodes.MAINTENANCE_MODE);
    });

    it('allows scheduler tick to run during maintenance mode', async () => {
      await query(`UPDATE app_settings SET value = 'true' WHERE key = 'maintenance_enabled'`);
      invalidateMaintenanceCache();

      const res = await request(app)
        .post('/api/v1/internal/jobs/tick')
        .set('x-cron-secret', config.CRON_SECRET)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  describe('Requirement 6: Validate maintenance_message and render plain text', () => {
    it('accepts maintenance_message containing <script> and stores it safely as plain text', async () => {
      const scriptMessage = '<script>alert("test")</script> Maintenance in progress.';
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maintenance_enabled: true,
          maintenance_message: scriptMessage,
        })
        .expect(200);

      expect(res.body.data.settings.maintenance_message).toBe(scriptMessage);

      // Check status endpoint returns raw plain text, not interpreted/stripped
      const statusRes = await request(app).get('/api/v1/status').expect(200);
      expect(statusRes.body.data.maintenance.message).toBe(scriptMessage);
      expect(statusRes.body.data.maintenance.enabled).toBe(true);
    });

    it('rejects maintenance_message longer than 300 characters', async () => {
      const longMessage = 'A'.repeat(301);
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maintenance_message: longMessage,
        })
        .expect(400);

      expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('rejects maintenance_message containing control characters', async () => {
      const badMessage = 'Under maintenance\x00\x08';
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maintenance_message: badMessage,
        })
        .expect(400);

      expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });
  });

  describe('Requirement 9: /status Rate Limit (60 req/min per IP) and Headers', () => {
    it('returns Cache-Control: no-store on /status', async () => {
      const res = await request(app).get('/api/v1/status').expect(200);
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.body.data.maintenance).toBeDefined();
    });

    it('returns unknown: true on /status when database is unreachable', async () => {
      invalidateMaintenanceCache();
      const pool = getPool();
      const poolSpy = vi.spyOn(pool, 'query').mockImplementationOnce(() => {
        throw new Error('Connection lost');
      });
      const res = await request(app).get('/api/v1/status').expect(200);
      expect(res.body.data.maintenance.unknown).toBe(true);
      expect(res.body.data.maintenance.enabled).toBe(false);
      poolSpy.mockRestore();
      invalidateMaintenanceCache();
    });

    it('rate limits GET /status to 60 req/min per IP and returns 429 with Retry-After', async () => {
      const rateLimitedApp = createApp({
        enableRateLimiting: true,
      });

      // 60 requests succeed
      for (let i = 0; i < 60; i++) {
        const res = await request(rateLimitedApp).get('/api/v1/status');
        expect(res.status).toBe(200);
      }

      // 61st request fails with 429 RATE_LIMITED
      const res = await request(rateLimitedApp).get('/api/v1/status');
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe(ErrorCodes.RATE_LIMITED);
      expect(res.headers['retry-after']).toBeDefined();
    });
  });

  describe('Requirement 10: In-Memory 5-second Cache and Immediate Invalidation on Admin Change', () => {
    it('takes effect immediately when an admin toggles maintenance without waiting 5 seconds or restarting', async () => {
      // Initially disabled
      const res1 = await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Valid Name' });
      expect(res1.status).not.toBe(503);

      // Admin turns maintenance ON
      await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maintenance_enabled: true })
        .expect(200);

      // Request is blocked IMMEDIATELY with 503 MAINTENANCE_MODE
      const res2 = await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Valid Name' })
        .expect(503);
      expect(res2.body.error.code).toBe(ErrorCodes.MAINTENANCE_MODE);

      // Admin turns maintenance OFF
      await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maintenance_enabled: false })
        .expect(200);

      // Request succeeds IMMEDIATELY without restart
      const res3 = await request(app)
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Valid Name' });
      expect(res3.status).not.toBe(503);
    });
  });
});
