import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { ErrorCodes } from '@booyah/shared';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { truncateAllTables } from './setup.js';

describe('Security Middleware: Helmet, CORS, and Rate Limiting', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  describe('Helmet Security Headers', () => {
    it('sets standard security headers on HTTP responses', async () => {
      const app = createApp({ enableRateLimiting: false });
      const res = await request(app).get('/health').expect(200);

      // Verify essential Helmet headers
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-download-options']).toBe('noopen');
      expect(res.headers['x-permitted-cross-domain-policies']).toBe('none');
    });
  });

  describe('CORS Allowlist', () => {
    it('allows requests from origins in CORS_ORIGINS with appropriate headers', async () => {
      const app = createApp({ enableRateLimiting: false });
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not reflect access-control-allow-origin for unauthorized origins', async () => {
      const app = createApp({ enableRateLimiting: false });
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://unauthorized-attacker.com')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Global Rate Limiter', () => {
    it('limits requests exceeding threshold and returns 429 RATE_LIMITED', async () => {
      // Create app instance with a low limit of 5 requests for deterministic testing
      const app = createApp({
        enableRateLimiting: true,
        globalRateLimitMax: 5,
        globalRateLimitWindowMs: 60 * 1000,
      });

      // 5 requests succeed
      for (let i = 0; i < 5; i++) {
        await request(app).get('/health').expect(200);
      }

      // 6th request fails with 429
      const res = await request(app).get('/health').expect(429);
      expect(res.body.error.code).toBe(ErrorCodes.RATE_LIMITED);
    });

    it('isolates rate-limit counters by client IP when behind reverse proxy (X-Forwarded-For)', async () => {
      const app = createApp({
        enableRateLimiting: true,
        globalRateLimitMax: 3,
        globalRateLimitWindowMs: 60 * 1000,
      });

      const clientIp1 = '203.0.113.195';
      const clientIp2 = '198.51.100.20';

      // 3 requests from Client 1 exhaust its quota
      for (let i = 0; i < 3; i++) {
        await request(app)
          .get('/health')
          .set('X-Forwarded-For', clientIp1)
          .expect(200);
      }

      // 4th request from Client 1 fails with 429
      const blockedRes = await request(app)
        .get('/health')
        .set('X-Forwarded-For', clientIp1)
        .expect(429);
      expect(blockedRes.body.error.code).toBe(ErrorCodes.RATE_LIMITED);

      // Client 2 with a different X-Forwarded-For IP has its own counter and succeeds
      await request(app)
        .get('/health')
        .set('X-Forwarded-For', clientIp2)
        .expect(200);
    });
  });

  describe('Per-IP OTP Rate Limiter (20 per hour)', () => {
    it('blocks more than 20 OTP requests from the same IP with 429 OTP_RATE_LIMITED', async () => {
      const app = createApp({
        enableRateLimiting: true,
      });

      // Send 20 requests with distinct emails so email-based limits are not triggered
      for (let i = 1; i <= 20; i++) {
        await request(app)
          .post('/api/v1/auth/login/request-otp')
          .send({ email: `ip_limit_user_${i}@example.com` })
          .expect(200);
      }

      // 21st request from same IP must be blocked by the IP limiter
      const res21 = await request(app)
        .post('/api/v1/auth/login/request-otp')
        .send({ email: 'ip_limit_user_21@example.com' })
        .expect(429);

      expect(res21.body.error.code).toBe(ErrorCodes.OTP_RATE_LIMITED);
      expect(res21.body.error.message).toMatch(/Too many OTP requests from this IP/);
    });
  });

  describe('PostgreSQL Check Constraint (23514) Error Mapping', () => {
    it('maps wallets check constraints to 402 LOW_BALANCE', () => {
      const walletConstraints = [
        'wallets_add_money_check',
        'wallets_cashback_check',
        'wallets_winning_check',
      ];

      for (const constraint of walletConstraints) {
        const req: any = { path: '/api/v1/wallet/mock' };
        const res: any = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn(),
        };

        errorHandler({ code: '23514', constraint }, req, res, vi.fn());

        expect(res.status).toHaveBeenCalledWith(402);
        expect(res.json).toHaveBeenCalledWith({
          error: {
            code: ErrorCodes.LOW_BALANCE,
            message: 'Low balance, please add money',
            details: {},
          },
        });
      }
    });

    it('maps non-wallet check constraints to 400 VALIDATION_ERROR', () => {
      const otherConstraints = [
        'deposit_requests_amount_check',
        'withdrawal_requests_amount_check',
        'entry_tiers_entry_fee_check',
      ];

      for (const constraint of otherConstraints) {
        const req: any = { path: '/api/v1/other/mock' };
        const res: any = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn(),
        };

        errorHandler({ code: '23514', constraint }, req, res, vi.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Validation error: constraint check failed',
            details: {},
          },
        });
      }
    });
  });
});

