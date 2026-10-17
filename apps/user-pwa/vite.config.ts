import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { pwaWorkboxConfig } from './src/pwaConfig.js';

function cspAndHeadersPlugin() {
  return {
    name: 'csp-and-headers-plugin',
    transformIndexHtml(html: string, ctx: any) {
      const isDev = !ctx.bundle; // true in vite dev server, false in vite build
      const apiOrigin = (process.env.VITE_API_ORIGIN || process.env.VITE_API_URL || '').trim();
      const storageOrigin = (process.env.VITE_STORAGE_ORIGIN || '').trim();

      // Production connect-src: exactly 'self' plus the single API origin from VITE_API_ORIGIN (no wildcards)
      // Dev mode: allows only 'self' and Vite's hot-reload WebSocket for port 5173
      const connectSrc = isDev
        ? `ws://localhost:5173`
        : apiOrigin;

      return html
        .replace('%CONNECT_SRC%', connectSrc)
        .replace('%VITE_API_ORIGIN%', apiOrigin)
        .replace('%VITE_STORAGE_ORIGIN%', storageOrigin);
    },
    generateBundle() {
      const apiOrigin = (process.env.VITE_API_ORIGIN || process.env.VITE_API_URL || '').trim();
      const storageOrigin = (process.env.VITE_STORAGE_ORIGIN || '').trim();
      const connectSrc = `connect-src 'self' ${apiOrigin}`.trim();
      const imgSrc = `img-src 'self' blob: ${storageOrigin}`.trim();

      const headersContent = [
        '# Cache control for immutable hashed assets',
        '/assets/*',
        '  Cache-Control: public, max-age=31536000, immutable',
        '',
        '# Cache control for entrypoints and service worker',
        '/index.html',
        '  Cache-Control: no-cache, no-store, must-revalidate',
        '',
        '/sw.js',
        '  Cache-Control: no-cache, no-store, must-revalidate',
        '',
        '/registerSW.js',
        '  Cache-Control: no-cache, no-store, must-revalidate',
        '',
        '# Global security headers',
        '/*',
        '  X-Frame-Options: DENY',
        '  X-Content-Type-Options: nosniff',
        '  Referrer-Policy: strict-origin-when-cross-origin',
        '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
        `  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; ${imgSrc}; ${connectSrc}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';`,
        ''
      ].join('\n');

      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: headersContent,
      });

      this.emitFile({
        type: 'asset',
        fileName: '_redirects',
        source: '/*    /index.html   200\n',
      });
    },
  };
}

export default defineConfig({
  envDir: path.resolve(__dirname, '../../'),
  plugins: [
    cspAndHeadersPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Booyah Win',
        short_name: 'BooyahWin',
        description: 'Competitive Free Fire Match Platform',
        theme_color: '#090D16',
        background_color: '#090D16',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: pwaWorkboxConfig,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@booyah/shared': path.resolve(__dirname, '../../packages/shared/dist/index.js'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
