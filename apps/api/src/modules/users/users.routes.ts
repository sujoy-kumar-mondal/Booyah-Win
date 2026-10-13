import { Router, Request } from 'express';
import rateLimit from 'express-rate-limit';
import { ErrorCodes } from '@booyah/shared';
import { authenticateUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { TeamsController } from '../matches/teams.controller.js';
import { UsersController } from './users.controller.js';

export const usersRouter = Router();

// Requirement 7: Rate limit PATCH /me/profile to 10/min per user
const profileUpdateRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req: Request) => req.user?.id || req.ip || 'global',
  skip: (req: Request) => !req.app.get('enableRateLimiting'),
  standardHeaders: true,
  legacyHeaders: false,
  handler: () => {
    throw new AppError(
      ErrorCodes.RATE_LIMITED,
      'Too many profile update requests. Please slow down.',
      429
    );
  },
});

import { maintenanceGuard } from '../../middleware/maintenance.js';

// Profile endpoints
usersRouter.get('/me', authenticateUser, UsersController.getProfile);
usersRouter.patch('/me/profile', authenticateUser, maintenanceGuard, profileUpdateRateLimiter, UsersController.updateProfile);
usersRouter.patch('/profile', authenticateUser, maintenanceGuard, profileUpdateRateLimiter, UsersController.updateProfile);

// Match history endpoints
usersRouter.get('/me/match-history', authenticateUser, UsersController.getMatchHistory);
usersRouter.get('/match-history', authenticateUser, UsersController.getMatchHistory);

// Team invites
usersRouter.get('/me/team-invites', authenticateUser, TeamsController.listUserInvites);

// Leaderboard rank
usersRouter.get('/me/leaderboard-rank', authenticateUser, UsersController.getLeaderboardRank);

// Referral summary
usersRouter.get('/me/referral-summary', authenticateUser, UsersController.getReferralSummary);
