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

/**
 * Request notification permission and subscribe to Staff Web Push notifications.
 */
export async function subscribeToStaffPushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    return false;
  }

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      return false;
    }

    // Fetch VAPID public key from backend
    const keyRes = await apiClient.get<any>('/staff/notifications/push-key');
    const vapidPublicKey = keyRes?.publicKey || keyRes?.data?.publicKey;
    if (!vapidPublicKey) {
      return false;
    }

    // Register service worker
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
    }

    const readyReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<ServiceWorkerRegistration | null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);

    const activeReg = readyReg || registration;
    let subscription = await activeReg?.pushManager?.getSubscription();
    if (!subscription && activeReg?.pushManager) {
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource;
      subscription = await activeReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    if (!subscription) {
      return false;
    }

    const subJson = subscription.toJSON();
    await apiClient.post('/staff/notifications/push-subscribe', {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
      subscription: subJson,
    });

    return true;
  } catch (err) {
    console.warn('[StaffPush] Failed to register staff push subscription:', err);
    return false;
  }
}

/**
 * Unsubscribe from Staff Web Push notifications.
 */
export async function unsubscribeFromStaffPushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await apiClient.post('/staff/notifications/push-unsubscribe', { endpoint });
    }
    return true;
  } catch (err) {
    console.warn('[StaffPush] Failed to unsubscribe:', err);
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

    // First tone (D5 ~ 587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second tone (A5 ~ 880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.12, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.35);
  } catch {
    // Autoplay policy or sound disabled in browser
  }
}
