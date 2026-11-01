import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { apiClient } from '../api/client.js';
import { initializeLocalNotifications, showSystemNotification } from './localNotifications.js';
import { playNotificationSound } from '../utils/pushNotifications.js';

let isPushListenersRegistered = false;

/**
 * Initializes native Android Push Notifications using Capacitor.
 * Safe to call on web: exits immediately if not native.
 */
export async function initializeNativePushNotifications(
  onNotificationTap?: (actionUrl: string) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  // Also initialize local notifications
  await initializeLocalNotifications(onNotificationTap);

  try {
    // 1. Request permission (handles Android 13+ POST_NOTIFICATIONS)
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[PushNotifications] Permission not granted:', permStatus.receive);
      return;
    }

    // 2. Create high-importance push channel (Android 8.0+)
    await PushNotifications.createChannel({
      id: 'booyah_match_alerts',
      name: 'Booyah Match Alerts',
      description: 'Match updates, room credentials, and winner announcements',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#10B981',
    });

    // 3. Register listeners BEFORE calling register() to prevent missing token event
    if (!isPushListenersRegistered) {
      PushNotifications.addListener('registration', async (token: Token) => {
        try {
          await apiClient('/api/v1/notifications/device-token', {
            method: 'POST',
            body: JSON.stringify({
              fcmToken: token.value,
              platform: 'android',
            }),
            skipAuthEvents: true,
          });
          localStorage.setItem('booyah_fcm_token', token.value);
        } catch (err) {
          console.error('[PushNotifications] Failed to sync device token with backend:', err);
        }
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.error('[PushNotifications] FCM registration error:', err);
      });

      // Handle incoming notification when app is in foreground
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        playNotificationSound();

        // Show in-app banner toast
        window.dispatchEvent(
          new CustomEvent('bw_inapp_notification', {
            detail: {
              id: notification.id || String(Date.now()),
              title: notification.title || 'Booyah Win Alert',
              message: notification.body || '',
              actionUrl: notification.data?.actionUrl,
              createdAt: Date.now(),
            },
          })
        );

        // Refresh unread indicators
        window.dispatchEvent(new CustomEvent('booyah_notifications_updated'));

        // Also trigger native heads-up system notification
        showSystemNotification({
          title: notification.title || 'Booyah Win',
          body: notification.body || '',
          actionUrl: notification.data?.actionUrl,
        });
      });

      // Handle user tapping a push notification
      PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        const actionUrl = action.notification.data?.actionUrl || '/notifications';
        if (onNotificationTap) {
          onNotificationTap(actionUrl);
        } else {
          window.location.href = actionUrl;
        }
      });

      isPushListenersRegistered = true;
    }

    // 4. Register with FCM
    await PushNotifications.register();
  } catch (err) {
    console.error('[PushNotifications] Initialization failed:', err);
  }
}
