import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateStaff, requireAdmin } from '../../../middleware/auth.js';
import { query } from '../../../db/index.js';

export const auditAdminRouter = Router();

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  staffId: z.string().trim().regex(/^\d+$/).optional(),
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
      SELECT id, staff_id, action, target_type, target_id, details, created_at
      FROM audit_logs
      WHERE 1=1
    `;
    const values: any[] = [];
    let pIdx = 1;

    if (staffId) {
      sql += ` AND staff_id = $${pIdx}`;
      values.push(staffId);
      pIdx++;
    }

    if (action) {
      sql += ` AND action = $${pIdx}`;
      values.push(action);
      pIdx++;
    }

    if (from) {
      sql += ` AND created_at >= $${pIdx}`;
      values.push(from);
      pIdx++;
    }

    if (to) {
      sql += ` AND created_at <= $${pIdx}`;
      values.push(to);
      pIdx++;
    }

    if (cursor) {
      sql += ` AND id < $${pIdx}`;
      values.push(cursor);
      pIdx++;
    }

    sql += ` ORDER BY id DESC LIMIT $${pIdx}`;
    values.push(limit + 1);

    const dbRes = await query(sql, values);
    const hasNext = dbRes.rows.length > limit;
    const rows = hasNext ? dbRes.rows.slice(0, limit) : dbRes.rows;
    const nextCursor = hasNext ? rows[rows.length - 1].id.toString() : null;

    const items = rows.map((r) => ({
      id: r.id.toString(),
      staffId: r.staff_id ? r.staff_id.toString() : null,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id ? r.target_id.toString() : null,
      details: r.details,
      createdAt: r.created_at.toISOString(),
    }));

    res.status(200).json({ data: { items, nextCursor } });
  } catch (err) {
    next(err);
  }
});
