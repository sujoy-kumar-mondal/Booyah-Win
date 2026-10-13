import type { PoolClient } from 'pg';
import {
  ErrorCodes,
  formatDbNumeric,
  paiseToString,
  stringToPaise,
} from '@booyah/shared';
import { query, withTransaction } from '../../db/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import { writeAuditLog } from '../../utils/audit.js';
import { refundEntryFee } from '../wallet/wallet.service.js';
import { runSchedulerTick } from './scheduler.service.js';
import type {
  CreateMatchDto,
  MatchDetailStaffDto,
  MatchStaffDto,
  JoinedPlayerDto,
  MatchTeamStaffDto,
} from './matches.types.js';

// ISO 8601 with timezone offset regex: requires Z or +/-HH:MM
const ISO_8601_TZ_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})$/;

export async function createMatchStaff(
  staffId: string,
  dto: CreateMatchDto
): Promise<MatchStaffDto> {
  const { tierId, startTime } = dto;

  if (!startTime || !ISO_8601_TZ_REGEX.test(startTime)) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      'startTime must be a valid ISO 8601 string with a timezone offset (e.g. 2026-10-10T15:00:00Z)',
      400
    );
  }

  return withTransaction(async (client: PoolClient) => {
    // Compare startTime against database now()
    const timeCheck = await client.query<{ is_future: boolean }>(
      `SELECT ($1::timestamptz > now()) AS is_future`,
      [startTime]
    );
    if (!timeCheck.rows[0]?.is_future) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'Start time must be in the future',
        400
      );
    }

    // Tier lookup — rejected if soft-deleted (deleted_at IS NOT NULL)
    const tierRes = await client.query(
      `SELECT id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
              max_players, min_players, deleted_at
       FROM entry_tiers
       WHERE id = $1`,
      [tierId]
    );

    if (!tierRes.rowCount || tierRes.rows[0].deleted_at !== null) {
      throw new AppError(
        ErrorCodes.NOT_FOUND,
        'Active tier not found or tier has been soft-deleted',
        404
      );
    }
    const tier = tierRes.rows[0];

    // Read tier position prizes
    const prizesRes = await client.query<{ position: number; prize: string }>(
      `SELECT position, prize FROM tier_position_prizes WHERE tier_id = $1 ORDER BY position ASC`,
      [tierId]
    );

    // NOTE: position_prizes is snapshotted as a JSONB map of position -> prize string.
    // Later code must parse the string values with the shared money utility (stringToPaise / parseMoney), NOT Number().
    const positionPrizesMap: Record<string, string> = {};
    for (const row of prizesRes.rows) {
      positionPrizesMap[row.position.toString()] = paiseToString(
        stringToPaise(row.prize.toString())
      );
    }

    // Insert match with snapshotted tier fields
    const insertRes = await client.query(
      `INSERT INTO matches (
         tier_id, game_mode, team_mode, entry_fee, kill_price,
         min_kills_for_reward, position_prizes, max_players, min_players,
         start_time, status, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'upcoming', $11)
       RETURNING id, tier_id, game_mode, team_mode, entry_fee, kill_price,
                 min_kills_for_reward, position_prizes, max_players, min_players,
                 start_time, status, cancel_reason, created_by, created_at`,
      [
        tier.id,
        tier.game_mode,
        tier.team_mode,
        tier.entry_fee,
        tier.kill_price,
        tier.min_kills_for_reward,
        JSON.stringify(positionPrizesMap),
        tier.max_players,
        tier.min_players,
        startTime,
        staffId,
      ]
    );

    const match = insertRes.rows[0];

    await writeAuditLog(client, {
      staffId,
      action: 'match_created',
      targetType: 'match',
      targetId: match.id.toString(),
      details: { tierId: tier.id.toString(), gameMode: tier.game_mode, teamMode: tier.team_mode, startTime },
    });

    return {
      id: match.id.toString(),
      tierId: match.tier_id.toString(),
      gameMode: match.game_mode,
      teamMode: match.team_mode,
      entryFee: paiseToString(stringToPaise(match.entry_fee.toString())),
      killPrice: paiseToString(stringToPaise(match.kill_price.toString())),
      minKillsForReward: match.min_kills_for_reward,
      positionPrizes: match.position_prizes,
      maxPlayers: match.max_players,
      minPlayers: match.min_players,
      startTime: match.start_time.toISOString(),
      status: match.status,
      cancelReason: match.cancel_reason,
      createdBy: match.created_by.toString(),
      createdAt: match.created_at.toISOString(),
      joinedCount: 0,
    };
  });
}

/**
 * List matches for staff with combinable filters and single SQL aggregation (avoid N+1).
 */
