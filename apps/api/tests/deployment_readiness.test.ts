import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import { createApp } from '../src/app.js';
import { validateProductionEnv } from '../src/config/index.js';
import { redactPaths } from '../src/utils/logger.js';
import * as dbModule from '../src/db/index.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

describe('Milestone 8.5 Deployment Readiness', () => {
  describe('Production Startup Validation (validateProductionEnv)', () => {
    const validEnv: Record<string, string> = {
      DATABASE_URL: 'postgresql://postgres:secretpassword@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
      JWT_SECRET: 'a_very_secure_jwt_secret_that_has_more_than_32_characters_12345678',
      OTP_HMAC_SECRET: 'a_very_secure_otp_hmac_secret_that_has_more_than_32_characters_123',
      FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      CORS_ORIGINS: 'https://booyahwin.com,https://staff.booyahwin.com',
      SUPABASE_URL: 'https://xyzcompany.supabase.co',
      SUPABASE_SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_secret_service_key',
      GMAIL_USER: 'service-mailer@booyahwin.com',
      GMAIL_APP_PASSWORD: 'abcdefghijklmnop',
      CRON_SECRET: 'cron_super_secret_token_1234567890_abcdefg',
      FILE_URL_SECRET: 'a_very_secure_file_url_secret_that_has_more_than_32_characters_123',
    };

    it('passes when all environment variables are present and valid', () => {
      expect(() => validateProductionEnv(validEnv)).not.toThrow();
    });

    it('fails when DATABASE_URL is missing', () => {
      const env = { ...validEnv, DATABASE_URL: '' };
      expect(() => validateProductionEnv(env)).toThrowError(/DATABASE_URL/);
    });

    it('fails and explicitly refuses transaction pooler port :6543 with a clear message', () => {
      const env = {
        ...validEnv,
        DATABASE_URL: 'postgresql://postgres:pass@aws-0.pooler.supabase.com:6543/postgres',
      };
      expect(() => validateProductionEnv(env)).toThrowError(
        /DATABASE_URL must use the Supabase session pooler on port 5432, not transaction pooler \(:6543\)/
      );
    });

    it('fails when JWT_SECRET is shorter than 32 characters and never prints the secret', () => {
      const shortSecret = 'too_short_jwt';
      const env = { ...validEnv, JWT_SECRET: shortSecret };
      let thrownMessage = '';
      try {
        validateProductionEnv(env);
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toMatch(/JWT_SECRET/);
      expect(thrownMessage).not.toContain(shortSecret);
    });

    it('fails when OTP_HMAC_SECRET is shorter than 32 characters and never prints the secret', () => {
      const shortSecret = 'short_otp_secret';
      const env = { ...validEnv, OTP_HMAC_SECRET: shortSecret };
      let thrownMessage = '';
      try {
        validateProductionEnv(env);
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toMatch(/OTP_HMAC_SECRET/);
      expect(thrownMessage).not.toContain(shortSecret);
    });

    it('fails when FILE_URL_SECRET is shorter than 32 characters and never prints the secret', () => {
      const shortSecret = 'short_file_secret';
      const env = { ...validEnv, FILE_URL_SECRET: shortSecret };
      let thrownMessage = '';
      try {
        validateProductionEnv(env);
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toMatch(/FILE_URL_SECRET/);
      expect(thrownMessage).not.toContain(shortSecret);
    });

    it('fails when FIELD_ENCRYPTION_KEY is missing or not 32 bytes base64', () => {
      const envMissing = { ...validEnv, FIELD_ENCRYPTION_KEY: '' };
      expect(() => validateProductionEnv(envMissing)).toThrowError(/FIELD_ENCRYPTION_KEY/);

      const envInvalidLen = {
        ...validEnv,
        FIELD_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64'),
      };
      expect(() => validateProductionEnv(envInvalidLen)).toThrowError(/FIELD_ENCRYPTION_KEY/);
    });

    it('fails when CORS_ORIGINS contains wildcard *', () => {
      const envWildcard = { ...validEnv, CORS_ORIGINS: 'https://booyahwin.com,*' };
      expect(() => validateProductionEnv(envWildcard)).toThrowError(/CORS_ORIGINS/);

      const envAll = { ...validEnv, CORS_ORIGINS: '*' };
      expect(() => validateProductionEnv(envAll)).toThrowError(/CORS_ORIGINS/);
    });

    it('fails when SUPABASE_URL or SUPABASE_SERVICE_KEY is missing', () => {
      expect(() => validateProductionEnv({ ...validEnv, SUPABASE_URL: '' })).toThrowError(/SUPABASE_URL/);
      expect(() => validateProductionEnv({ ...validEnv, SUPABASE_SERVICE_KEY: '' })).toThrowError(
        /SUPABASE_SERVICE_KEY/
      );
    });

    it('fails when GMAIL_USER or GMAIL_APP_PASSWORD is missing', () => {
      expect(() => validateProductionEnv({ ...validEnv, GMAIL_USER: '' })).toThrowError(/GMAIL_USER/);
      expect(() => validateProductionEnv({ ...validEnv, GMAIL_APP_PASSWORD: '' })).toThrowError(
        /GMAIL_APP_PASSWORD/
      );
    });

    it('fails when CRON_SECRET is missing', () => {
      expect(() => validateProductionEnv({ ...validEnv, CRON_SECRET: '' })).toThrowError(/CRON_SECRET/);
    });
  });

  describe('GET /health Endpoint', () => {
    it('returns 200 with status ok and connected database when pool is healthy', async () => {
      const app = createApp();
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
      expect(res.body.timestamp).toBeDefined();

      // Asserts response contains zero secrets or database connection strings
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('password');
      expect(bodyStr).not.toContain('postgresql://');
      expect(bodyStr).not.toContain('postgres');
    });

    it('returns 503 with status error and disconnected database when database query fails', async () => {
      const querySpy = vi.spyOn(dbModule, 'query').mockRejectedValueOnce(new Error('Connection terminated'));
      const app = createApp();
      const res = await request(app).get('/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('error');
      expect(res.body.database).toBe('disconnected');
      expect(res.body.timestamp).toBeDefined();

      querySpy.mockRestore();
    });
  });

  describe('Database Lock and Query Timeout Error Mapping (55P03 & 57014)', () => {
    it('maps PostgreSQL lock_not_available 55P03 to HTTP 503 DATABASE_BUSY', () => {
      const req: any = { path: '/test-lock-timeout' };
      let statusCode = 0;
      let jsonBody: any = null;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              jsonBody = body;
            },
          };
        },
      };

      const err: any = new Error('canceling statement due to lock timeout');
      err.code = '55P03';

      errorHandler(err, req, res, vi.fn());

      expect(statusCode).toBe(503);
      expect(jsonBody.error).toBeDefined();
      expect(jsonBody.error.code).toBe('DATABASE_BUSY');
      expect(jsonBody.error.message).toMatch(/Database server is busy\. Please retry shortly\./);
    });

    it('maps PostgreSQL query_canceled 57014 to HTTP 503 DATABASE_BUSY', () => {
      const req: any = { path: '/test-statement-timeout' };
      let statusCode = 0;
      let jsonBody: any = null;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              jsonBody = body;
            },
          };
        },
      };

      const err: any = new Error('canceling statement due to statement timeout');
      err.code = '57014';

      errorHandler(err, req, res, vi.fn());

      expect(statusCode).toBe(503);
      expect(jsonBody.error).toBeDefined();
      expect(jsonBody.error.code).toBe('DATABASE_BUSY');
      expect(jsonBody.error.message).toMatch(/Database server is busy\. Please retry shortly\./);
    });
  });

  describe('Pino Logger Redaction', () => {
    it('redacts tokens, OTPs, Authorization headers, passwords, PAN, Aadhaar, UPI IDs, and screenshot paths', () => {
      let loggedOutput = '';
      const destination = {
        write: (str: string) => {
          loggedOutput += str;
        },
      };

      const testLogger = pino(
        {
          redact: {
            paths: redactPaths,
            censor: '[Redacted]',
          },
        },
        destination as any
      );

      const sensitivePayload = {
        token: 'super_secret_jwt_token',
        registrationToken: 'secret_reg_token',
        refreshToken: 'secret_refresh_token',
        otp: '987654',
        code_hash: 'secret_hash_abc123',
        password: 'mySecretPassword!23',
        appPassword: 'google_app_password',
        pan: 'ABCDE1234F',
        pan_enc: 'encrypted_pan_bytes',
        aadhaar: '123412341234',
        aadhaar_enc: 'encrypted_aadhaar_bytes',
        upiId: 'user@bank',
        upi_id: 'user2@bank',
        screenshotUrl: 'https://bucket.supabase.co/screenshots/secret1.png',
        screenshotPath: '/var/uploads/secret1.png',
        file_key: 'screenshots/abc.png',
        headers: {
          authorization: 'Bearer secret_auth_header',
        },
      };

      testLogger.info(sensitivePayload, 'Audit test entry');

      // None of the sensitive plaintexts should appear in loggedOutput
      expect(loggedOutput).not.toContain('super_secret_jwt_token');
      expect(loggedOutput).not.toContain('secret_reg_token');
      expect(loggedOutput).not.toContain('secret_refresh_token');
      expect(loggedOutput).not.toContain('987654');
      expect(loggedOutput).not.toContain('secret_hash_abc123');
      expect(loggedOutput).not.toContain('mySecretPassword!23');
      expect(loggedOutput).not.toContain('google_app_password');
      expect(loggedOutput).not.toContain('ABCDE1234F');
      expect(loggedOutput).not.toContain('encrypted_pan_bytes');
      expect(loggedOutput).not.toContain('123412341234');
      expect(loggedOutput).not.toContain('encrypted_aadhaar_bytes');
      expect(loggedOutput).not.toContain('user@bank');
      expect(loggedOutput).not.toContain('user2@bank');
      expect(loggedOutput).not.toContain('https://bucket.supabase.co/screenshots/secret1.png');
      expect(loggedOutput).not.toContain('/var/uploads/secret1.png');
      expect(loggedOutput).not.toContain('screenshots/abc.png');
      expect(loggedOutput).not.toContain('Bearer secret_auth_header');

      // The censor string should be present
      expect(loggedOutput).toContain('[Redacted]');
    });
  });
});
