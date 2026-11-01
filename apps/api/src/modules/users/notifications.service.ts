import type pg from 'pg';
import { query } from '../../db/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ErrorCodes, formatTransactionId, formatUserId } from '@booyah/shared';
import type { NotificationItemDto, NotificationType } from '@booyah/shared';
import { sendPushBroadcast, sendPushToUsers } from './webpush.service.js';
import { sendUnifiedPushNotification } from './unifiedPush.service.js';
import { logger } from '../../utils/logger.js';

function formatRelativeTime(dateMs: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - dateMs) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

function formatMatchModeTitle(gameMode: string, teamMode: string): string {
  const mode = gameMode === 'clash_squad' ? 'Clash Squad' : 'Battle Royale';
  const team = teamMode ? teamMode.toUpperCase() : 'SOLO';
  return `${mode} [${team}]`;
}

function formatISTTime(dateStr: string | Date): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'upcoming';
  }
}

export interface CreateNotificationParams {
  userId?: string | number | null; // null for broadcast
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Insert an automated or targeted notification into the notifications table.
 */
export async function createNotification(
  clientOrQuery: pg.PoolClient | typeof query,
  params: CreateNotificationParams
): Promise<void> {
  const q = 'query' in clientOrQuery ? clientOrQuery.query.bind(clientOrQuery) : clientOrQuery;
  await q(
    `INSERT INTO notifications (user_id, type, title, message, action_url, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      params.userId ? params.userId.toString() : null,
      params.type,
      params.title,
      params.message,
      params.actionUrl || null,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]
  );

  // Trigger unified push notification (Web Push + Native Android FCM) in background
  if (params.userId) {
    sendUnifiedPushNotification(params.userId.toString(), {
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl || '/notifications',
    }).catch((err) => {
      logger.warn({ err: err?.message, userId: params.userId }, 'Unified push notification failed to send');
    });
  } else {
    sendPushBroadcast({
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl || '/notifications',
    }).catch((err) => {
      logger.warn({ err: err?.message }, 'Broadcast push notification failed to send');
    });
  }
}

/**
 * Batch insert notifications for multiple user IDs (e.g. all players in a match).
 */
export async function createNotificationsForUsers(
  clientOrQuery: pg.PoolClient | typeof query,
  userIds: (string | number)[],
  notification: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  if (!userIds || userIds.length === 0) return;
  const q = 'query' in clientOrQuery ? clientOrQuery.query.bind(clientOrQuery) : clientOrQuery;
  const values: any[] = [];
  const rows: string[] = [];

  userIds.forEach((uid, idx) => {
    const offset = idx * 6;
    values.push(
      uid.toString(),
      notification.type,
      notification.title,
      notification.message,
      notification.actionUrl || null,
      notification.metadata ? JSON.stringify(notification.metadata) : null
    );
    rows.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, NOW())`
    );
  });

  await q(
    `INSERT INTO notifications (user_id, type, title, message, action_url, metadata, created_at)
     VALUES ${rows.join(', ')}`,
    values
  );

  // Trigger unified push notifications (Web Push + Native Android FCM) for user IDs
  sendUnifiedPushNotification(userIds.map((u) => u.toString()), {
    title: notification.title,
    message: notification.message,
    actionUrl: notification.actionUrl || '/notifications',
  }).catch((err) => {
    logger.warn({ err: err?.message, userCount: userIds.length }, 'Batch push notifications failed to send');
  });
}

/**
 * Get dynamic, aggregated notifications for the authenticated player.
 * Combines stored notifications from the `notifications` table (including admin broadcasts)
 * with dynamic synthesized events (matches joined, room open/live, deposits, withdrawals, rewards).
 */
