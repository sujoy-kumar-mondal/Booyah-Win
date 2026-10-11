import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ErrorCodes } from '@booyah/shared';
import { query } from '../../../db/index.js';
import { AppError } from '../../../middleware/errorHandler.js';
import {
  approveResultAdmin,
  rejectResultAdmin,
  reverseResultAdmin,
  previewPayoutsAdmin,
} from '../../matches/results.service.js';

export class AdminResultsController {
  static async listPendingQueue(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await query<{
        id: string;
        match_id: string;
        status: string;
        submitted_by: string;
        created_at: Date;
        screenshot_url: string;
        game_mode: string;
        team_mode: string;
        match_status: string;
      }>(
        `SELECT mr.id, mr.match_id, mr.status, mr.submitted_by, mr.created_at, mr.screenshot_url,
                m.game_mode, m.team_mode, m.status AS match_status
         FROM match_results mr
         JOIN matches m ON m.id = mr.match_id
         WHERE mr.status = 'pending_approval' AND m.status = 'live'
         ORDER BY mr.created_at ASC`
      );

      const items = result.rows.map((r) => ({
        id: r.id.toString(),
        matchId: r.match_id.toString(),
        status: r.status,
        submittedBy: r.submitted_by.toString(),
        createdAt: r.created_at.toISOString(),
        screenshotUrl: r.screenshot_url,
        gameMode: r.game_mode,
        teamMode: r.team_mode,
        matchStatus: r.match_status,
      }));

      res.status(200).json({ data: { results: items, count: items.length } });
    } catch (err) {
      next(err);
    }
  }

  static async preview(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const matchId = req.params.matchId;
      if (!matchId) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'matchId is required',
          400
        );
      }

      const preview = await previewPayoutsAdmin(matchId);
      res.status(200).json({ data: preview });
    } catch (err) {
      next(err);
    }
  }

  static async approve(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.staff) {
        throw new AppError(
          ErrorCodes.UNAUTHENTICATED,
          'Staff authentication required',
          401
        );
      }

      const matchId = req.params.matchId;
      if (!matchId) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'matchId is required',
          400
        );
      }

      await approveResultAdmin(req.staff.id, req.staff.role, matchId);
      res.status(200).json({
        data: {
          matchId,
          status: 'approved',
          message: 'Result approved and payouts credited',
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async reject(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.staff) {
        throw new AppError(
          ErrorCodes.UNAUTHENTICATED,
          'Staff authentication required',
          401
        );
      }

      const matchId = req.params.matchId;
      if (!matchId) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'matchId is required',
          400
        );
      }

      const rejectSchema = z.object({
        reason: z.string().trim().min(1, 'Reject reason is required').max(500),
      });
      const { reason } = rejectSchema.parse(req.body);

      await rejectResultAdmin(req.staff.id, req.staff.role, matchId, reason);
      res.status(200).json({
        data: {
          matchId,
          status: 'rejected',
          reason: reason.trim(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async reverse(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.staff) {
        throw new AppError(
          ErrorCodes.UNAUTHENTICATED,
          'Staff authentication required',
          401
        );
      }

      const matchId = req.params.matchId;
      if (!matchId) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'matchId is required',
          400
        );
      }

      const reverseSchema = z.object({
        reason: z.string().trim().min(1, 'Reversal reason is required').max(500),
      });
      const { reason } = reverseSchema.parse(req.body);

      await reverseResultAdmin(req.staff.id, req.staff.role, matchId, reason);
      res.status(200).json({
        data: {
          matchId,
          status: 'reversed',
          message: 'Result reversed and payouts debited',
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
