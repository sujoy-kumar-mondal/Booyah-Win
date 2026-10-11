import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function cspHtmlPlugin() {
  return {
    name: 'csp-html-plugin',
    transformIndexHtml(html: string, ctx: any) {
      const isDev = !ctx.bundle; // true in vite dev server, false in vite build
      const apiOrigin = (process.env.VITE_API_ORIGIN || process.env.VITE_API_URL || '').trim();
      const storageOrigin = (process.env.VITE_STORAGE_ORIGIN || '').trim();

      // Production connect-src: exactly 'self' plus the single API origin from VITE_API_ORIGIN (no wildcards)
      // Dev mode: allows only 'self' and Vite's hot-reload WebSocket for port 5174 (no port 3000 entries because requests go through proxy)
      const connectSrc = isDev
        ? `connect-src 'self' ws://localhost:5174`
        : `connect-src 'self' ${apiOrigin}`.trim();

      // img-src: 'self', blob:, the storage origin (no wildcards, no data:)
      const imgSrc = `img-src 'self' blob: ${storageOrigin}`.trim();

      return html
        .replace('%CONNECT_SRC%', connectSrc)
        .replace('%IMG_SRC%', imgSrc);
    },
  };
}

export default defineConfig({
  plugins: [
    cspHtmlPlugin(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@booyah/shared': path.resolve(__dirname, '../../packages/shared/dist/index.js'),
    },
  },
  server: {
    port: 5174,
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
