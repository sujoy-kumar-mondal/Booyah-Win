import { Router, Request, Response, NextFunction } from 'express';
import { authenticateStaff } from '../../middleware/auth.js';
import { staffAuthRouter } from '../auth/auth.routes.js';

export const staffRouter = Router();

// Staff authentication subroutes: /staff/auth/login/*, /staff/auth/logout
staffRouter.use('/auth', staffAuthRouter);

// Staff me endpoint: /staff/me
staffRouter.get('/me', authenticateStaff, (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ data: { profile: req.staff } });
  } catch (err) {
    next(err);
  }
});
