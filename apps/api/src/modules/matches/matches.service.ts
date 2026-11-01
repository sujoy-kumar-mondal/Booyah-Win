import type { PoolClient } from 'pg';
import {
  ErrorCodes,
  formatDbNumeric,
  paiseToString,
  stringToPaise,
} from '@booyah/shared';
import { query, withTransaction } from '../../db/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import { allocateEntryFee } from '../wallet/wallet.service.js';
import { createNotification } from '../users/notifications.service.js';
import type { MatchUserDto } from './matches.types.js';

function normalizeMatchId(id: string | number): string {
  if (!id) return '';
  const s = String(id).trim();
  return s.startsWith('BW-MCH-') ? s : `BW-MCH-${s.replace(/^(?:BW-(?:MAT|MCH)-|M|#)/i, '')}`;
}

/**
 * List matches for users (upcoming, room_open, live) without N+1 queries.
 * Room credentials are included ONLY if user has joined AND match is room_open or live.
 */
export async function listMatchesUser(
  userId?: string | null,
  statusFilter?: string
): Promise<MatchUserDto[]> {
  let statusCondition = `m.status IN ('upcoming', 'room_open', 'live')`;
  if (statusFilter === 'upcoming') {
    statusCondition = `m.status IN ('upcoming', 'room_open') AND now() < m.start_time - INTERVAL '10 minutes'`;
  } else if (statusFilter === 'live') {
    statusCondition = `(m.status = 'live' OR (m.status IN ('upcoming', 'room_open') AND now() >= m.start_time - INTERVAL '10 minutes'))`;
  } else if (statusFilter === 'completed') {
    statusCondition = `m.status IN ('completed', 'cancelled')`;
  } else if (statusFilter === 'my_matches') {
    statusCondition = `m.status IN ('upcoming', 'room_open', 'live')`;
  }

  const havingClause =
    statusFilter === 'my_matches'
      ? `HAVING BOOL_OR(mp.user_id = $1 AND (mp.refunded_at IS NULL OR m.status = 'cancelled')) = TRUE`
      : ``;

  const sql = `
    SELECT m.id, m.game_mode, m.team_mode, m.entry_fee, m.kill_price,
           m.min_kills_for_reward, m.position_prizes, m.max_players, m.min_players,
           m.start_time, m.room_id, m.room_password, m.status, m.cancel_reason, m.map_name,
           CASE
             WHEN m.status = 'cancelled' THEN COUNT(DISTINCT mp.id)::int
             ELSE COUNT(DISTINCT mp.id) FILTER (WHERE mp.refunded_at IS NULL)::int
           END AS joined_count,
           CASE
             WHEN m.status = 'cancelled' THEN BOOL_OR(mp.user_id = $1)
             ELSE BOOL_OR(mp.user_id = $1 AND mp.refunded_at IS NULL)
           END AS has_joined,
           COALESCE(
             (SELECT SUM(t.size)::int FROM teams t WHERE t.match_id = m.id AND t.status IN ('forming', 'confirmed')),
             0
           ) AS team_seats_taken,
           EXISTS (
             SELECT 1 FROM teams t
             LEFT JOIN match_players p ON p.team_id = t.id
             WHERE t.match_id = m.id
               AND (t.leader_id = $1 OR p.user_id = $1)
           ) AS is_in_team,
           EXISTS (
             SELECT 1 FROM teams t
             WHERE t.match_id = m.id
               AND t.leader_id = $1
           ) AS is_team_leader,
           COALESCE(
             (SELECT t.replace_count FROM teams t
              LEFT JOIN match_players p ON p.team_id = t.id
              WHERE t.match_id = m.id
                AND (t.leader_id = $1 OR p.user_id = $1)
              LIMIT 1),
             0
           )::int AS team_replace_count,
           (now() >= m.start_time - INTERVAL '10 minutes') AS past_cutoff
    FROM matches m
    LEFT JOIN match_players mp ON mp.match_id = m.id
    WHERE ${statusCondition}
    GROUP BY m.id
    ${havingClause}
    ORDER BY ${
      statusFilter === 'completed'
        ? 'm.start_time DESC'
        : statusFilter === 'my_matches'
        ? "CASE WHEN m.status = 'live' THEN 0 WHEN m.status = 'room_open' THEN 1 WHEN m.status = 'upcoming' THEN 2 ELSE 3 END, m.start_time ASC"
        : 'm.start_time ASC'
    }
    ${statusFilter === 'completed' ? 'LIMIT 50' : ''}
  `;

  const res = await query(sql, [userId || null]);

  return res.rows.map((row) => {
    const hasJoined = Boolean(row.has_joined);
    const showRoomCredentials =
      hasJoined && (row.status === 'room_open' || row.status === 'live');
    const joinedPlayers = Number(row.joined_count || 0);
    const seatsTaken =
      row.team_mode === 'solo' ? joinedPlayers : Number(row.team_seats_taken || 0);

    const hasReplacedTeammate = Boolean(
      (row.is_in_team || row.is_team_leader) && Number(row.team_replace_count || 0) >= 1
    );
    const canReplaceTeammate = Boolean(
      row.is_team_leader &&
      !row.past_cutoff &&
      !hasReplacedTeammate &&
      (row.status === 'upcoming' || row.status === 'room_open')
    );

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
      mapName: row.map_name,
      map: row.map_name,
      hasJoined,
      isInTeam: Boolean(row.is_in_team),
      isTeamLeader: Boolean(row.is_team_leader),
      canReplaceTeammate,
      hasReplacedTeammate,
      roomId: showRoomCredentials ? (row.room_id ?? undefined) : undefined,
      roomPassword: showRoomCredentials ? (row.room_password ?? undefined) : undefined,
      cancelReason: row.cancel_reason ? row.cancel_reason : undefined,
    };
  });
}

