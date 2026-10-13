import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkSupabaseStorage,
  validateStorageConfig,
  sanitizeErrorMessage,
} from '../src/scripts/checkEnv.js';

describe('Supabase Storage Probe & check:env Validation', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('validateStorageConfig (Upfront Validation)', () => {
    it('fails when SUPABASE_URL contains whitespace without printing the URL', () => {
      const badUrl = 'https://abc .supabase.co';
      let thrownMessage = '';
      try {
        validateStorageConfig(badUrl, 'booyah-private');
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toBe('Invalid SUPABASE_URL: URL contains whitespace.');
      expect(thrownMessage).not.toContain(badUrl);
    });

    it('fails when SUPABASE_URL contains bracket characters without printing the URL', () => {
      const badUrl = 'https://<ref>.supabase.co';
      let thrownMessage = '';
      try {
        validateStorageConfig(badUrl, 'booyah-private');
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toBe('Invalid SUPABASE_URL: URL contains bracket characters.');
      expect(thrownMessage).not.toContain(badUrl);
    });

    it('fails when SUPABASE_URL has a trailing slash without printing the URL', () => {
      const badUrl = 'https://myref.supabase.co/';
      let thrownMessage = '';
      try {
        validateStorageConfig(badUrl, 'booyah-private');
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toBe('Invalid SUPABASE_URL: trailing slash is not allowed.');
      expect(thrownMessage).not.toContain(badUrl);
    });

    it('fails when SUPABASE_URL contains a path without printing the URL', () => {
      const badUrl = 'https://myref.supabase.co/storage/v1';
      let thrownMessage = '';
      try {
        validateStorageConfig(badUrl, 'booyah-private');
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toBe('Invalid SUPABASE_URL: URL must not contain a path.');
      expect(thrownMessage).not.toContain(badUrl);
    });

    it('fails when SUPABASE_URL is missing or empty', () => {
      expect(() => validateStorageConfig('', 'booyah-private')).toThrowError(
        'Invalid or missing SUPABASE_URL: value is required.'
      );
    });

    it('fails when STORAGE_BUCKET is missing or empty', () => {
      expect(() => validateStorageConfig('https://myref.supabase.co', '')).toThrowError(
        'Invalid or missing STORAGE_BUCKET: bucket name is required.'
      );
    });

    it('fails when STORAGE_BUCKET contains whitespace without printing the bucket name', () => {
      const badBucket = 'booyah private';
      let thrownMessage = '';
      try {
        validateStorageConfig('https://myref.supabase.co', badBucket);
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toBe('Invalid STORAGE_BUCKET: bucket name contains whitespace.');
      expect(thrownMessage).not.toContain(badBucket);
    });

    it('fails when STORAGE_BUCKET contains bracket characters without printing the bucket name', () => {
      const badBucket = '<bucket_name>';
      let thrownMessage = '';
      try {
        validateStorageConfig('https://myref.supabase.co', badBucket);
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toBe('Invalid STORAGE_BUCKET: bucket name contains bracket characters.');
      expect(thrownMessage).not.toContain(badBucket);
    });

    it('fails when STORAGE_BUCKET contains slashes without printing the bucket name', () => {
      const badBucket = 'bucket/subfolder';
      let thrownMessage = '';
      try {
        validateStorageConfig('https://myref.supabase.co', badBucket);
      } catch (err: any) {
        thrownMessage = err.message;
      }
      expect(thrownMessage).toBe('Invalid STORAGE_BUCKET: bucket name must not contain slashes.');
      expect(thrownMessage).not.toContain(badBucket);
    });

    it('passes when valid URL and bucket name are provided', () => {
      expect(() =>
        validateStorageConfig('https://validref123.supabase.co', 'booyah-private')
      ).not.toThrow();
    });
  });

  describe('Storage Probe Workflow & Cleanup Guarantee', () => {
    const validUrl = 'https://validref123.supabase.co';
    const validKey = 'sb_secret_service_key_1234567890abcdefg';
    const validBucket = 'booyah-private';

    it('uploads valid PNG with image/png and _healthcheck/ prefix, reads back, and deletes', async () => {
      const calls: { url: string; method: string; contentType?: string }[] = [];

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        calls.push({
          url,
          method: opts.method,
          contentType: opts.headers?.['Content-Type'],
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });

      const res = await checkSupabaseStorage(validUrl, validKey, validBucket);

      expect(res.passed).toBe(true);
      expect(res.message).toMatch(/Successfully uploaded, read back, and deleted probe file in bucket 'booyah-private'/);

      expect(calls.length).toBe(3);
      // Call 1: Upload (POST)
      expect(calls[0].method).toBe('POST');
      expect(calls[0].url).toMatch(/https:\/\/validref123\.supabase\.co\/storage\/v1\/object\/booyah-private\/_healthcheck\/probe-.*\.png/);
      expect(calls[0].contentType).toBe('image/png');

      // Call 2: Read-back (GET)
      expect(calls[1].method).toBe('GET');
      expect(calls[1].url).toMatch(/_healthcheck\/probe-.*\.png/);

      // Call 3: Delete (DELETE)
      expect(calls[2].method).toBe('DELETE');
      expect(calls[2].url).toMatch(/_healthcheck\/probe-.*\.png/);
    });

    it('cleanup delete always runs when read-back fails, and reports both outcomes', async () => {
      let deleteCalled = false;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (opts.method === 'POST') {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (opts.method === 'GET') {
          return new Response(
            JSON.stringify({ error: 'Object not found', message: 'Read-back failed' }),
            { status: 404 }
          );
        }
        if (opts.method === 'DELETE') {
          deleteCalled = true;
          return new Response(JSON.stringify({ message: 'Deleted successfully' }), { status: 200 });
        }
        return new Response(null, { status: 400 });
      });

      const res = await checkSupabaseStorage(validUrl, validKey, validBucket);

      expect(deleteCalled).toBe(true);
      expect(res.passed).toBe(false);
      expect(res.message).toMatch(/Read-back probe failed/);
      expect(res.message).toMatch(/Probe file was cleaned up successfully\./);
    });

    it('reports both read-back failure and cleanup failure when cleanup also fails', async () => {
      let deleteCalled = false;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (opts.method === 'POST') {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (opts.method === 'GET') {
          return new Response(JSON.stringify({ message: 'Read network timeout' }), { status: 504 });
        }
        if (opts.method === 'DELETE') {
          deleteCalled = true;
          return new Response(JSON.stringify({ error: 'Permission denied on delete' }), { status: 403 });
        }
        return new Response(null, { status: 400 });
      });

      const res = await checkSupabaseStorage(validUrl, validKey, validBucket);

      expect(deleteCalled).toBe(true);
      expect(res.passed).toBe(false);
      expect(res.message).toMatch(/Read-back probe failed/);
      expect(res.message).toMatch(/cleanup delete failed/);
      expect(res.message).toMatch(/probe file left in bucket/);
    });
  });

  describe('Mocked Failures with Fake Secrets Redaction', () => {
    const fakeSecretUrl = 'https://secret-project-ref-xyz.supabase.co';
    const fakeSecretKey = 'sb_secret_super_confidential_token_987654321';
    const fakeBucket = 'booyah-private';

    it('handles bucket not found error and redacts any fake secrets in error text', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            statusCode: '404',
            error: 'Bucket not found',
            message: `Bucket not found for key ${fakeSecretKey} at ${fakeSecretUrl}`,
          }),
          { status: 404 }
        );
      });

      const res = await checkSupabaseStorage(fakeSecretUrl, fakeSecretKey, fakeBucket);

      expect(res.passed).toBe(false);
      expect(res.message).toMatch(/Upload probe failed/);
      expect(res.message).not.toContain(fakeSecretKey);
      expect(res.message).not.toContain(fakeSecretUrl);
    });

    it('handles wrong mime type error and redacts any fake secrets in error text', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            statusCode: '400',
            error: 'Invalid MIME type',
            message: `mime type not supported at ${fakeSecretUrl} with token ${fakeSecretKey}`,
          }),
          { status: 400 }
        );
      });

      const res = await checkSupabaseStorage(fakeSecretUrl, fakeSecretKey, fakeBucket);

      expect(res.passed).toBe(false);
      expect(res.message).toMatch(/Upload probe failed/);
      expect(res.message).not.toContain(fakeSecretKey);
      expect(res.message).not.toContain(fakeSecretUrl);
    });

    it('handles invalid API key (401/403) and redacts fake secret key from output', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            statusCode: '401',
            error: 'Invalid API key',
            message: `Invalid API key Bearer ${fakeSecretKey}`,
          }),
          { status: 401 }
        );
      });

      const res = await checkSupabaseStorage(fakeSecretUrl, fakeSecretKey, fakeBucket);

      expect(res.passed).toBe(false);
      expect(res.message).toMatch(/Upload probe failed/);
      expect(res.message).not.toContain(fakeSecretKey);
    });

    it('handles wrong URL or network error and redacts fake secret URL and headers', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        throw new Error(`ENOTFOUND failed to connect to ${fakeSecretUrl} with apikey: ${fakeSecretKey}`);
      });

      const res = await checkSupabaseStorage(fakeSecretUrl, fakeSecretKey, fakeBucket);

      expect(res.passed).toBe(false);
      expect(res.message).toMatch(/Upload probe failed/);
      expect(res.message).not.toContain(fakeSecretKey);
      expect(res.message).not.toContain(fakeSecretUrl);
    });
  });
});
