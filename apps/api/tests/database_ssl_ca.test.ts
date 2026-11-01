import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveDatabaseSslCa } from '../src/config/index.js';
import {
  getDatabaseSslConfig,
  isUntrustedCertificateError,
  assertDatabaseConnection,
  UNTRUSTED_CERT_SAFE_REASON,
} from '../src/db/index.js';
import { checkDatabase } from '../src/scripts/checkEnv.js';
import pg from 'pg';

const FAKE_CA_PEM_1 = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIBADANBgkqhkiG9w0BAQsFADANMQswCQYDVQQDEwJDQTAeFw0yMDAx
MDEClickableFakeCert1Data01234567890abcdefghijklmnopqrstuvwxyzAB
CDEFGHIJKLMNOPQRSTUVWXYZ01234567890abcdefghijklmnopqrstuvwxyzAB
-----END CERTIFICATE-----`;

const FAKE_CA_PEM_2 = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIBADANBgkqhkiG9w0BAQsFADANMQswCQYDVQQDEwJDQTAeFw0yMDAx
MDEClickableFakeCert2DifferentData9876543210zyxwvutsrqponmlkjihg
FEDCBAZYXWVUTSRQPONMLKJIHGFEDCBA9876543210zyxwvutsrqponmlkjihg
-----END CERTIFICATE-----`;

