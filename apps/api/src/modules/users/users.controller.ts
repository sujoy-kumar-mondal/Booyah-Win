import { Request, Response, NextFunction } from 'express';
import { updateProfileSchema } from '@booyah/shared';
import { UsersService } from './users.service.js';

export class UsersController {
  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return;
      }
      const data = await UsersService.getProfile(req.user.id);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return;
      }
      const validated = updateProfileSchema.parse(req.body);
      const data = await UsersService.updateProfile(req.user.id, validated);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  static async getMatchHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return;
      }
      const { gameMode, teamMode, limit, cursor } = req.query as {
        gameMode?: string;
        teamMode?: string;
        limit?: string;
        cursor?: string;
      };

      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      const data = await UsersService.getMatchHistory(req.user.id, {
        gameMode,
        teamMode,
        limit: parsedLimit,
        cursor,
      });

      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }
}
