/**
 * Banner Service
 * Handles public and admin operations for home carousel banners.
 */

import { BannerDto } from '@booyah/shared';
import { query, withTransaction } from '../../db/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  validateImageMagicBytes,
  uploadScreenshot,
  getSignedUrl,
  deleteFile,
} from '../../utils/storage.js';
import { writeAuditLog } from '../../utils/audit.js';

interface RawBannerRow {
  id: string;
  title: string | null;
  image_key: string;
  target_url: string;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export class BannersService {
  /**
   * Helper to format a database row into BannerDto with signed image URL.
   */
  private static async formatBanner(row: RawBannerRow): Promise<BannerDto> {
    let imageUrl = '';
    try {
      imageUrl = await getSignedUrl(row.image_key, 3600);
    } catch {
      // In case storage signing fails, fallback to empty or key
      imageUrl = '';
    }

    return {
      id: String(row.id),
      title: row.title ?? null,
      imageUrl,
      imageKey: row.image_key,
      targetUrl: row.target_url,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Retrieves all active banners for public player PWA carousel.
   */
  static async listActiveBanners(): Promise<BannerDto[]> {
    const res = await query<RawBannerRow>(
      `SELECT * FROM banners
       WHERE is_active = true
       ORDER BY sort_order ASC, id ASC`
    );

    return Promise.all(res.rows.map((r) => this.formatBanner(r)));
  }

  /**
   * Retrieves all banners (active and inactive) for admin management portal.
   */
  static async listAllBanners(): Promise<BannerDto[]> {
    const res = await query<RawBannerRow>(
      `SELECT * FROM banners
       ORDER BY sort_order ASC, id ASC`
    );

    return Promise.all(res.rows.map((r) => this.formatBanner(r)));
  }

  /**
   * Admin creates a new banner with an uploaded image.
   */
  static async createBanner(
    staffId: string,
    data: {
      fileBuffer: Buffer;
      targetUrl: string;
      title?: string;
      sortOrder?: number;
      isActive?: boolean;
    }
  ): Promise<BannerDto> {
    if (!data.fileBuffer || data.fileBuffer.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Banner image is required', 400);
    }

    if (!data.targetUrl || data.targetUrl.trim() === '') {
      throw new AppError('VALIDATION_ERROR', 'Banner target URL is required', 400);
    }

    // Validate magic bytes
    validateImageMagicBytes(data.fileBuffer);

    // Upload image to storage
    const imageKey = await uploadScreenshot(data.fileBuffer);

    let createdRow: RawBannerRow;
    try {
      createdRow = await withTransaction(async (client) => {
        const res = await client.query<RawBannerRow>(
          `INSERT INTO banners (title, image_key, target_url, sort_order, is_active, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, now(), now())
           RETURNING *`,
          [
            data.title?.trim() || null,
            imageKey,
            data.targetUrl.trim(),
            data.sortOrder ?? 0,
            data.isActive ?? true,
            staffId,
          ]
        );

        const banner = res.rows[0];

        await writeAuditLog(client, {
          staffId,
          action: 'banner_created',
          targetType: 'banner',
          targetId: String(banner.id),
          details: {
            title: banner.title,
            targetUrl: banner.target_url,
            sortOrder: banner.sort_order,
            isActive: banner.is_active,
            imageKey,
          },
        });

        return banner;
      });
    } catch (err) {
      // Cleanup uploaded image on database rollback
      try {
        await deleteFile(imageKey);
      } catch {
        // ignore delete failure on rollback
      }
      throw err;
    }

    return this.formatBanner(createdRow);
  }

  /**
   * Admin updates an existing banner.
   */
  static async updateBanner(
    staffId: string,
    bannerId: string,
    data: {
      fileBuffer?: Buffer;
      targetUrl?: string;
      title?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    }
  ): Promise<BannerDto> {
    const existingRes = await query<RawBannerRow>(
      'SELECT * FROM banners WHERE id = $1',
      [bannerId]
    );

    if (existingRes.rowCount === 0) {
      throw new AppError('NOT_FOUND', 'Banner not found', 404);
    }

    const currentBanner = existingRes.rows[0];
    let newImageKey: string | null = null;

    if (data.fileBuffer && data.fileBuffer.length > 0) {
      validateImageMagicBytes(data.fileBuffer);
      newImageKey = await uploadScreenshot(data.fileBuffer);
    }

    const updatedImageKey = newImageKey || currentBanner.image_key;
    const updatedTargetUrl =
      data.targetUrl !== undefined ? data.targetUrl.trim() : currentBanner.target_url;
    const updatedTitle =
      data.title !== undefined
        ? data.title?.trim() || null
        : currentBanner.title;
    const updatedSortOrder =
      data.sortOrder !== undefined ? data.sortOrder : currentBanner.sort_order;
    const updatedIsActive =
      data.isActive !== undefined ? data.isActive : currentBanner.is_active;

    let updatedRow: RawBannerRow;
    try {
      updatedRow = await withTransaction(async (client) => {
        const res = await client.query<RawBannerRow>(
          `UPDATE banners
           SET image_key = $1,
               target_url = $2,
               title = $3,
               sort_order = $4,
               is_active = $5,
               updated_at = now()
           WHERE id = $6
           RETURNING *`,
          [
            updatedImageKey,
            updatedTargetUrl,
            updatedTitle,
            updatedSortOrder,
            updatedIsActive,
            bannerId,
          ]
        );

        const banner = res.rows[0];

        await writeAuditLog(client, {
          staffId,
          action: 'banner_updated',
          targetType: 'banner',
          targetId: String(banner.id),
          details: {
            title: banner.title,
            targetUrl: banner.target_url,
            sortOrder: banner.sort_order,
            isActive: banner.is_active,
            imageKeyChanged: Boolean(newImageKey),
          },
        });

        return banner;
      });
    } catch (err) {
      if (newImageKey) {
        try {
          await deleteFile(newImageKey);
        } catch {
          // ignore
        }
      }
      throw err;
    }

    // If new image succeeded, delete old image from storage
    if (newImageKey && currentBanner.image_key !== newImageKey) {
      try {
        await deleteFile(currentBanner.image_key);
      } catch {
        // ignore delete failure of old asset
      }
    }

    return this.formatBanner(updatedRow);
  }

  /**
   * Admin deletes a banner and purges its image file from storage.
   */
  static async deleteBanner(
    staffId: string,
    bannerId: string
  ): Promise<{ success: boolean }> {
    const existingRes = await query<RawBannerRow>(
      'SELECT * FROM banners WHERE id = $1',
      [bannerId]
    );

    if (existingRes.rowCount === 0) {
      throw new AppError('NOT_FOUND', 'Banner not found', 404);
    }

    const currentBanner = existingRes.rows[0];

    await withTransaction(async (client) => {
      await client.query('DELETE FROM banners WHERE id = $1', [bannerId]);

      await writeAuditLog(client, {
        staffId,
        action: 'banner_deleted',
        targetType: 'banner',
        targetId: bannerId,
        details: {
          title: currentBanner.title,
          imageKey: currentBanner.image_key,
          targetUrl: currentBanner.target_url,
        },
      });
    });

    // Delete image file from storage after successful database commit
    if (currentBanner.image_key) {
      try {
        await deleteFile(currentBanner.image_key);
      } catch {
        // ignore storage deletion error
      }
    }

    return { success: true };
  }
}
