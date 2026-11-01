import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Requirement 1: Content Security Policy & Security Headers', () => {
  it('production CSP has no wildcards in connect-src or img-src, and includes required directives', () => {
    const indexPath = path.resolve(__dirname, '../index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf-8');

    // Extract CSP meta tag
    const cspMatch = indexHtml.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
    expect(cspMatch).toBeTruthy();
    const cspTemplate = cspMatch![1];

    // Simulate production replacement with realistic build origins
    const prodApiOrigin = 'https://api.booyah.win';
    const prodStorageOrigin = 'https://storage.booyah.win';

    const prodConnectSrc = `connect-src 'self' ${prodApiOrigin}`;
    const prodImgSrc = `img-src 'self' blob: ${prodStorageOrigin}`;

    const evaluatedCsp = cspTemplate
      .replace('%CONNECT_SRC%', prodConnectSrc)
      .replace('%IMG_SRC%', prodImgSrc);

    // 1. Strict directive checks
    expect(evaluatedCsp).toContain("default-src 'self'");
    expect(evaluatedCsp).toContain("frame-ancestors 'none'");
    expect(evaluatedCsp).toContain("form-action 'self'");
    expect(evaluatedCsp).toContain("object-src 'none'");

    // 2. Extract connect-src and img-src sections
    const connectSection = evaluatedCsp.match(/connect-src\s+([^;]+)/)?.[1] || '';
    const imgSection = evaluatedCsp.match(/img-src\s+([^;]+)/)?.[1] || '';

    // 3. User Requirement 1: The CSP test fails on any "*" in connect-src or img-src
    expect(connectSection).not.toContain('*');
    expect(imgSection).not.toContain('*');

    // 4. img-src allows only 'self', blob:, and storage origin (no data:, no wildcards)
    expect(imgSection).toContain("'self'");
    expect(imgSection).toContain('blob:');
    expect(imgSection).toContain(prodStorageOrigin);
    expect(imgSection).not.toContain('data:');

    // 5. Production connect-src is exactly 'self' plus the single API origin
    expect(connectSection).toBe(`'self' ${prodApiOrigin}`);
    expect(connectSection).not.toContain('localhost');
    expect(connectSection).not.toContain('ws:');
  });

  it('Requirement 1: production policy contains no "localhost"', () => {
    const indexPath = path.resolve(__dirname, '../index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf-8');

    const cspMatch = indexHtml.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
    expect(cspMatch).toBeTruthy();
    const cspTemplate = cspMatch![1];

    const prodApiOrigin = 'https://api.booyah.win';
    const prodStorageOrigin = 'https://storage.booyah.win';

    const prodConnectSrc = `connect-src 'self' ${prodApiOrigin}`;
    const prodImgSrc = `img-src 'self' blob: ${prodStorageOrigin}`;

    const evaluatedCsp = cspTemplate
      .replace('%CONNECT_SRC%', prodConnectSrc)
      .replace('%IMG_SRC%', prodImgSrc);

    expect(evaluatedCsp.toLowerCase()).not.toContain('localhost');
  });

  it('Requirement 1: development CSP allows only "self" and Vite hot-reload WebSocket for port 5174 (no port 3000)', () => {
    const indexPath = path.resolve(__dirname, '../index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf-8');

    const cspMatch = indexHtml.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
    expect(cspMatch).toBeTruthy();
    const cspTemplate = cspMatch![1];

    // Dev connectSrc as configured in vite.config.ts
    const devConnectSrc = "connect-src 'self' ws://localhost:5174";
    const devImgSrc = "img-src 'self' blob:";

    const evaluatedDevCsp = cspTemplate
      .replace('%CONNECT_SRC%', devConnectSrc)
      .replace('%IMG_SRC%', devImgSrc);

    const connectSection = evaluatedDevCsp.match(/connect-src\s+([^;]+)/)?.[1] || '';
    expect(connectSection).toContain("'self'");
    expect(connectSection).toContain('ws://localhost:5174');
    expect(connectSection).not.toContain('3000');
    expect(connectSection).not.toContain('http://localhost:3000');
    expect(connectSection).not.toContain('ws://localhost:3000');
  });

  it('public/_headers contains frame-ancestors none and CSP header for hosting providers', () => {
    const headersPath = path.resolve(__dirname, '../public/_headers');
    expect(fs.existsSync(headersPath)).toBe(true);

    const headersContent = fs.readFileSync(headersPath, 'utf-8');
    expect(headersContent).toContain("frame-ancestors 'none'");
    expect(headersContent).toContain("form-action 'self'");
    expect(headersContent).toContain('X-Frame-Options: DENY');
  });
});
