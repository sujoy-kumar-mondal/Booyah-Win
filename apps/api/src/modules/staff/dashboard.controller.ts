import { Request, Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service.js';

export class DashboardController {
  static async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await DashboardService.getMetrics();
      res.status(200).json({ data: metrics });
    } catch (err) {
      next(err);
    }
  }
}