export async function getPlayerNotifications(userId: string): Promise<NotificationItemDto[]> {
  const notifications: NotificationItemDto[] = [];
  const seenKeys = new Set<string>();

  // 1. Fetch from notifications table (User personal notifications + Admin broadcast notifications)
  try {
    const dbNotifs = await query(
      `SELECT id, user_id, type, title, message, action_url, metadata, created_at
       FROM notifications
       WHERE user_id = $1 OR user_id IS NULL
       ORDER BY created_at DESC
       LIMIT 40`,
      [userId]
    );

    for (const row of dbNotifs.rows) {
      const createdMs = new Date(row.created_at).getTime();
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
      
      let actionUrl = row.action_url || undefined;
      // Upgrade generic action URLs to specific detail URLs
      if (meta?.matchId && (actionUrl === '/matches' || !actionUrl)) {
        actionUrl = `/matches/${meta.matchId}`;
      } else if ((meta?.depositId || meta?.transactionId) && (actionUrl === '/wallet' || !actionUrl || actionUrl.includes('DEP-'))) {
        const depId = formatTransactionId(meta.depositId || meta.transactionId);
        actionUrl = `/wallet/transactions/${depId}`;
      } else if ((meta?.withdrawalId || meta?.transactionId) && (actionUrl === '/wallet' || !actionUrl || actionUrl.includes('WTH-'))) {
        const wthId = formatTransactionId(meta.withdrawalId || meta.transactionId);
        actionUrl = `/wallet/transactions/${wthId}`;
      }

      notifications.push({
        id: row.id.toString(),
        type: row.type as NotificationType,
        title: row.title,
        message: row.message,
        timestamp: formatRelativeTime(createdMs),
        createdAt: createdMs,
        actionUrl,
        roomId: meta?.roomId || undefined,
        roomPassword: meta?.roomPassword || undefined,
      });

      if (meta?.matchId && row.type) seenKeys.add(`${row.type}-${meta.matchId}`);
      const depKey = meta?.depositId || meta?.transactionId;
      if (depKey && meta?.status) {
        seenKeys.add(`deposit-${depKey}-${meta.status}`);
        seenKeys.add(`deposit-${formatTransactionId(depKey)}-${meta.status}`);
        const raw = String(depKey).replace(/^BW-TRX-/i, '');
        if (raw) seenKeys.add(`deposit-${raw}-${meta.status}`);
      }
      const wthKey = meta?.withdrawalId || meta?.transactionId;
      if (wthKey && meta?.status) {
        seenKeys.add(`withdrawal-${wthKey}-${meta.status}`);
        seenKeys.add(`withdrawal-${formatTransactionId(wthKey)}-${meta.status}`);
        const raw = String(wthKey).replace(/^BW-TRX-/i, '');
        if (raw) seenKeys.add(`withdrawal-${raw}-${meta.status}`);
      }
    }
  } catch {
    // Graceful fallback if table is unavailable during testing
  }

  // 2. Tournament Rewards / Match Winnings
  try {
    const rewardsRes = await query(
      `SELECT mp.id, mp.match_id, mp.payout, mp.kills, mp.position,
              m.game_mode, m.team_mode, m.start_time, mp.joined_at
       FROM match_players mp
       JOIN matches m ON mp.match_id = m.id
       WHERE mp.user_id = $1 AND mp.payout > 0 AND m.status = 'completed'
       ORDER BY mp.id DESC
       LIMIT 10`,
      [userId]
    );

    for (const row of rewardsRes.rows) {
      const rewardKey = `reward-${row.match_id}`;
      if (!seenKeys.has(rewardKey)) {
        const matchTitle = formatMatchModeTitle(row.game_mode, row.team_mode);
        const payoutRupees = Math.round(Number(row.payout));
        const eventMs = new Date(row.joined_at || row.start_time || Date.now()).getTime();
        notifications.push({
          id: rewardKey,
          type: 'reward',
          title: `Tournament Reward: ₹${payoutRupees}`,
          message: `Congratulations! You won ₹${payoutRupees} (Rank #${row.position || '-'}, ${row.kills || 0} kills) in ${matchTitle}!`,
          timestamp: formatRelativeTime(eventMs),
          createdAt: eventMs,
          actionUrl: `/matches/${row.match_id}`,
        });
        seenKeys.add(rewardKey);
      }
    }
  } catch {
    // ignore
  }

  // 3. Matches user has joined (match_players joined with matches)
  try {
    const matchesRes = await query(
      `SELECT mp.id AS player_id, mp.joined_at,
              m.id AS match_id, m.game_mode, m.team_mode, m.start_time,
              m.status, m.room_id, m.room_password, m.created_at
       FROM match_players mp
       JOIN matches m ON mp.match_id = m.id
       WHERE mp.user_id = $1 AND mp.refunded_at IS NULL
       ORDER BY mp.joined_at DESC
       LIMIT 20`,
      [userId]
    );

    for (const row of matchesRes.rows) {
      const matchTitle = formatMatchModeTitle(row.game_mode, row.team_mode);
      const joinedAtMs = new Date(row.joined_at).getTime();

      // Match Joined Event
      const joinKey = `match_joined-${row.match_id}`;
      if (!seenKeys.has(joinKey)) {
        notifications.push({
          id: `match-joined-${row.match_id}`,
          type: 'match_joined',
          title: `Match Joined: ${matchTitle}`,
          message: `You joined ${matchTitle}. Match starts at ${formatISTTime(row.start_time)} IST.`,
          timestamp: formatRelativeTime(joinedAtMs),
          createdAt: joinedAtMs,
          actionUrl: `/matches/${row.match_id}`,
        });
        seenKeys.add(joinKey);
      }

      // Room Open Event
      if (
        (row.status === 'room_open' || row.status === 'live' || row.status === 'completed') &&
        row.room_id
      ) {
        const openKey = `room_open-${row.match_id}`;
        if (!seenKeys.has(openKey)) {
          const startTimeMs = new Date(row.start_time).getTime();
          const matchCreatedMs = new Date(row.created_at).getTime();
          const roomOpenMs =
            startTimeMs - 15 * 60 * 1000 <= Date.now()
              ? Math.max(joinedAtMs, startTimeMs - 15 * 60 * 1000)
              : Math.max(joinedAtMs + 500, matchCreatedMs + 500);

          const pwText = row.room_password ? `Password: ${row.room_password}` : 'No password';
          notifications.push({
            id: `room-open-${row.match_id}`,
            type: 'room_open',
            title: `Room Open: ${matchTitle}`,
            message: `Room ID: ${row.room_id} | ${pwText}`,
            timestamp: formatRelativeTime(roomOpenMs),
            createdAt: roomOpenMs,
            roomId: row.room_id,
            roomPassword: row.room_password || undefined,
            actionUrl: `/matches/${row.match_id}`,
          });
          seenKeys.add(openKey);
        }
      }

      // Match Live Event
      if (row.status === 'live' || row.status === 'completed') {
        const liveKey = `room_live-${row.match_id}`;
        if (!seenKeys.has(liveKey)) {
          const startTimeMs = new Date(row.start_time).getTime();
          const matchCreatedMs = new Date(row.created_at).getTime();
          const liveMs =
            startTimeMs <= Date.now()
              ? Math.max(joinedAtMs + 1000, startTimeMs)
              : Math.max(joinedAtMs + 1000, matchCreatedMs + 1000);

          notifications.push({
            id: `room-live-${row.match_id}`,
            type: 'room_live',
            title: `Match Live: ${matchTitle}`,
            message: `The match is now in progress! Good luck and secure your Booyah!`,
            timestamp: formatRelativeTime(liveMs),
            createdAt: liveMs,
            actionUrl: `/matches/${row.match_id}`,
          });
          seenKeys.add(liveKey);
        }
      }
    }
  } catch {
    // ignore
  }

  // 4. Deposits (deposit_requests)
  try {
    const depositsRes = await query(
      `SELECT id, amount, status, reject_reason, created_at, reviewed_at
       FROM deposit_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 15`,
      [userId]
    );

    for (const dep of depositsRes.rows) {
      const amountRupees = Math.round(Number(dep.amount));
      const createdMs = new Date(dep.created_at).getTime();
      const txnId = formatTransactionId(dep.id);

      if (dep.status === 'approved') {
        const depKey = `deposit-${txnId}-approved`;
        const rawKey = `deposit-${dep.id}-approved`;
        if (!seenKeys.has(depKey) && !seenKeys.has(rawKey)) {
          const approvedMs = new Date(dep.reviewed_at || dep.created_at).getTime();
          notifications.push({
            id: depKey,
            type: 'wallet_deposit',
            title: `Deposit Approved: ₹${amountRupees}`,
            message: `₹${amountRupees} has been successfully added to your wallet balance.`,
            timestamp: formatRelativeTime(approvedMs),
            createdAt: approvedMs,
            actionUrl: `/wallet/transactions/${txnId}`,
          });
          seenKeys.add(depKey);
          seenKeys.add(rawKey);
        }
      } else if (dep.status === 'rejected') {
        const depKey = `deposit-${txnId}-rejected`;
        const rawKey = `deposit-${dep.id}-rejected`;
        if (!seenKeys.has(depKey) && !seenKeys.has(rawKey)) {
          const rejectedMs = new Date(dep.reviewed_at || dep.created_at).getTime();
          const reasonText = dep.reject_reason ? ` Reason: ${dep.reject_reason}` : '';
          notifications.push({
            id: depKey,
            type: 'wallet_deposit',
            title: `Deposit Rejected: ₹${amountRupees}`,
            message: `Your deposit request for ₹${amountRupees} was rejected.${reasonText}`,
            timestamp: formatRelativeTime(rejectedMs),
            createdAt: rejectedMs,
            actionUrl: `/wallet/transactions/${txnId}`,
          });
          seenKeys.add(depKey);
          seenKeys.add(rawKey);
        }
      } else {
        const depKey = `deposit-${txnId}-submitted`;
        const rawKey = `deposit-${dep.id}-submitted`;
        if (!seenKeys.has(depKey) && !seenKeys.has(rawKey)) {
          notifications.push({
            id: depKey,
            type: 'wallet_deposit',
            title: `Deposit Submitted: ₹${amountRupees}`,
            message: `Your deposit of ₹${amountRupees} is currently being verified by staff.`,
            timestamp: formatRelativeTime(createdMs),
            createdAt: createdMs,
            actionUrl: `/wallet/transactions/${txnId}`,
          });
          seenKeys.add(depKey);
          seenKeys.add(rawKey);
        }
      }
    }
  } catch {
    // ignore
  }

  // 5. Withdrawals (withdrawal_requests)
  try {
    const withdrawalsRes = await query(
      `SELECT id, amount, status, upi_id, reject_reason, created_at, processed_at
       FROM withdrawal_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 15`,
      [userId]
    );

    for (const w of withdrawalsRes.rows) {
      const amountRupees = Math.round(Number(w.amount));
      const createdMs = new Date(w.created_at).getTime();
      const txnId = formatTransactionId(w.id);

      if (w.status === 'paid') {
        const wKey = `withdrawal-${txnId}-paid`;
        const rawKey = `withdrawal-${w.id}-paid`;
        if (!seenKeys.has(wKey) && !seenKeys.has(rawKey)) {
          const paidMs = new Date(w.processed_at || w.created_at).getTime();
          notifications.push({
            id: wKey,
            type: 'wallet_withdrawal',
            title: `Withdrawal Successful: ₹${amountRupees}`,
            message: `₹${amountRupees} has been transferred to your UPI (${w.upi_id}).`,
            timestamp: formatRelativeTime(paidMs),
            createdAt: paidMs,
            actionUrl: `/wallet/transactions/${txnId}`,
          });
          seenKeys.add(wKey);
          seenKeys.add(rawKey);
        }
      } else if (w.status === 'rejected') {
        const wKey = `withdrawal-${txnId}-rejected`;
        const rawKey = `withdrawal-${w.id}-rejected`;
        if (!seenKeys.has(wKey) && !seenKeys.has(rawKey)) {
          const rejectedMs = new Date(w.processed_at || w.created_at).getTime();
          const reasonText = w.reject_reason ? ` Reason: ${w.reject_reason}` : '';
          notifications.push({
            id: wKey,
            type: 'wallet_withdrawal',
            title: `Withdrawal Rejected: ₹${amountRupees}`,
            message: `Your withdrawal request for ₹${amountRupees} was rejected.${reasonText}`,
            timestamp: formatRelativeTime(rejectedMs),
            createdAt: rejectedMs,
            actionUrl: `/wallet/transactions/${txnId}`,
          });
          seenKeys.add(wKey);
          seenKeys.add(rawKey);
        }
      } else {
        const wKey = `withdrawal-${txnId}-pending`;
        const rawKey = `withdrawal-${w.id}-pending`;
        if (!seenKeys.has(wKey) && !seenKeys.has(rawKey)) {
          notifications.push({
            id: wKey,
            type: 'wallet_withdrawal',
            title: `Withdrawal Requested: ₹${amountRupees}`,
            message: `Withdrawal of ₹${amountRupees} to UPI (${w.upi_id}) is under review.`,
            timestamp: formatRelativeTime(createdMs),
            createdAt: createdMs,
            actionUrl: `/wallet/transactions/${txnId}`,
          });
          seenKeys.add(wKey);
          seenKeys.add(rawKey);
        }
      }
    }
  } catch {
    // ignore
  }

  // 6. Important Updates / Platform Announcements
  try {
    const updatesRes = await query(
      `SELECT id, title, heading, summary, created_at
       FROM important_updates
       WHERE is_active = true
       ORDER BY sort_order ASC, created_at DESC
       LIMIT 5`
    );

    for (const up of updatesRes.rows) {
      const upKey = `update-${up.id}`;
      if (!seenKeys.has(upKey)) {
        const createdMs = new Date(up.created_at).getTime();
        notifications.push({
          id: upKey,
          type: 'announcement',
          title: up.title,
          message: up.summary || up.heading,
          timestamp: formatRelativeTime(createdMs),
          createdAt: createdMs,
          actionUrl: '/important-updates',
        });
        seenKeys.add(upKey);
      }
    }
  } catch {
    // ignore
  }

  // Sort descending by creation timestamp and tie-break deterministically by ID
  notifications.sort((a, b) => {
    if (b.createdAt !== a.createdAt) {
      return b.createdAt - a.createdAt;
    }
    return String(b.id).localeCompare(String(a.id));
  });

  // Return the most recent 25 notifications
  return notifications.slice(0, 25);
}

