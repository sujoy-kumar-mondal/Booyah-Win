import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ErrorCodes, parseEntityNumber } from '@booyah/shared';
import { AppError } from './errorHandler.js';

export const numericIdSchema = z
  .string()
  .regex(
    /^(?:BW-(?:MCH|WDL|DPT|TRX|USR|STF)-|DEP-|WTH-|DPT-|WDL-|TRX-)?\d+$/i,
    'ID must be a numeric string or standard formatted ID'
  );

/**
 * Express router.param callback that validates :id or :matchId as a numeric string or standard formatted ID.
 */
export function idParamHandler(
  req: Request,
  _res: Response,
  next: NextFunction,
  val: string,
  name: string
): void {
  const result = numericIdSchema.safeParse(val);
  if (!result.success) {
    return next(
      new AppError(
        ErrorCodes.VALIDATION_ERROR,
        `Route parameter :${name} must be a numeric string or standard formatted ID`,
        400,
        {
          param: name,
          value: val,
          issues: result.error.issues,
        }
      )
    );
  }
  // Determine standard prefix based on URL/route context
  const url = ((req.baseUrl || '') + (req.path || '')).toLowerCase();
  const rawNum = parseEntityNumber(val) || val.replace(/^(?:BW-(?:MCH|WDL|DPT|TRX|USR|STF)-)/i, '');

  if (name === 'matchId' || url.includes('/matches')) {
    req.params[name] = `BW-MCH-${rawNum}`;
  } else if (url.includes('/deposits')) {
    req.params[name] = `BW-TRX-${rawNum}`;
  } else if (url.includes('/withdrawals')) {
    req.params[name] = `BW-TRX-${rawNum}`;
  } else if (url.includes('/transactions')) {
    const upperVal = val.toUpperCase();
    if (upperVal.startsWith('DEP-') || upperVal.startsWith('DPT-') || upperVal.startsWith('BW-DPT-')) {
      req.params[name] = `BW-DPT-${rawNum}`;
    } else if (upperVal.startsWith('WTH-') || upperVal.startsWith('WDL-') || upperVal.startsWith('BW-WDL-')) {
      req.params[name] = `BW-WDL-${rawNum}`;
    } else {
      req.params[name] = `BW-TRX-${rawNum}`;
    }
  } else if (url.includes('/users')) {
    req.params[name] = `BW-USR-${rawNum}`;
  } else if (url.includes('/employees') || url.includes('/staff')) {
    req.params[name] = `BW-STF-${rawNum}`;
  } else {
    req.params[name] = val.replace(/^(?:BW-(?:MCH|WDL|DPT|TRX|USR|STF)-)/i, '');
  }
  next();
}

/**
 * Middleware factory to validate req.body against a Zod schema.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Validation failed for request body',
          400,
          { issues: result.error.issues }
        )
      );
    }
    req.body = result.data;
    next();
  };
}

/**
 * Middleware factory to validate req.query against a Zod schema.
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(
        new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Validation failed for query parameters',
          400,
          { issues: result.error.issues }
        )
      );
    }
    req.query = result.data as any;
    next();
  };
}
