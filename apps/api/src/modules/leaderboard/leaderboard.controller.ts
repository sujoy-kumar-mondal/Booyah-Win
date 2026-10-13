import { Request, Response, NextFunction } from 'express';
import { getWeeklyLeaderboard } from './leaderboard.service.js';

export class LeaderboardController {
  static async getLeaderboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await getWeeklyLeaderboard();
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }
}
