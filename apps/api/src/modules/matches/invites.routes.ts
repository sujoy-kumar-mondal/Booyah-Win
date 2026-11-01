import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ErrorCodes } from '@booyah/shared';
import { authenticateUser, requireUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { idParamHandler } from '../../middleware/validate.js';
import { TeamsController } from './teams.controller.js';

export const teamInvitesRouter = Router();

// Per-user rate limiter for invite accept/decline: 10 req/min
export const inviteActionRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `invite_action:${(req as any).user?.id ?? req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.app.get('enableRateLimiting') === false,
  handler: (_req, _res, next) => {
    next(new AppError(ErrorCodes.RATE_LIMITED, 'Too many requests. Please slow down.', 429));
  },
});

import { maintenanceGuard } from '../../middleware/maintenance.js';

teamInvitesRouter.use(authenticateUser, requireUser);
teamInvitesRouter.param('id', idParamHandler);

teamInvitesRouter.post('/:id/accept', maintenanceGuard, inviteActionRateLimit, TeamsController.acceptInvite);
teamInvitesRouter.post('/:id/decline', maintenanceGuard, inviteActionRateLimit, TeamsController.declineInvite);

