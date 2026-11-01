import { Request, Response, NextFunction } from 'express';
import {
  adminCreateNotification,
  adminListNotifications,
  adminDeleteNotification,
} from '../../users/notifications.service.js';

export class AdminNotificationsController {
  static async listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const data = await adminListNotifications({ limit, offset });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }

  static async createNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffId = req.staff!.id;
      const created = await adminCreateNotification(staffId, req.body);
      res.status(201).json({ data: created });
    } catch (err) {
      next(err);
    }
  }

  static async deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await adminDeleteNotification(id);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  }
}

