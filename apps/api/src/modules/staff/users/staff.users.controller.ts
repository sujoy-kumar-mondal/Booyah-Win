import { Request, Response, NextFunction } from 'express';
import { StaffUsersService } from './staff.users.service.js';

export class StaffUsersController {
  static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query.q as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const cursor = req.query.cursor as string | undefined;

      const data = await StaffUsersService.listUsers({ q, limit, cursor });
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  static async getUserDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const staffId = req.staff!.id;
      const staffRole = req.staff!.role;

      const data = await StaffUsersService.getUserDetail(staffId, staffRole, id);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }
}
