import { paiseToString, stringToPaise, ErrorCodes, getPositionLabel } from '@booyah/shared';
import { query } from '../../../db/index.js';
import { AppError } from '../../../middleware/errorHandler.js';

export const DAILY_USER_DETAIL_VIEW_CAP = 300;

export function maskMobile(mobile: string): string {
  if (!mobile) return '';
  const digits = mobile.replace(/\D/g, '');
  if (digits.length <= 4) return mobile;
  return '******' + digits.slice(-4);
}

export function maskUpiId(upiId: string): string {
  if (!upiId) return '';
  const parts = upiId.split('@');
  if (parts.length !== 2) return '****';
  const local = parts[0];
  const handle = parts[1];
  if (local.length <= 4) {
    return '*'.repeat(local.length) + '@' + handle;
  }
  return '****' + local.slice(-4) + '@' + handle;
}

// Explicit allowlist of profile keys for employees (Instruction #5)
export const EMPLOYEE_USER_PROFILE_ALLOWLIST = [
  'id',
  'name',
  'email',
  'mobile',
  'ffId',
  'ffName',
  'upiId',
  'isDeleted',
  'deletedAt',
  'createdAt',
] as const;

export class StaffUsersService {
  /**
   * Search / list users with cursor pagination for staff.
   * Search query matches across name, email, mobile, and ff_id.
   * Mobile and upiId are returned masked.
   */
  static async listUsers(options: {
    q?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    items: Array<{
      id: string;
      name: string;
      email: string;
      mobile: string;
      ffId: string;
      ffName: string;
      upiId: string;
      isDeleted: boolean;
      deletedAt: string | null;
      createdAt: string;
    }>;
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const rawQ = (options.q || '').trim().slice(0, 100);

    let whereClause = '1=1';
    const params: any[] = [];
    let pIdx = 1;

    if (rawQ) {
      const sanitized = rawQ.replace(/[%_]/g, '\\$&');
      whereClause += ` AND (name ILIKE $${pIdx} OR email ILIKE $${pIdx} OR mobile ILIKE $${pIdx} OR ff_id ILIKE $${pIdx})`;
      params.push(`%${sanitized}%`);
      pIdx++;
    }

    if (options.cursor) {
      whereClause += ` AND id < $${pIdx}`;
      params.push(options.cursor);
      pIdx++;
    }

    params.push(limit + 1);
    const sql = `
      SELECT id, name, email, mobile, ff_id, ff_name, upi_id,
             (deleted_at IS NOT NULL) AS is_deleted,
             deleted_at, created_at
      FROM users
      WHERE ${whereClause}
      ORDER BY id DESC
      LIMIT $${pIdx}
    `;

    const res = await query(sql, params);
    const hasMore = res.rows.length > limit;
    const rows = hasMore ? res.rows.slice(0, limit) : res.rows;
    const nextCursor = hasMore && rows.length > 0 ? rows[rows.length - 1].id.toString() : null;

    const items = rows.map((r: any) => ({
      id: r.id.toString(),
      name: r.name,
      email: r.email,
      mobile: maskMobile(r.mobile),
      ffId: r.ff_id,
      ffName: r.ff_name,
      upiId: maskUpiId(r.upi_id),
      isDeleted: Boolean(r.is_deleted),
      deletedAt: r.deleted_at ? r.deleted_at.toISOString() : null,
      createdAt: r.created_at.toISOString(),
    }));

    return { items, nextCursor, hasMore };
  }

  /**
   * Get user detail for staff with strict allowlist and masked fields.
   * Audits view as user_viewed for all staff.
   * Enforces daily distinct user view cap (default 300) for employees.
   */
  static async getUserDetail(
    staffId: string,
    staffRole: 'employee' | 'admin',
    userId: string
  ): Promise<any> {
    // Check daily distinct user view cap for employees (Instruction 3)
    if (staffRole === 'employee') {
      const distinctCountRes = await query<{ count: string }>(
        `SELECT COUNT(DISTINCT target_id)::text AS count
         FROM audit_logs
         WHERE staff_id = $1
           AND action = 'user_viewed'
           AND created_at >= date_trunc('day', now())`,
        [staffId]
      );
      const currentDistinct = parseInt(distinctCountRes.rows[0]?.count || '0', 10);

      // Check if this specific user was already viewed today by this employee
      const alreadyViewedRes = await query(
        `SELECT 1 FROM audit_logs
         WHERE staff_id = $1
           AND action = 'user_viewed'
           AND target_id = $2
           AND created_at >= date_trunc('day', now())
         LIMIT 1`,
        [staffId, userId]
      );

      if (alreadyViewedRes.rowCount === 0 && currentDistinct >= DAILY_USER_DETAIL_VIEW_CAP) {
        // Exceeded daily cap - audit and throw RATE_LIMITED
        await query(
          `INSERT INTO audit_logs (staff_id, action, target_type, target_id, details)
           VALUES ($1, 'user_view_limit_exceeded', 'user', $2, $3)`,
          [staffId, userId, JSON.stringify({ cap: DAILY_USER_DETAIL_VIEW_CAP, distinctViewed: currentDistinct })]
        );
        throw new AppError(
          ErrorCodes.RATE_LIMITED,
          `Daily distinct user view limit reached (${DAILY_USER_DETAIL_VIEW_CAP}/day)`,
          429
        );
      }
    }

    // Load user
    const userRes = await query(
      `SELECT id, name, email, mobile, ff_id, ff_name, upi_id,
              (deleted_at IS NOT NULL) AS is_deleted,
              deleted_at, created_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userRes.rowCount === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }
    const userRow = userRes.rows[0];

    // Load wallets
    const walletRes = await query(
      'SELECT add_money, cashback, winning FROM wallets WHERE user_id = $1',
      [userId]
    );
    const w = walletRes.rows[0] || { add_money: 0, cashback: 0, winning: 0 };
    const addMoneyPaise = stringToPaise(w.add_money.toString());
    const cashbackPaise = stringToPaise(w.cashback.toString());
    const winningPaise = stringToPaise(w.winning.toString());
    const totalPaise = addMoneyPaise + cashbackPaise + winningPaise;

    // Load recent ledger (last 20)
    const ledgerRes = await query(
      `SELECT id, wallet, type, amount, balance_after, total_after, ref_type, ref_id, created_at
       FROM wallet_ledger
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 20`,
      [userId]
    );

    // Load match history (last 20)
    const matchRes = await query(
      `SELECT m.id AS match_id, m.game_mode, m.team_mode, m.entry_fee, m.start_time, m.status AS match_status,
              COALESCE(mp.kills, 0) AS kills, mp.position,
              COALESCE(mp.payout, 0) AS payout,
              mp.joined_at,
              mp.refunded_at
       FROM match_players mp
       JOIN matches m ON m.id = mp.match_id
       WHERE mp.user_id = $1
       ORDER BY m.start_time DESC
       LIMIT 20`,
      [userId]
    );

    // Load deposit history (last 20)
    const depositRes = await query(
      `SELECT id, amount, utr, status, reject_reason, created_at, reviewed_at, employee_reviewed_at
       FROM deposit_requests
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 20`,
      [userId]
    );

    // Load withdrawal history (last 20)
    const withdrawalRes = await query(
      `SELECT id, amount, upi_id, status, reject_reason, payout_ref, created_at, processed_at, employee_reviewed_at
       FROM withdrawal_requests
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 20`,
      [userId]
    );

    // Construct profile using STRICT ALLOWLIST (Instruction #5)
    const profile: Record<string, any> = {};
    for (const key of EMPLOYEE_USER_PROFILE_ALLOWLIST) {
      switch (key) {
        case 'id':
          profile.id = userRow.id.toString();
          break;
        case 'name':
          profile.name = userRow.name;
          break;
        case 'email':
          profile.email = userRow.email;
          break;
        case 'mobile':
          profile.mobile = maskMobile(userRow.mobile);
          break;
        case 'ffId':
          profile.ffId = userRow.ff_id;
          break;
        case 'ffName':
          profile.ffName = userRow.ff_name;
          break;
        case 'upiId':
          profile.upiId = maskUpiId(userRow.upi_id);
          break;
        case 'isDeleted':
          profile.isDeleted = Boolean(userRow.is_deleted);
          break;
        case 'deletedAt':
          profile.deletedAt = userRow.deleted_at ? userRow.deleted_at.toISOString() : null;
          break;
        case 'createdAt':
          profile.createdAt = userRow.created_at.toISOString();
          break;
      }
    }

    // Write audit log entry (Instruction #3: Audit EVERY staff view of a user detail)
    await query(
      `INSERT INTO audit_logs (staff_id, action, target_type, target_id, details)
       VALUES ($1, 'user_viewed', 'user', $2, $3)`,
      [staffId, userId, JSON.stringify({ role: staffRole })]
    );

    return {
      profile,
      wallets: {
        addMoney: paiseToString(addMoneyPaise),
        cashback: paiseToString(cashbackPaise),
        winning: paiseToString(winningPaise),
        total: paiseToString(totalPaise),
      },
      recentLedger: ledgerRes.rows.map((r: any) => ({
        id: Number(r.id),
        wallet: r.wallet,
        type: r.type,
        amount: paiseToString(stringToPaise(r.amount.toString())),
        balanceAfter: paiseToString(stringToPaise(r.balance_after.toString())),
        totalAfter: paiseToString(stringToPaise(r.total_after.toString())),
        refType: r.ref_type || null,
        refId: r.ref_id ? r.ref_id.toString() : null,
        createdAt: r.created_at.toISOString(),
      })),
      matchHistory: matchRes.rows.map((r: any) => {
        let displayStatus = 'Result pending';
        if (r.match_status === 'cancelled' || r.refunded_at !== null) {
          displayStatus = 'Cancelled (refunded)';
        } else if (r.match_status !== 'completed') {
          displayStatus = 'Result pending';
        } else {
          displayStatus = getPositionLabel(r.position, r.game_mode);
        }

        return {
          matchId: r.match_id.toString(),
          gameMode: r.game_mode,
          teamMode: r.team_mode,
          entryFee: paiseToString(stringToPaise(r.entry_fee.toString())),
          startTime: r.start_time.toISOString(),
          matchStatus: r.match_status,
          kills: Number(r.kills),
          position: r.position !== null ? Number(r.position) : null,
          payout: paiseToString(stringToPaise(r.payout.toString())),
          displayStatus,
          joinedAt: r.joined_at.toISOString(),
        };
      }),
      depositHistory: depositRes.rows.map((r: any) => ({
        id: r.id.toString(),
        amount: paiseToString(stringToPaise(r.amount.toString())),
        utr: r.utr,
        status: r.status,
        rejectReason: r.reject_reason || null,
        createdAt: r.created_at.toISOString(),
        reviewedAt: r.reviewed_at ? r.reviewed_at.toISOString() : null,
        employeeReviewedAt: r.employee_reviewed_at ? r.employee_reviewed_at.toISOString() : null,
      })),
      withdrawalHistory: withdrawalRes.rows.map((r: any) => ({
        id: r.id.toString(),
        amount: paiseToString(stringToPaise(r.amount.toString())),
        upiId: maskUpiId(r.upi_id),
        status: r.status,
        rejectReason: r.reject_reason || null,
        payoutRef: r.payout_ref || null,
        createdAt: r.created_at.toISOString(),
        processedAt: r.processed_at ? r.processed_at.toISOString() : null,
        employeeReviewedAt: r.employee_reviewed_at ? r.employee_reviewed_at.toISOString() : null,
      })),
    };
  }
}
