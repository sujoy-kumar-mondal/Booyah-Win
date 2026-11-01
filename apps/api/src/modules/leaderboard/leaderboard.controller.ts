import { Request, Response, NextFunction } from 'express';
import { getLeaderboard, type LeaderboardPeriod } from './leaderboard.service.js';

export class LeaderboardController {
  static async getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = (req.query.period as LeaderboardPeriod) || 'weekly';
      const data = await getLeaderboard(period);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }
}
