import { Request, Response, NextFunction } from 'express';
import { updateProfileSchema, updateLanguageSchema, ErrorCodes } from '@booyah/shared';
import { AppError } from '../../middleware/errorHandler.js';
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

  static async updateLanguage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return;
      }
      const validated = updateLanguageSchema.parse(req.body);
      const data = await UsersService.updateLanguage(req.user.id, validated.language);
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

  static async getLeaderboardRank(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return;
      }
      const { getUserLeaderboardRank } = await import('../leaderboard/leaderboard.service.js');
      const data = await getUserLeaderboardRank(req.user.id);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  static async getReferralSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return;
      }
      const data = await UsersService.getReferralSummary(req.user.id);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  static async uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return;
      }
      const file = req.file || (req.files && Array.isArray(req.files) ? req.files[0] : null);
      if (!file || !file.buffer) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Profile photo file is required', 400);
      }
      const data = await UsersService.uploadAvatar(req.user.id, file.buffer);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  static async deleteAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return;
      }
      await UsersService.deleteAvatar(req.user.id);
      res.status(200).json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  }
}