export async function listMatchesStaff(params: {
  status?: string;
  gameMode?: string;
  teamMode?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: MatchStaffDto[]; nextCursor: string | null }> {
  // Proactively run scheduler tick to cancel any expired underfilled/unstarted matches
  await runSchedulerTick();

  const limit = Math.min(Math.max(params.limit || 20, 1), 100);

  let sql = `
    SELECT m.id, m.tier_id, m.game_mode, m.team_mode, m.entry_fee, m.kill_price,
           m.min_kills_for_reward, m.position_prizes, m.max_players, m.min_players,
           m.start_time, m.room_id, m.room_password, m.status, m.cancel_reason,
           m.created_by, m.created_at,
           CASE
             WHEN m.status = 'cancelled' THEN COUNT(DISTINCT mp.id)::int
             ELSE COUNT(DISTINCT mp.id) FILTER (WHERE mp.refunded_at IS NULL)::int
           END AS joined_count,
           CASE
             WHEN m.status = 'cancelled' THEN COUNT(DISTINCT mp.id)::int
             WHEN m.team_mode = 'solo' THEN COUNT(DISTINCT mp.id) FILTER (WHERE mp.refunded_at IS NULL)::int
             ELSE COALESCE(
               (SELECT SUM(t.size)::int FROM teams t WHERE t.match_id = m.id AND t.status IN ('forming', 'confirmed')),
               0
             )
           END AS seats_taken
    FROM matches m
    LEFT JOIN match_players mp ON mp.match_id = m.id
    WHERE 1=1
  `;
  const values: any[] = [];
  let pIdx = 1;

  if (params.status) {
    sql += ` AND m.status = $${pIdx}`;
    values.push(params.status);
    pIdx++;
  }

  if (params.gameMode) {
    sql += ` AND m.game_mode = $${pIdx}`;
    values.push(params.gameMode);
    pIdx++;
  }

  if (params.teamMode) {
    sql += ` AND m.team_mode = $${pIdx}`;
    values.push(params.teamMode);
    pIdx++;
  }

  if (params.from) {
    sql += ` AND m.start_time >= $${pIdx}`;
    values.push(params.from);
    pIdx++;
  }

  if (params.to) {
    sql += ` AND m.start_time <= $${pIdx}`;
    values.push(params.to);
    pIdx++;
  }

  if (params.cursor) {
    sql += ` AND m.id < $${pIdx}`;
    values.push(params.cursor);
    pIdx++;
  }

  sql += `
    GROUP BY m.id
    ORDER BY m.id DESC
    LIMIT $${pIdx}
  `;
  values.push(limit + 1);

  const res = await query(sql, values);
  const hasNext = res.rows.length > limit;
  const rows = hasNext ? res.rows.slice(0, limit) : res.rows;
  const nextCursor = hasNext ? rows[rows.length - 1].id.toString() : null;

  const items: MatchStaffDto[] = rows.map((row) => ({
    id: row.id.toString(),
    tierId: row.tier_id.toString(),
    gameMode: row.game_mode,
    teamMode: row.team_mode,
    entryFee: paiseToString(stringToPaise(row.entry_fee.toString())),
    killPrice: paiseToString(stringToPaise(row.kill_price.toString())),
    minKillsForReward: row.min_kills_for_reward,
    positionPrizes: row.position_prizes,
    maxPlayers: row.max_players,
    minPlayers: row.min_players,
    startTime: row.start_time.toISOString(),
    roomId: row.room_id ?? undefined,
    roomPassword: row.room_password ?? undefined,
    status: row.status,
    cancelReason: row.cancel_reason,
    createdBy: row.created_by.toString(),
    createdAt: row.created_at.toISOString(),
    joinedCount: Number(row.joined_count || 0),
    seatsTaken: Number(row.seats_taken || 0),
  }));

  return { items, nextCursor };
}

/**
 * Match detail with joined players list for staff.
 */
export async function getMatchDetailStaff(matchId: string): Promise<MatchDetailStaffDto> {
  const matchRes = await query(
    `SELECT m.id, m.tier_id, m.game_mode, m.team_mode, m.entry_fee, m.kill_price,
            m.min_kills_for_reward, m.position_prizes, m.max_players, m.min_players,
            m.start_time, m.room_id, m.room_password, m.status, m.cancel_reason,
            m.created_by, m.created_at,
            COUNT(mp.id)::int AS joined_count
     FROM matches m
     LEFT JOIN match_players mp ON mp.match_id = m.id
     WHERE m.id = $1
     GROUP BY m.id`,
    [matchId]
  );

  if (!matchRes.rowCount) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
  }
  const row = matchRes.rows[0];

  const playersRes = await query(
    `SELECT mp.user_id, mp.team_id, u.name, u.ff_id, u.ff_name,
            mp.paid_add_money, mp.paid_cashback, mp.paid_winning,
            mp.refunded_at, mp.joined_at
     FROM match_players mp
     JOIN users u ON u.id = mp.user_id
     WHERE mp.match_id = $1
     ORDER BY mp.joined_at ASC`,
    [matchId]
  );

  const players: JoinedPlayerDto[] = playersRes.rows.map((p) => ({
    userId: p.user_id.toString(),
    name: p.name,
    ffId: p.ff_id,
    ffName: p.ff_name,
    teamId: row.team_mode === 'solo' ? null : (p.team_id ? p.team_id.toString() : null),
    paidAddMoney: paiseToString(stringToPaise(p.paid_add_money.toString())),
    paidCashback:  paiseToString(stringToPaise(p.paid_cashback.toString())),
    paidWinning:   paiseToString(stringToPaise(p.paid_winning.toString())),
    refundedAt:    p.refunded_at ? p.refunded_at.toISOString() : null,
    joinedAt:      p.joined_at.toISOString(),
  }));

  let teams: MatchTeamStaffDto[] = [];
  if (row.team_mode !== 'solo') {
    const teamsRes = await query<{
      id: string;
      name: string | null;
      size: number;
      status: string;
      leader_id: string;
    }>(
      `SELECT t.id, t.name, t.size, t.status, t.leader_id
       FROM teams t
       WHERE t.match_id = $1
       ORDER BY t.created_at ASC, t.id ASC`,
      [matchId]
    );

    const teamMembersMap = new Map<string, string[]>();
    for (const p of playersRes.rows) {
      if (p.team_id && !p.refunded_at) {
        const tid = p.team_id.toString();
        if (!teamMembersMap.has(tid)) {
          teamMembersMap.set(tid, []);
        }
        teamMembersMap.get(tid)!.push(p.user_id.toString());
      }
    }

    teams = teamsRes.rows.map((t) => ({
      id: t.id.toString(),
      name: t.name ?? null,
      size: Number(t.size),
      status: t.status,
      leaderId: t.leader_id.toString(),
      memberUserIds: teamMembersMap.get(t.id.toString()) ?? [],
    }));
  }

  return {
    id: row.id.toString(),
    tierId: row.tier_id.toString(),
    gameMode: row.game_mode,
    teamMode: row.team_mode,
    entryFee: paiseToString(stringToPaise(row.entry_fee.toString())),
    killPrice: paiseToString(stringToPaise(row.kill_price.toString())),
    minKillsForReward: row.min_kills_for_reward,
    positionPrizes: row.position_prizes,
    maxPlayers: row.max_players,
    minPlayers: row.min_players,
    startTime: row.start_time.toISOString(),
    roomId: row.room_id ?? undefined,
    roomPassword: row.room_password ?? undefined,
    status: row.status,
    cancelReason: row.cancel_reason,
    createdBy: row.created_by.toString(),
    createdAt: row.created_at.toISOString(),
    joinedCount: Number(row.joined_count || 0),
    players,
    teams,
  };
}

