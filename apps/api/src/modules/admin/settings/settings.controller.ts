import { Request, Response, NextFunction } from 'express';
import { updateSettingsSchema, ErrorCodes } from '@booyah/shared';
import { AppError } from '../../../middleware/errorHandler.js';
import { assertSessionElevated } from '../../../middleware/auth.js';
import { SettingsService } from './settings.service.js';

const DANGEROUS_SETTINGS_KEYS = [
  'payment_upi_id',
  'payment_qr_url',
  'maintenance_enabled',
  'maintenance_message',
  'maintenance_until',
  'cashback_max_percent',
];

export class SettingsController {
  static async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await SettingsService.getAllSettings();
      res.status(200).json({ data: { settings } });
    } catch (err) {
      next(err);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.body && 'payment_qr_key' in req.body) {
        throw new AppError(
          'VALIDATION_ERROR',
          'payment_qr_key cannot be updated directly; use the upload endpoint',
          400
        );
      }
      const updates = updateSettingsSchema.parse(req.body);

      // Check step-up elevation for dangerous settings: payment (UPI, QR), maintenance, cashback
      if (Object.keys(updates).some((k) => DANGEROUS_SETTINGS_KEYS.includes(k))) {
        await assertSessionElevated(req);
      }

      const settings = await SettingsService.updateSettings(req.staff!.id, updates);
      res.status(200).json({ data: { settings } });
    } catch (err) {
      next(err);
    }
  }

  static async uploadPaymentQr(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file || !file.buffer) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Payment QR image file is required',
          400
        );
      }
      const result = await SettingsService.uploadPaymentQr(req.staff!.id, file.buffer);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  // Public support endpoint
  static async getSupportInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const support = await SettingsService.getSupportInfo();
      res.status(200).json({ data: support });
    } catch (err) {
      next(err);
    }
  }

  // Public payment info endpoint
  static async getPaymentInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paymentInfo = await SettingsService.getPaymentInfo();
      res.status(200).json({ data: paymentInfo });
    } catch (err) {
      next(err);
    }
  }
}
