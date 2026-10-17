import {
  ErrorCodes,
  paiseToString,
  stringToPaise,
  getPositionLabel,
  getOrdinal,
  UserDto,
  WalletSummaryDto,
  UserCooldownsDto,
  ReferralSummaryResponse,
} from '@booyah/shared';
import { query, withTransaction } from '../../db/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import { uploadScreenshot, getSignedUrl, deleteFile, validateImageMagicBytes } from '../../utils/storage.js';

const COOLDOWN_DAYS = 30;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

function computeAvailableAt(
  changedAt: Date | string | null | undefined,
  dbNow: Date
): string | null {
  if (!changedAt) return null;
  const changedDate = new Date(changedAt);
  const availableMs = changedDate.getTime() + COOLDOWN_MS;
  if (dbNow.getTime() >= availableMs) {
    return null;
  }
  return new Date(availableMs).toISOString();
}

export class UsersService {
  /**
   * Get complete user profile with wallet balances and cooldowns.
   */
  static async getProfile(userId: string): Promise<{
    profile: UserDto;
    wallets: WalletSummaryDto;
    cooldowns: UserCooldownsDto;
  }> {
    const userRes = await query<{
      id: string;
      email: string;
      name: string;
      mobile: string;
      ff_id: string;
      ff_name: string;
      upi_id: string;
      date_of_birth: string;
      referral_code: string;
      referred_by: string | null;
      avatar_key: string | null;
      language: string;
      mobile_changed_at: Date | null;
      ff_id_changed_at: Date | null;
      ff_name_changed_at: Date | null;
      upi_changed_at: Date | null;
      created_at: Date;
      db_now: Date;
    }>(
      `SELECT id, email, name, mobile, ff_id, ff_name, upi_id,
              to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
              referral_code, referred_by, avatar_key, language,
              mobile_changed_at, ff_id_changed_at, ff_name_changed_at, upi_changed_at,
              created_at, now() AS db_now
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (userRes.rowCount === 0) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'User not found', 401);
    }

    const row = userRes.rows[0];
    const dbNow = new Date(row.db_now);

    let avatarUrl: string | null = null;
    if (row.avatar_key) {
      try {
        avatarUrl = await getSignedUrl(row.avatar_key, 86400);
      } catch {
        avatarUrl = null;
      }
    }

    const cooldowns: UserCooldownsDto = {
      mobileAvailableAt: computeAvailableAt(row.mobile_changed_at, dbNow),
      ffIdAvailableAt: computeAvailableAt(row.ff_id_changed_at, dbNow),
      ffNameAvailableAt: computeAvailableAt(row.ff_name_changed_at, dbNow),
      upiIdAvailableAt: computeAvailableAt(row.upi_changed_at, dbNow),
    };

    const walletRes = await query<{
      add_money: string;
      cashback: string;
      winning: string;
    }>(
      'SELECT add_money, cashback, winning FROM wallets WHERE user_id = $1',
      [userId]
    );

    const w = walletRes.rows[0] || { add_money: '0.00', cashback: '0.00', winning: '0.00' };
    const addMoneyPaise = stringToPaise(w.add_money.toString());
    const cashbackPaise = stringToPaise(w.cashback.toString());
    const winningPaise = stringToPaise(w.winning.toString());
    const totalPaise = addMoneyPaise + cashbackPaise + winningPaise;

    return {
      profile: {
        id: row.id.toString(),
        email: row.email,
        name: row.name,
        mobile: row.mobile,
        ffId: row.ff_id,
        ffName: row.ff_name,
        upiId: row.upi_id,
        dateOfBirth: row.date_of_birth,
        referralCode: row.referral_code,
        referredBy: row.referred_by ? row.referred_by.toString() : null,
        avatarUrl,
        language: (row.language as 'en' | 'bn') || 'en',
        createdAt: row.created_at.toISOString(),
      },
      wallets: {
        addMoney: paiseToString(addMoneyPaise),
        cashback: paiseToString(cashbackPaise),
        winning: paiseToString(winningPaise),
        total: paiseToString(totalPaise),
      },
      cooldowns,
    };
  }

  /**
   * Update profile editable fields: mobile, ffId, ffName, upiId.
   * - Locks user row using FOR NO KEY UPDATE (Requirement 4).
   * - Enforces 30-day cooldown with database clock (Requirement 9).
   * - Unchanged values do not reset cooldown.
   * - Blocks ffId and ffName updates if user is in an active match (409 IN_ACTIVE_MATCH).
   * - Re-checks uniqueness for mobile, ffId, upiId.
   */
  static async updateProfile(
    userId: string,
    updates: {
      mobile?: string;
      ffId?: string;
      ffName?: string;
      upiId?: string;
    }
  ): Promise<{
    profile: UserDto;
    wallets: WalletSummaryDto;
    cooldowns: UserCooldownsDto;
  }> {
    await withTransaction(async (client) => {
      // 1. Lock user row FOR NO KEY UPDATE (Requirement 4)
      const lockRes = await client.query<{
        id: string;
        email: string;
        name: string;
        mobile: string;
        ff_id: string;
        ff_name: string;
        upi_id: string;
        mobile_changed_at: Date | null;
        ff_id_changed_at: Date | null;
        ff_name_changed_at: Date | null;
        upi_changed_at: Date | null;
        deleted_at: Date | null;
        db_now: Date;
      }>(
        `SELECT id, email, name, mobile, ff_id, ff_name, upi_id,
                mobile_changed_at, ff_id_changed_at, ff_name_changed_at, upi_changed_at,
                deleted_at, now() AS db_now
         FROM users
         WHERE id = $1
         FOR NO KEY UPDATE`,
        [userId]
      );

      if (lockRes.rowCount === 0 || lockRes.rows[0].deleted_at !== null) {
        throw new AppError(ErrorCodes.UNAUTHENTICATED, 'User not found', 401);
      }

      const row = lockRes.rows[0];
      const dbNow = new Date(row.db_now);

      // Determine changes (ignore unchanged values)
      const isMobileChanging =
        updates.mobile !== undefined && updates.mobile.trim() !== row.mobile;
      const isFfIdChanging =
        updates.ffId !== undefined && updates.ffId.trim() !== row.ff_id;
      const isFfNameChanging =
        updates.ffName !== undefined && updates.ffName.trim() !== row.ff_name;
      const isUpiIdChanging =
        updates.upiId !== undefined &&
        updates.upiId.trim().toLowerCase() !== row.upi_id.toLowerCase();

      // 2. Cooldown checks (Requirement 9)
      if (isMobileChanging && row.mobile_changed_at) {
        const avail = computeAvailableAt(row.mobile_changed_at, dbNow);
        if (avail !== null) {
          throw new AppError(
            ErrorCodes.FIELD_COOLDOWN,
            'Mobile number can only be changed once every 30 days',
            429,
            { field: 'mobile', availableAt: avail }
          );
        }
      }

      if (isFfIdChanging && row.ff_id_changed_at) {
        const avail = computeAvailableAt(row.ff_id_changed_at, dbNow);
        if (avail !== null) {
          throw new AppError(
            ErrorCodes.FIELD_COOLDOWN,
            'Free Fire ID can only be changed once every 30 days',
            429,
            { field: 'ffId', availableAt: avail }
          );
        }
      }

      if (isFfNameChanging && row.ff_name_changed_at) {
        const avail = computeAvailableAt(row.ff_name_changed_at, dbNow);
        if (avail !== null) {
          throw new AppError(
            ErrorCodes.FIELD_COOLDOWN,
            'Free Fire Name can only be changed once every 30 days',
            429,
            { field: 'ffName', availableAt: avail }
          );
        }
      }

      if (isUpiIdChanging && row.upi_changed_at) {
        const avail = computeAvailableAt(row.upi_changed_at, dbNow);
        if (avail !== null) {
          throw new AppError(
            ErrorCodes.FIELD_COOLDOWN,
            'UPI ID can only be changed once every 30 days',
            429,
            { field: 'upiId', availableAt: avail }
          );
        }
      }

      // 3. Active match check (ffId and ffName only)
      if (isFfIdChanging || isFfNameChanging) {
        const activeMatchRes = await client.query(
          `SELECT 1
           FROM match_players mp
           JOIN matches m ON m.id = mp.match_id
           WHERE mp.user_id = $1
             AND mp.refunded_at IS NULL
             AND m.status IN ('upcoming', 'room_open', 'live')
           LIMIT 1`,
          [userId]
        );
        if (activeMatchRes.rowCount && activeMatchRes.rowCount > 0) {
          throw new AppError(
            ErrorCodes.IN_ACTIVE_MATCH,
            'Cannot change Free Fire ID or Name while registered in an active match',
            409
          );
        }
      }

      // 4. Uniqueness checks
      if (isMobileChanging) {
        const dupMobile = await client.query(
          'SELECT id FROM users WHERE mobile = $1 AND id <> $2',
          [updates.mobile!.trim(), userId]
        );
        if (dupMobile.rowCount && dupMobile.rowCount > 0) {
          throw new AppError(
            ErrorCodes.MOBILE_EXISTS,
            'Mobile number already registered',
            409
          );
        }
      }

      if (isFfIdChanging) {
        const dupFfId = await client.query(
          'SELECT id FROM users WHERE ff_id = $1 AND id <> $2',
          [updates.ffId!.trim(), userId]
        );
        if (dupFfId.rowCount && dupFfId.rowCount > 0) {
          throw new AppError(
            ErrorCodes.FF_ID_EXISTS,
            'Free Fire ID already registered',
            409
          );
        }
      }

      if (isUpiIdChanging) {
        const dupUpi = await client.query(
          'SELECT id FROM users WHERE lower(upi_id) = lower($1) AND id <> $2',
          [updates.upiId!.trim(), userId]
        );
        if (dupUpi.rowCount && dupUpi.rowCount > 0) {
          throw new AppError(
            ErrorCodes.UPI_EXISTS,
            'UPI ID already in use',
            409
          );
        }
      }

      // 5. Build dynamic update query
      const setClauses: string[] = [];
      const queryParams: any[] = [];
      let paramIdx = 1;

      if (isMobileChanging) {
        setClauses.push(`mobile = $${paramIdx++}`, `mobile_changed_at = now()`);
        queryParams.push(updates.mobile!.trim());
      }
      if (isFfIdChanging) {
        setClauses.push(`ff_id = $${paramIdx++}`, `ff_id_changed_at = now()`);
        queryParams.push(updates.ffId!.trim());
      }
      if (isFfNameChanging) {
        setClauses.push(`ff_name = $${paramIdx++}`, `ff_name_changed_at = now()`);
        queryParams.push(updates.ffName!.trim());
      }
      if (isUpiIdChanging) {
        setClauses.push(`upi_id = $${paramIdx++}`, `upi_changed_at = now()`);
        queryParams.push(updates.upiId!.trim());
      }

      if (setClauses.length > 0) {
        queryParams.push(userId);
        await client.query(
          `UPDATE users
           SET ${setClauses.join(', ')}
           WHERE id = $${paramIdx}`,
          queryParams
        );
      }
    });

    return await UsersService.getProfile(userId);
  }

  /**
   * User Match History (Section 13.2)
   */
  static async getMatchHistory(
    userId: string,
    filters: {
      gameMode?: string;
      teamMode?: string;
      limit?: number;
      cursor?: string;
    }
  ): Promise<{
    items: Array<{
      matchId: string;
      gameMode: string;
      teamMode: string;
      entryFee: string;
      startTime: string;
      matchStatus: string;
      joinedAt: string;
      refundedAt: string | null;
      kills: number;
      position: number | null;
      payout: string;
      displayStatus: string;
      positionLabel: string;
    }>;
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const limit = Math.min(Math.max(filters.limit || 20, 1), 50);
    const params: any[] = [userId];
    let queryText = `
      SELECT mp.id AS match_player_id, mp.match_id, mp.kills, mp.position, mp.payout,
             mp.joined_at, mp.refunded_at,
             m.game_mode, m.team_mode, m.entry_fee, m.status AS match_status, m.start_time
      FROM match_players mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = $1
    `;

    if (filters.gameMode) {
      params.push(filters.gameMode);
      queryText += ` AND m.game_mode = $${params.length}`;
    }

    if (filters.teamMode) {
      params.push(filters.teamMode);
      queryText += ` AND m.team_mode = $${params.length}`;
    }

    if (filters.cursor) {
      params.push(filters.cursor);
      queryText += ` AND mp.id < $${params.length}`;
    }

    queryText += ` ORDER BY mp.id DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1);

    const res = await query<{
      match_player_id: string;
      match_id: string;
      kills: number | null;
      position: number | null;
      payout: string | null;
      joined_at: Date;
      refunded_at: Date | null;
      game_mode: string;
      team_mode: string;
      entry_fee: string;
      match_status: string;
      start_time: Date;
    }>(queryText, params);

    const hasMore = res.rows.length > limit;
    const rows = hasMore ? res.rows.slice(0, limit) : res.rows;
    const nextCursor = hasMore && rows.length > 0
      ? rows[rows.length - 1].match_player_id.toString()
      : null;

    const items = rows.map((r) => {
      let displayStatus = 'Result pending';
      let positionLabel = 'Result pending';

      if (r.match_status === 'cancelled' || r.refunded_at !== null) {
        displayStatus = 'Cancelled (refunded)';
        positionLabel = 'Cancelled (refunded)';
      } else if (r.match_status !== 'completed') {
        displayStatus = 'Result pending';
        positionLabel = 'Result pending';
      } else {
        displayStatus = getPositionLabel(r.position, r.game_mode);
        positionLabel = displayStatus;
      }

      return {
        matchId: r.match_id.toString(),
        gameMode: r.game_mode,
        teamMode: r.team_mode,
        entryFee: r.entry_fee.toString(),
        startTime: r.start_time.toISOString(),
        matchStatus: r.match_status,
        joinedAt: r.joined_at.toISOString(),
        refundedAt: r.refunded_at ? r.refunded_at.toISOString() : null,
        kills: r.kills ?? 0,
        position: r.position,
        payout: r.payout ? paiseToString(stringToPaise(r.payout.toString())) : '0.00',
        displayStatus,
        positionLabel,
      };
    });

    return { items, nextCursor, hasMore };
  }