// ─── Admin Notification Operations ──────────────────────────────────────────

export interface AdminCreateNotificationDto {
  title: string;
  message: string;
  type?: NotificationType;
  target?: 'all' | 'specific';
  targetUserId?: string | number;
  targetUsername?: string;
  actionUrl?: string;
}

export async function adminCreateNotification(
  staffId: string,
  data: AdminCreateNotificationDto
): Promise<any> {
  const title = (data.title || '').trim();
  const message = (data.message || '').trim();
  if (!title) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Notification title is required', 400);
  }
  if (!message) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Notification message is required', 400);
  }

  let targetUserId: string | null = null;
  if (data.target === 'specific' || data.targetUserId || data.targetUsername) {
    if (data.targetUserId) {
      const userRes = await query('SELECT id, username FROM users WHERE id = $1', [data.targetUserId.toString()]);
      if (userRes.rows.length === 0) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Target user not found', 404);
      }
      targetUserId = userRes.rows[0].id.toString();
    } else if (data.targetUsername) {
      const userRes = await query('SELECT id, username FROM users WHERE username = $1', [data.targetUsername.trim()]);
      if (userRes.rows.length === 0) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Target user not found', 404);
      }
      targetUserId = userRes.rows[0].id.toString();
    }
  }

  const notifType: NotificationType = data.type || 'announcement';
  const actionUrl = data.actionUrl?.trim() || null;

  const res = await query(
    `INSERT INTO notifications (user_id, type, title, message, action_url, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING id, user_id, type, title, message, action_url, metadata, created_at`,
    [
      targetUserId,
      notifType,
      title,
      message,
      actionUrl,
      JSON.stringify({ createdByStaffId: staffId, broadcast: !targetUserId }),
    ]
  );

  // Dispatch push notification
  if (targetUserId) {
    sendUnifiedPushNotification(targetUserId.toString(), {
      title,
      message,
      actionUrl: actionUrl || '/notifications',
    }).catch(() => {});
  } else {
    sendPushBroadcast({
      title,
      message,
      actionUrl: actionUrl || '/notifications',
    }).catch(() => {});
  }

  return res.rows[0];
}

