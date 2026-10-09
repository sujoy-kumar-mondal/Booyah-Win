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

export interface AppOptions {
  enableRateLimiting?: boolean;
  globalRateLimitMax?: number;
  globalRateLimitWindowMs?: number;
  otpIpRateLimitMax?: number;
}

export function createApp(options?: AppOptions): Express {
  const app = express();

  const isRateLimitingEnabled =
    options?.enableRateLimiting ?? (config.NODE_ENV !== 'test');

  app.set('enableRateLimiting', isRateLimitingEnabled);
  if (options?.otpIpRateLimitMax) {
    app.set('otpIpRateLimitMax', options.otpIpRateLimitMax);
  }

  // Security headers via Helmet
  app.use(helmet());

  // Strict CORS allowlist
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (such as mobile apps or server-to-server)
        if (!origin) return callback(null, true);
        if (config.CORS_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    })
  );

  // Request size limit: 1 MB JSON
  app.use(express.json({ limit: '1mb' }));

  // Global rate limiter (100 req/min/IP)
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

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Base API v1 routes
  const v1Router = express.Router();
  v1Router.use('/auth', authRouter);
  v1Router.use('/', usersRouter); // /api/v1/me
  v1Router.use('/staff', staffRouter); // /api/v1/staff/auth, /api/v1/staff/me

  app.use('/api/v1', v1Router);

  // Direct root route aliases for spec compatibility
  app.use('/auth', authRouter);
  app.use('/', usersRouter); // /me
  app.use('/staff', staffRouter); // /staff/auth, /staff/me

  // Global error handler
  app.use(errorHandler);

  return app;
}
