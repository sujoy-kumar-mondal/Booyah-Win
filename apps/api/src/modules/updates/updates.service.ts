/**
 * Updates Service
 * Handles public and admin operations for Important Updates & Announcements.
 */

import { ImportantUpdateDto, UpdatePointDto } from '@booyah/shared';
import { query, withTransaction } from '../../db/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import { writeAuditLog } from '../../utils/audit.js';

interface RawUpdateRow {
  id: string;
  title: string;
  category: string;
  date_display: string;
  heading: string;
  summary: string | null;
  points: any;
  notice: string | null;
  link_url: string | null;
  link_text: string | null;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export class UpdatesService {
  /**
   * Helper to format a database row into ImportantUpdateDto.
   */
  private static formatUpdate(row: RawUpdateRow): ImportantUpdateDto {
    let parsedPoints: UpdatePointDto[] = [];
    if (Array.isArray(row.points)) {
      parsedPoints = row.points;
    } else if (typeof row.points === 'string') {
      try {
        parsedPoints = JSON.parse(row.points);
      } catch {
        parsedPoints = [];
      }
    }

    return {
      id: String(row.id),
      title: row.title,
      category: row.category,
      dateDisplay: row.date_display,
      heading: row.heading,
      summary: row.summary ?? null,
      points: parsedPoints,
      notice: row.notice ?? null,
      linkUrl: row.link_url ?? null,
      linkText: row.link_text ?? null,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Public list of active important updates for Player PWA.
   */
  static async listActiveUpdates(): Promise<ImportantUpdateDto[]> {
    const res = await query<RawUpdateRow>(
      `SELECT * FROM important_updates
       WHERE is_active = true
       ORDER BY sort_order ASC, id ASC`
    );

    return res.rows.map((r) => this.formatUpdate(r));
  }

  /**
   * Admin list of all updates (active and inactive).
   */
  static async listAllUpdates(): Promise<ImportantUpdateDto[]> {
    const res = await query<RawUpdateRow>(
      `SELECT * FROM important_updates
       ORDER BY sort_order ASC, id ASC`
    );

    return res.rows.map((r) => this.formatUpdate(r));
  }

  /**
   * Admin creates a new important update.
   */
  static async createUpdate(
    staffId: string,
    data: {
      title: string;
      category?: string;
      dateDisplay: string;
      heading: string;
      summary?: string;
      points: UpdatePointDto[];
      notice?: string;
      linkUrl?: string;
      linkText?: string;
      sortOrder?: number;
      isActive?: boolean;
    }
  ): Promise<ImportantUpdateDto> {
    if (!data.title || !data.title.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Update title is required', 400);
    }
    if (!data.heading || !data.heading.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Update heading is required', 400);
    }
    if (!data.dateDisplay || !data.dateDisplay.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Update date display is required', 400);
    }

    const category = data.category?.trim() || 'Announcement';
    const summary = data.summary?.trim() || null;
    const notice = data.notice?.trim() || null;
    const linkUrl = data.linkUrl?.trim() || null;
    const linkText = data.linkText?.trim() || null;
    const sortOrder = data.sortOrder !== undefined ? data.sortOrder : 0;
    const isActive = data.isActive !== undefined ? data.isActive : true;
    const pointsJson = JSON.stringify(Array.isArray(data.points) ? data.points : []);

    const createdRow = await withTransaction(async (client) => {
      const res = await client.query<RawUpdateRow>(
        `INSERT INTO important_updates (
           title, category, date_display, heading, summary,
           points, notice, link_url, link_text, sort_order,
           is_active, created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          data.title.trim(),
          category,
          data.dateDisplay.trim(),
          data.heading.trim(),
          summary,
          pointsJson,
          notice,
          linkUrl,
          linkText,
          sortOrder,
          isActive,
          staffId,
        ]
      );

      const update = res.rows[0];

      await writeAuditLog(client, {
        staffId,
        action: 'important_update_created',
        targetType: 'important_update',
        targetId: String(update.id),
        details: {
          title: update.title,
          category: update.category,
          heading: update.heading,
          linkUrl: update.link_url,
          sortOrder: update.sort_order,
          isActive: update.is_active,
        },
      });

      return update;
    });

    return this.formatUpdate(createdRow);
  }

  /**
   * Admin updates an existing important update.
   */
  static async updateUpdate(
    staffId: string,
    updateId: string,
    data: {
      title?: string;
      category?: string;
      dateDisplay?: string;
      heading?: string;
      summary?: string;
      points?: UpdatePointDto[];
      notice?: string;
      linkUrl?: string;
      linkText?: string;
      sortOrder?: number;
      isActive?: boolean;
    }
  ): Promise<ImportantUpdateDto> {
    const existingRes = await query<RawUpdateRow>(
      'SELECT * FROM important_updates WHERE id = $1',
      [updateId]
    );

    if (existingRes.rowCount === 0) {
      throw new AppError('NOT_FOUND', 'Important update not found', 404);
    }

    const current = existingRes.rows[0];

    const updatedTitle = data.title !== undefined ? data.title.trim() : current.title;
    const updatedCategory =
      data.category !== undefined ? data.category.trim() : current.category;
    const updatedDateDisplay =
      data.dateDisplay !== undefined ? data.dateDisplay.trim() : current.date_display;
    const updatedHeading =
      data.heading !== undefined ? data.heading.trim() : current.heading;
    const updatedSummary =
      data.summary !== undefined ? (data.summary.trim() ? data.summary.trim() : null) : current.summary;
    const updatedNotice =
      data.notice !== undefined ? (data.notice.trim() ? data.notice.trim() : null) : current.notice;
    const updatedLinkUrl =
      data.linkUrl !== undefined ? (data.linkUrl.trim() ? data.linkUrl.trim() : null) : current.link_url;
    const updatedLinkText =
      data.linkText !== undefined ? (data.linkText.trim() ? data.linkText.trim() : null) : current.link_text;
    const updatedSortOrder =
      data.sortOrder !== undefined ? data.sortOrder : current.sort_order;
    const updatedIsActive =
      data.isActive !== undefined ? data.isActive : current.is_active;
    const updatedPointsJson =
      data.points !== undefined
        ? JSON.stringify(data.points)
        : JSON.stringify(current.points || []);

    const updatedRow = await withTransaction(async (client) => {
      const res = await client.query<RawUpdateRow>(
        `UPDATE important_updates
         SET title = $1,
             category = $2,
             date_display = $3,
             heading = $4,
             summary = $5,
             points = $6::jsonb,
             notice = $7,
             link_url = $8,
             link_text = $9,
             sort_order = $10,
             is_active = $11,
             updated_at = now()
         WHERE id = $12
         RETURNING *`,
        [
          updatedTitle,
          updatedCategory,
          updatedDateDisplay,
          updatedHeading,
          updatedSummary,
          updatedPointsJson,
          updatedNotice,
          updatedLinkUrl,
          updatedLinkText,
          updatedSortOrder,
          updatedIsActive,
          updateId,
        ]
      );

      const update = res.rows[0];

      await writeAuditLog(client, {
        staffId,
        action: 'important_update_modified',
        targetType: 'important_update',
        targetId: String(update.id),
        details: {
          title: update.title,
          category: update.category,
          heading: update.heading,
          linkUrl: update.link_url,
          sortOrder: update.sort_order,
          isActive: update.is_active,
        },
      });

      return update;
    });

    return this.formatUpdate(updatedRow);
  }

  /**
   * Admin deletes an important update.
   */
  static async deleteUpdate(
    staffId: string,
    updateId: string
  ): Promise<{ success: boolean }> {
    const existingRes = await query<RawUpdateRow>(
      'SELECT * FROM important_updates WHERE id = $1',
      [updateId]
    );

    if (existingRes.rowCount === 0) {
      throw new AppError('NOT_FOUND', 'Important update not found', 404);
    }

    const current = existingRes.rows[0];

    await withTransaction(async (client) => {
      await client.query('DELETE FROM important_updates WHERE id = $1', [updateId]);

      // Clean up any automated/broadcast notifications that referenced this update
      await client.query(
        `DELETE FROM notifications 
         WHERE (metadata->>'updateId' = $1)
            OR (metadata->>'targetId' = $1 AND type = 'announcement')
            OR (action_url = '/important-updates' AND (title = $2 OR message LIKE '%' || $2 || '%'))`,
        [updateId, current.title]
      );

      await writeAuditLog(client, {
        staffId,
        action: 'important_update_deleted',
        targetType: 'important_update',
        targetId: updateId,
        details: {
          title: current.title,
          category: current.category,
          heading: current.heading,
        },
      });
    });

    return { success: true };
  }
}