describe('Supabase CA and SSL Verification', () => {
  let tempDir: string;
  let certFilePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'booyah-ssl-test-'));
    certFilePath = path.join(tempDir, 'fake-ca.crt');
    fs.writeFileSync(certFilePath, FAKE_CA_PEM_1, 'utf-8');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('resolveDatabaseSslCa', () => {
    it('returns undefined when no CA environment variables are set', () => {
      const result = resolveDatabaseSslCa({});
      expect(result).toBeUndefined();
    });

    it('trusts DATABASE_SSL_CA provided as PEM text', () => {
      const result = resolveDatabaseSslCa({ DATABASE_SSL_CA: FAKE_CA_PEM_1 });
      expect(result).toBe(FAKE_CA_PEM_1.trim());
    });

    it('trusts DATABASE_SSL_CA_BASE64 provided as base64 of PEM text', () => {
      const b64 = Buffer.from(FAKE_CA_PEM_1, 'utf-8').toString('base64');
      const result = resolveDatabaseSslCa({ DATABASE_SSL_CA_BASE64: b64 });
      expect(result).toBe(FAKE_CA_PEM_1.trim());
    });

    it('trusts DATABASE_SSL_CA_FILE provided as a file path', () => {
      const result = resolveDatabaseSslCa({ DATABASE_SSL_CA_FILE: certFilePath });
      expect(result).toBe(FAKE_CA_PEM_1.trim());
    });

    it('fails with a clear error when DATABASE_SSL_CA_FILE does not exist without leaking file paths', () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.crt');
      let thrownMessage = '';
      try {
        resolveDatabaseSslCa({ DATABASE_SSL_CA_FILE: nonExistentPath });
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toBe('DATABASE_SSL_CA_FILE was not found.');
      expect(thrownMessage).not.toContain(nonExistentPath);
      expect(thrownMessage).not.toContain(tempDir);
    });

    it('fails with a clear error when PEM format is malformed without leaking certificate content', () => {
      const malformedCert = 'THIS_IS_NOT_A_VALID_PEM_CERTIFICATE_SECRET_123456';
      let thrownMessage = '';
      try {
        resolveDatabaseSslCa({ DATABASE_SSL_CA: malformedCert });
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toBe('Invalid CA certificate: malformed PEM format.');
      expect(thrownMessage).not.toContain(malformedCert);
    });

    it('fails when DATABASE_SSL_CA_BASE64 contains malformed PEM without leaking contents', () => {
      const malformedB64 = Buffer.from('invalid_cert_secret_data', 'utf-8').toString('base64');
      let thrownMessage = '';
      try {
        resolveDatabaseSslCa({ DATABASE_SSL_CA_BASE64: malformedB64 });
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toBe('Invalid CA certificate: malformed PEM format.');
      expect(thrownMessage).not.toContain('invalid_cert_secret_data');
    });

    it('fails when DATABASE_SSL_CA_FILE contains malformed PEM without leaking path or contents', () => {
      const badFilePath = path.join(tempDir, 'bad-cert.crt');
      fs.writeFileSync(badFilePath, 'invalid cert secret', 'utf-8');
      let thrownMessage = '';
      try {
        resolveDatabaseSslCa({ DATABASE_SSL_CA_FILE: badFilePath });
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toBe('Invalid CA certificate: malformed PEM format.');
      expect(thrownMessage).not.toContain(badFilePath);
      expect(thrownMessage).not.toContain('invalid cert secret');
    });

    it('fails when multiple conflicting CAs are provided without printing certificate text', () => {
      const b64Different = Buffer.from(FAKE_CA_PEM_2, 'utf-8').toString('base64');
      let thrownMessage = '';
      try {
        resolveDatabaseSslCa({
          DATABASE_SSL_CA: FAKE_CA_PEM_1,
          DATABASE_SSL_CA_BASE64: b64Different,
        });
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toMatch(/Multiple conflicting CA certificates provided in environment variables/);
      expect(thrownMessage).not.toContain(FAKE_CA_PEM_1);
      expect(thrownMessage).not.toContain(FAKE_CA_PEM_2);
    });

    it('succeeds when multiple CA forms are provided with identical certificate content', () => {
      const b64Same = Buffer.from(FAKE_CA_PEM_1, 'utf-8').toString('base64');
      const result = resolveDatabaseSslCa({
        DATABASE_SSL_CA: FAKE_CA_PEM_1,
        DATABASE_SSL_CA_BASE64: b64Same,
        DATABASE_SSL_CA_FILE: certFilePath,
      });
      expect(result).toBe(FAKE_CA_PEM_1.trim());
    });
  });

  describe('Database SSL Configuration (getDatabaseSslConfig)', () => {
    it('returns undefined for local database connections without CA', () => {
      const ssl = getDatabaseSslConfig('postgresql://postgres:pass@localhost:5432/booyah_test');
      expect(ssl).toBeUndefined();
    });

    it('enforces rejectUnauthorized=true and attaches CA when CA is present', () => {
      const oldEnv = process.env.DATABASE_SSL_CA;
      try {
        process.env.DATABASE_SSL_CA = FAKE_CA_PEM_1;
        const ssl = getDatabaseSslConfig('postgresql://postgres:pass@localhost:5432/booyah_test');
        expect(ssl).toBeDefined();
        expect(ssl).toEqual({
          rejectUnauthorized: true,
          ca: FAKE_CA_PEM_1.trim(),
        });
        // Verification must NEVER be disabled
        expect((ssl as any).rejectUnauthorized).toBe(true);
      } finally {
        if (oldEnv === undefined) {
          delete process.env.DATABASE_SSL_CA;
        } else {
          process.env.DATABASE_SSL_CA = oldEnv;
        }
      }
    });

    it('enforces rejectUnauthorized=true for remote connections', () => {
      const ssl = getDatabaseSslConfig('postgresql://postgres:pass@aws-0.pooler.supabase.com:5432/postgres');
      expect(ssl).toBeDefined();
      expect((ssl as any).rejectUnauthorized).toBe(true);
    });
  });

  describe('Untrusted Certificate Error Diagnostics', () => {
    it('identifies SELF_SIGNED_CERT_IN_CHAIN and related codes as untrusted certificate errors', () => {
      expect(isUntrustedCertificateError({ code: 'SELF_SIGNED_CERT_IN_CHAIN' })).toBe(true);
      expect(isUntrustedCertificateError({ code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' })).toBe(true);
      expect(isUntrustedCertificateError({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' })).toBe(true);
      expect(isUntrustedCertificateError({ code: 'CERT_UNTRUSTED' })).toBe(true);
      expect(isUntrustedCertificateError({ message: 'self-signed certificate in certificate chain' })).toBe(true);
      expect(isUntrustedCertificateError({ message: 'some other syntax error' })).toBe(false);
    });

    it('checkDatabase returns specific safe reason on untrusted certificate error without leaking connection string', async () => {
      const fakeRemoteUrl = 'postgresql://postgres:supersecretpassword@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

      const poolSpy = vi.spyOn(pg.Pool.prototype, 'query').mockImplementationOnce(() => {
        const err: any = new Error('self-signed certificate in certificate chain');
        err.code = 'SELF_SIGNED_CERT_IN_CHAIN';
        return Promise.reject(err);
      });

      const result = await checkDatabase(fakeRemoteUrl, ['--allow-remote']);

      expect(result.passed).toBe(false);
      expect(result.message).toBe(`Failed: ${UNTRUSTED_CERT_SAFE_REASON}`);
      expect(result.message).not.toContain('supersecretpassword');
      expect(result.message).not.toContain('aws-0-ap-south-1');

      poolSpy.mockRestore();
    });

    it('assertDatabaseConnection throws the specific safe reason when certificate is untrusted', async () => {
      const mockPool: any = {
        query: vi.fn().mockImplementation(() => {
          const err: any = new Error('self-signed certificate');
          err.code = 'SELF_SIGNED_CERT_IN_CHAIN';
          return Promise.reject(err);
        }),
      };

      await expect(assertDatabaseConnection(mockPool)).rejects.toThrowError(UNTRUSTED_CERT_SAFE_REASON);
    });
  });
});