export async function adminListNotifications(params: { limit?: number; offset?: number } = {}) {
  const limit = Math.min(params.limit || 50, 100);
  const offset = params.offset || 0;

  const res = await query(
    `SELECT n.id, n.user_id, n.type, n.title, n.message, n.action_url, n.metadata, n.created_at,
            u.username AS target_username, u.name AS target_name
     FROM notifications n
     LEFT JOIN users u ON u.id = n.user_id
     ORDER BY n.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const countRes = await query('SELECT count(*)::int AS count FROM notifications');
  const total = countRes.rows[0]?.count || 0;

  return {
    items: res.rows.map((r) => ({
      id: r.id.toString(),
      userId: r.user_id ? r.user_id.toString() : null,
      targetUsername: r.target_username || null,
      targetName: r.target_name || null,
      isBroadcast: !r.user_id,
      type: r.type,
      title: r.title,
      message: r.message,
      actionUrl: r.action_url,
      metadata: r.metadata,
      createdAt: r.created_at.toISOString(),
    })),
    total,
  };
}

export async function adminDeleteNotification(id: number | string): Promise<void> {
  const res = await query('DELETE FROM notifications WHERE id = $1 RETURNING id', [id.toString()]);
  if (res.rows.length === 0) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Notification not found', 404);
  }
}
