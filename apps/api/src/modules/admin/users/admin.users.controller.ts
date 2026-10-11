import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminAdjustmentSchema } from '@booyah/shared';
import { AdminUsersService } from './admin.users.service.js';

export class AdminUsersController {
  static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, limit, cursor } = req.query as {
        q?: string;
        limit?: string;
        cursor?: string;
      };

      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      const data = await AdminUsersService.listUsers({
        q,
        limit: parsedLimit,
        cursor,
      });

      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  static async getUserDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = await AdminUsersService.getUserDetail(id);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  static async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const deleteUserSchema = z.object({
        reason: z.string().trim().min(5, 'Delete reason must be at least 5 characters').max(500),
      });
      const { reason } = deleteUserSchema.parse(req.body);
      await AdminUsersService.deleteUser(req.staff!.id, id, reason);
      res.status(200).json({
        data: {
          id,
          message: 'User deleted successfully',
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async adjustBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validated = adminAdjustmentSchema.parse(req.body);
      const data = await AdminUsersService.adjustBalance(req.staff!.id, id, validated);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }
}
