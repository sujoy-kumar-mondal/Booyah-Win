/**
 * Updates Controller
 * Public and Admin endpoints for Important Updates
 */

import { Request, Response, NextFunction } from 'express';
import { UpdatesService } from './updates.service.js';
import { AppError } from '../../middleware/errorHandler.js';

export class UpdatesController {
  /**
   * GET /api/v1/updates
   * Public list of active updates for Player PWA.
   */
  static async listActiveUpdates(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const updates = await UpdatesService.listActiveUpdates();
      res.status(200).json({ data: { updates } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/updates
   * Admin list of all configured updates.
   */
  static async listAllUpdates(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const updates = await UpdatesService.listAllUpdates();
      res.status(200).json({ data: { updates } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/updates
   * Admin creates a new important update.
   */
  static async createUpdate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        title,
        category,
        dateDisplay,
        heading,
        summary,
        points,
        notice,
        linkUrl,
        linkText,
        sortOrder,
        isActive,
      } = req.body;

      if (!title || typeof title !== 'string' || !title.trim()) {
        throw new AppError('VALIDATION_ERROR', 'Update title is required', 400);
      }
      if (!heading || typeof heading !== 'string' || !heading.trim()) {
        throw new AppError('VALIDATION_ERROR', 'Update heading is required', 400);
      }
      if (!dateDisplay || typeof dateDisplay !== 'string' || !dateDisplay.trim()) {
        throw new AppError('VALIDATION_ERROR', 'Update date display is required', 400);
      }

      const parsedSortOrder =
        sortOrder !== undefined && sortOrder !== '' ? parseInt(sortOrder, 10) : 0;
      const parsedIsActive =
        isActive !== undefined
          ? isActive === true || isActive === 'true' || isActive === '1'
          : true;

      let parsedPoints = points;
      if (typeof points === 'string') {
        try {
          parsedPoints = JSON.parse(points);
        } catch {
          parsedPoints = [];
        }
      }
      if (!Array.isArray(parsedPoints)) {
        parsedPoints = [];
      }

      const update = await UpdatesService.createUpdate(req.staff!.id, {
        title: title.trim(),
        category: category ? String(category).trim() : 'Announcement',
        dateDisplay: dateDisplay.trim(),
        heading: heading.trim(),
        summary: summary ? String(summary).trim() : undefined,
        points: parsedPoints,
        notice: notice ? String(notice).trim() : undefined,
        linkUrl: linkUrl ? String(linkUrl).trim() : undefined,
        linkText: linkText ? String(linkText).trim() : undefined,
        sortOrder: isNaN(parsedSortOrder) ? 0 : parsedSortOrder,
        isActive: parsedIsActive,
      });

      res.status(201).json({ data: { update } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/admin/updates/:id
   * Admin updates an important update.
   */
  static async updateUpdate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || isNaN(parseInt(id, 10))) {
        throw new AppError('VALIDATION_ERROR', 'Invalid update ID', 400);
      }

      const {
        title,
        category,
        dateDisplay,
        heading,
        summary,
        points,
        notice,
        linkUrl,
        linkText,
        sortOrder,
        isActive,
      } = req.body;

      const parsedSortOrder =
        sortOrder !== undefined && sortOrder !== ''
          ? parseInt(sortOrder, 10)
          : undefined;
      const parsedIsActive =
        isActive !== undefined
          ? isActive === true || isActive === 'true' || isActive === '1'
          : undefined;

      let parsedPoints = points;
      if (points !== undefined) {
        if (typeof points === 'string') {
          try {
            parsedPoints = JSON.parse(points);
          } catch {
            parsedPoints = [];
          }
        }
        if (!Array.isArray(parsedPoints)) {
          parsedPoints = [];
        }
      }

      const update = await UpdatesService.updateUpdate(req.staff!.id, id, {
        title: title !== undefined ? String(title).trim() : undefined,
        category: category !== undefined ? String(category).trim() : undefined,
        dateDisplay: dateDisplay !== undefined ? String(dateDisplay).trim() : undefined,
        heading: heading !== undefined ? String(heading).trim() : undefined,
        summary: summary !== undefined ? String(summary).trim() : undefined,
        points: parsedPoints,
        notice: notice !== undefined ? String(notice).trim() : undefined,
        linkUrl: linkUrl !== undefined ? String(linkUrl).trim() : undefined,
        linkText: linkText !== undefined ? String(linkText).trim() : undefined,
        sortOrder:
          parsedSortOrder !== undefined && !isNaN(parsedSortOrder)
            ? parsedSortOrder
            : undefined,
        isActive: parsedIsActive,
      });

      res.status(200).json({ data: { update } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/admin/updates/:id
   * Admin deletes an important update.
   */
  static async deleteUpdate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || isNaN(parseInt(id, 10))) {
        throw new AppError('VALIDATION_ERROR', 'Invalid update ID', 400);
      }

      const result = await UpdatesService.deleteUpdate(req.staff!.id, id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
