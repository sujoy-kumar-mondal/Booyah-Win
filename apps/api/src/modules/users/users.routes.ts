import { Router, Request, Response, NextFunction } from 'express';
import { authenticateUser } from '../../middleware/auth.js';
import { AuthService } from '../auth/auth.service.js';

export const usersRouter = Router();

usersRouter.get('/me', authenticateUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return;
    }
    const data = await AuthService.getUserProfileWithWallets(req.user.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});
