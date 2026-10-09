import { Request, Response, NextFunction } from 'express';
import { ErrorCodes } from '@booyah/shared';
import { query } from '../db/index.js';
import { verifySessionToken } from '../utils/crypto.js';
import { AppError } from './errorHandler.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  mobile: string;
  ffId: string;
  ffName: string;
  upiId: string;
  dateOfBirth: string;
  referralCode: string;
  referredBy: string | null;
}

export interface AuthenticatedStaff {
  id: string;
  role: 'admin' | 'employee';
  name: string;
  email: string;
  mobile: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      staff?: AuthenticatedStaff;
      sessionId?: string;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return null;
}

/**
 * Middleware: authenticates a user token for player endpoints (e.g. /me)
 * Rejects staff tokens or wrong token types
 */
export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authentication token required', 401);
    }

    let payload;
    try {
      payload = verifySessionToken(token);
    } catch {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Invalid or expired token', 401);
    }

    // Must be a user token
    if (payload.typ !== 'user') {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Invalid token type for user endpoint', 401);
    }

    // Lookup session using both account_type and account_id
    const sessionRes = await query(
      'SELECT id FROM sessions WHERE account_type = $1 AND account_id = $2',
      [payload.typ, payload.sub]
    );

    if (sessionRes.rowCount === 0 || sessionRes.rows[0].id !== payload.sid) {
      throw new AppError(
        ErrorCodes.SESSION_REPLACED,
        'You were logged out because your account was used on another device.',
        401
      );
    }

    // Load user profile and check not soft-deleted
    const userRes = await query(
      `SELECT id, email, name, mobile, ff_id, ff_name, upi_id, to_char(date_of_birth, 'YYYY-MM-DD') as date_of_birth,
              referral_code, referred_by, deleted_at
       FROM users WHERE id = $1`,
      [payload.sub]
    );

    if (userRes.rowCount === 0 || userRes.rows[0].deleted_at !== null) {
      // Soft-deleted or not found: delete session and block
      await query('DELETE FROM sessions WHERE account_type = $1 AND account_id = $2', [
        payload.typ,
        payload.sub,
      ]);
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Account is inactive or deleted', 401);
    }

    const row = userRes.rows[0];
    req.user = {
      id: row.id.toString(),
      email: row.email,
      name: row.name,
      mobile: row.mobile,
      ffId: row.ff_id,
      ffName: row.ff_name,
      upiId: row.upi_id,
      dateOfBirth: row.date_of_birth,
      referralCode: row.referral_code,
      referredBy: row.referred_by ? row.referred_by.toString() : null,
    };
    req.sessionId = payload.sid;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: authenticates a staff token (Bearer token only) for staff endpoints (e.g. /staff/*)
 * Rejects user tokens or wrong token types
 */
export async function authenticateStaff(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Staff authentication token required', 401);
    }

    let payload;
    try {
      payload = verifySessionToken(token);
    } catch {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Invalid or expired token', 401);
    }

    // Must be a staff token
    if (payload.typ !== 'staff') {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Invalid token type for staff endpoint', 401);
    }

    // Lookup session using both account_type and account_id
    const sessionRes = await query(
      'SELECT id FROM sessions WHERE account_type = $1 AND account_id = $2',
      [payload.typ, payload.sub]
    );

    if (sessionRes.rowCount === 0 || sessionRes.rows[0].id !== payload.sid) {
      throw new AppError(
        ErrorCodes.SESSION_REPLACED,
        'You were logged out because your account was used on another device.',
        401
      );
    }

    // Load staff profile and check not soft-deleted
    const staffRes = await query(
      'SELECT id, role, name, email, mobile, deleted_at FROM staff WHERE id = $1',
      [payload.sub]
    );

    if (staffRes.rowCount === 0 || staffRes.rows[0].deleted_at !== null) {
      await query('DELETE FROM sessions WHERE account_type = $1 AND account_id = $2', [
        payload.typ,
        payload.sub,
      ]);
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Staff account is inactive or deleted', 401);
    }

    const row = staffRes.rows[0];
    req.staff = {
      id: row.id.toString(),
      role: row.role,
      name: row.name,
      email: row.email,
      mobile: row.mobile,
    };
    req.sessionId = payload.sid;

    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.staff || req.staff.role !== 'admin') {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Admin privileges required', 403);
  }
  next();
}
