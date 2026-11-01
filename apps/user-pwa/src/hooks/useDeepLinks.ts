import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App, type URLOpenListenerEvent } from '@capacitor/app';

/**
 * Hook to listen for native Android deep links and app links.
 * Handles incoming referral links (e.g., https://booyah-win.vercel.app/refer/s2003
 * or booyahwin://refer/s2003) and routes them directly to /register?ref=s2003.
 */
export function useDeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let isSubscribed = true;

    const handleIncomingUrl = (rawUrl?: string | null) => {
      if (!isSubscribed || !rawUrl) return;

      try {
        console.log('[DeepLink] Received incoming URL:', rawUrl);

        // Normalize URL
        const urlStr = rawUrl.startsWith('booyahwin://')
          ? rawUrl.replace('booyahwin://', 'https://booyah-win.vercel.app/')
          : rawUrl;

        let path = '';
        let search = '';

        if (urlStr.includes('://')) {
          const parsed = new URL(urlStr);
          path = parsed.pathname;
          search = parsed.search;
        } else {
          path = urlStr;
        }

        console.log('[DeepLink] Parsed path:', path, 'search:', search);

        // Handle /refer/:code -> navigate to /register?ref=<code>
        if (path.startsWith('/refer/')) {
          const code = path.replace('/refer/', '').split('/')[0].trim();
          if (code) {
            const target = `/register?ref=${encodeURIComponent(code)}`;
            console.log('[DeepLink] Navigating to referral register target:', target);
            navigate(target);
            return;
          }
        }

        // Handle /register route with params
        if (path.startsWith('/register')) {
          const target = `${path}${search}`;
          console.log('[DeepLink] Navigating to register target:', target);
          navigate(target);
          return;
        }

        // Any other route
        if (path && path !== '/') {
          const target = `${path}${search}`;
          console.log('[DeepLink] Navigating to target:', target);
          navigate(target);
        }
      } catch (err) {
        console.error('[DeepLink] Failed to parse incoming URL:', rawUrl, err);
      }
    };

    // 1. Check if app was cold-started from a deep link
    App.getLaunchUrl().then((launch) => {
      console.log('[DeepLink] getLaunchUrl result:', JSON.stringify(launch));
      if (launch && launch.url) {
        handleIncomingUrl(launch.url);
      }
    }).catch((err) => {
      console.error('[DeepLink] getLaunchUrl error:', err);
    });

    // 2. Listen for deep links when app is resumed / warm-started
    const handlePromise = App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      console.log('[DeepLink] appUrlOpen event:', JSON.stringify(event));
      handleIncomingUrl(event.url);
    });

    return () => {
      isSubscribed = false;
      handlePromise.then((h) => h?.remove()).catch(() => {});
    };
  }, [navigate]);
}
