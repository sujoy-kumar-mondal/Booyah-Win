import { Request, Response, NextFunction } from 'express';
import {
  listMatchesUser,
  getMatchUser,
  joinMatchSolo,
} from './matches.service.js';

export class MatchesController {
  static async listMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matches = await listMatchesUser(req.user!.id);
      res.status(200).json({ data: { matches } });
    } catch (err) {
      next(err);
    }
  }

  static async getMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const match = await getMatchUser(req.user!.id, id);
      res.status(200).json({ data: { match } });
    } catch (err) {
      next(err);
    }
  }

  static async joinMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await joinMatchSolo(req.user!.id, id);
      res.status(200).json({
        data: {
          message: 'Successfully joined match',
          matchId: result.matchId,
          joinedAt: result.joinedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
