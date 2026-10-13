import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ErrorCodes } from '@booyah/shared';
import { config } from './config/index.js';
import { AppError, errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { staffRouter } from './modules/staff/staff.routes.js';
import { employeeAdminRouter } from './modules/admin/employees/employee.routes.js';
import { settingsAdminRouter } from './modules/admin/settings/settings.routes.js';
import { tierAdminRouter } from './modules/admin/tiers/tier.routes.js';
import { auditAdminRouter } from './modules/admin/audit/audit.routes.js';
import { adminResultsRouter } from './modules/admin/results/admin.results.routes.js';
import { adminUsersRouter } from './modules/admin/users/admin.users.routes.js';
import { SettingsController } from './modules/admin/settings/settings.controller.js';
import { StatusController } from './modules/admin/settings/status.controller.js';
import { statusRateLimit, leaderboardRateLimit } from './middleware/rateLimiters.js';
import { leaderboardRouter } from './modules/leaderboard/leaderboard.routes.js';
import { rulesRouter } from './modules/rules/rules.routes.js';
import { staffUsersRouter } from './modules/staff/users/staff.users.routes.js';
import { walletRouter } from './modules/wallet/wallet.routes.js';
import { staffWalletRouter } from './modules/wallet/staff.wallet.routes.js';
import { matchesRouter } from './modules/matches/matches.routes.js';
import { staffMatchesRouter } from './modules/matches/staff.matches.routes.js';
import { teamInvitesRouter } from './modules/matches/invites.routes.js';
import { internalRouter } from './modules/internal/internal.routes.js';
import { query } from './db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

export interface AppOptions {
  enableRateLimiting?: boolean;
  globalRateLimitMax?: number;
  globalRateLimitWindowMs?: number;
  otpIpRateLimitMax?: number;
}

export function createApp(options?: AppOptions): Express {
  const app = express();

  app.set('trust proxy', 1);

  const isRateLimitingEnabled =
    options?.enableRateLimiting ?? (config.NODE_ENV !== 'test');

  app.set('enableRateLimiting', isRateLimitingEnabled);
  if (options?.otpIpRateLimitMax) {
    app.set('otpIpRateLimitMax', options.otpIpRateLimitMax);
  }

  app.use(helmet());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (config.CORS_ORIGINS.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));

  // Dedicated rate limiter for /health
  const healthRateLimiter = rateLimit({
    windowMs: options?.globalRateLimitWindowMs ?? 60 * 1000,
    max: options?.globalRateLimitMax ?? 120, // Dedicated separate limit for monitoring/health checks (default 120)
    standardHeaders: true,
    legacyHeaders: false,
    handler: () => {
      throw new AppError(
        ErrorCodes.RATE_LIMITED,
        'Too many health check requests.',
        429
      );
    },
  });

  // Health check: separate rate limit, reuses the pool, returns zero secrets
  app.get(
    '/health',
    isRateLimitingEnabled ? healthRateLimiter : (_req: Request, _res: Response, next: NextFunction) => next(),
    async (_req: Request, res: Response) => {
      try {
        await query('SELECT 1');
        res.status(200).json({
          status: 'ok',
          database: 'connected',
          timestamp: new Date().toISOString(),
        });
      } catch {
        res.status(503).json({
          status: 'error',
          database: 'disconnected',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  if (isRateLimitingEnabled) {
    app.use(
      rateLimit({
        windowMs: options?.globalRateLimitWindowMs ?? 60 * 1000,
        max: options?.globalRateLimitMax ?? 100,
        standardHeaders: true,
        legacyHeaders: false,
        handler: () => {
          throw new AppError(
            ErrorCodes.RATE_LIMITED,
            'Too many requests. Please slow down.',
            429
          );
        },
      })
    );
  }

  // HMAC-signed local file route (dev + test only; production uses Supabase signed URLs)
  if (config.NODE_ENV !== 'production') {
    app.get('/api/v1/files/:key', (req: Request, res: Response, next: NextFunction) => {
      try {
        const { key } = req.params;

        // Path traversal protection: key must be exactly 32 hex chars + known extension
        if (!/^[0-9a-f]{32}\.(jpg|png|webp)$/.test(key)) {
          return next(new AppError(ErrorCodes.NOT_FOUND, 'File not found', 404));
        }

        const { token, expires } = req.query as { token?: string; expires?: string };
        if (!token || !expires) {
          return next(new AppError(ErrorCodes.FORBIDDEN, 'Missing token or expiry', 403));
        }

        // Check expiry
        if (Date.now() > Number(expires)) {
          return next(new AppError(ErrorCodes.FORBIDDEN, 'Signed URL has expired', 403));
        }

        // Verify HMAC (timing-safe)
        const expected = crypto
          .createHmac('sha256', config.FILE_URL_SECRET)
          .update(`${key}:${expires}`)
          .digest('hex');

        let tokenBuf: Buffer, expectedBuf: Buffer;
        try {
          tokenBuf   = Buffer.from(token, 'hex');
          expectedBuf = Buffer.from(expected, 'hex');
        } catch {
          return next(new AppError(ErrorCodes.FORBIDDEN, 'Invalid token', 403));
        }

        if (tokenBuf.length !== expectedBuf.length ||
            !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
          return next(new AppError(ErrorCodes.FORBIDDEN, 'Invalid token', 403));
        }

        const filePath = path.join(UPLOADS_DIR, key);

        // Extra traversal guard (already blocked by regex but belt-and-suspenders)
        if (!filePath.startsWith(UPLOADS_DIR + path.sep) &&
            filePath !== path.join(UPLOADS_DIR, key)) {
          return next(new AppError(ErrorCodes.FORBIDDEN, 'Invalid file path', 403));
        }

        if (!fs.existsSync(filePath)) {
          return next(new AppError(ErrorCodes.NOT_FOUND, 'File not found', 404));
        }

        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, no-transform, max-age=60');
        res.sendFile(filePath);
      } catch (err) {
        next(err);
      }
    });
  }

  // Admin sub-router
  const adminRouter = express.Router();
  adminRouter.use('/employees', employeeAdminRouter);
  adminRouter.use('/settings', settingsAdminRouter);
  adminRouter.use('/tiers', tierAdminRouter);
  adminRouter.use('/audit-logs', auditAdminRouter);
  adminRouter.use('/results', adminResultsRouter);
  adminRouter.use('/users', adminUsersRouter);

  // All routes under /api/v1 (C5 fix: no duplicate root-level aliases)
  const v1Router = express.Router();

  // Public endpoints
  v1Router.get('/support',      SettingsController.getSupportInfo);
  v1Router.get('/payment-info', SettingsController.getPaymentInfo);
  v1Router.get(
    '/status',
    isRateLimitingEnabled ? statusRateLimit : (_req: Request, _res: Response, next: NextFunction) => next(),
    StatusController.getStatus
  );
  v1Router.use(
    '/leaderboard',
    isRateLimitingEnabled ? leaderboardRateLimit : (_req: Request, _res: Response, next: NextFunction) => next(),
    leaderboardRouter
  );
  v1Router.use('/rules', rulesRouter);

  // Auth
  v1Router.use('/auth', authRouter);

  // User
  v1Router.use('/users', usersRouter);    // /api/v1/users/me, /api/v1/users/me/team-invites
  v1Router.use('/', usersRouter);         // /api/v1/me, /api/v1/me/team-invites

  // Wallet (user-facing)
  v1Router.use('/wallet', walletRouter);

  // Matches (user-facing)
  v1Router.use('/matches', matchesRouter);

  // Team Invites (user-facing)
  v1Router.use('/team-invites', teamInvitesRouter);

  // Internal jobs
  v1Router.use('/internal', internalRouter);
  app.use('/internal', internalRouter);

  // Staff
  v1Router.use('/staff', staffRouter);        // /api/v1/staff/auth, /api/v1/staff/me
  v1Router.use('/staff', staffWalletRouter);  // /api/v1/staff/deposits, /api/v1/staff/withdrawals
  v1Router.use('/staff/matches', staffMatchesRouter);
  v1Router.use('/staff/users', staffUsersRouter);

  // Admin
  v1Router.use('/admin', adminRouter);

  app.use('/api/v1', v1Router);

  // Global error handler
  app.use(errorHandler);

  return app;
}