/**
 * Open room credentials: upcoming -> room_open.
 */
export async function openRoomStaff(
  staffId: string,
  matchId: string,
  roomId: string,
  roomPassword: string
): Promise<void> {
  const cleanRoomId = roomId?.trim();
  const cleanRoomPw = roomPassword?.trim();

  if (!cleanRoomId || !cleanRoomPw) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      'Both roomId and roomPassword are required',
      400
    );
  }

  await withTransaction(async (client: PoolClient) => {
    const res = await client.query(
      `SELECT status, start_time FROM matches WHERE id = $1 FOR UPDATE`,
      [matchId]
    );

    if (!res.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
    }

    const { status, start_time } = res.rows[0];
    if (status !== 'upcoming') {
      throw new AppError(
        ErrorCodes.INVALID_TRANSITION,
        `Cannot open room for match with status ${status}`,
        409
      );
    }

    if (new Date(start_time).getTime() <= Date.now()) {
      throw new AppError(
        ErrorCodes.INVALID_TRANSITION,
        'Cannot open room: match start time has passed and match is expired',
        400
      );
    }

    await client.query(
      `UPDATE matches
       SET status = 'room_open', room_id = $1, room_password = $2
       WHERE id = $3`,
      [cleanRoomId, cleanRoomPw, matchId]
    );

    await writeAuditLog(client, {
      staffId,
      action: 'match_room_opened',
      targetType: 'match',
      targetId: matchId,
      details: { roomId: cleanRoomId },
    });
  });
}

/**
 * Transition match to live: room_open -> live.
 */
