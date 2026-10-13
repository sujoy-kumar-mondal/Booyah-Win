import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ErrorCodes } from '@booyah/shared';
import { authenticateUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  screenshotUpload,
  createDeposit,
  getDeposits,
  createWithdrawal,
  getWithdrawals,
  getTransactions,
} from './wallet.controller.js';

export const walletRouter = Router();

// Per-user rate limiter: 10 req/min for deposit & withdrawal endpoints
const walletRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `wallet:${(req as any).user?.id ?? req.ip}:${req.path}`,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.app.get('enableRateLimiting') === false;
  },
  handler: (_req, _res, next) => {
    next(new AppError(ErrorCodes.RATE_LIMITED, 'Too many requests. Please slow down.', 429));
  },
});

import { maintenanceGuard } from '../../middleware/maintenance.js';

// All wallet routes require authentication
walletRouter.use(authenticateUser);

// Deposits
walletRouter.post('/deposits', maintenanceGuard, walletRateLimit, screenshotUpload, createDeposit);
walletRouter.get('/deposits', getDeposits);

// Withdrawals
walletRouter.post('/withdrawals', maintenanceGuard, walletRateLimit, createWithdrawal);
walletRouter.get('/withdrawals', getWithdrawals);

// Transaction history
walletRouter.get('/transactions', getTransactions);
