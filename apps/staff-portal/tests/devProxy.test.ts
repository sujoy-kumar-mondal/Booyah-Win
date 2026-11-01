import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getApiBaseUrl } from '../src/api/client.js';

describe('Requirement 1 & 6: Dev Proxy Configuration & getApiBaseUrl', () => {
  it('Requirement 1: vite.config.ts configures dev proxy for /api targeting http://localhost:3000 with changeOrigin', () => {
    const configPath = path.resolve(__dirname, '../vite.config.ts');
    const content = fs.readFileSync(configPath, 'utf-8');

    // Verify port 5174
    expect(content).toMatch(/port:\s*5174/);

    // Verify dev proxy /api targeting http://localhost:3000 with changeOrigin: true
    expect(content).toMatch(/proxy:\s*\{[^}]*['"]\/api['"]:\s*\{/s);
    expect(content).toMatch(/target:\s*['"]http:\/\/localhost:3000['"]/);
    expect(content).toMatch(/changeOrigin:\s*true/);
  });

  describe('Requirement 6: getApiBaseUrl formatting and normalization', () => {
    it('returns /api/v1 when VITE_API_URL is unset (undefined)', () => {
      const url = getApiBaseUrl(undefined);
      expect(url).toBe('/api/v1');
      expect((url.match(/\/api\/v1/g) || []).length).toBe(1);
      expect(url).not.toContain('//');
    });

    it('returns /api/v1 when VITE_API_URL is empty string', () => {
      const url = getApiBaseUrl('');
      expect(url).toBe('/api/v1');
      expect((url.match(/\/api\/v1/g) || []).length).toBe(1);
      expect(url).not.toContain('//');
    });

    it('returns http://localhost:3000/api/v1 when VITE_API_URL is "http://localhost:3000"', () => {
      const url = getApiBaseUrl('http://localhost:3000');
      expect(url).toBe('http://localhost:3000/api/v1');
      expect((url.match(/\/api\/v1/g) || []).length).toBe(1);
      expect(url.replace('http://', '')).not.toContain('//');
    });

    it('returns http://localhost:3000/api/v1 when VITE_API_URL is "http://localhost:3000/api/v1"', () => {
      const url = getApiBaseUrl('http://localhost:3000/api/v1');
      expect(url).toBe('http://localhost:3000/api/v1');
      expect((url.match(/\/api\/v1/g) || []).length).toBe(1);
      expect(url.replace('http://', '')).not.toContain('//');
    });

    it('returns http://localhost:3000/api/v1 when VITE_API_URL has a trailing slash "http://localhost:3000/"', () => {
      const url = getApiBaseUrl('http://localhost:3000/');
      expect(url).toBe('http://localhost:3000/api/v1');
      expect((url.match(/\/api\/v1/g) || []).length).toBe(1);
      expect(url.replace('http://', '')).not.toContain('//');
    });

    it('returns http://localhost:3000/api/v1 when VITE_API_URL has trailing slash on api path "http://localhost:3000/api/v1/"', () => {
      const url = getApiBaseUrl('http://localhost:3000/api/v1/');
      expect(url).toBe('http://localhost:3000/api/v1');
      expect((url.match(/\/api\/v1/g) || []).length).toBe(1);
      expect(url.replace('http://', '')).not.toContain('//');
    });

    it('returns http://localhost:3000/api/v1 when VITE_API_URL has multiple trailing slashes "http://localhost:3000///"', () => {
      const url = getApiBaseUrl('http://localhost:3000///');
      expect(url).toBe('http://localhost:3000/api/v1');
      expect((url.match(/\/api\/v1/g) || []).length).toBe(1);
      expect(url.replace('http://', '')).not.toContain('//');
    });

    it('works with production domain "https://api.booyah.win" and produces exactly one /api/v1 without double slashes', () => {
      const url = getApiBaseUrl('https://api.booyah.win');
      expect(url).toBe('https://api.booyah.win/api/v1');
      expect((url.match(/\/api\/v1/g) || []).length).toBe(1);
      expect(url.replace('https://', '')).not.toContain('//');
    });
  });
});