/**
 * Get single match detail for a user.
 * Never exposes other players' personal data or player rosters.
 */
export async function getMatchUser(userId: string | null | undefined, matchId: string): Promise<MatchUserDto> {
  const cleanMatchId = normalizeMatchId(matchId);
  const sql = `
    SELECT m.id, m.game_mode, m.team_mode, m.entry_fee, m.kill_price,
           m.min_kills_for_reward, m.position_prizes, m.max_players, m.min_players,
           m.start_time, m.room_id, m.room_password, m.status, m.cancel_reason, m.map_name,
           CASE
             WHEN m.status = 'cancelled' THEN COUNT(DISTINCT mp.id)::int
             ELSE COUNT(DISTINCT mp.id) FILTER (WHERE mp.refunded_at IS NULL)::int
           END AS joined_count,
           CASE
             WHEN m.status = 'cancelled' THEN BOOL_OR(mp.user_id = $1)
             ELSE BOOL_OR(mp.user_id = $1 AND mp.refunded_at IS NULL)
           END AS has_joined,
           COALESCE(
             (SELECT SUM(t.size)::int FROM teams t WHERE t.match_id = m.id AND t.status IN ('forming', 'confirmed')),
             0
           ) AS team_seats_taken,
           EXISTS (
             SELECT 1 FROM teams t
             LEFT JOIN match_players p ON p.team_id = t.id
             WHERE t.match_id = m.id
               AND (t.leader_id = $1 OR p.user_id = $1)
           ) AS is_in_team,
           EXISTS (
             SELECT 1 FROM teams t
             WHERE t.match_id = m.id
               AND t.leader_id = $1
           ) AS is_team_leader,
           COALESCE(
             (SELECT t.replace_count FROM teams t
              LEFT JOIN match_players p ON p.team_id = t.id
              WHERE t.match_id = m.id
                AND (t.leader_id = $1 OR p.user_id = $1)
              LIMIT 1),
             0
           )::int AS team_replace_count,
           (now() >= m.start_time - INTERVAL '10 minutes') AS past_cutoff
    FROM matches m
    LEFT JOIN match_players mp ON mp.match_id = m.id
    WHERE m.id = $2 AND m.status IN ('upcoming', 'room_open', 'live', 'completed')
    GROUP BY m.id
  `;

  const res = await query(sql, [userId || null, cleanMatchId]);
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

  const hasReplacedTeammate = Boolean(
    (row.is_in_team || row.is_team_leader) && Number(row.team_replace_count || 0) >= 1
  );
  const canReplaceTeammate = Boolean(
    row.is_team_leader &&
    !row.past_cutoff &&
    !hasReplacedTeammate &&
    (row.status === 'upcoming' || row.status === 'room_open')
  );

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
    mapName: row.map_name,
    map: row.map_name,
    hasJoined,
    isInTeam: Boolean(row.is_in_team),
    isTeamLeader: Boolean(row.is_team_leader),
    canReplaceTeammate,
    hasReplacedTeammate,
    roomId: showRoomCredentials ? (row.room_id ?? undefined) : undefined,
    roomPassword: showRoomCredentials ? (row.room_password ?? undefined) : undefined,
    cancelReason: row.cancel_reason ? row.cancel_reason : undefined,
  };
}

