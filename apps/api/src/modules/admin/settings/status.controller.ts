import { Request, Response } from 'express';
import { getMaintenanceStatus } from '../../../middleware/maintenance.js';

export class StatusController {
  /**
   * Public read endpoint GET /api/v1/status.
   * Rate limited, never cached, fault-tolerant.
   */
  static async getStatus(_req: Request, res: Response): Promise<void> {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const status = await getMaintenanceStatus();

    res.status(200).json({
      data: {
        maintenance: {
          enabled: status.enabled,
          message: status.message,
          until: status.until,
          ...(status.unknown ? { unknown: true } : {}),
        },
      },
    });
  }
}
