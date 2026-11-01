import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { formatStaffId, formatUserId, ErrorCodes } from '@booyah/shared';
import { authenticateStaff, requireAdmin } from '../../../middleware/auth.js';
import { query } from '../../../db/index.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { sanitizeAuditDetails } from '../../../utils/audit.js';

export const auditAdminRouter = Router();

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  staffId: z.string().trim().regex(/^(?:BW-STF-)?\d+$/i, 'Staff ID must be numeric or BW-STF-<id>').optional(),
  action: z.string().trim().min(1).max(100).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  cursor: z.string().trim().regex(/^\d+$/).optional(),
});

auditAdminRouter.use(authenticateStaff, requireAdmin);

auditAdminRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, staffId, action, from, to, cursor } = auditQuerySchema.parse(req.query);

    let sql = `
      SELECT a.id, a.staff_id, a.action, a.target_type, a.target_id, a.details, a.created_at,
             s.name AS staff_name
      FROM audit_logs a
      LEFT JOIN staff s ON a.staff_id = s.id
      WHERE 1=1
    `;
    const values: any[] = [];
    let pIdx = 1;

    if (staffId) {
      const cleanStaffId = staffId.replace(/^(?:BW-STF-)/i, '').trim();
      sql += ` AND (a.staff_id = $${pIdx} OR a.staff_id = $${pIdx + 1})`;
      values.push(cleanStaffId, `BW-STF-${cleanStaffId}`);
      pIdx += 2;
    }

    if (action) {
      sql += ` AND a.action = $${pIdx}`;
      values.push(action);
      pIdx++;
    }

    if (from) {
      sql += ` AND a.created_at >= $${pIdx}`;
      values.push(from);
      pIdx++;
    }

    if (to) {
      sql += ` AND a.created_at <= $${pIdx}`;
      values.push(to);
      pIdx++;
    }

    if (cursor) {
      sql += ` AND a.id < $${pIdx}`;
      values.push(cursor);
      pIdx++;
    }

    sql += ` ORDER BY a.id DESC LIMIT $${pIdx}`;
    values.push(limit + 1);

    const dbRes = await query(sql, values);
    const hasNext = dbRes.rows.length > limit;
    const rows = hasNext ? dbRes.rows.slice(0, limit) : dbRes.rows;
    const nextCursor = hasNext ? rows[rows.length - 1].id.toString() : null;

    const items = rows.map((r) => ({
      id: r.id.toString(),
      staffId: r.staff_id ? formatStaffId(r.staff_id) : null,
      staffName: r.staff_name ? r.staff_name : null,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id
        ? (r.target_type === 'staff' || r.target_type === 'employee'
            ? formatStaffId(r.target_id)
            : r.target_type === 'user'
            ? formatUserId(r.target_id)
            : r.target_id.toString())
        : null,
      details: sanitizeAuditDetails(r.details) ?? {},
      createdAt: r.created_at.toISOString(),
    }));

    res.status(200).json({ data: { items, nextCursor } });
  } catch (err) {
    next(err);
  }
});

auditAdminRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    if (!rawId || !/^\d+$/.test(rawId.trim())) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Invalid audit log ID', 400);
    }

    const sql = `
      SELECT a.id, a.staff_id, a.action, a.target_type, a.target_id, a.details, a.created_at,
             s.name AS staff_name, s.role AS staff_role, s.email AS staff_email
      FROM audit_logs a
      LEFT JOIN staff s ON a.staff_id = s.id
      WHERE a.id = $1
    `;
    const dbRes = await query(sql, [rawId.trim()]);
    if (dbRes.rowCount === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Audit log not found', 404);
    }

    const r = dbRes.rows[0];
    const log = {
      id: r.id.toString(),
      staffId: r.staff_id ? formatStaffId(r.staff_id) : null,
      staffName: r.staff_name ? r.staff_name : null,
      staffRole: r.staff_role ? r.staff_role : null,
      staffEmail: r.staff_email ? r.staff_email : null,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id
        ? (r.target_type === 'staff' || r.target_type === 'employee'
            ? formatStaffId(r.target_id)
            : r.target_type === 'user'
            ? formatUserId(r.target_id)
            : r.target_id.toString())
        : null,
      details: sanitizeAuditDetails(r.details) ?? {},
      createdAt: r.created_at.toISOString(),
    };

    res.status(200).json({ data: { log } });
  } catch (err) {
    next(err);
  }
});
