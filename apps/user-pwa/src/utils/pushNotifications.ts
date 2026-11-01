import { apiClient } from '../api/client.js';

export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function sendDebugReport(data: Record<string, any>): Promise<void> {
  if (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') {
    return;
  }
  try {
    await apiClient('/api/v1/notifications/push-debug', {
      method: 'POST',
      skipAuthEvents: true,
      body: JSON.stringify({
        ...data,
        isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : null,
        protocol: typeof window !== 'undefined' ? window.location.protocol : '',
        host: typeof window !== 'undefined' ? window.location.host : '',
        hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
        hasPushManager: typeof window !== 'undefined' && 'PushManager' in window,
        hasNotification: typeof window !== 'undefined' && 'Notification' in window,
        permission: typeof Notification !== 'undefined' ? Notification.permission : 'none',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {}
}

/**
 * Asks the user for push notification permission.
 * If user accepts: registers subscription with API backend.
 * If user declines (or browser unsupported): does nothing.
 */
export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    await sendDebugReport({ step: 'unsupported' });
    return false;
  }

  try {
    // If not granted yet, ask for permission via native browser dialog
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      await sendDebugReport({ step: 'permission_not_granted', permission });
      return false; // User declined - do nothing
    }

    // Fetch VAPID public key from backend
    const keyRes = await apiClient<any>('/api/v1/notifications/push-key');
    const vapidPublicKey = keyRes?.publicKey || keyRes?.data?.publicKey;
    if (!vapidPublicKey) {
      await sendDebugReport({ step: 'missing_vapid_key', keyRes });
      return false;
    }

    // Ensure service worker is registered
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      const swUrl = import.meta.env.PROD ? '/sw.js' : '/sw-push.js';
      registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
    }

    // Wait up to 3s for worker to activate
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);

    let subscription = await registration?.pushManager?.getSubscription();

    if (!subscription && registration?.pushManager) {
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    if (!subscription) {
      await sendDebugReport({ step: 'failed_to_subscribe_push_manager' });
      return false;
    }

    const subJson = subscription.toJSON();
    if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
      await apiClient('/api/v1/notifications/push-subscribe', {
        method: 'POST',
      skipAuthEvents: true,
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
        }),
      });
      await sendDebugReport({ step: 'success_registered', endpoint: subJson.endpoint });
    }

    return true;
  } catch (err: any) {
    await sendDebugReport({ step: 'error', error: err?.message || String(err) });
    return false;
  }
}

/**
 * Synthesizes a subtle, pleasant 2-tone notification chime using Web Audio API.
 */
export function playNotificationSound(): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.14, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch {
    // AudioContext blocked or unsupported
  }
}
