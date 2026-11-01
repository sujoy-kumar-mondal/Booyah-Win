import { Router, Request, Response, NextFunction } from 'express';
import { authenticateUser, authenticateOptionalUser, requireUser } from '../../middleware/auth.js';
import { upsertDeviceToken, removeDeviceToken } from './fcm.service.js';
import { maintenanceGuard } from '../../middleware/maintenance.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ErrorCodes } from '@booyah/shared';
import {
  getVapidPublicKey,
  registerPushSubscription,
  removePushSubscription,
  sendPushToUsers,
} from './webpush.service.js';

export const notificationsRouter = Router();

/**
 * GET /api/v1/notifications/push-key
 * Returns VAPID public key for browser pushManager.subscribe()
 */
notificationsRouter.get(
  '/push-key',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const publicKey = await getVapidPublicKey();
      res.json({ data: { publicKey } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/notifications/push-subscribe
 * Saves a browser push subscription for the active user (or device)
 */
notificationsRouter.post(
  '/push-subscribe',
  maintenanceGuard,
  authenticateOptionalUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { endpoint, keys } = req.body || {};
      if (!endpoint || typeof endpoint !== 'string') {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Push subscription endpoint is required', 400);
      }
      if (!keys?.p256dh || !keys?.auth) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Push subscription keys (p256dh, auth) are required', 400);
      }

      const userId = req.user?.id || null;
      const userAgent = req.headers['user-agent'] as string | undefined;

      await registerPushSubscription(userId, {
        endpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        userAgent,
      });

      res.status(201).json({ message: 'Push subscription registered successfully' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/notifications/push-unsubscribe
 * Removes a browser push subscription endpoint
 */
notificationsRouter.post(
  '/push-unsubscribe',
  maintenanceGuard,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { endpoint } = req.body || {};
      if (!endpoint || typeof endpoint !== 'string') {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Push subscription endpoint is required', 400);
      }

      await removePushSubscription(endpoint);
      res.json({ message: 'Push subscription removed successfully' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/notifications/push-debug
 * Telemetry endpoint to diagnose client push capability and permission status
 */
notificationsRouter.post(
  '/push-debug',
  maintenanceGuard,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { query: dbQuery } = await import('../../db/index.js');
      const item = req.body;
      const existing = await dbQuery(`SELECT value FROM app_settings WHERE key = 'push_debug_logs'`);
      let list = [];
      try {
        if (existing.rows[0]?.value) {
          list = JSON.parse(existing.rows[0].value);
        }
      } catch {}
      list.push(item);
      if (list.length > 25) list = list.slice(-25);
      await dbQuery(
        `INSERT INTO app_settings (key, value) VALUES ('push_debug_logs', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [JSON.stringify(list)]
      );
    } catch {}
    res.json({ ok: true });
  }
);

/**
 * POST /api/v1/notifications/push-test
 * Dispatches an instant test push notification to this user's registered devices
 */
notificationsRouter.post(
  '/push-test',
  maintenanceGuard,
  authenticateOptionalUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authentication required to test push notifications', 401);
      }

      const sentCount = await sendPushToUsers([userId], {
        title: 'Booyah Win 🔥',
        message: 'Push notifications are working! Match room credentials and alerts will appear right here.',
        actionUrl: '/notifications',
      });

      res.json({
        data: { sentCount },
        message: sentCount > 0 ? 'Test push notification dispatched' : 'No active subscriptions found for this user',
      });
    } catch (err) {
      next(err);
    }
  }
);


/**
 * POST /api/v1/notifications/device-token
 * Registers an Android FCM token for the authenticated user.
 */
notificationsRouter.post(
  '/device-token',
  maintenanceGuard,
  authenticateUser,
  requireUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fcmToken, platform = 'android' } = req.body || {};
      if (!fcmToken || typeof fcmToken !== 'string') {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'fcmToken is required', 400);
      }

      await upsertDeviceToken(req.user!.id, fcmToken, platform);
      res.status(201).json({ message: 'Device token registered successfully' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/notifications/device-token
 * Removes an Android FCM token upon logout.
 */
notificationsRouter.delete(
  '/device-token',
  maintenanceGuard,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fcmToken } = req.body || {};
      if (fcmToken) {
        await removeDeviceToken(fcmToken);
      }
      res.json({ message: 'Device token removed successfully' });
    } catch (err) {
      next(err);
    }
  }
);
