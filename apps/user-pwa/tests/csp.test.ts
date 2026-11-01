import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Requirement 3: Content Security Policy (CSP) & Storage Origin', () => {
  const indexHtmlPath = path.resolve(__dirname, '../index.html');
  const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');

  it('enforces strict img-src without wildcards and without data: in index.html', () => {
    // Extract CSP meta tag
    const cspMatch = indexHtmlContent.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
    expect(cspMatch).not.toBeNull();

    const csp = cspMatch![1];
    const directives = Object.fromEntries(
      csp
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => {
          const [key, ...vals] = d.split(/\s+/);
          return [key, vals];
        })
    );

    const imgSrc = directives['img-src'];
    expect(imgSrc).toBeDefined();

    // Must allow 'self' and blob:
    expect(imgSrc).toContain("'self'");
    expect(imgSrc).toContain('blob:');

    // Must contain placeholders for build-time origins
    expect(imgSrc).toContain('%VITE_API_ORIGIN%');
    expect(imgSrc).toContain('%VITE_STORAGE_ORIGIN%');

    // Must NOT contain wildcards (*) or data:
    expect(imgSrc).not.toContain('*');
    expect(imgSrc).not.toContain('data:');
  });

  it('replaces VITE_STORAGE_ORIGIN and VITE_API_ORIGIN at build time', () => {
    const testStorageOrigin = 'https://custom-storage.supabase.co';
    const testApiOrigin = 'https://api.booyah.win';

    const transformed = indexHtmlContent
      .replace('%VITE_API_ORIGIN%', testApiOrigin)
      .replace('%VITE_STORAGE_ORIGIN%', testStorageOrigin);

    expect(transformed).toContain(`img-src 'self' blob: ${testApiOrigin} ${testStorageOrigin};`);
  });
});
