import rateLimit from 'express-rate-limit';
import { ErrorCodes } from '@booyah/shared';
import { AppError } from './errorHandler.js';

/**
 * Staff and Admin write rate limiter (Section 5.1 & Requirement 4):
 * - Runs after authentication
 * - Keys by staff user id
 * - Limits mutating requests (POST, PATCH, PUT, DELETE) to 30 requests per minute per staff member
 */
export const staffWriteRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `staff_write:${(req as any).staff?.id ?? req.ip}`,
  skip: (req) => {
    if (req.app?.get('enableRateLimiting') === false) return true;
    // Only apply to write/mutating methods
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return true;
    return false;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError(ErrorCodes.RATE_LIMITED, 'Too many write requests. Please slow down.', 429));
  },
});

/**
 * Public /api/v1/status rate limiter (Instruction 9):
 * 60 requests per minute per IP.
 */
export const statusRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.ip || 'global',
  skip: (req) => req.app?.get('enableRateLimiting') === false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError(ErrorCodes.RATE_LIMITED, 'Too many status requests. Please slow down.', 429));
  },
});

/**
 * Staff user view rate limiter (per staff member):
 * 60 requests per minute per staff member.
 */
export const staffUserViewRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => `staff_user_view:${(req as any).staff?.id ?? req.ip}`,
  skip: (req) => req.app?.get('enableRateLimiting') === false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError(ErrorCodes.RATE_LIMITED, 'Too many user inspect requests. Please slow down.', 429));
  },
});

/**
 * Public /api/v1/leaderboard rate limiter:
 * 60 requests per minute per IP.
 */
export const leaderboardRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.ip || 'global',
  skip: (req) => req.app?.get('enableRateLimiting') === false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError(ErrorCodes.RATE_LIMITED, 'Too many leaderboard requests. Please slow down.', 429));
  },
});

