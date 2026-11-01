/**
 * Admin Banner Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ErrorCodes } from '@booyah/shared';
import { AppError } from '../../../middleware/errorHandler.js';
import { authenticateStaff, requireAdmin } from '../../../middleware/auth.js';
import { staffWriteRateLimit } from '../../../middleware/rateLimiters.js';
import { BannersController } from '../../banners/banners.controller.js';

export const adminBannersRouter = Router();

const bannerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Invalid file type: banner image must be JPEG, PNG, or WebP',
          400
        )
      );
    }
  },
});

function handleRequiredBannerUpload(req: Request, res: Response, next: NextFunction): void {
  bannerUpload.any()(req, res, (err) => {
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
          'Banner image is required',
          400
        )
      );
    }
    (req as any).file = files[0];
    next();
  });
}

function handleOptionalBannerUpload(req: Request, res: Response, next: NextFunction): void {
  bannerUpload.any()(req, res, (err) => {
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
    if (files && files.length > 0) {
      (req as any).file = files[0];
    }
    next();
  });
}

// All admin banner routes require staff authentication, admin role, and rate limiting
adminBannersRouter.use(authenticateStaff, requireAdmin, staffWriteRateLimit);

adminBannersRouter.get('/', BannersController.listAllBanners);
adminBannersRouter.post('/', handleRequiredBannerUpload, BannersController.createBanner);
adminBannersRouter.patch('/:id', handleOptionalBannerUpload, BannersController.updateBanner);
adminBannersRouter.delete('/:id', BannersController.deleteBanner);
