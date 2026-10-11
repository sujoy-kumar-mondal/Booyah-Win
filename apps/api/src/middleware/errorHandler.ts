import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import { ErrorCode, ErrorCodes } from '@booyah/shared';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: any;

  constructor(code: ErrorCode, message: string, statusCode = 400, details: any = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? {},
      },
    });
    return;
  }

  // Check err.name === 'ZodError' for monorepo cross-package safety
  if (err instanceof ZodError || err?.name === 'ZodError') {
    res.status(400).json({
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        details: err.flatten ? err.flatten() : err.errors,
      },
    });
    return;
  }

  if (err?.name === 'MulterError') {
    res.status(400).json({
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: err.code === 'LIMIT_FILE_SIZE' ? 'File too large: maximum 2 MB' : 'File upload error',
        details: { code: err.code },
      },
    });
    return;
  }

  if (err instanceof jwt.TokenExpiredError) {
    res.status(401).json({
      error: {
        code: ErrorCodes.UNAUTHENTICATED,
        message: 'Token has expired',
        details: {},
      },
    });
    return;
  }

  if (err instanceof jwt.JsonWebTokenError) {
    res.status(401).json({
      error: {
        code: ErrorCodes.UNAUTHENTICATED,
        message: 'Invalid token',
        details: {},
      },
    });
    return;
  }

  // Database unique violation fallback (code 23505)
  if (err?.code === '23505') {
    const constraint = err?.constraint || '';
    if (constraint.includes('users_email') || constraint.includes('users_email_key')) {
      res.status(409).json({
        error: { code: ErrorCodes.EMAIL_EXISTS, message: 'Email already exists', details: {} },
      });
      return;
    }
    if (constraint.includes('users_mobile') || constraint.includes('users_mobile_key')) {
      res.status(409).json({
        error: { code: ErrorCodes.MOBILE_EXISTS, message: 'Mobile already exists', details: {} },
      });
      return;
    }
    if (constraint.includes('users_ff_id') || constraint.includes('users_ff_id_key')) {
      res.status(409).json({
        error: { code: ErrorCodes.FF_ID_EXISTS, message: 'Free Fire ID already exists', details: {} },
      });
      return;
    }
    if (constraint.includes('users_upi')) {
      res.status(409).json({
        error: { code: ErrorCodes.UPI_EXISTS, message: 'UPI ID already exists', details: {} },
      });
      return;
    }
    if (constraint === 'deposit_requests_utr_active_unique') {
      res.status(409).json({
        error: { code: ErrorCodes.UTR_EXISTS, message: 'This UTR has already been submitted', details: {} },
      });
      return;
    }
    if (constraint === 'withdrawal_requests_user_pending_unique') {
      res.status(409).json({
        error: { code: ErrorCodes.WITHDRAWAL_PENDING, message: 'You already have a pending withdrawal', details: {} },
      });
      return;
    }
    if (
      constraint === 'match_players_match_id_user_id_active_unique' ||
      constraint === 'match_players_match_id_user_id_key'
    ) {
      res.status(409).json({
        error: { code: ErrorCodes.ALREADY_JOINED, message: 'You have already joined this match', details: {} },
      });
      return;
    }
  }

  // Database check-constraint violation (code 23514)
  if (err?.code === '23514') {
    const constraint = err?.constraint || '';
    if (
      constraint === 'wallets_add_money_check' ||
      constraint === 'wallets_cashback_check' ||
      constraint === 'wallets_winning_check'
    ) {
      res.status(402).json({
        error: {
          code: ErrorCodes.LOW_BALANCE,
          message: 'Low balance, please add money',
          details: {},
        },
      });
      return;
    }

    logger.warn({ constraint }, 'Database check constraint violation');
    res.status(400).json({
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation error: constraint check failed',
        details: {},
      },
    });
    return;
  }


  // Database lock_timeout (55P03) and query_canceled / statement_timeout (57014)
  if (err?.code === '55P03' || err?.code === '57014') {
    logger.warn({ code: err.code }, 'Database lock/statement timeout');
    res.status(503).json({
      error: {
        code: ErrorCodes.DATABASE_BUSY,
        message: 'Database server is busy. Please retry shortly.',
        details: {},
      },
    });
    return;
  }

  // Fallback internal server error
  logger.error({ err, path: req.path }, 'Unhandled server error');
  res.status(500).json({
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'Internal server error',
      details: {},
    },
  });
}
