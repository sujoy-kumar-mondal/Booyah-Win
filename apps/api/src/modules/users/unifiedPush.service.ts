import { sendPushToUsers, WebPushPayload } from './webpush.service.js';
import { sendFcmToUsers, FcmPayload } from './fcm.service.js';
import { logger } from '../../utils/logger.js';

export interface PushNotificationPayload {
  title: string;
  message: string;
  actionUrl?: string;
  data?: Record<string, string>;
}

/**
 * Dispatches notification to both Web-Push browsers and native Android devices.
 */
export async function sendUnifiedPushNotification(
  userIds: string | string[],
  payload: PushNotificationPayload
): Promise<{ webCount: number; fcmCount: number }> {
  const ids = Array.isArray(userIds) ? userIds : [userIds];

  const webPayload: WebPushPayload = {
    title: payload.title,
    message: payload.message,
    actionUrl: payload.actionUrl,
  };

  const fcmPayload: FcmPayload = {
    title: payload.title,
    message: payload.message,
    actionUrl: payload.actionUrl,
    data: payload.data,
  };

  const [webResult, fcmResult] = await Promise.allSettled([
    sendPushToUsers(ids, webPayload),
    sendFcmToUsers(ids, fcmPayload),
  ]);

  const webCount = webResult.status === 'fulfilled' ? webResult.value : 0;
  const fcmCount = fcmResult.status === 'fulfilled' ? fcmResult.value : 0;

  logger.info({ userIds: ids, webCount, fcmCount }, 'Dispatched unified push notification');

  return { webCount, fcmCount };
}
