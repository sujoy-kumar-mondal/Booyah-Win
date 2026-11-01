import webpush from 'web-push';
import { formatUserId } from '@booyah/shared';
import { query } from '../../db/index.js';
import { logger } from '../../utils/logger.js';

let cachedVapidKeys: { publicKey: string; privateKey: string } | null = null;

const DEFAULT_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@booyah.win';

/**
 * Retrieve or dynamically initialize VAPID keys.
 * Checks environment variables first, then database app_settings.
 * If absent, auto-generates and persists a keypair to app_settings.
 */
export async function getOrInitVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (cachedVapidKeys) {
    return cachedVapidKeys;
  }

  // 1. Check environment variables
  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  if (envPublic && envPrivate) {
    const keys = { publicKey: envPublic, privateKey: envPrivate };
    cachedVapidKeys = keys;
    webpush.setVapidDetails(DEFAULT_SUBJECT, envPublic, envPrivate);
    return keys;
  }

  // 2. Check app_settings in database
  try {
    const settingsRes = await query(
      `SELECT key, value FROM app_settings WHERE key IN ('vapid_public_key', 'vapid_private_key')`
    );
    const map: Record<string, string> = {};
    for (const row of settingsRes.rows) {
      map[row.key] = row.value;
    }

    if (map['vapid_public_key'] && map['vapid_private_key']) {
      const keys = {
        publicKey: map['vapid_public_key'],
        privateKey: map['vapid_private_key'],
      };
      cachedVapidKeys = keys;
      webpush.setVapidDetails(DEFAULT_SUBJECT, keys.publicKey, keys.privateKey);
      return keys;
    }

    // 3. Auto-generate new VAPID keypair and persist to database
    const newKeys = webpush.generateVAPIDKeys();
    await query(
      `INSERT INTO app_settings (key, value)
       VALUES ('vapid_public_key', $1), ('vapid_private_key', $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [newKeys.publicKey, newKeys.privateKey]
    );

    cachedVapidKeys = newKeys;
    webpush.setVapidDetails(DEFAULT_SUBJECT, newKeys.publicKey, newKeys.privateKey);
    logger.info('Generated and stored new VAPID keys for Web Push Notifications.');
    return newKeys;
  } catch (err: any) {
    // If DB is temporarily unavailable (e.g. initial setup), generate ephemeral fallback
    const fallback = webpush.generateVAPIDKeys();
    cachedVapidKeys = fallback;
    webpush.setVapidDetails(DEFAULT_SUBJECT, fallback.publicKey, fallback.privateKey);
    return fallback;
  }
}

/**
 * Get public key for browser pushManager.subscribe()
 */
export async function getVapidPublicKey(): Promise<string> {
  const keys = await getOrInitVapidKeys();
  return keys.publicKey;
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string;
}

/**
 * Register or update a browser push subscription for a user (or guest).
 */
export async function registerPushSubscription(
  userId: string | number | null,
  sub: PushSubscriptionInput
): Promise<void> {
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return;
  }

  const uId = userId ? formatUserId(userId) : null;
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = COALESCE(EXCLUDED.user_id, push_subscriptions.user_id),
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent,
       updated_at = NOW()`,
    [uId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, sub.userAgent || null]
  );
}

/**
 * Remove a browser push subscription (user turned off notifications).
 */
export async function removePushSubscription(endpoint: string): Promise<void> {
  if (!endpoint) return;
  await query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

export interface WebPushPayload {
  title: string;
  message: string;
  actionUrl?: string | null;
  icon?: string;
  badge?: string;
  tag?: string;
}

/**
 * Dispatch web push notification to specific users.
 * Automatically cleans up expired/unregistered endpoints (HTTP 404 / 410).
 */
export async function sendPushToUsers(
  userIds: (string | number)[],
  payload: WebPushPayload
): Promise<number> {
  if (!userIds || userIds.length === 0) return 0;
  await getOrInitVapidKeys();

  const expandedIds = new Set<string>();
  for (const uid of userIds) {
    if (uid !== null && uid !== undefined) {
      const s = uid.toString().trim();
      expandedIds.add(s);
      expandedIds.add(formatUserId(s));
      const raw = s.replace(/^BW-USR-/i, '');
      if (raw) expandedIds.add(raw);
    }
  }

  const subsRes = await query(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1)`,
    [Array.from(expandedIds)]
  );

  return sendPushToSubscriptionRows(subsRes.rows, payload);
}

/**
 * Broadcast web push notification to all subscribed devices.
 */
export async function sendPushBroadcast(payload: WebPushPayload): Promise<number> {
  await getOrInitVapidKeys();

  const subsRes = await query(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions`);
  return sendPushToSubscriptionRows(subsRes.rows, payload);
}

export async function sendPushToSubscriptionRows(rows: any[], payload: WebPushPayload): Promise<number> {
  if (!rows || rows.length === 0) return 0;

  const bodyData = JSON.stringify({
    title: payload.title,
    message: payload.message,
    actionUrl: payload.actionUrl || '/notifications',
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/favicon.png',
    tag: payload.tag || 'booyah-win-notification',
  });

  let sentCount = 0;
  const expiredEndpoints: string[] = [];

  const promises = rows.map(async (row) => {
    const pushSub = {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSub, bodyData, {
        urgency: 'high',
        TTL: 86400,
      });
      sentCount++;
    } catch (err: any) {
      // 404 Not Found or 410 Gone indicates the browser unregistered or reset the subscription
      if (err.statusCode === 404 || err.statusCode === 410) {
        expiredEndpoints.push(row.endpoint);
      } else {
        logger.warn({ err: err.message, endpoint: row.endpoint }, 'Push delivery error');
      }
    }
  });

  await Promise.allSettled(promises);

  // Clean up any stale/expired endpoints
  if (expiredEndpoints.length > 0) {
    try {
      await query(`DELETE FROM push_subscriptions WHERE endpoint = ANY($1)`, [expiredEndpoints]);
    } catch {
      // ignore
    }
  }

  return sentCount;
}

