import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ErrorCodes } from '@booyah/shared';
import { authenticateUser, requireUser, authenticateOptionalUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { idParamHandler } from '../../middleware/validate.js';
import { MatchesController } from './matches.controller.js';
import { TeamsController } from './teams.controller.js';
import { maintenanceGuard } from '../../middleware/maintenance.js';

export const matchesRouter = Router();

// Per-user rate limit on match join: 10/min
const joinRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `match_join:${(req as any).user?.id ?? req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.app.get('enableRateLimiting') === false,
  handler: (_req, _res, next) => {
    next(new AppError(ErrorCodes.RATE_LIMITED, 'Too many requests. Please slow down.', 429));
  },
});

// Per-user rate limit on team creation: 10/min
const teamCreateRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `team_create:${(req as any).user?.id ?? req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.app.get('enableRateLimiting') === false,
  handler: (_req, _res, next) => {
    next(new AppError(ErrorCodes.RATE_LIMITED, 'Too many requests. Please slow down.', 429));
  },
});

// Per-user rate limit on team replace & disband: 10/min (SEC-04)
export const teamManageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `team_manage:${(req as any).user?.id ?? req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.app.get('enableRateLimiting') === false,
  handler: (_req, _res, next) => {
    next(new AppError(ErrorCodes.RATE_LIMITED, 'Too many requests. Please slow down.', 429));
  },
});

matchesRouter.param('id', idParamHandler);

// Public / optionally authenticated read endpoints (shows matches to logged-out users)
matchesRouter.get('/', authenticateOptionalUser, MatchesController.listMatches);
matchesRouter.get('/:id', authenticateOptionalUser, MatchesController.getMatch);

// Authenticated mutating endpoints
matchesRouter.post('/:id/join', authenticateUser, requireUser, maintenanceGuard, joinRateLimit, MatchesController.joinMatch);

// Milestone 6 team endpoints (strictly authenticated)
matchesRouter.post('/:id/teams', authenticateUser, requireUser, maintenanceGuard, teamCreateRateLimit, TeamsController.createTeam);
matchesRouter.post('/:id/teams/mine/replace', authenticateUser, requireUser, maintenanceGuard, teamManageRateLimit, TeamsController.replaceInvite);
matchesRouter.delete('/:id/teams/mine', authenticateUser, requireUser, maintenanceGuard, teamManageRateLimit, TeamsController.disbandTeam);

