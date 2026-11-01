import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions, ActionPerformed } from '@capacitor/local-notifications';

const CHANNEL_ID = 'booyah_match_alerts';
let isInitialized = false;

/**
 * Initialize local notification channel with high importance (heads-up banner, sound, vibration).
 */
export async function initializeLocalNotifications(
  onNotificationTap?: (actionUrl: string) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (isInitialized) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt') {
      await LocalNotifications.requestPermissions();
    }

    // Create high-importance notification channel for Android 8.0+
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Match Alerts & Updates',
      description: 'Instant notifications for tournament rooms, match confirmations, and results',
      importance: 5, // MAX importance (heads-up banner + sound)
      visibility: 1, // Public on lock screen
      sound: 'beep.wav',
      vibration: true,
      lights: true,
      lightColor: '#10B981',
    });

    LocalNotifications.addListener('localNotificationActionPerformed', (action: ActionPerformed) => {
      const extra = action.notification.extra;
      const actionUrl = extra?.actionUrl;
      if (onNotificationTap && actionUrl) {
        onNotificationTap(actionUrl);
      } else if (actionUrl) {
        window.location.href = actionUrl;
      }
    });

    isInitialized = true;
  } catch (err) {
    console.warn('[LocalNotifications] init error:', err);
  }
}

export interface ShowNotificationOptions {
  title: string;
  body: string;
  id?: number;
  actionUrl?: string;
  extra?: Record<string, any>;
}

/**
 * Triggers an immediate Android system notification.
 */
export async function showSystemNotification(options: ShowNotificationOptions): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // If running in browser, fallback to standard Web Notification API if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(options.title, {
          body: options.body,
          icon: '/favicon.png',
        });
      } catch {
        // Ignore web notification failure
      }
    }
    return;
  }

  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display !== 'granted') return;

    const notifId = options.id || Math.floor(Date.now() % 100000);

    const scheduleOpts: ScheduleOptions = {
      notifications: [
        {
          id: notifId,
          title: options.title,
          body: options.body,
          channelId: CHANNEL_ID,
          smallIcon: 'ic_launcher_round',
          iconColor: '#10B981',
          sound: 'beep.wav',
          extra: {
            actionUrl: options.actionUrl,
            ...options.extra,
          },
        },
      ],
    };

    await LocalNotifications.schedule(scheduleOpts);
  } catch (err) {
    console.error('[LocalNotifications] schedule error:', err);
  }
}
