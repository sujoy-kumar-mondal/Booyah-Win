import { Request, Response, NextFunction } from 'express';
import { ErrorCodes } from '@booyah/shared';
import { query } from '../db/index.js';
import { AppError } from './errorHandler.js';

interface MaintenanceCache {
  enabled: boolean;
  message: string;
  until: string | null;
  cachedAt: number;
}

let maintenanceCache: MaintenanceCache | null = null;
const CACHE_TTL_MS = 5000; // In-memory cache for at most 5 seconds

/**
 * Invalidate in-memory cache immediately upon admin settings change.
 */
export function invalidateMaintenanceCache(): void {
  maintenanceCache = null;
}

/**
 * Retrieve maintenance mode configuration from cache or database.
 * If database is unreachable, safely returns enabled: false with unknown: true.
 */
export async function getMaintenanceStatus(): Promise<{
  enabled: boolean;
  message: string;
  until: string | null;
  unknown?: boolean;
}> {
  const now = Date.now();
  if (maintenanceCache && now - maintenanceCache.cachedAt < CACHE_TTL_MS) {
    return {
      enabled: maintenanceCache.enabled,
      message: maintenanceCache.message,
      until: maintenanceCache.until,
    };
  }

  try {
    const res = await query(
      "SELECT key, value FROM app_settings WHERE key IN ('maintenance_enabled', 'maintenance_message', 'maintenance_until')"
    );
    let enabled = false;
    let message = 'Under scheduled maintenance. Please check back shortly.';
    let until: string | null = null;

    for (const row of res.rows) {
      if (row.key === 'maintenance_enabled') {
        enabled = row.value === 'true';
      } else if (row.key === 'maintenance_message' && row.value) {
        message = row.value;
      } else if (row.key === 'maintenance_until' && row.value) {
        until = row.value.trim() ? row.value.trim() : null;
      }
    }

    maintenanceCache = {
      enabled,
      message,
      until,
      cachedAt: now,
    };

    return { enabled, message, until };
  } catch {
    return {
      enabled: false,
      message: 'Under scheduled maintenance. Please check back shortly.',
      until: null,
      unknown: true,
    };
  }
}

/**
 * Middleware that blocks user state-changing requests when maintenance mode is active.
 * Throws 503 MAINTENANCE_MODE.
 */
export async function maintenanceGuard(
  _req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = await getMaintenanceStatus();
    if (status.enabled) {
      return next(
        new AppError(
          ErrorCodes.MAINTENANCE_MODE,
          status.message,
          503,
          { until: status.until }
        )
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}
