import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { ErrorCodes } from '@booyah/shared';
import { AppError } from '../../middleware/errorHandler.js';
import { runSchedulerTick } from './scheduler.service.js';
import { forceRefreshLeaderboards, type LeaderboardPeriod } from '../leaderboard/leaderboard.service.js';

export class SchedulerController {
  static async tick(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const headerSecret = (req.headers['x-cron-secret'] || '') as string;
      const expectedSecret = process.env.CRON_SECRET || '';

      if (!headerSecret || !expectedSecret) {
        throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Cron secret required', 401);
      }

      const headerBuf = Buffer.from(headerSecret);
      const expectedBuf = Buffer.from(expectedSecret);

      if (
        headerBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(headerBuf, expectedBuf)
      ) {
        throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Invalid cron secret', 401);
      }

      const result = await runSchedulerTick();
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async refreshLeaderboards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const headerSecret = (req.headers['x-cron-secret'] || '') as string;
      const expectedSecret = process.env.CRON_SECRET || '';

      if (!headerSecret || !expectedSecret) {
        throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Cron secret required', 401);
      }

      const headerBuf = Buffer.from(headerSecret);
      const expectedBuf = Buffer.from(expectedSecret);

      if (
        headerBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(headerBuf, expectedBuf)
      ) {
        throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Invalid cron secret', 401);
      }

      const periodParam = (req.query.period as string) || 'all';
      let periods: LeaderboardPeriod[];
      if (periodParam === 'weekly') periods = ['weekly'];
      else if (periodParam === 'monthly') periods = ['monthly'];
      else if (periodParam === 'overall') periods = ['overall'];
      else periods = ['weekly', 'monthly', 'overall'];

      const result = await forceRefreshLeaderboards(periods);
      res.status(200).json({
        data: {
          refreshed: true,
          periods,
          result,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
