import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../src/app.js';

function extractExpressRoutes(app: any): Array<{ method: string; path: string }> {
  const routes: Array<{ method: string; path: string }> = [];

  function traverse(layer: any, basePath = '') {
    if (layer.route) {
      const routePath = (basePath + (layer.route.path === '/' ? '' : layer.route.path)) || '/';
      for (const m of Object.keys(layer.route.methods)) {
        routes.push({ method: m.toUpperCase(), path: routePath });
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      let mountPath = '';
      const match = layer.regexp?.source?.match(/^\^\\\/([a-zA-Z0-9_\-\\\/]+?)\\\/\?\(\?=\\\/\|\$\)/);
      if (match) {
        mountPath = '/' + match[1].replace(/\\\//g, '/').replace(/\\/g, '');
      }
      const nextBase = basePath + mountPath;
      for (const sub of layer.handle.stack) {
        traverse(sub, nextBase);
      }
    }
  }

  for (const layer of (app as any)._router.stack) {
    traverse(layer, '');
  }
  return routes;
}

function extractDocsRoutes(markdownContent: string): Array<{ method: string; path: string }> {
  const routes: Array<{ method: string; path: string }> = [];
  const lines = markdownContent.split('\n');
  const routeRegex = /`(GET|POST|PUT|PATCH|DELETE)\s+([/a-zA-Z0-9_\-:]+)`/g;

  for (const line of lines) {
    if (line.startsWith('#### ')) {
      let match: RegExpExecArray | null;
      while ((match = routeRegex.exec(line)) !== null) {
        routes.push({ method: match[1].toUpperCase(), path: match[2] });
      }
    }
  }
  return routes;
}

function normalizeRouteKey(method: string, routePath: string): string {
  // Normalize route param names so :id and :matchId match
  const normalizedPath = routePath
    .replace(/\/+/g, '/')
    .replace(/:\w+/g, ':param')
    .replace(/\/$/, '');
  return `${method.toUpperCase()} ${normalizedPath}`;
}

describe('API Documentation Parity (docs/API.md <-> Express Routes)', () => {
  const docsPath = path.resolve(__dirname, '../../../docs/API.md');
  const docsContent = fs.readFileSync(docsPath, 'utf-8');

  const app = createApp();
  const expressRoutes = extractExpressRoutes(app);
  const docsRoutes = extractDocsRoutes(docsContent);

  const expressNormalizedSet = new Set(
    expressRoutes.map((r) => normalizeRouteKey(r.method, r.path))
  );
  const docsNormalizedSet = new Set(
    docsRoutes.map((r) => normalizeRouteKey(r.method, r.path))
  );

  it('fails if an Express route is missing from docs/API.md', () => {
    const missingInDocs: string[] = [];
    for (const route of expressRoutes) {
      const key = normalizeRouteKey(route.method, route.path);
      if (!docsNormalizedSet.has(key)) {
        missingInDocs.push(`${route.method} ${route.path}`);
      }
    }
    expect(
      missingInDocs,
      `The following Express routes exist in code but are NOT documented in docs/API.md:\n${missingInDocs.join('\n')}`
    ).toEqual([]);
  });

  it('fails if docs/API.md lists a route that no longer exists in Express', () => {
    const missingInExpress: string[] = [];
    for (const route of docsRoutes) {
      const key = normalizeRouteKey(route.method, route.path);
      if (!expressNormalizedSet.has(key)) {
        missingInExpress.push(`${route.method} ${route.path}`);
      }
    }
    expect(
      missingInExpress,
      `The following routes are documented in docs/API.md but DO NOT exist in Express:\n${missingInExpress.join('\n')}`
    ).toEqual([]);
  });
});
