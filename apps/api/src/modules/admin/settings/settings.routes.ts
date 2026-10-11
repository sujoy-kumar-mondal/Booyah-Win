import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ErrorCodes } from '@booyah/shared';
import { AppError } from '../../../middleware/errorHandler.js';
import { authenticateStaff, requireAdmin } from '../../../middleware/auth.js';
import { staffWriteRateLimit } from '../../../middleware/rateLimiters.js';
import { SettingsController } from './settings.controller.js';

export const settingsAdminRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Invalid file type: QR image must be JPEG, PNG, or WebP',
          400
        )
      );
    }
  },
});

function paymentQrUpload(req: Request, res: Response, next: NextFunction): void {
  upload.any()(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new AppError(
            ErrorCodes.VALIDATION_ERROR,
            'File too large: maximum 2 MB',
            400
          )
        );
      }
      return next(err);
    }
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return next(
        new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Payment QR image is required',
          400
        )
      );
    }
    (req as any).file = files[0];
    next();
  });
}

// Admin routes for settings
settingsAdminRouter.use(authenticateStaff, requireAdmin, staffWriteRateLimit);

settingsAdminRouter.get('/', SettingsController.getSettings);
settingsAdminRouter.patch('/', SettingsController.updateSettings);
settingsAdminRouter.post('/payment-qr', paymentQrUpload, SettingsController.uploadPaymentQr);
