import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ErrorCodes } from '@booyah/shared';
import { AppError } from '../../middleware/errorHandler.js';
import {
  submitResultStaff,
  getResultStaff,
} from './results.service.js';

// Multer – memory storage, 2 MB limit (Requirement 7)
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
          'Invalid file type: screenshot must be JPEG, PNG, or WebP',
          400
        )
      );
    }
  },
});

export function screenshotUpload(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  upload.single('screenshot')(req, res, (err) => {
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
    next();
  });
}

export class ResultsController {
  static async submitResult(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.staff) {
        throw new AppError(
          ErrorCodes.UNAUTHENTICATED,
          'Staff authentication required',
          401
        );
      }

      const matchId = req.params.id;
      if (!matchId) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'matchId is required',
          400
        );
      }

      if (!req.file) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Screenshot is required',
          400
        );
      }

      const autoApprove =
        req.query.autoApprove === 'true' ||
        req.body.autoApprove === true ||
        req.body.autoApprove === 'true';

      // Requirement 10: employee sending autoApprove gets 403
      if (autoApprove && req.staff.role !== 'admin') {
        throw new AppError(
          ErrorCodes.FORBIDDEN,
          'Only admin can auto-approve results',
          403
        );
      }

      let payload: any = req.body;
      if (typeof req.body.entries === 'string') {
        try {
          payload.entries = JSON.parse(req.body.entries);
        } catch {
          throw new AppError(
            ErrorCodes.RESULT_INVALID,
            'Invalid entries JSON',
            400
          );
        }
      }

      const result = await submitResultStaff({
        staffId: req.staff.id,
        staffRole: req.staff.role,
        matchId,
        payload,
        fileBuffer: req.file.buffer,
        autoApprove,
      });

      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getResult(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.staff) {
        throw new AppError(
          ErrorCodes.UNAUTHENTICATED,
          'Staff authentication required',
          401
        );
      }

      const matchId = req.params.id;
      if (!matchId) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'matchId is required',
          400
        );
      }

      const result = await getResultStaff(matchId);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