  /**
   * Get referral summary (counts and total credited bonus from ledger).
   * Strict privacy: zero personal details (names, emails, mobiles) of referred users.
   */
  static async getReferralSummary(userId: string): Promise<ReferralSummaryResponse> {
    const userRes = await query<{ referral_code: string }>(
      'SELECT referral_code FROM users WHERE id = $1',
      [userId]
    );
    if (!userRes.rows.length) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }
    const referralCode = userRes.rows[0].referral_code;

    const countsRes = await query<{
      referred_count: string;
      bonus_earned_count: string;
    }>(
      `SELECT
         COUNT(*) AS referred_count,
         COUNT(credited_at) AS bonus_earned_count
       FROM referrals
       WHERE referrer_id = $1`,
      [userId]
    );

    const ledgerRes = await query<{ total_bonus: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS total_bonus
       FROM wallet_ledger
       WHERE user_id = $1 AND type = 'referral'`,
      [userId]
    );

    const referredCount = parseInt(countsRes.rows[0].referred_count, 10);
    const bonusEarnedCount = parseInt(countsRes.rows[0].bonus_earned_count, 10);
    const totalBonusEarned = paiseToString(stringToPaise(String(ledgerRes.rows[0].total_bonus)));

    return {
      referralCode,
      referredCount,
      bonusEarnedCount,
      totalBonusEarned,
    };
  }

  /**
   * Upload or replace user profile picture.
   */
  static async uploadAvatar(userId: string, buffer: Buffer): Promise<{ avatarUrl: string }> {
    if (buffer.length > 2 * 1024 * 1024) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'File too large: maximum 2 MB', 400);
    }
    try {
      validateImageMagicBytes(buffer);
    } catch {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Invalid image: file must be JPEG, PNG, or WebP', 400);
    }
    const key = await uploadScreenshot(buffer);

    // Fetch old avatar_key to clean up if present
    const oldRes = await query<{ avatar_key: string | null }>(
      'SELECT avatar_key FROM users WHERE id = $1',
      [userId]
    );
    const oldKey = oldRes.rows[0]?.avatar_key;
    if (oldKey) {
      try {
        await deleteFile(oldKey);
      } catch {
        // ignore deletion failure for previous avatar
      }
    }

    await query(
      'UPDATE users SET avatar_key = $1 WHERE id = $2',
      [key, userId]
    );

    const avatarUrl = await getSignedUrl(key, 86400);
    return { avatarUrl };
  }

  /**
   * Remove user profile picture.
   */
  static async deleteAvatar(userId: string): Promise<void> {
    const oldRes = await query<{ avatar_key: string | null }>(
      'SELECT avatar_key FROM users WHERE id = $1',
      [userId]
    );
    const oldKey = oldRes.rows[0]?.avatar_key;
    if (oldKey) {
      try {
        await deleteFile(oldKey);
      } catch {
        // ignore
      }
    }
    await query('UPDATE users SET avatar_key = NULL WHERE id = $1', [userId]);
  }

  /**
   * Update user language preference ('en' or 'bn').
   */
  static async updateLanguage(userId: string, language: 'en' | 'bn'): Promise<{ language: 'en' | 'bn' }> {
    const res = await query<{ language: string }>(
      'UPDATE users SET language = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING language',
      [language, userId]
    );
    if (res.rowCount === 0) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'User not found', 401);
    }
    return { language: res.rows[0].language as 'en' | 'bn' };
  }
}