export async function goLiveStaff(
  staffId: string,
  matchId: string,
  staffRole?: string
): Promise<void> {
  await withTransaction(async (client: PoolClient) => {
    const res = await client.query(
      `SELECT id, game_mode, team_mode, min_players, status FROM matches WHERE id = $1 FOR UPDATE`,
      [matchId]
    );

    if (!res.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
    }

    const match = res.rows[0];
    if (match.status !== 'room_open') {
      throw new AppError(
        ErrorCodes.INVALID_TRANSITION,
        `Cannot transition to live from status ${match.status}`,
        409
      );
    }

    // Match cannot go live until minimum players requirement is fulfilled
    let isUnderfilled = false;
    let enrolledCount = 0;
    if (match.team_mode === 'solo') {
      const cRes = await client.query<{ count: string }>(
        `SELECT count(*)::int AS count FROM match_players WHERE match_id = $1 AND refunded_at IS NULL`,
        [matchId]
      );
      enrolledCount = Number(cRes.rows[0].count);
      isUnderfilled = enrolledCount < match.min_players;
    } else if (match.game_mode === 'clash_squad') {
      const cRes = await client.query<{ count: string }>(
        `SELECT count(*)::int AS count FROM teams WHERE match_id = $1 AND status = 'confirmed'`,
        [matchId]
      );
      enrolledCount = Number(cRes.rows[0].count);
      isUnderfilled = enrolledCount < 2;
    } else {
      const cRes = await client.query<{ count: string }>(
        `SELECT count(mp.id)::int AS count
         FROM match_players mp
         JOIN teams t ON t.id = mp.team_id
         WHERE mp.match_id = $1 AND t.status = 'confirmed' AND mp.refunded_at IS NULL`,
        [matchId]
      );
      enrolledCount = Number(cRes.rows[0].count);
      isUnderfilled = enrolledCount < match.min_players;
    }

    if (isUnderfilled) {
      const reqText = match.game_mode === 'clash_squad'
        ? `Requires at least 2 confirmed teams to go live (currently ${enrolledCount})`
        : `Match requires at least ${match.min_players} players to go live (currently ${enrolledCount}/${match.min_players})`;
      throw new AppError(
        ErrorCodes.INVALID_TRANSITION,
        reqText,
        400
      );
    }

    await client.query(
      `UPDATE matches SET status = 'live' WHERE id = $1`,
      [matchId]
    );

    await writeAuditLog(client, {
      staffId,
      action: 'match_went_live',
      targetType: 'match',
      targetId: matchId,
      details: {},
    });
  });
}

/**
 * Cancel match with full wallet refunds and audit log.
 * Rules:
 *  - Reason required.
 *  - Employee can cancel before live (upcoming, room_open).
 *  - Only admin can cancel once live.
 *  - Completed or cancelled matches cannot be cancelled -> 409 INVALID_TRANSITION.
 */
export async function cancelMatchStaff(
  staffId: string,
  staffRole: string,
  matchId: string,
  reason: string
): Promise<void> {
  const cleanReason = reason?.trim();
  if (!cleanReason || cleanReason.length < 3) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      'Cancellation reason is required (min 3 characters)',
      400
    );
  }

  await withTransaction(async (client: PoolClient) => {
    // 1. Lock match FOR UPDATE
    const matchRes = await client.query(
      `SELECT id, status FROM matches WHERE id = $1 FOR UPDATE`,
      [matchId]
    );

    if (!matchRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
    }

    const { status } = matchRes.rows[0];

    // Status check
    if (status === 'completed' || status === 'cancelled') {
      throw new AppError(
        ErrorCodes.INVALID_TRANSITION,
        `Cannot cancel match with status ${status}`,
        409
      );
    }

    // Role check: employee cannot cancel live match
    if (status === 'live' && staffRole !== 'admin') {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Only admin can cancel a live match',
        403
      );
    }

    // 2. Fetch all unrefunded players
    const mpRes = await client.query<{ id: number; user_id: number }>(
      `SELECT id, user_id FROM match_players
       WHERE match_id = $1 AND refunded_at IS NULL
       ORDER BY user_id ASC`,
      [matchId]
    );

    // 3. Lock all user wallets in ascending user_id order
    const distinctUserIds = Array.from(
      new Set(mpRes.rows.map((r) => r.user_id.toString()))
    ).sort((a, b) => Number(a) - Number(b));

    for (const uid of distinctUserIds) {
      await client.query(
        `SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [uid]
      );
    }

    // 4. Refund each player row via refundEntryFee (exact refunds, sets refunded_at)
    for (const playerRow of mpRes.rows) {
      await refundEntryFee(client, playerRow.id.toString(), matchId);
    }

    // 5. Update match status
    await client.query(
      `UPDATE matches
       SET status = 'cancelled', cancel_reason = $1
       WHERE id = $2`,
      [cleanReason, matchId]
    );

    // 6. Write audit log
    await writeAuditLog(client, {
      staffId,
      action: 'match_cancelled',
      targetType: 'match',
      targetId: matchId,
      details: { reason: cleanReason, refundedPlayersCount: mpRes.rows.length },
    });
  });
}
