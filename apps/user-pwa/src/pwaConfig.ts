/**
 * PWA Workbox Caching Configuration
 * 
 * Requirement 9: The service worker must never cache /api responses.
 */
export const pwaWorkboxConfig = {
  navigateFallbackDenylist: [/^\/api/],
  runtimeCaching: [
    {
      urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api') || url.pathname.includes('/api/v1'),
      handler: 'NetworkOnly' as const,
      options: {
        cacheName: 'no-cache-api',
      },
    },
  ],
};
