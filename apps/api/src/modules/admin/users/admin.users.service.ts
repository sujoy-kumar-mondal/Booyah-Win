import {
  ErrorCodes,
  paiseToString,
  stringToPaise,
  formatDbNumeric,
  getPositionLabel,
} from '@booyah/shared';
import { query, withTransaction } from '../../../db/index.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { writeAuditLog } from '../../../utils/audit.js';
import {
  creditWallet,
  debitWallet,
  WalletKind,
  getWalletBalances,
} from '../../wallet/wallet.service.js';

export interface AdminUserListItem {
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
}

export class AdminUsersService {
  /**
   * Search / list users with pagination (Section 16.3).
   * - Requirement 5: Escapes % and _ in q, caps q to 100 characters, includes deleted users with isDeleted flag.
   */
  static async listUsers(options: {
    q?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    items: AdminUserListItem[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const limit = Math.min(Math.max(options.limit || 20, 1), 50);
    const rawQ = (options.q || '').slice(0, 100).trim();
    const params: any[] = [];
    let queryText = `
      SELECT id, name, email, mobile, ff_id, ff_name, upi_id,
             deleted_at, created_at
      FROM users
      WHERE 1=1
    `;

    if (rawQ) {
      const escaped = rawQ.replace(/[%_\\]/g, '\\$&');
      params.push(`%${escaped}%`);
      const pIdx = params.length;
      queryText += ` AND (
        name ILIKE $${pIdx} ESCAPE '\\'
        OR email ILIKE $${pIdx} ESCAPE '\\'
        OR mobile ILIKE $${pIdx} ESCAPE '\\'
        OR ff_id ILIKE $${pIdx} ESCAPE '\\'
      )`;
    }

    if (options.cursor) {
      params.push(options.cursor);
      queryText += ` AND id < $${params.length}`;
    }

    queryText += ` ORDER BY id DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1);

    const res = await query<{
      id: string;
      name: string;
      email: string;
      mobile: string;
      ff_id: string;
      ff_name: string;
      upi_id: string;
      deleted_at: Date | null;
      created_at: Date;
    }>(queryText, params);

    const hasMore = res.rows.length > limit;
    const rows = hasMore ? res.rows.slice(0, limit) : res.rows;
    const nextCursor = hasMore && rows.length > 0
      ? rows[rows.length - 1].id.toString()
      : null;

    const items: AdminUserListItem[] = rows.map((r) => ({
      id: r.id.toString(),
      name: r.name,
      email: r.email,
      mobile: r.mobile,
      ffId: r.ff_id,
      ffName: r.ff_name,
      upiId: r.upi_id,
      isDeleted: r.deleted_at !== null,
      deletedAt: r.deleted_at ? r.deleted_at.toISOString() : null,
      createdAt: r.created_at.toISOString(),
    }));

    return { items, nextCursor, hasMore };
  }

  /**
   * User detail: profile, 3 wallet balances, recent ledger, match history (Section 16.3).
   */
  static async getUserDetail(userId: string): Promise<{
    profile: {
      id: string;
      name: string;
      email: string;
      mobile: string;
      ffId: string;
      ffName: string;
      upiId: string;
      dateOfBirth: string;
      referralCode: string;
      referredBy: string | null;
      isDeleted: boolean;
      deletedAt: string | null;
      deletedReason: string | null;
      deletedBy: string | null;
      createdAt: string;
    };
    wallets: { addMoney: string; cashback: string; winning: string; total: string };
    recentLedger: Array<{
      id: number;
      wallet: string;
      type: string;
      amount: string;
      balanceAfter: string;
      totalAfter: string;
      refType: string | null;
      refId: string | null;
      createdAt: string;
    }>;
    matchHistory: Array<{
      matchId: string;
      gameMode: string;
      teamMode: string;
      entryFee: string;
      startTime: string;
      matchStatus: string;
      kills: number;
      position: number | null;
      payout: string;
      displayStatus: string;
      joinedAt: string;
    }>;
  }> {
    const userRes = await query<{
      id: string;
      name: string;
      email: string;
      mobile: string;
      ff_id: string;
      ff_name: string;
      upi_id: string;
      date_of_birth: string;
      referral_code: string;
      referred_by: string | null;
      deleted_at: Date | null;
      deleted_reason: string | null;
      deleted_by: string | null;
      created_at: Date;
    }>(
      `SELECT id, name, email, mobile, ff_id, ff_name, upi_id,
              to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
              referral_code, referred_by,
              deleted_at, deleted_reason, deleted_by, created_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userRes.rowCount === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }
    const u = userRes.rows[0];

    // Wallets
    const walletRes = await query<{
      add_money: string;
      cashback: string;
      winning: string;
    }>('SELECT add_money, cashback, winning FROM wallets WHERE user_id = $1', [userId]);

    const w = walletRes.rows[0] || { add_money: '0.00', cashback: '0.00', winning: '0.00' };
    const addMoneyPaise = stringToPaise(w.add_money.toString());
    const cashbackPaise = stringToPaise(w.cashback.toString());
    const winningPaise = stringToPaise(w.winning.toString());
    const totalPaise = addMoneyPaise + cashbackPaise + winningPaise;

    // Recent 20 ledger rows
    const ledgerRes = await query<{
      id: number;
      wallet: string;
      type: string;
      amount: string;
      balance_after: string;
      total_after: string;
      ref_type: string | null;
      ref_id: string | null;
      created_at: Date;
    }>(
      `SELECT id, wallet, type, amount, balance_after, total_after, ref_type, ref_id, created_at
       FROM wallet_ledger
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 20`,
      [userId]
    );

    const recentLedger = ledgerRes.rows.map((row) => ({
      id: Number(row.id),
      wallet: row.wallet,
      type: row.type,
      amount: row.amount.toString(),
      balanceAfter: row.balance_after.toString(),
      totalAfter: row.total_after.toString(),
      refType: row.ref_type,
      refId: row.ref_id ? row.ref_id.toString() : null,
      createdAt: row.created_at.toISOString(),
    }));

    // Recent 20 match players records
    const matchRes = await query<{
      match_id: string;
      game_mode: string;
      team_mode: string;
      entry_fee: string;
      start_time: Date;
      match_status: string;
      kills: number | null;
      position: number | null;
      payout: string | null;
      refunded_at: Date | null;
      joined_at: Date;
    }>(
      `SELECT mp.match_id, mp.kills, mp.position, mp.payout, mp.refunded_at, mp.joined_at,
              m.game_mode, m.team_mode, m.entry_fee, m.start_time, m.status AS match_status
       FROM match_players mp
       JOIN matches m ON m.id = mp.match_id
       WHERE mp.user_id = $1
       ORDER BY mp.id DESC
       LIMIT 20`,
      [userId]
    );

    const matchHistory = matchRes.rows.map((r) => {
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
        entryFee: r.entry_fee.toString(),
        startTime: r.start_time.toISOString(),
        matchStatus: r.match_status,
        kills: r.kills ?? 0,
        position: r.position,
        payout: r.payout ? paiseToString(stringToPaise(r.payout.toString())) : '0.00',
        displayStatus,
        joinedAt: r.joined_at.toISOString(),
      };
    });

    return {
      profile: {
        id: u.id.toString(),
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        ffId: u.ff_id,
        ffName: u.ff_name,
        upiId: u.upi_id,
        dateOfBirth: u.date_of_birth,
        referralCode: u.referral_code,
        referredBy: u.referred_by ? u.referred_by.toString() : null,
        isDeleted: u.deleted_at !== null,
        deletedAt: u.deleted_at ? u.deleted_at.toISOString() : null,
        deletedReason: u.deleted_reason,
        deletedBy: u.deleted_by ? u.deleted_by.toString() : null,
        createdAt: u.created_at.toISOString(),
      },
      wallets: {
        addMoney: paiseToString(addMoneyPaise),
        cashback: paiseToString(cashbackPaise),
        winning: paiseToString(winningPaise),
        total: paiseToString(totalPaise),
      },
      recentLedger,
      matchHistory,
    };
  }

