/**
 * Banner Controller
 * Public and Admin endpoints for banner management
 */

import { Request, Response, NextFunction } from 'express';
import { BannersService } from './banners.service.js';
import { AppError } from '../../middleware/errorHandler.js';

export class BannersController {
  /**
   * GET /api/v1/banners
   * Public list of active banners for Player PWA home screen.
   */
  static async listActiveBanners(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const banners = await BannersService.listActiveBanners();
      res.status(200).json({ data: { banners } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/banners
   * Admin list of all configured banners.
   */
  static async listAllBanners(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const banners = await BannersService.listAllBanners();
      res.status(200).json({ data: { banners } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/banners
   * Admin creates a new banner with image and target link.
   */
  static async createBanner(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file || !file.buffer) {
        throw new AppError('VALIDATION_ERROR', 'Banner image file is required', 400);
      }

      const { targetUrl, title, sortOrder, isActive } = req.body;
      if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.trim()) {
        throw new AppError('VALIDATION_ERROR', 'Target URL is required', 400);
      }

      const parsedSortOrder =
        sortOrder !== undefined && sortOrder !== '' ? parseInt(sortOrder, 10) : 0;
      const parsedIsActive =
        isActive !== undefined
          ? isActive === true || isActive === 'true' || isActive === '1'
          : true;

      const banner = await BannersService.createBanner(req.staff!.id, {
        fileBuffer: file.buffer,
        targetUrl: targetUrl.trim(),
        title: title ? String(title).trim() : undefined,
        sortOrder: isNaN(parsedSortOrder) ? 0 : parsedSortOrder,
        isActive: parsedIsActive,
      });

      res.status(201).json({ data: { banner } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/admin/banners/:id
   * Admin updates banner link, title, order, active status, or replacement image.
   */
  static async updateBanner(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || isNaN(parseInt(id, 10))) {
        throw new AppError('VALIDATION_ERROR', 'Invalid banner ID', 400);
      }

      const file = (req as any).file as Express.Multer.File | undefined;
      const { targetUrl, title, sortOrder, isActive } = req.body;

      const parsedSortOrder =
        sortOrder !== undefined && sortOrder !== ''
          ? parseInt(sortOrder, 10)
          : undefined;
      const parsedIsActive =
        isActive !== undefined
          ? isActive === true || isActive === 'true' || isActive === '1'
          : undefined;

      const banner = await BannersService.updateBanner(req.staff!.id, id, {
        fileBuffer: file?.buffer,
        targetUrl: targetUrl !== undefined ? String(targetUrl).trim() : undefined,
        title: title !== undefined ? String(title).trim() : undefined,
        sortOrder:
          parsedSortOrder !== undefined && !isNaN(parsedSortOrder)
            ? parsedSortOrder
            : undefined,
        isActive: parsedIsActive,
      });

      res.status(200).json({ data: { banner } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/admin/banners/:id
   * Admin deletes a banner.
   */
  static async deleteBanner(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || isNaN(parseInt(id, 10))) {
        throw new AppError('VALIDATION_ERROR', 'Invalid banner ID', 400);
      }

      const result = await BannersService.deleteBanner(req.staff!.id, id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
