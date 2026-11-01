import { query } from '../../db/index.js';
import { logger } from '../../utils/logger.js';
import {
  getOrInitVapidKeys,
  getVapidPublicKey,
  sendPushToSubscriptionRows,
  type PushSubscriptionInput,
} from '../users/webpush.service.js';

export interface NotifyStaffParams {
  targetRole: 'all' | 'admin';
  staffId?: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface StaffNotificationItem {
  id: string;
  targetRole: string;
  staffId: string | null;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  metadata: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
}

/**
 * Dispatch notification to staff members:
 * 1. Persists to staff_notifications table
 * 2. Sends Web Push to subscribed devices (admin-only or all staff)
 */
export async function notifyStaff(params: NotifyStaffParams): Promise<void> {
  try {
    // 1. Insert into staff_notifications
    await query(
      `INSERT INTO staff_notifications 
         (target_role, staff_id, type, title, message, action_url, metadata, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())`,
      [
        params.targetRole,
        params.staffId || null,
        params.type,
        params.title,
        params.message,
        params.actionUrl || null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]
    );

    // 2. Query target push subscriptions
    let subsQuery = '';
    const queryParams: any[] = [];

    if (params.staffId) {
      subsQuery = `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE staff_id = $1`;
      queryParams.push(params.staffId);
    } else if (params.targetRole === 'admin') {
      subsQuery = `
        SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
        FROM push_subscriptions ps
        JOIN staff s ON (s.id::text = ps.staff_id::text OR ps.staff_id = ('BW-STF-' || s.id::text))
        WHERE s.role = 'admin' AND ps.staff_id IS NOT NULL
      `;
    } else {
      // 'all' -> admin and employees
      subsQuery = `
        SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
        FROM push_subscriptions ps
        WHERE ps.staff_id IS NOT NULL
      `;
    }

    const subsRes = await query(subsQuery, queryParams);

    if (subsRes.rows.length > 0) {
      await getOrInitVapidKeys();
      await sendPushToSubscriptionRows(subsRes.rows, {
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl || '/dashboard',
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: `staff-${params.type}`,
      });
    }
  } catch (err: any) {
    logger.warn({ err: err.message, type: params.type }, 'Failed to dispatch staff notification');
  }
}

/**
 * Fetch notifications for a staff member (scoped to their role).
 */
export async function listStaffNotifications(
  staffId: string,
  staffRole: string,
  options: { limit?: number; unreadOnly?: boolean } = {}
): Promise<{ items: StaffNotificationItem[]; unreadCount: number }> {
  const limit = Math.min(Math.max(options.limit || 30, 1), 100);

  // Role filter: admins can see 'all' and 'admin' notifications; employees can see 'all'
  const roleCondition =
    staffRole === 'admin'
      ? `(target_role IN ('all', 'admin') OR staff_id = $1)`
      : `(target_role = 'all' OR staff_id = $1)`;

  const unreadCountRes = await query(
    `SELECT count(*)::int AS count
     FROM staff_notifications
     WHERE ${roleCondition} AND is_read = false`,
    [staffId]
  );
  const unreadCount = Number(unreadCountRes.rows[0]?.count || 0);

  let listQuery = `
    SELECT id, target_role, staff_id, type, title, message, action_url, metadata, is_read, created_at
    FROM staff_notifications
    WHERE ${roleCondition}
  `;

  if (options.unreadOnly) {
    listQuery += ` AND is_read = false`;
  }

  listQuery += ` ORDER BY created_at DESC LIMIT $2`;

  const rowsRes = await query(listQuery, [staffId, limit]);

  const items: StaffNotificationItem[] = rowsRes.rows.map((r: any) => ({
    id: r.id.toString(),
    targetRole: r.target_role,
    staffId: r.staff_id,
    type: r.type,
    title: r.title,
    message: r.message,
    actionUrl: r.action_url,
    metadata: r.metadata,
    isRead: r.is_read,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  }));

  return { items, unreadCount };
}

/**
 * Mark a single staff notification as read.
 */
export async function markStaffNotificationRead(id: string | number): Promise<void> {
  await query(`UPDATE staff_notifications SET is_read = true WHERE id = $1`, [id]);
}

/**
 * Mark all visible notifications as read for this staff member.
 */
export async function markAllStaffNotificationsRead(
  staffId: string,
  staffRole: string
): Promise<void> {
  const roleCondition =
    staffRole === 'admin'
      ? `(target_role IN ('all', 'admin') OR staff_id = $1)`
      : `(target_role = 'all' OR staff_id = $1)`;

  await query(`UPDATE staff_notifications SET is_read = true WHERE ${roleCondition}`, [staffId]);
}

/**
 * Register or update browser push subscription for staff member.
 */
export async function registerStaffPushSubscription(
  staffId: string,
  sub: PushSubscriptionInput
): Promise<void> {
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return;
  }

  await query(
    `INSERT INTO push_subscriptions (staff_id, endpoint, p256dh, auth, user_agent, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (endpoint) DO UPDATE SET
       staff_id = EXCLUDED.staff_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent,
       updated_at = NOW()`,
    [staffId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, sub.userAgent || null]
  );
}

/**
 * Remove staff browser push subscription.
 */
export async function removeStaffPushSubscription(endpoint: string): Promise<void> {
  if (!endpoint) return;
  await query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

