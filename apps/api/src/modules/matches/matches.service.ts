import type { PoolClient } from 'pg';
import {
  ErrorCodes,
  formatDbNumeric,
  paiseToString,
  stringToPaise,
} from '@booyah/shared';
import { query, withTransaction } from '../../db/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import { allocateEntryFee, creditReferralReward } from '../wallet/wallet.service.js';
import type { MatchUserDto } from './matches.types.js';

/**
 * List matches for users (upcoming, room_open, live) without N+1 queries.
 * Room credentials are included ONLY if user has joined AND match is room_open or live.
 */
export async function listMatchesUser(userId: string): Promise<MatchUserDto[]> {
  const sql = `
    SELECT m.id, m.game_mode, m.team_mode, m.entry_fee, m.kill_price,
           m.min_kills_for_reward, m.position_prizes, m.max_players, m.min_players,
           m.start_time, m.room_id, m.room_password, m.status,
           COUNT(DISTINCT mp.id) FILTER (WHERE mp.refunded_at IS NULL)::int AS joined_count,
           BOOL_OR(mp.user_id = $1 AND mp.refunded_at IS NULL) AS has_joined,
           COALESCE(
             (SELECT SUM(t.size)::int FROM teams t WHERE t.match_id = m.id AND t.status IN ('forming', 'confirmed')),
             0
           ) AS team_seats_taken,
           EXISTS (
             SELECT 1 FROM teams t
             LEFT JOIN match_players p ON p.team_id = t.id AND p.refunded_at IS NULL
             WHERE t.match_id = m.id
               AND t.status IN ('forming', 'confirmed')
               AND (t.leader_id = $1 OR p.user_id = $1)
           ) AS is_in_team
    FROM matches m
    LEFT JOIN match_players mp ON mp.match_id = m.id
    WHERE m.status IN ('upcoming', 'room_open', 'live')
    GROUP BY m.id
    ORDER BY m.start_time ASC
  `;

  const res = await query(sql, [userId]);

  return res.rows.map((row) => {
    const hasJoined = Boolean(row.has_joined);
    const showRoomCredentials =
      hasJoined && (row.status === 'room_open' || row.status === 'live');
    const joinedPlayers = Number(row.joined_count || 0);
    const seatsTaken =
      row.team_mode === 'solo' ? joinedPlayers : Number(row.team_seats_taken || 0);

    return {
      id: row.id.toString(),
      gameMode: row.game_mode,
      teamMode: row.team_mode,
      entryFee: paiseToString(stringToPaise(row.entry_fee.toString())),
      prizes: {
        positions: row.position_prizes,
        killPrice: paiseToString(stringToPaise(row.kill_price.toString())),
        minKillsForReward: row.min_kills_for_reward,
      },
      joinedPlayers,
      seatsTaken,
      maxPlayers: row.max_players,
      minPlayers: row.min_players,
      startTime: row.start_time.toISOString(),
      status: row.status,
      hasJoined,
      isInTeam: Boolean(row.is_in_team),
      roomId: showRoomCredentials ? (row.room_id ?? undefined) : undefined,
      roomPassword: showRoomCredentials ? (row.room_password ?? undefined) : undefined,
    };
  });
}

/**
 * Get single match detail for a user.
 * Never exposes other players' personal data or player rosters.
 */
export async function getMatchUser(userId: string, matchId: string): Promise<MatchUserDto> {
  const sql = `
    SELECT m.id, m.game_mode, m.team_mode, m.entry_fee, m.kill_price,
           m.min_kills_for_reward, m.position_prizes, m.max_players, m.min_players,
           m.start_time, m.room_id, m.room_password, m.status,
           COUNT(DISTINCT mp.id) FILTER (WHERE mp.refunded_at IS NULL)::int AS joined_count,
           BOOL_OR(mp.user_id = $1 AND mp.refunded_at IS NULL) AS has_joined,
           COALESCE(
             (SELECT SUM(t.size)::int FROM teams t WHERE t.match_id = m.id AND t.status IN ('forming', 'confirmed')),
             0
           ) AS team_seats_taken,
           EXISTS (
             SELECT 1 FROM teams t
             LEFT JOIN match_players p ON p.team_id = t.id AND p.refunded_at IS NULL
             WHERE t.match_id = m.id
               AND t.status IN ('forming', 'confirmed')
               AND (t.leader_id = $1 OR p.user_id = $1)
           ) AS is_in_team
    FROM matches m
    LEFT JOIN match_players mp ON mp.match_id = m.id
    WHERE m.id = $2 AND m.status IN ('upcoming', 'room_open', 'live')
    GROUP BY m.id
  `;

  const res = await query(sql, [userId, matchId]);
  if (!res.rowCount) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
  }

  const row = res.rows[0];
  const hasJoined = Boolean(row.has_joined);
  const showRoomCredentials =
    hasJoined && (row.status === 'room_open' || row.status === 'live');
  const joinedPlayers = Number(row.joined_count || 0);
  const seatsTaken =
    row.team_mode === 'solo' ? joinedPlayers : Number(row.team_seats_taken || 0);

  return {
    id: row.id.toString(),
    gameMode: row.game_mode,
    teamMode: row.team_mode,
    entryFee: paiseToString(stringToPaise(row.entry_fee.toString())),
    prizes: {
      positions: row.position_prizes,
      killPrice: paiseToString(stringToPaise(row.kill_price.toString())),
      minKillsForReward: row.min_kills_for_reward,
    },
    joinedPlayers,
    seatsTaken,
    maxPlayers: row.max_players,
    minPlayers: row.min_players,
    startTime: row.start_time.toISOString(),
    status: row.status,
    hasJoined,
    isInTeam: Boolean(row.is_in_team),
    roomId: showRoomCredentials ? (row.room_id ?? undefined) : undefined,
    roomPassword: showRoomCredentials ? (row.room_password ?? undefined) : undefined,
  };
}