  /**
   * Soft delete user (Section 16.3).
   * - Requirement 4: Uses FOR NO KEY UPDATE on user row.
   * - Requirement 6: Deleting an already-deleted user returns 409 INVALID_TRANSITION;
   *   expires that user's pending team invites.
   */
  static async deleteUser(
    adminId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    const trimmedReason = (reason || '').trim();
    if (trimmedReason.length < 5) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'Delete reason must be at least 5 characters',
        400
      );
    }

    await withTransaction(async (client) => {
      // 1. Lock user row FOR NO KEY UPDATE
      const lockRes = await client.query<{
        id: string;
        deleted_at: Date | null;
      }>(
        'SELECT id, deleted_at FROM users WHERE id = $1 FOR NO KEY UPDATE',
        [userId]
      );

      if (lockRes.rowCount === 0) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'User not found', 404);
      }

      const user = lockRes.rows[0];
      if (user.deleted_at !== null) {
        throw new AppError(
          ErrorCodes.INVALID_TRANSITION,
          'User is already deleted',
          409
        );
      }

      // 2. Soft delete user
      await client.query(
        `UPDATE users
         SET deleted_at = now(), deleted_reason = $1, deleted_by = $2
         WHERE id = $3`,
        [trimmedReason, adminId, userId]
      );

      // 3. Invalidate active user session
      await client.query(
        `DELETE FROM sessions
         WHERE account_type = 'user' AND account_id = $1`,
        [userId]
      );

      // 4. Expire pending team invites (Requirement 6)
      await client.query(
        `UPDATE team_invites
         SET status = 'expired', responded_at = now()
         WHERE invited_user_id = $1 AND status = 'pending'`,
        [userId]
      );

      // 5. Audit log
      await writeAuditLog(client, {
        staffId: adminId,
        action: 'user_deleted',
        targetType: 'user',
        targetId: userId,
        details: { reason: trimmedReason, deletedBy: adminId },
      });
    });
  }

  /**
   * Balance adjustment (Section 16.3).
   * - Requirement 1: Admin adjustment goes through wallet.service (credit/debit)
   *   with ledger type admin_adjustment, no direct wallet updates.
   *   Reason >= 5 chars; zero amount rejected. Cannot make balance negative.
   */
  static async adjustBalance(
    adminId: string,
    userId: string,
    params: {
      wallet: WalletKind;
      amount: string;
      reason: string;
    }
  ): Promise<{
    userId: string;
    wallet: WalletKind;
    amount: string;
    balances: { addMoney: string; cashback: string; winning: string; total: string };
  }> {
    const trimmedReason = (params.reason || '').trim();
    if (trimmedReason.length < 5) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'Adjustment reason must be at least 5 characters',
        400
      );
    }

    const amountPaise = stringToPaise(params.amount);
    if (amountPaise === 0) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'Adjustment amount cannot be zero',
        400
      );
    }

    return await withTransaction(async (client) => {
      // Lock wallet FOR UPDATE
      const walletRes = await client.query(
        'SELECT user_id FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );
      if (walletRes.rowCount === 0) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'User wallet not found', 404);
      }

      if (amountPaise > 0) {
        await creditWallet(
          client,
          userId,
          params.wallet,
          amountPaise,
          'admin_adjustment',
          'admin_adjustment',
          adminId
        );
      } else {
        await debitWallet(
          client,
          userId,
          params.wallet,
          Math.abs(amountPaise),
          'admin_adjustment',
          'admin_adjustment',
          adminId
        );
      }

      // Audit log in transaction
      await writeAuditLog(client, {
        staffId: adminId,
        action: 'balance_adjusted',
        targetType: 'user',
        targetId: userId,
        details: {
          wallet: params.wallet,
          amount: params.amount,
          amountPaise,
          reason: trimmedReason,
          adminId,
        },
      });

      const updatedBalances = await getWalletBalances(client, userId);

      return {
        userId,
        wallet: params.wallet,
        amount: params.amount,
        balances: updatedBalances,
      };
    });
  }
}
