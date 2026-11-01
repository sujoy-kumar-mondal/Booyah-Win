import { describe, it, expect, vi } from 'vitest';
import { assertDatabaseSafety } from '../src/scripts/scriptUtils.js';
import { checkDatabase, checkSupabaseStorage, checkGmailSmtp } from '../src/scripts/checkEnv.js';
import pg from 'pg';
import nodemailer from 'nodemailer';

describe('Requirement 5 & 12: Script Remote Database Guards & Sanitized Outputs', () => {
  describe('assertDatabaseSafety', () => {
    it('refuses remote database URL when --allow-remote is not present', () => {
      const remoteUrl = 'postgresql://postgres:secret123@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
      expect(() => assertDatabaseSafety(remoteUrl, [])).toThrowError(
        /Safety check failed: Refusing to run script against remote database host "aws-0-us-east-1.pooler.supabase.com". Pass --allow-remote to proceed./
      );
    });

    it('permits remote database URL when --allow-remote is present and never prints credentials', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const secretPass = 'superSecretPassword987!';
      const remoteUrl = `postgresql://postgres:${secretPass}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;

      const result = assertDatabaseSafety(remoteUrl, ['node', 'script.js', '--allow-remote']);
      expect(result.host).toBe('aws-0-us-east-1.pooler.supabase.com');
      expect(result.dbName).toBe('postgres');
      expect(result.isRemote).toBe(true);

      const loggedOutput = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(loggedOutput).toContain('Permitted remote database: host="aws-0-us-east-1.pooler.supabase.com", db="postgres"');
      expect(loggedOutput).not.toContain(secretPass);
      consoleSpy.mockRestore();
    });

    it('permits local database URL without --allow-remote', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const localUrl = 'postgresql://postgres:localpass@localhost:5432/booyah_win_dev';

      const result = assertDatabaseSafety(localUrl, []);
      expect(result.host).toBe('localhost');
      expect(result.dbName).toBe('booyah_win_dev');
      expect(result.isRemote).toBe(false);

      const loggedOutput = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(loggedOutput).toContain('Local database: host="localhost", db="booyah_win_dev"');
      expect(loggedOutput).not.toContain('localpass');
      consoleSpy.mockRestore();
    });

    it('fails when DATABASE_URL is missing', () => {
      expect(() => assertDatabaseSafety('')).toThrowError(/DATABASE_URL is not set/);
      expect(() => assertDatabaseSafety(undefined)).toThrowError(/DATABASE_URL is not set/);
    });
  });

  describe('check:env failure sanitization (User Change #12)', () => {
    it('checkDatabase refuses remote database URL when --allow-remote is absent', async () => {
      const remoteUrl = 'postgresql://postgres:secretpass@remote.supabase.co:5432/postgres';
      const result = await checkDatabase(remoteUrl, []);

      expect(result.passed).toBe(false);
      expect(result.message).toMatch(/Refusing to run script against remote database host/);
      expect(result.message).not.toContain('secretpass');
    });

    it('checkDatabase redacts passwords when database connection errors contain credentials', async () => {
      const secretPass = 'fakeSecretDbPassword123';
      const fakeUrl = `postgresql://user:${secretPass}@127.0.0.1:5432/fake_db`;

      // Mock pg.Pool to simulate connection failure containing the connection string
      const poolQuerySpy = vi.spyOn(pg.Pool.prototype, 'query').mockRejectedValueOnce(
        new Error(`password authentication failed for user "user" with password ${secretPass}`)
      );

      const result = await checkDatabase(fakeUrl, []);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('[REDACTED]');
      expect(result.message).not.toContain(secretPass);

      poolQuerySpy.mockRestore();
    });

    it('checkSupabaseStorage redacts fake service keys in failure messages', async () => {
      const fakeKey = 'fake_service_key_99999_secret_token';
      const result = await checkSupabaseStorage('https://invalid-nonexistent-subdomain.supabase.co', fakeKey);

      expect(result.passed).toBe(false);
      expect(result.message).not.toContain(fakeKey);
    });

    it('checkGmailSmtp redacts fake app passwords in failure messages', async () => {
      const fakeAppPass = 'fake_app_password_9876';

      const createTransportSpy = vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
        verify: vi.fn().mockRejectedValueOnce(new Error(`Invalid login with password ${fakeAppPass}`)),
      } as any);

      const result = await checkGmailSmtp(null, 'test@gmail.com', fakeAppPass);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('[REDACTED]');
      expect(result.message).not.toContain(fakeAppPass);

      createTransportSpy.mockRestore();
    });
  });
});
