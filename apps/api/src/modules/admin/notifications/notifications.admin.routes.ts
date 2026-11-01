import { Router } from 'express';
import { authenticateStaff, requireAdmin } from '../../../middleware/auth.js';
import { staffWriteRateLimit } from '../../../middleware/rateLimiters.js';
import { AdminNotificationsController } from './notifications.admin.controller.js';

export const adminNotificationsRouter = Router();

adminNotificationsRouter.use(authenticateStaff, requireAdmin, staffWriteRateLimit);

adminNotificationsRouter.get('/', AdminNotificationsController.listNotifications);
adminNotificationsRouter.post('/', AdminNotificationsController.createNotification);
adminNotificationsRouter.delete('/:id', AdminNotificationsController.deleteNotification);

