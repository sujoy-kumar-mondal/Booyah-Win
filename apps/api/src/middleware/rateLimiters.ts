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
