import { Router, Request, Response, NextFunction } from 'express';
import { authenticateStaff, requireStaff } from '../../middleware/auth.js';
import { staffAuthRouter } from '../auth/auth.routes.js';
import { TierController } from '../admin/tiers/tier.controller.js';
import { DashboardController } from './dashboard.controller.js';

export const staffRouter = Router();

// Staff authentication subroutes: /staff/auth/login/*, /staff/auth/logout
staffRouter.use('/auth', staffAuthRouter);

// Staff me endpoint: /staff/me
staffRouter.get('/me', authenticateStaff, requireStaff, (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ data: { profile: req.staff } });
  } catch (err) {
    next(err);
  }
});

// Change #5: GET /staff/entry-tiers (active tiers, accessible to any staff role)
staffRouter.get('/entry-tiers', authenticateStaff, requireStaff, TierController.listTiers);

// Staff Dashboard: /staff/dashboard
staffRouter.get('/dashboard', authenticateStaff, requireStaff, DashboardController.getDashboard);
