// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { build } from 'vite';
import fs from 'fs';
import path from 'path';

describe('Requirement 3 & 7: Staff Portal Build Artifacts, Security Headers & CSP', () => {
  const staffPortalRoot = path.resolve(__dirname, '..');
  const distDir = path.resolve(staffPortalRoot, 'dist');
  const sampleApiOrigin = 'https://api.booyahwin.com';
  const sampleStorageOrigin = 'https://xyz.supabase.co';

  beforeAll(async () => {
    process.env.VITE_API_ORIGIN = sampleApiOrigin;
    process.env.VITE_STORAGE_ORIGIN = sampleStorageOrigin;

    // Run production build programmatically
    await build({
      root: staffPortalRoot,
      configFile: path.resolve(staffPortalRoot, 'vite.config.ts'),
      logLevel: 'silent',
    });
  }, 60000);

  it('generates dist/_redirects with exact SPA fallback rule', () => {
    const redirectsPath = path.resolve(distDir, '_redirects');
    expect(fs.existsSync(redirectsPath)).toBe(true);

    const content = fs.readFileSync(redirectsPath, 'utf-8');
    expect(content).toContain('/*');
    expect(content).toContain('/index.html');
    expect(content).toContain('200');
  });

  it('generates dist/_headers with caching directives and strict security headers', () => {
    const headersPath = path.resolve(distDir, '_headers');
    expect(fs.existsSync(headersPath)).toBe(true);

    const content = fs.readFileSync(headersPath, 'utf-8');

    // 1. Caching rules (User Change #9)
    expect(content).toContain('/assets/*');
    expect(content).toContain('max-age=31536000, immutable');
    expect(content).toContain('/index.html');
    expect(content).toContain('no-cache, no-store, must-revalidate');

    // 2. Core security headers
    expect(content).toContain('X-Frame-Options: DENY');
    expect(content).toContain('X-Content-Type-Options: nosniff');
    expect(content).toContain('Referrer-Policy: strict-origin-when-cross-origin');

    // 3. CSP headers (Requirement #3, User Change #7)
    expect(content).toContain("frame-ancestors 'none'");
    expect(content).toContain("default-src 'self'");
    expect(content).toContain("script-src 'self'");
    expect(content).toContain("object-src 'none'");
    expect(content).toContain("base-uri 'self'");

    // 4. Interpolated origins without wildcards and without localhost
    expect(content).toContain(`connect-src 'self' ${sampleApiOrigin}`);
    expect(content).toContain(`img-src 'self' blob: ${sampleStorageOrigin}`);

    const cspLine = content.split('\n').find((l) => l.includes('Content-Security-Policy:')) || '';
    const connectMatch = cspLine.match(/connect-src\s+([^;]+)/)?.[1] || '';
    const imgMatch = cspLine.match(/img-src\s+([^;]+)/)?.[1] || '';

    expect(connectMatch).not.toContain('*');
    expect(imgMatch).not.toContain('*');
    expect(connectMatch.toLowerCase()).not.toContain('localhost');
    expect(imgMatch.toLowerCase()).not.toContain('localhost');
  });

  it('generates dist/index.html with strict meta CSP containing sample origins and no wildcards/localhost', () => {
    const htmlPath = path.resolve(distDir, 'index.html');
    expect(fs.existsSync(htmlPath)).toBe(true);

    const content = fs.readFileSync(htmlPath, 'utf-8');
    expect(content).toContain(sampleApiOrigin);
    expect(content).toContain(sampleStorageOrigin);
    expect(content).toContain("script-src 'self'");
    expect(content).toContain("object-src 'none'");
    expect(content).toContain("base-uri 'self'");

    // Extract CSP meta tag
    const cspMatch = content.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
    expect(cspMatch).toBeTruthy();
    const csp = cspMatch![1];

    expect(csp).not.toContain('*');
    expect(csp.toLowerCase()).not.toContain('localhost');
  });
});