/**
 * Solo Battle Royale Join (Section 11.5).
 * Lock order (Change #1):
 *   1. Lock match FOR UPDATE.
 *   2. Lock player wallet FOR UPDATE.
 *   3. THEN allocate fee (allocateEntryFee).
 *   4. Insert match_players row.
 */
export async function joinMatchSolo(
  userId: string,
  matchId: string
): Promise<{ matchId: string; joinedAt: string }> {
  const cleanMatchId = normalizeMatchId(matchId);
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
    // 1. Lock the match FOR UPDATE
    const matchRes = await client.query(
      `SELECT id, game_mode, team_mode, entry_fee, max_players, start_time, status
       FROM matches
       WHERE id = $1
       FOR UPDATE`,
      [cleanMatchId]
    );

    if (!matchRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
    }
    const match = matchRes.rows[0];

    // Solo matches (Battle Royale or Lone Wolf)
    if (
      (match.game_mode !== 'battle_royale' && match.game_mode !== 'lone_wolf') ||
      match.team_mode !== 'solo'
    ) {
      throw new AppError(
        ErrorCodes.TEAM_INVALID,
        'Only solo matches can be joined directly',
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

    // Start time & cutoff check against database now()
    const cutoffCheck = await client.query<{ has_started: boolean; past_cutoff: boolean }>(
      `SELECT ($1::timestamptz <= now()) AS has_started,
              (now() >= $1::timestamptz - INTERVAL '10 minutes') AS past_cutoff`,
      [match.start_time]
    );
    if (cutoffCheck.rows[0]?.past_cutoff) {
      throw new AppError(
        ErrorCodes.MATCH_NOT_JOINABLE,
        'Match registration is closed (10 minutes before start time)',
        409
      );
    }

    // Capacity check (excluding refunded players)
    const countRes = await client.query<{ count: string }>(
      `SELECT count(*)::int AS count FROM match_players WHERE match_id = $1 AND refunded_at IS NULL`,
      [cleanMatchId]
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
      [cleanMatchId, userId]
    );
    if (alreadyRes.rowCount) {
      throw new AppError(
        ErrorCodes.ALREADY_JOINED,
        'You have already joined this match',
        409
      );
    }

    // 2. Lock player's wallet
    await client.query(
      `SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );

    // 3. THEN allocate entry fee
    const feePaise = stringToPaise(match.entry_fee.toString());
    const alloc = await allocateEntryFee(client, userId, feePaise, 'match', cleanMatchId);

    // 4. Insert match_players
    try {
      await client.query(
        `INSERT INTO match_players (
           match_id, user_id, paid_add_money, paid_cashback, paid_winning
         ) VALUES ($1, $2, $3, $4, $5)`,
        [
          cleanMatchId,
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

    // 5. Automated notification for match joined
    const modeTitle = match.game_mode === 'clash_squad' ? 'Clash Squad' : match.game_mode === 'lone_wolf' ? 'Lone Wolf' : 'Battle Royale';
    const timeFormatted = new Date(match.start_time).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    await createNotification(client, {
      userId,
      type: 'match_joined',
      title: `Match Joined: ${modeTitle} [SOLO]`,
      message: `You successfully joined match ${cleanMatchId}. Match starts at ${timeFormatted} IST.`,
      actionUrl: `/matches/${cleanMatchId}`,
      metadata: { matchId: cleanMatchId },
    });

    return {
      matchId: cleanMatchId,
      joinedAt: new Date().toISOString(),
    };
  });
}

/**
 * Returns tournament player roster for match room slotting (Section 11.5).
 * Only public in-game gaming tags are exposed; zero private user IDs or phone numbers.
 */
export async function getMatchPlayers(
  matchId: string
): Promise<{
  count: number;
  players: Array<{
    team: number;
    position: string;
    name: string;
    teamName: string | null;
    kills: number;
    matchPosition: number | null;
    payout: string;
    teamPayout: string;
  }>;
}> {
  const cleanMatchId = normalizeMatchId(matchId);
  const matchCheck = await query<{
    id: number;
    game_mode: string;
    team_mode: string;
    status: string;
    cancel_reason: string | null;
  }>(
    `SELECT id, game_mode, team_mode, status, cancel_reason FROM matches WHERE id = $1`,
    [cleanMatchId]
  );
  if (!matchCheck.rowCount) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
  }
  const match = matchCheck.rows[0];

  const refundFilter = match.status === 'cancelled' ? '' : 'AND mp.refunded_at IS NULL';
  const res = await query<{
    id: number;
    team_id: number | null;
    joined_at: Date;
    name: string;
    ff_name: string | null;
    team_name: string | null;
    kills: number | null;
    position: number | null;
    payout: string | null;
  }>(
    `SELECT mp.id, mp.team_id, mp.joined_at, u.name, u.ff_name, t.name AS team_name,
            mp.kills, mp.position, mp.payout
     FROM match_players mp
     JOIN users u ON u.id = mp.user_id
     LEFT JOIN teams t ON t.id = mp.team_id
     WHERE mp.match_id = $1 ${refundFilter}
     ORDER BY COALESCE(mp.position, 9999) ASC, COALESCE(mp.team_id, 0) ASC, mp.joined_at ASC, mp.id ASC`,
    [cleanMatchId]
  );

  const posLabels = ['A', 'B', 'C', 'D'];
  const players: Array<{
    team: number;
    position: string;
    name: string;
    teamName: string | null;
    kills: number;
    matchPosition: number | null;
    payout: string;
    teamPayout: string;
  }> = [];

  if (match.team_mode === 'solo') {
    res.rows.forEach((row, idx) => {
      const playerPaise = row.payout ? stringToPaise(row.payout.toString()) : 0;
      players.push({
        team: idx + 1,
        position: 'A',
        name: row.ff_name || row.name || 'Player',
        teamName: row.team_name || `Team ${idx + 1}`,
        kills: row.kills ?? 0,
        matchPosition: row.position ?? null,
        payout: paiseToString(playerPaise),
        teamPayout: paiseToString(playerPaise),
      });
    });
  } else {
    const teamMap = new Map<string, typeof res.rows>();
    for (const row of res.rows) {
      const key = row.team_id ? row.team_id.toString() : `solo_${row.id}`;
      if (!teamMap.has(key)) {
        teamMap.set(key, []);
      }
      teamMap.get(key)!.push(row);
    }

    let teamNum = 1;
    for (const [, members] of teamMap.entries()) {
      const teamName = members[0]?.team_name || `Team ${teamNum}`;
      let teamTotalPaise = 0;
      for (const m of members) {
        if (m.payout) {
          teamTotalPaise += stringToPaise(m.payout.toString());
        }
      }
      const teamPayout = paiseToString(teamTotalPaise);
      const matchPosition = members.find((m) => m.position != null)?.position ?? null;

      members.forEach((m, mIdx) => {
        const playerPaise = m.payout ? stringToPaise(m.payout.toString()) : 0;
        players.push({
          team: teamNum,
          position: posLabels[mIdx % posLabels.length],
          name: m.ff_name || m.name || 'Player',
          teamName,
          kills: m.kills ?? 0,
          matchPosition: m.position ?? matchPosition,
          payout: paiseToString(playerPaise),
          teamPayout,
        });
      });
      teamNum++;
    }
  }

  return {
    count: players.length,
    players,
  };
}
