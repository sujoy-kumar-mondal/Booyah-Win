import { describe, it, expect } from 'vitest';
import { pwaWorkboxConfig } from '../src/pwaConfig.js';

describe('Requirement 9: PWA Service Worker API Cache Prevention', () => {
  it('excludes /api paths from navigateFallback', () => {
    const denylist = pwaWorkboxConfig.navigateFallbackDenylist;
    expect(denylist).toBeDefined();

    const matchesApi = denylist.some((pattern) => pattern.test('/api/v1/me'));
    expect(matchesApi).toBe(true);

    const matchesApiMatches = denylist.some((pattern) => pattern.test('/api/matches'));
    expect(matchesApiMatches).toBe(true);
  });

  it('configures NetworkOnly strategy for all /api runtime requests so responses are never cached', () => {
    const runtimeCaching = pwaWorkboxConfig.runtimeCaching;
    expect(runtimeCaching).toBeDefined();
    expect(runtimeCaching.length).toBeGreaterThan(0);

    const apiRule = runtimeCaching.find((rule) => {
      if (typeof rule.urlPattern === 'function') {
        const testUrl1 = new URL('https://app.booyah.win/api/v1/me');
        const testUrl2 = new URL('http://localhost:5173/api/v1/auth/login');
        return rule.urlPattern({ url: testUrl1 }) && rule.urlPattern({ url: testUrl2 });
      }
      return false;
    });

    expect(apiRule).toBeDefined();
    expect(apiRule?.handler).toBe('NetworkOnly');
  });
});
