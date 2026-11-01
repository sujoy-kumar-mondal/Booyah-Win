import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { query } from '../../db/index.js';
import { logger } from '../../utils/logger.js';

let firebaseApp: App | null = null;

/**
 * Initializes Firebase Admin SDK safely.
 * Checks for FIREBASE_SERVICE_ACCOUNT_JSON in environment.
 */
export function initFirebaseAdmin(): App | null {
  if (firebaseApp) return firebaseApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    return firebaseApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set. Native FCM push notifications disabled.');
    return null;
  }

  try {
    const credentials = JSON.parse(serviceAccountJson);
    firebaseApp = initializeApp({
      credential: cert(credentials),
    });
    logger.info('Firebase Admin SDK initialized successfully for Android push.');
    return firebaseApp;
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON.');
    return null;
  }
}

/**
 * Upsert FCM token for a user.
 */
export async function upsertDeviceToken(
  userId: string,
  fcmToken: string,
  platform = 'android'
): Promise<void> {
  const normalizedUserId = userId.startsWith('BW-USR-') ? userId : `BW-USR-${userId}`;

  await query(
    `INSERT INTO device_tokens (user_id, fcm_token, platform, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (fcm_token)
     DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = now()`,
    [normalizedUserId, fcmToken, platform]
  );
}

/**
 * Remove an invalid or uninstalled device token.
 */
export async function removeDeviceToken(fcmToken: string): Promise<void> {
  await query(`DELETE FROM device_tokens WHERE fcm_token = $1`, [fcmToken]);
}

export interface FcmPayload {
  title: string;
  message: string;
  actionUrl?: string;
  data?: Record<string, string>;
}

/**
 * Dispatches push notifications to Android devices via FCM.
 */
export async function sendFcmToUsers(
  userIds: string | string[],
  payload: FcmPayload
): Promise<number> {
  const app = initFirebaseAdmin();
  if (!app) return 0;

  const ids = Array.isArray(userIds) ? userIds : [userIds];
  const normalizedIds = ids.map((id) => (id.startsWith('BW-USR-') ? id : `BW-USR-${id}`));

  const result = await query(
    `SELECT fcm_token FROM device_tokens WHERE user_id = ANY($1)`,
    [normalizedIds]
  );

  if (!result.rows || result.rows.length === 0) return 0;

  const tokens = result.rows.map((r: { fcm_token: string }) => r.fcm_token);
  const messaging = getMessaging(app);

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: payload.title,
      body: payload.message,
    },
    data: {
      actionUrl: payload.actionUrl || '/notifications',
      ...(payload.data || {}),
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'booyah_match_alerts',
        sound: 'default',
        icon: 'ic_stat_icon',
      },
    },
  });

  // Prune dead/invalid tokens automatically
  const deadTokens: string[] = [];
  response.responses.forEach((resp: { success: boolean; error?: any }, idx: number) => {
    if (!resp.success && resp.error) {
      const code = resp.error.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        deadTokens.push(tokens[idx]);
      }
    }
  });

  if (deadTokens.length > 0) {
    try {
      await query(`DELETE FROM device_tokens WHERE fcm_token = ANY($1)`, [deadTokens]);
    } catch {
      // ignore
    }
  }

  return response.successCount;
}
