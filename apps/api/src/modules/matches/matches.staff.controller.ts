import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createMatchStaff,
  listMatchesStaff,
  getMatchDetailStaff,
  openRoomStaff,
  goLiveStaff,
  cancelMatchStaff,
} from './matches.staff.service.js';

export class StaffMatchesController {
  static async createMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tierId, startTime } = req.body;
      const match = await createMatchStaff(req.staff!.id, { tierId, startTime });
      res.status(201).json({ data: { match } });
    } catch (err) {
      next(err);
    }
  }

  static async listMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, gameMode, teamMode, from, to, limit, cursor } = req.query as {
        status?: string;
        gameMode?: string;
        teamMode?: string;
        from?: string;
        to?: string;
        limit?: string;
        cursor?: string;
      };

      const { items, nextCursor } = await listMatchesStaff({
        status,
        gameMode,
        teamMode,
        from,
        to,
        limit: limit ? Number(limit) : undefined,
        cursor,
      });

      res.status(200).json({ data: { matches: items, nextCursor } });
    } catch (err) {
      next(err);
    }
  }

  static async getMatchDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const match = await getMatchDetailStaff(id);
      res.status(200).json({ data: { match } });
    } catch (err) {
      next(err);
    }
  }

  static async openRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { roomId, roomPassword } = req.body;
      await openRoomStaff(req.staff!.id, id, roomId, roomPassword);
      res.status(200).json({ data: { message: 'Room opened successfully' } });
    } catch (err) {
      next(err);
    }
  }

  static async goLive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await goLiveStaff(req.staff!.id, id, req.staff!.role);
      res.status(200).json({ data: { message: 'Match is now live' } });
    } catch (err) {
      next(err);
    }
  }

  static async cancelMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const cancelMatchSchema = z.object({
        reason: z.string().trim().min(3, 'Cancellation reason is required (min 3 characters)').max(500),
      });
      const { reason } = cancelMatchSchema.parse(req.body);
      await cancelMatchStaff(req.staff!.id, req.staff!.role, id, reason);
      res.status(200).json({ data: { message: 'Match cancelled and players refunded' } });
    } catch (err) {
      next(err);
    }
  }
}
