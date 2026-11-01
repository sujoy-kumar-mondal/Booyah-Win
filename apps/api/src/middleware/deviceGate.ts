import { Request, Response, NextFunction } from 'express';

/**
 * Device access policy middleware:
 * All devices and browsers are allowed to access user routes.
 */
export function deviceGate(_req: Request, _res: Response, next: NextFunction): void {
  return next();
}
