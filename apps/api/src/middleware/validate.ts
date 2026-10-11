import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ErrorCodes } from '@booyah/shared';
import { AppError } from './errorHandler.js';

export const numericIdSchema = z.string().regex(/^\d+$/, 'ID must be a numeric string');

/**
 * Express router.param callback that validates :id or :matchId as a numeric string.
 */
export function idParamHandler(
  _req: Request,
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
        `Route parameter :${name} must be a numeric string`,
        400,
        {
          param: name,
          value: val,
          issues: result.error.issues,
        }
      )
    );
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
