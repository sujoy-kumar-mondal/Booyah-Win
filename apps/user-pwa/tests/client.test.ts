import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiClient,
  ApiError,
  setStoredToken,
  getStoredToken,
  clearStoredToken,
  onSessionReplaced,
  onSlowRequest,
} from '../src/api/client.js';
import { ErrorCodes } from '@booyah/shared';

describe('API Client Envelope, Interceptors & Error Handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearStoredToken();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('unwraps { data: ... } envelope on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: { profile: { id: '1', name: 'ProGamer' } } }),
    });

    const res = await apiClient<{ profile: { id: string; name: string } }>('/api/v1/me');
    expect(res).toEqual({ profile: { id: '1', name: 'ProGamer' } });
  });

  it('attaches Authorization Bearer header when token is stored', async () => {
    setStoredToken('test-jwt-token-123');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: { ok: true } }),
    });

    await apiClient('/api/v1/test');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt-token-123',
        }),
      })
    );
  });

  it('maps known error codes to friendly messages and throws ApiError', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: async () => ({
        error: {
          code: ErrorCodes.LOW_BALANCE,
          message: 'Raw DB error message that should not be shown',
          details: {},
        },
      }),
    });

    await expect(apiClient('/api/v1/matches/1/join')).rejects.toThrow(ApiError);
    try {
      await apiClient('/api/v1/matches/1/join');
    } catch (err: any) {
      expect(err.code).toBe(ErrorCodes.LOW_BALANCE);
      expect(err.message).toBe('Insufficient wallet balance. Please add money to continue.');
    }
  });

  it('Requirement 4: unknown error codes show a friendly generic message, never server text', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: async () => ({
        error: {
          code: 'UNEXPECTED_DB_CRASH',
          message: 'FATAL: database disk full at pg_wal/000000010000000000000001',
        },
      }),
    });

    try {
      await apiClient('/api/v1/something');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toBe('An unexpected error occurred. Please try again.');
      expect(err.message).not.toContain('database disk full');
    }
  });

  it('Requirement 4: network failures show friendly connection message, never raw error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    try {
      await apiClient('/api/v1/data');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe('NETWORK_ERROR');
      expect(err.message).toBe('Cannot reach the server. Check that the API is running.');
    }
  });

  it('Requirement 4: timeouts show friendly timeout message', async () => {
    global.fetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    });

    try {
      await apiClient('/api/v1/slow', { timeoutMs: 50 });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe('TIMEOUT');
      expect(err.message).toBe('Server request timed out. Please try again.');
    }
  });

  it('Requirement 4: non-JSON responses (proxy HTML / 502 / Render sleeping) show friendly server unavailable message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: { get: () => 'text/html' },
      text: async () => '<html><body>Bad Gateway from Cloudflare</body></html>',
    });

    try {
      await apiClient('/api/v1/data');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe('NON_JSON_RESPONSE');
      expect(err.message).toBe('The server sent an unexpected response.');
    }
  });

  it('Requirement 4: triggers slow server notice after 5 seconds of waiting', async () => {
    vi.useFakeTimers();

    const slowCallback = vi.fn();
    const unsub = onSlowRequest(slowCallback);

    // Mock fetch that hangs until we advance time
    global.fetch = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => ({ data: { status: 'awake' } }),
          });
        }, 10000);
      });
    });

    const promise = apiClient('/api/v1/waking-server');

    expect(slowCallback).not.toHaveBeenCalled();

    // Advance 5.1 seconds
    vi.advanceTimersByTime(5100);

    // Should have triggered slow notification
    expect(slowCallback).toHaveBeenCalledWith(true);

    // Advance remaining time so request resolves
    vi.advanceTimersByTime(5000);
    await promise;

    // Slow notice should clear
    expect(slowCallback).toHaveBeenCalledWith(false);

    unsub();
  });

  it('clears token and fires onSessionReplaced listener on SESSION_REPLACED', async () => {
    setStoredToken('active-token-999');
    const replacedListener = vi.fn();
    const unsub = onSessionReplaced(replacedListener);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({
        error: {
          code: ErrorCodes.SESSION_REPLACED,
          message: 'Session replaced by newer login',
        },
      }),
    });

    try {
      await apiClient('/api/v1/me');
    } catch {
      // expected error
    }

    expect(getStoredToken()).toBeNull();
    expect(replacedListener).toHaveBeenCalled();

    unsub();
  });

  it('Requirement 2: does not set Content-Type: application/json when body is FormData', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: { id: '1', status: 'pending' } }),
    });

    const formData = new FormData();
    formData.append('amount', '100.00');
    formData.append('utr', '123456789012');

    await apiClient('/api/v1/wallet/deposits', {
      method: 'POST',
      body: formData,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const callArgs = (global.fetch as any).mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers['Content-Type']).toBeUndefined();
  });
});
