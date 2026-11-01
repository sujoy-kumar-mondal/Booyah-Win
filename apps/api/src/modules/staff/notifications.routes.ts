import { Router, Request, Response, NextFunction } from 'express';
import { authenticateStaff, requireStaff } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ErrorCodes } from '@booyah/shared';
import {
  listStaffNotifications,
  markStaffNotificationRead,
  markAllStaffNotificationsRead,
  registerStaffPushSubscription,
  removeStaffPushSubscription,
} from './notifications.service.js';
import { getVapidPublicKey } from '../users/webpush.service.js';

export const staffNotificationsRouter = Router();

staffNotificationsRouter.use(authenticateStaff, requireStaff);

/**
 * GET /api/v1/staff/notifications/push-key
 * Returns VAPID public key for browser pushManager.subscribe()
 */
staffNotificationsRouter.get(
  '/push-key',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const publicKey = await getVapidPublicKey();
      res.json({ data: { publicKey }, publicKey });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/staff/notifications/push-subscribe
 * Saves a browser push subscription for the active staff member
 */
staffNotificationsRouter.post(
  '/push-subscribe',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sub = req.body?.subscription || req.body || {};
      const endpoint = sub.endpoint;
      const keys = sub.keys;
      if (!endpoint || typeof endpoint !== 'string') {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Push subscription endpoint is required', 400);
      }
      if (!keys?.p256dh || !keys?.auth) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Push subscription keys (p256dh, auth) are required', 400);
      }

      const staffId = req.staff!.id;
      const userAgent = req.headers['user-agent'] as string | undefined;

      await registerStaffPushSubscription(staffId, {
        endpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        userAgent,
      });

      res.status(201).json({ message: 'Staff push subscription registered successfully' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/staff/notifications/push-unsubscribe
 */
staffNotificationsRouter.post(
  '/push-unsubscribe',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { endpoint } = req.body || {};
      if (!endpoint || typeof endpoint !== 'string') {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Push subscription endpoint is required', 400);
      }

      await removeStaffPushSubscription(endpoint);
      res.json({ message: 'Push subscription removed successfully' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/staff/notifications
 * List notifications for the authenticated staff member
 */
staffNotificationsRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const staffId = req.staff!.id;
      const staffRole = req.staff!.role;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
      const unreadOnly = req.query.unreadOnly === 'true';

      const data = await listStaffNotifications(staffId, staffRole, { limit, unreadOnly });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/staff/notifications/:id/read
 * Mark notification as read
 */
staffNotificationsRouter.patch(
  '/:id/read',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await markStaffNotificationRead(id);
      res.json({ message: 'Notification marked as read' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/staff/notifications/mark-all-read
 * Mark all notifications as read
 */
staffNotificationsRouter.post(
  '/mark-all-read',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const staffId = req.staff!.id;
      const staffRole = req.staff!.role;
      await markAllStaffNotificationsRead(staffId, staffRole);
      res.json({ message: 'All notifications marked as read' });
    } catch (err) {
      next(err);
    }
  }
);