/**
 * Solo Battle Royale Join (Section 11.5).
 * Lock order (Change #1):
 *   1. Non-locking read on referrals to find referrer_id.
 *   2. Lock match FOR UPDATE.
 *   3. Lock player wallet and referrer wallet in ascending user_id order.
 *   4. THEN allocate fee (allocateEntryFee).
 *   5. Insert match_players row.
 *   6. Call creditReferralReward (first match trigger).
 */
export async function joinMatchSolo(
  userId: string,
  matchId: string
): Promise<{ matchId: string; joinedAt: string }> {
  // Check user is active and not soft-deleted
  const userCheck = await query(
    `SELECT id, deleted_at FROM users WHERE id = $1`,
    [userId]
  );
  if (!userCheck.rowCount || userCheck.rows[0].deleted_at !== null) {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      'Account is inactive or deleted',
      403
    );
  }

  return withTransaction(async (client: PoolClient) => {
    // 1. Non-locking read to check if user has an uncredited referral
    const refRes = await client.query<{ referrer_id: number }>(
      `SELECT referrer_id FROM referrals WHERE referred_id = $1 AND credited_at IS NULL`,
      [userId]
    );
    const referrerId = refRes.rowCount ? refRes.rows[0].referrer_id.toString() : null;

    // 2. Lock the match FOR UPDATE
    const matchRes = await client.query(
      `SELECT id, game_mode, team_mode, entry_fee, max_players, start_time, status
       FROM matches
       WHERE id = $1
       FOR UPDATE`,
      [matchId]
    );

    if (!matchRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
    }
    const match = matchRes.rows[0];

    // Solo Battle Royale only in Milestone 5
    if (match.game_mode !== 'battle_royale' || match.team_mode !== 'solo') {
      throw new AppError(
        ErrorCodes.TEAM_INVALID,
        'Team join is not supported in Milestone 5; solo Battle Royale only',
        400
      );
    }

    // Status check: must be upcoming or room_open
    if (match.status !== 'upcoming' && match.status !== 'room_open') {
      throw new AppError(
        ErrorCodes.MATCH_NOT_JOINABLE,
        `Cannot join match with status ${match.status}`,
        409
      );
    }

    // Start time check against database now()
    const startCheck = await client.query<{ has_started: boolean }>(
      `SELECT ($1::timestamptz <= now()) AS has_started`,
      [match.start_time]
    );
    if (startCheck.rows[0]?.has_started) {
      throw new AppError(
        ErrorCodes.MATCH_NOT_JOINABLE,
        'Match start time has already passed',
        409
      );
    }

    // Capacity check (excluding refunded players)
    const countRes = await client.query<{ count: string }>(
      `SELECT count(*)::int AS count FROM match_players WHERE match_id = $1 AND refunded_at IS NULL`,
      [matchId]
    );
    const confirmedCount = Number(countRes.rows[0].count);
    if (confirmedCount >= match.max_players) {
      throw new AppError(
        ErrorCodes.MATCH_FULL,
        'Match is already full',
        409
      );
    }

    // Check if user has already joined (active, not refunded)
    const alreadyRes = await client.query(
      `SELECT id FROM match_players WHERE match_id = $1 AND user_id = $2 AND refunded_at IS NULL`,
      [matchId, userId]
    );
    if (alreadyRes.rowCount) {
      throw new AppError(
        ErrorCodes.ALREADY_JOINED,
        'You have already joined this match',
        409
      );
    }

    // 3. Lock player's wallet and referrer's wallet together in ascending user_id order
    const walletIdsToLock = referrerId
      ? [userId, referrerId].sort((a, b) => Number(a) - Number(b))
      : [userId];

    for (const wid of walletIdsToLock) {
      await client.query(
        `SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [wid]
      );
    }

    // 4. THEN allocate entry fee
    const feePaise = stringToPaise(match.entry_fee.toString());
    const alloc = await allocateEntryFee(client, userId, feePaise, 'match', matchId);

    // 5. Insert match_players
    try {
      await client.query(
        `INSERT INTO match_players (
           match_id, user_id, paid_add_money, paid_cashback, paid_winning
         ) VALUES ($1, $2, $3, $4, $5)`,
        [
          matchId,
          userId,
          formatDbNumeric(alloc.paidAddMoney),
          formatDbNumeric(alloc.paidCashback),
          formatDbNumeric(alloc.paidWinning),
        ]
      );
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new AppError(
          ErrorCodes.ALREADY_JOINED,
          'You have already joined this match',
          409
        );
      }
      throw err;
    }

    // 6. First-match referral trigger: credit referral reward if applicable
    await creditReferralReward(client, userId);

    return {
      matchId,
      joinedAt: new Date().toISOString(),
    };
  });
}
