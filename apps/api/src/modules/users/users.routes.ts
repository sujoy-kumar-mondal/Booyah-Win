import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { ErrorCodes } from '@booyah/shared';
import { authenticateUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { maintenanceGuard } from '../../middleware/maintenance.js';
import { TeamsController } from '../matches/teams.controller.js';
import { UsersController } from './users.controller.js';

export const usersRouter = Router();

// Rate limit PATCH /me/profile to 10/min per user
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

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Invalid file type: profile photo must be JPEG, PNG, or WebP',
          400
        )
      );
    }
  },
});

function handleAvatarUpload(req: Request, res: Response, next: NextFunction): void {
  avatarUpload.any()(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new AppError(
            ErrorCodes.VALIDATION_ERROR,
            'File too large: maximum 2 MB',
            400
          )
        );
      }
      return next(err);
    }
    next();
  });
}

// Profile endpoints
usersRouter.get('/me', authenticateUser, UsersController.getProfile);
usersRouter.patch('/me/profile', authenticateUser, maintenanceGuard, profileUpdateRateLimiter, UsersController.updateProfile);
usersRouter.patch('/profile', authenticateUser, maintenanceGuard, profileUpdateRateLimiter, UsersController.updateProfile);

// Language preference endpoints (allowlisted during maintenance mode)
usersRouter.patch('/me/language', authenticateUser, UsersController.updateLanguage);
usersRouter.patch('/language', authenticateUser, UsersController.updateLanguage);

// Avatar upload & deletion endpoints
usersRouter.post('/me/avatar', authenticateUser, maintenanceGuard, handleAvatarUpload, UsersController.uploadAvatar);
usersRouter.delete('/me/avatar', authenticateUser, maintenanceGuard, UsersController.deleteAvatar);

// Match history endpoints
usersRouter.get('/me/match-history', authenticateUser, UsersController.getMatchHistory);
usersRouter.get('/match-history', authenticateUser, UsersController.getMatchHistory);

// Team invites
usersRouter.get('/me/team-invites', authenticateUser, TeamsController.listUserInvites);

// Leaderboard rank
usersRouter.get('/me/leaderboard-rank', authenticateUser, UsersController.getLeaderboardRank);

// Referral summary
usersRouter.get('/me/referral-summary', authenticateUser, UsersController.getReferralSummary);
