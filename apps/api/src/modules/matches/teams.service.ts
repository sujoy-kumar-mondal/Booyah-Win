import type { PoolClient } from 'pg';
import {
  ErrorCodes,
  formatDbNumeric,
  formatUserId,
  paiseToString,
  parseUserId,
  stringToPaise,
} from '@booyah/shared';
import { query, withTransaction } from '../../db/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  allocateEntryFee,
  refundEntryFee,
} from '../wallet/wallet.service.js';
import { createNotification, createNotificationsForUsers } from '../users/notifications.service.js';

function normalizeMatchId(id: string | number): string {
  if (!id) return '';
  const s = String(id).trim();
  return s.startsWith('BW-MCH-') ? s : `BW-MCH-${s.replace(/^(?:BW-(?:MAT|MCH)-|M|#)/i, '')}`;
}
import type {
  CreateTeamDto,
  ReplaceInviteDto,
  TeamDto,
  TeamInviteDto,
  MyTeamDto,
  MyTeamMemberDto,
} from './matches.types.js';

/**
 * Helper to get the team size from the match mode & team mode.
 */
function getExpectedTeamSize(gameMode: string, teamMode: string): number {
  if (gameMode === 'clash_squad') return 4;
  if (gameMode === 'lone_wolf') {
    if (teamMode === 'solo') return 1;
    if (teamMode === 'duo') return 2;
  }
  if (teamMode === 'duo') return 2;
  if (teamMode === 'squad') return 4;
  throw new AppError(ErrorCodes.TEAM_INVALID, 'Match does not support teams', 400);
}

/**
 * 1. Create a team (leader forms a duo, squad, or Clash Squad team).
 *
 * Requirements & Lock Order:
 * - Validate memberFfIds (exactly size - 1, registered, not deleted, not leader, not duplicate).
 * - Read leader's referrer (non-locking).
 * - Lock match FOR UPDATE.
 * - Enforce cutoff: now() >= start_time - interval '10 minutes' -> 409 MATCH_NOT_JOINABLE.
 * - Clash Squad: at most 2 non-disbanded teams.
 * - Capacity: reserved seats + teamSize <= max_players.
 * - Ensure neither leader nor invited members are already in match or active non-disbanded teams.
 * - Lock leader's wallet.
 * - Charge leader with Section 6.1 allocation.
 * - Create team ('forming').
 * - Insert leader's match_players row with team_id.
 * - Create team_invites ('pending').
 */
export async function createTeam(
  leaderId: string,
  rawMatchId: string,
  dto: CreateTeamDto
): Promise<TeamDto> {
  const matchId = normalizeMatchId(rawMatchId);
  const hasUsernames = Array.isArray(dto.memberUsernames) && dto.memberUsernames.length > 0;
  const rawList = hasUsernames
    ? dto.memberUsernames!
    : Array.isArray(dto.memberFfIds)
    ? dto.memberFfIds
    : [];
  const memberIdentifiers = rawList.map((id) => (id || '').trim());

  return await withTransaction(async (client: PoolClient) => {
    // ── Pre-read match to know expected size before member validation ────────
    const matchPeek = await client.query(
      `SELECT game_mode, team_mode FROM matches WHERE id = $1`,
      [matchId]
    );
    if (!matchPeek.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
    }
    const expectedSize = getExpectedTeamSize(
      matchPeek.rows[0].game_mode,
      matchPeek.rows[0].team_mode
    );

    if (memberIdentifiers.length !== expectedSize - 1) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        `Expected ${expectedSize - 1} teammate ${hasUsernames ? 'username(s)' : 'Free Fire ID(s)'}, got ${memberIdentifiers.length}`,
        400
      );
    }

    // Check for duplicates in memberIdentifiers
    const uniqueIdentifiers = new Set(memberIdentifiers.map((id) => id.toLowerCase()));
    if (uniqueIdentifiers.size !== memberIdentifiers.length) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        hasUsernames
          ? 'Duplicate teammate usernames in invitation list'
          : 'Duplicate teammate Free Fire IDs in invitation list',
        400
      );
    }

    // Read leader user info
    const leaderUserRes = await client.query<{
      id: number;
      username: string | null;
      ff_id: string;
      ff_name: string | null;
      name: string;
    }>(
      `SELECT id, username, ff_id, ff_name, name FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [leaderId]
    );
    if (!leaderUserRes.rowCount) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'User account is inactive or not found', 403);
    }
    const leaderRow = leaderUserRes.rows[0];
    const leaderFormattedId = formatUserId(leaderRow.id).toLowerCase();
    const leaderRawId = leaderRow.id.toString().toLowerCase();
    const leaderUsername = (leaderRow.username || '').toLowerCase();
    const leaderFfId = (leaderRow.ff_id || '').toLowerCase();
    if (
      (leaderUsername && uniqueIdentifiers.has(leaderUsername)) ||
      (leaderFfId && uniqueIdentifiers.has(leaderFfId)) ||
      (leaderFormattedId && uniqueIdentifiers.has(leaderFormattedId)) ||
      (leaderRawId && uniqueIdentifiers.has(leaderRawId)) ||
      memberIdentifiers.some((id) => {
        const pId = parseUserId(id);
        return pId !== null && (formatUserId(pId).toLowerCase() === leaderFormattedId || String(pId) === leaderRawId);
      })
    ) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Leader cannot invite themselves', 400);
    }

    // Lookup each invited member by User ID (BW-USR-X), username, or Free Fire ID
    const invitedUserIds: string[] = [];
    const memberUsers: { id: string; username?: string; ffId: string; ffName?: string; name: string }[] = [];
    for (const identifier of memberIdentifiers) {
      const parsedUserId = parseUserId(identifier);
      const formattedMemberId = parsedUserId !== null ? formatUserId(parsedUserId) : null;
      const rawMemberId = parsedUserId !== null ? String(parsedUserId) : null;
      let uRes;
      if (formattedMemberId !== null && rawMemberId !== null) {
        uRes = await client.query<{ id: string | number; username: string | null; ff_id: string; ff_name: string | null; name: string }>(
          `SELECT id, username, ff_id, ff_name, name FROM users
           WHERE (id = $1 OR id = $2 OR LOWER(id::text) = LOWER($3) OR LOWER(username) = LOWER($3) OR LOWER(ff_id) = LOWER($3))
             AND deleted_at IS NULL
           ORDER BY CASE WHEN id = $1 OR id = $2 THEN 0 WHEN LOWER(username) = LOWER($3) THEN 1 ELSE 2 END LIMIT 1`,
          [formattedMemberId, rawMemberId, identifier]
        );
      } else {
        uRes = await client.query<{ id: string | number; username: string | null; ff_id: string; ff_name: string | null; name: string }>(
          `SELECT id, username, ff_id, ff_name, name FROM users
           WHERE (LOWER(username) = LOWER($1) OR LOWER(ff_id) = LOWER($1)) AND deleted_at IS NULL
           ORDER BY CASE WHEN LOWER(username) = LOWER($1) THEN 0 ELSE 1 END LIMIT 1`,
          [identifier]
        );
      }
      if (!uRes.rowCount) {
        // Generic error that does not reveal whether the user is deleted or nonexistent
        throw new AppError(ErrorCodes.NOT_FOUND, 'Player not found', 404);
      }
      const member = uRes.rows[0];
      const memberIdStr = member.id.toString();
      invitedUserIds.push(memberIdStr);
      memberUsers.push({
        id: memberIdStr,
        username: member.username || undefined,
        ffId: member.ff_id,
        ffName: member.ff_name || member.name,
        name: member.name,
      });
    }

    if (
      invitedUserIds.includes(leaderRow.id.toString()) ||
      invitedUserIds.some((uid) => formatUserId(uid).toLowerCase() === leaderFormattedId)
    ) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Leader cannot invite themselves', 400);
    }
    if (new Set(invitedUserIds).size !== invitedUserIds.length) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        hasUsernames
          ? 'Duplicate teammate usernames in invitation list'
          : 'Duplicate teammate Free Fire IDs in invitation list',
        400
      );
    }

    // ── 1. Lock match FOR UPDATE ─────────────────────────────────────────────
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

    if (match.status !== 'upcoming' && match.status !== 'room_open') {
      throw new AppError(
        ErrorCodes.MATCH_NOT_JOINABLE,
        `Cannot join match with status ${match.status}`,
        409
      );
    }

    // Cutoff check: 10 minutes before start_time using database clock
    const cutoffCheck = await client.query<{ past_cutoff: boolean }>(
      `SELECT (now() >= $1::timestamptz - INTERVAL '10 minutes') AS past_cutoff`,
      [match.start_time]
    );
    if (cutoffCheck.rows[0]?.past_cutoff) {
      throw new AppError(
        ErrorCodes.MATCH_NOT_JOINABLE,
        'Team registration is closed (10 minutes before start time)',
        409
      );
    }

    // Clash Squad or Lone Wolf: at most 2 non-disbanded teams
    if (match.game_mode === 'clash_squad' || match.game_mode === 'lone_wolf') {
      const teamsRes = await client.query<{ count: string }>(
        `SELECT count(*)::int AS count FROM teams WHERE match_id = $1 AND status IN ('forming', 'confirmed')`,
        [matchId]
      );
      if (Number(teamsRes.rows[0].count) >= 2) {
        throw new AppError(
          ErrorCodes.MATCH_FULL,
          `${match.game_mode === 'lone_wolf' ? 'Lone Wolf' : 'Clash Squad'} allows at most 2 teams`,
          409
        );
      }
    }

    // Seat reservation capacity check: sum of sizes of non-disbanded teams
    const capacityRes = await client.query<{ seats_taken: string }>(
      `SELECT COALESCE(SUM(size), 0)::int AS seats_taken
       FROM teams
       WHERE match_id = $1 AND status IN ('forming', 'confirmed')`,
      [matchId]
    );
    const seatsTaken = Number(capacityRes.rows[0].seats_taken);
    if (seatsTaken + expectedSize > match.max_players) {
      throw new AppError(
        ErrorCodes.MATCH_FULL,
        'Match does not have enough seats for the whole team',
        409
      );
    }

    // Membership checks: leader must not be in match or active team
    const leaderAlreadyJoined = await client.query(
      `SELECT id FROM match_players WHERE match_id = $1 AND user_id = $2 AND refunded_at IS NULL`,
      [matchId, leaderId]
    );
    if (leaderAlreadyJoined.rowCount) {
      throw new AppError(ErrorCodes.ALREADY_JOINED, 'Leader has already joined this match', 409);
    }
    const leaderActiveTeam = await client.query(
      `SELECT id FROM teams WHERE match_id = $1 AND leader_id = $2 AND status IN ('forming', 'confirmed')`,
      [matchId, leaderId]
    );
    if (leaderActiveTeam.rowCount) {
      throw new AppError(ErrorCodes.ALREADY_JOINED, 'Leader already has an active team in this match', 409);
    }

    // Teammates must not already be in match or active team
    for (const memberId of invitedUserIds) {
      const memberJoined = await client.query(
        `SELECT id FROM match_players WHERE match_id = $1 AND user_id = $2 AND refunded_at IS NULL`,
        [matchId, memberId]
      );
      if (memberJoined.rowCount) {
        throw new AppError(
          ErrorCodes.ALREADY_JOINED,
          'An invited player has already joined this match',
          409
        );
      }
      const memberInTeam = await client.query(
        `SELECT t.id FROM teams t
         LEFT JOIN team_invites ti ON ti.team_id = t.id AND ti.invited_user_id = $2 AND ti.status = 'pending'
         WHERE t.match_id = $1 AND t.status IN ('forming', 'confirmed')
           AND (t.leader_id = $2 OR ti.id IS NOT NULL)`,
        [matchId, memberId]
      );
      if (memberInTeam.rowCount) {
        throw new AppError(
          ErrorCodes.ALREADY_JOINED,
          'An invited player is already part of a team in this match',
          409
        );
      }
    }

    // ── 2. Lock leader's wallet ───────────────────────────────────────────────
    await client.query(`SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE`, [leaderId]);

    // ── 3. Allocate full team entry fee for leader ────────────────────────────
    // For Clash Squad, the match entry fee is the team fee (e.g. ₹50 per team).
    // For Battle Royale (duo/squad), entry fee is per player, so leader pays fee * expectedSize.
    const feePaise = stringToPaise(match.entry_fee.toString());
    const totalTeamFeePaise =
      match.game_mode === 'clash_squad' ? feePaise : feePaise * expectedSize;
    const alloc = await allocateEntryFee(client, leaderId, totalTeamFeePaise, 'match', matchId);

    // ── 4. Create team directly with status 'confirmed' ───────────────────────
    const teamInsertRes = await client.query(
      `INSERT INTO teams (match_id, leader_id, name, size, status)
       VALUES ($1, $2, $3, $4, 'confirmed')
       RETURNING id, match_id, leader_id, name, size, status, created_at`,
      [matchId, leaderId, dto.teamName ? dto.teamName.trim() : null, expectedSize]
    );
    const team = teamInsertRes.rows[0];
    const teamId = team.id.toString();

    // ── 5. Insert leader's match_players row with total team fee paid ─────────
    await client.query(
      `INSERT INTO match_players (
         match_id, user_id, team_id, paid_add_money, paid_cashback, paid_winning
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        matchId,
        leaderId,
        teamId,
        formatDbNumeric(alloc.paidAddMoney),
        formatDbNumeric(alloc.paidCashback),
        formatDbNumeric(alloc.paidWinning),
      ]
    );

    // ── 6. Insert all teammates directly into match_players (fee paid by leader)
    for (const memberId of invitedUserIds) {
      await client.query(
        `INSERT INTO match_players (
           match_id, user_id, team_id, paid_add_money, paid_cashback, paid_winning
         ) VALUES ($1, $2, $3, 0, 0, 0)`,
        [matchId, memberId, teamId]
      );
    }

    // ── 7. Automated notification for team match joined ───────────────────────
    const modeTitle = match.game_mode === 'clash_squad' ? 'Clash Squad' : match.game_mode === 'lone_wolf' ? 'Lone Wolf' : 'Battle Royale';
    const allMemberIds = [leaderId, ...invitedUserIds];
    const teamTitle = team.name ? `team "${team.name}"` : 'team';
    const timeFormatted = new Date(match.start_time).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    await createNotificationsForUsers(client, allMemberIds, {
      type: 'match_joined',
      title: `Match Joined: ${modeTitle} [${match.team_mode.toUpperCase()}]`,
      message: `You joined ${teamTitle} for match ${matchId}. Match starts at ${timeFormatted} IST.`,
      actionUrl: `/matches/${matchId}`,
      metadata: { matchId: matchId, teamId: teamId },
    });

    return {
      id: teamId,
      matchId: team.match_id.toString(),
      leaderId: team.leader_id.toString(),
      name: team.name,
      size: team.size,
      status: team.status,
      createdAt: team.created_at.toISOString(),
      members: [
        {
          userId: leaderId,
          username: leaderUserRes.rows[0].username || undefined,
          freeFireId: leaderUserRes.rows[0].ff_id,
          ffName: leaderUserRes.rows[0].ff_name || leaderUserRes.rows[0].name || '',
          name: leaderUserRes.rows[0].name || '',
          role: 'leader',
          status: 'confirmed',
        },
        ...memberUsers.map((m) => ({
          userId: m.id,
          username: m.username || undefined,
          freeFireId: m.ffId,
          ffName: m.ffName || m.name,
          name: m.name,
          role: 'member' as const,
          status: 'confirmed' as const,
        })),
      ],
    };
  });
}

/**
 * 2. List team invites for a user: GET /me/team-invites
 */
export async function listUserInvites(userId: string): Promise<TeamInviteDto[]> {
  const res = await query(
    `SELECT ti.id, ti.team_id, ti.invited_user_id, ti.status, ti.created_at, ti.responded_at,
            t.name AS team_name, t.size AS team_size, t.leader_id,
            u.name AS leader_name, u.ff_id AS leader_ff_id, u.ff_name AS leader_ff_name,
            iu.name AS invited_user_name, iu.ff_id AS invited_user_ff_id, iu.ff_name AS invited_user_ff_name,
            m.id AS match_id, m.game_mode, m.team_mode, m.entry_fee, m.start_time, m.status AS match_status,
            m.kill_price, m.position_prizes
     FROM team_invites ti
     JOIN teams t ON t.id = ti.team_id
     JOIN users u ON u.id = t.leader_id
     JOIN users iu ON iu.id = ti.invited_user_id
     JOIN matches m ON m.id = t.match_id
     WHERE ti.invited_user_id = $1
     ORDER BY ti.created_at DESC`,
    [userId]
  );

  return res.rows.map((r) => ({
    id: r.id.toString(),
    teamId: r.team_id.toString(),
    teamName: r.team_name,
    teamSize: r.team_size,
    leaderId: r.leader_id.toString(),
    leaderName: r.leader_name,
    leaderFfId: r.leader_ff_id,
    leaderFfName: r.leader_ff_name || undefined,
    invitedUserId: r.invited_user_id.toString(),
    invitedUserName: r.invited_user_name || undefined,
    invitedUserFfId: r.invited_user_ff_id || undefined,
    invitedUserFfName: r.invited_user_ff_name || undefined,
    matchId: r.match_id.toString(),
    gameMode: r.game_mode,
    teamMode: r.team_mode,
    entryFee: paiseToString(stringToPaise(r.entry_fee.toString())),
    startTime: r.start_time.toISOString(),
    matchStatus: r.match_status,
    killPrice: r.kill_price ? paiseToString(stringToPaise(r.kill_price.toString())) : '0.00',
    firstPlacePrize: r.position_prizes?.['1']
      ? paiseToString(stringToPaise(r.position_prizes['1'].toString()))
      : (r.position_prizes?.[1] ? paiseToString(stringToPaise(r.position_prizes[1].toString())) : '0.00'),
    positionPrizes: r.position_prizes || {},
    status: r.status,
    createdAt: r.created_at.toISOString(),
    respondedAt: r.responded_at ? r.responded_at.toISOString() : null,
  }));
}

/**
 * 3. Accept a team invite: POST /team-invites/:id/accept
 *
 * Requirements & Lock Order (Change #1):
 * - Non-locking read of invite to find match and team.
 * - Lock match FOR UPDATE.
 * - Lock team FOR UPDATE.
 * - Lock invite FOR UPDATE.
 * - Lock user wallet FOR UPDATE.
 * - Allocate fee (Section 6.1). If LOW_BALANCE: transaction rolls back, leaves invite pending!
 * - Insert match_players row with team_id.
 * - Mark invite accepted.
 * - If all members accepted, set team confirmed.
 */
export async function acceptInvite(userId: string, inviteId: string): Promise<void> {
  await withTransaction(async (client: PoolClient) => {
    // ── Step 1: non-locking read of invite to find match, team, status ────────
    const invitePeek = await client.query<{
      id: number;
      team_id: number;
      invited_user_id: number;
      status: string;
      match_id: number;
    }>(
      `SELECT ti.id, ti.team_id, ti.invited_user_id, ti.status, t.match_id
       FROM team_invites ti
       JOIN teams t ON t.id = ti.team_id
       WHERE ti.id = $1`,
      [inviteId]
    );

    if (!invitePeek.rowCount || invitePeek.rows[0].invited_user_id.toString() !== userId) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Invite not found', 404);
    }
    const { team_id: teamId, match_id: matchId, status: currentInviteStatus } = invitePeek.rows[0];

    if (currentInviteStatus !== 'pending') {
      throw new AppError(ErrorCodes.INVITE_EXPIRED, 'Invite is no longer pending', 400);
    }

    // ── Step 2: Lock match FOR UPDATE ────────────────────────────────────────
    const matchRes = await client.query(
      `SELECT id, entry_fee, start_time, status FROM matches WHERE id = $1 FOR UPDATE`,
      [matchId]
    );
    if (!matchRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
    }
    const match = matchRes.rows[0];

    if (match.status !== 'upcoming' && match.status !== 'room_open') {
      throw new AppError(ErrorCodes.MATCH_NOT_JOINABLE, 'Match is no longer joinable', 409);
    }

    // Cutoff check: 10 minutes before start_time
    const cutoffCheck = await client.query<{ past_cutoff: boolean }>(
      `SELECT (now() >= $1::timestamptz - INTERVAL '10 minutes') AS past_cutoff`,
      [match.start_time]
    );
    if (cutoffCheck.rows[0]?.past_cutoff) {
      throw new AppError(
        ErrorCodes.MATCH_NOT_JOINABLE,
        'Team actions are closed (10 minutes before start time)',
        409
      );
    }

    // ── Step 3: Lock team FOR UPDATE ─────────────────────────────────────────
    const teamRes = await client.query(
      `SELECT id, size, status FROM teams WHERE id = $1 FOR UPDATE`,
      [teamId]
    );
    if (!teamRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Team not found', 404);
    }
    const team = teamRes.rows[0];

    if (team.status !== 'forming') {
      throw new AppError(
        ErrorCodes.INVITE_EXPIRED,
        `Cannot accept invite for team with status ${team.status}`,
        400
      );
    }

    // ── Step 4: Lock invite FOR UPDATE ───────────────────────────────────────
    const inviteRes = await client.query(
      `SELECT id, status FROM team_invites WHERE id = $1 FOR UPDATE`,
      [inviteId]
    );
    if (!inviteRes.rowCount || inviteRes.rows[0].status !== 'pending') {
      throw new AppError(ErrorCodes.INVITE_EXPIRED, 'Invite is no longer pending', 400);
    }

    // Check user has not joined this match another way
    const alreadyJoined = await client.query(
      `SELECT id FROM match_players WHERE match_id = $1 AND user_id = $2 AND refunded_at IS NULL`,
      [matchId, userId]
    );
    if (alreadyJoined.rowCount) {
      throw new AppError(ErrorCodes.ALREADY_JOINED, 'You have already joined this match', 409);
    }

    // ── Step 5: Lock user wallet ─────────────────────────────────────────────
    await client.query(`SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE`, [userId]);

    // ── Step 6: Allocate entry fee ───────────────────────────────────────────
    // If balance is insufficient, allocateEntryFee throws LOW_BALANCE (402).
    // The transaction rolls back, leaving the invite row untouched ('pending').
    const feePaise = stringToPaise(match.entry_fee.toString());
    const alloc = await allocateEntryFee(client, userId, feePaise, 'match', matchId.toString());

    // ── Step 7: Insert match_players row ─────────────────────────────────────
    await client.query(
      `INSERT INTO match_players (
         match_id, user_id, team_id, paid_add_money, paid_cashback, paid_winning
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        matchId,
        userId,
        teamId,
        formatDbNumeric(alloc.paidAddMoney),
        formatDbNumeric(alloc.paidCashback),
        formatDbNumeric(alloc.paidWinning),
      ]
    );

    // ── Step 8: Mark invite accepted ─────────────────────────────────────────
    await client.query(
      `UPDATE team_invites SET status = 'accepted', responded_at = now() WHERE id = $1`,
      [inviteId]
    );

    // ── Step 9: Notification for match joined ────────────────────────────────
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
      title: `Match Joined: ${modeTitle}`,
      message: `You accepted invite and joined match ${matchId}. Match starts at ${timeFormatted} IST.`,
      actionUrl: `/matches/${matchId}`,
      metadata: { matchId: matchId.toString(), teamId: teamId.toString() },
    });

    // ── Step 10: Confirmation check ──────────────────────────────────────────
    // Count current accepted invites (leader + accepted invites = size)
    const acceptedCountRes = await client.query<{ count: string }>(
      `SELECT count(*)::int AS count FROM team_invites WHERE team_id = $1 AND status = 'accepted'`,
      [teamId]
    );
    const totalAccepted = 1 + Number(acceptedCountRes.rows[0].count);
    if (totalAccepted >= team.size) {
      await client.query(`UPDATE teams SET status = 'confirmed' WHERE id = $1`, [teamId]);
    }
  });
}

/**
 * 4. Decline a team invite: POST /team-invites/:id/decline
 *
 * Requirements & Lock Order (Change #1):
 * - Non-locking read of invite to find match and team.
 * - Lock match FOR UPDATE.
 * - Lock team FOR UPDATE.
 * - Lock invite FOR UPDATE.
 * - Mark invite declined; seat stays reserved.
 */
export async function declineInvite(userId: string, inviteId: string): Promise<void> {
  await withTransaction(async (client: PoolClient) => {
    // ── Step 1: non-locking read of invite ────────────────────────────────────
    const invitePeek = await client.query<{
      id: number;
      team_id: number;
      invited_user_id: number;
      status: string;
      match_id: number;
    }>(
      `SELECT ti.id, ti.team_id, ti.invited_user_id, ti.status, t.match_id
       FROM team_invites ti
       JOIN teams t ON t.id = ti.team_id
       WHERE ti.id = $1`,
      [inviteId]
    );

    if (!invitePeek.rowCount || invitePeek.rows[0].invited_user_id.toString() !== userId) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Invite not found', 404);
    }
    const { team_id: teamId, match_id: matchId, status: currentStatus } = invitePeek.rows[0];

    if (currentStatus !== 'pending') {
      throw new AppError(ErrorCodes.INVITE_EXPIRED, 'Invite is no longer pending', 400);
    }

    // ── Step 2: Lock match FOR UPDATE ────────────────────────────────────────
    const matchRes = await client.query(
      `SELECT id, start_time, status FROM matches WHERE id = $1 FOR UPDATE`,
      [matchId]
    );
    if (!matchRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
    }
    const match = matchRes.rows[0];

    const cutoffCheck = await client.query<{ past_cutoff: boolean }>(
      `SELECT (now() >= $1::timestamptz - INTERVAL '10 minutes') AS past_cutoff`,
      [match.start_time]
    );
    if (cutoffCheck.rows[0]?.past_cutoff) {
      throw new AppError(
        ErrorCodes.MATCH_NOT_JOINABLE,
        'Team actions are closed (10 minutes before start time)',
        409
      );
    }

    // ── Step 3: Lock team FOR UPDATE ─────────────────────────────────────────
    const teamRes = await client.query(
      `SELECT id, status FROM teams WHERE id = $1 FOR UPDATE`,
      [teamId]
    );
    if (!teamRes.rowCount || teamRes.rows[0].status !== 'forming') {
      throw new AppError(ErrorCodes.INVITE_EXPIRED, 'Team is no longer forming', 400);
    }

    // ── Step 4: Lock invite FOR UPDATE ───────────────────────────────────────
    const inviteRes = await client.query(
      `SELECT id, status FROM team_invites WHERE id = $1 FOR UPDATE`,
      [inviteId]
    );
    if (!inviteRes.rowCount || inviteRes.rows[0].status !== 'pending') {
      throw new AppError(ErrorCodes.INVITE_EXPIRED, 'Invite is no longer pending', 400);
    }

    // Mark declined
    await client.query(
      `UPDATE team_invites SET status = 'declined', responded_at = now() WHERE id = $1`,
      [inviteId]
    );
  });
}

/**
 * 5. Replace an invite: POST /matches/:id/teams/mine/replace
 *
 * Requirements & Lock Order (Change #1 & #5):
 * - Performed by leader on a declined/expired/pending invite.
 * - Non-locking read of users and team.
 * - Lock match FOR UPDATE.
 * - Lock team FOR UPDATE.
 * - Lock invites FOR UPDATE.
 * - Expire old invite (not delete).
 * - If new user previously had a declined/expired invite on this team, reactivate it (status='pending').
 *   Otherwise, insert new pending invite.
 */
export async function replaceInvite(
  leaderId: string,
  rawMatchId: string,
  dto: ReplaceInviteDto
): Promise<void> {
  const matchId = normalizeMatchId(rawMatchId);
  const rawList: Array<{ oldId: string; newId: string }> = [];
  if (dto.replacements && Array.isArray(dto.replacements) && dto.replacements.length > 0) {
    for (const r of dto.replacements) {
      const oldVal = (r.oldUsername || r.oldFfId || '').trim();
      const newVal = (r.newUsername || r.newFfId || '').trim();
      rawList.push({ oldId: oldVal, newId: newVal });
    }
  } else if (dto.oldUsername || dto.newUsername || dto.oldFfId || dto.newFfId) {
    const oldVal = (dto.oldUsername || dto.oldFfId || '').trim();
    const newVal = (dto.newUsername || dto.newFfId || '').trim();
    rawList.push({ oldId: oldVal, newId: newVal });
  }

  if (rawList.length === 0) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'old teammate and new teammate are required', 400);
  }

  const seenOld = new Set<string>();
  const seenNew = new Set<string>();

  for (const item of rawList) {
    if (!item.oldId || !item.newId) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'old teammate and new teammate are required', 400);
    }
    const lowerOld = item.oldId.toLowerCase();
    const lowerNew = item.newId.toLowerCase();
    if (lowerOld === lowerNew) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'new teammate must be different from old teammate', 400);
    }
    if (seenOld.has(lowerOld)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Duplicate old teammate in replacement list', 400);
    }
    if (seenNew.has(lowerNew)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Duplicate new teammate in replacement list', 400);
    }
    seenOld.add(lowerOld);
    seenNew.add(lowerNew);
  }

  await withTransaction(async (client: PoolClient) => {
    // ── Non-locking user lookups ──────────────────────────────────────────────
    const pairs: Array<{
      oldUserId: string;
      oldFfId: string;
      newUserId: string;
      newFfId: string;
    }> = [];

    for (const item of rawList) {
      const parsedOldUserId = parseUserId(item.oldId);
      const formattedOldId = parsedOldUserId !== null ? formatUserId(parsedOldUserId) : null;
      const rawOldId = parsedOldUserId !== null ? String(parsedOldUserId) : null;
      let oldUserRes;
      if (formattedOldId !== null && rawOldId !== null) {
        oldUserRes = await client.query<{ id: string | number; ff_id: string }>(
          `SELECT id, ff_id FROM users
           WHERE (id = $1 OR id = $2 OR LOWER(id::text) = LOWER($3) OR LOWER(username) = LOWER($3) OR LOWER(ff_id) = LOWER($3))
           ORDER BY CASE WHEN id = $1 OR id = $2 THEN 0 WHEN LOWER(username) = LOWER($3) THEN 1 ELSE 2 END LIMIT 1`,
          [formattedOldId, rawOldId, item.oldId]
        );
      } else {
        oldUserRes = await client.query<{ id: string | number; ff_id: string }>(
          `SELECT id, ff_id FROM users
           WHERE (LOWER(username) = LOWER($1) OR LOWER(ff_id) = LOWER($1))
           ORDER BY CASE WHEN LOWER(username) = LOWER($1) THEN 0 ELSE 1 END LIMIT 1`,
          [item.oldId]
        );
      }
      if (!oldUserRes.rowCount) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Player not found', 404);
      }
      const oldUserId = oldUserRes.rows[0].id.toString();
      const oldFfId = oldUserRes.rows[0].ff_id;

      const parsedNewUserId = parseUserId(item.newId);
      const formattedNewId = parsedNewUserId !== null ? formatUserId(parsedNewUserId) : null;
      const rawNewId = parsedNewUserId !== null ? String(parsedNewUserId) : null;
      let newUserRes;
      if (formattedNewId !== null && rawNewId !== null) {
        newUserRes = await client.query<{ id: string | number; ff_id: string }>(
          `SELECT id, ff_id FROM users
           WHERE (id = $1 OR id = $2 OR LOWER(id::text) = LOWER($3) OR LOWER(username) = LOWER($3) OR LOWER(ff_id) = LOWER($3))
             AND deleted_at IS NULL
           ORDER BY CASE WHEN id = $1 OR id = $2 THEN 0 WHEN LOWER(username) = LOWER($3) THEN 1 ELSE 2 END LIMIT 1`,
          [formattedNewId, rawNewId, item.newId]
        );
      } else {
        newUserRes = await client.query<{ id: string | number; ff_id: string }>(
          `SELECT id, ff_id FROM users
           WHERE (LOWER(username) = LOWER($1) OR LOWER(ff_id) = LOWER($1))
             AND deleted_at IS NULL
           ORDER BY CASE WHEN LOWER(username) = LOWER($1) THEN 0 ELSE 1 END LIMIT 1`,
          [item.newId]
        );
      }
      if (!newUserRes.rowCount) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Player not found', 404);
      }
      const newUserId = newUserRes.rows[0].id.toString();
      const newFfId = newUserRes.rows[0].ff_id;

      if (newUserId === leaderId) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Leader cannot invite themselves', 400);
      }
      if (oldUserId === leaderId) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Leader cannot replace themselves', 400);
      }

      pairs.push({
        oldUserId,
        oldFfId,
        newUserId,
        newFfId,
      });
    }

    const newUserIdSet = new Set(pairs.map((p) => p.newUserId));
    if (newUserIdSet.size !== pairs.length) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Duplicate new teammate in replacement list', 400);
    }

    // Find active team for user on this match (forming or confirmed)
    const userTeamRes = await client.query<{ id: number; leader_id: number; size: number; status: string }>(
      `SELECT t.id, t.leader_id, t.size, t.status FROM teams t
       LEFT JOIN match_players p ON p.team_id = t.id AND p.refunded_at IS NULL
       WHERE t.match_id = $1 AND (t.leader_id = $2 OR p.user_id = $2) AND t.status IN ('forming', 'confirmed')
       LIMIT 1`,
      [matchId, leaderId]
    );
    if (!userTeamRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Active team not found', 404);
    }
    if (userTeamRes.rows[0].leader_id.toString() !== leaderId) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Only team leader can change teammates', 403);
    }
    const teamPeek = userTeamRes;
    const teamId = teamPeek.rows[0].id.toString();

    // ── Step 1: Lock match FOR UPDATE ────────────────────────────────────────
    const matchRes = await client.query(
      `SELECT id, start_time, status FROM matches WHERE id = $1 FOR UPDATE`,
      [matchId]
    );
    if (!matchRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
    }
    const match = matchRes.rows[0];

    const cutoffCheck = await client.query<{ past_cutoff: boolean }>(
      `SELECT (now() >= $1::timestamptz - INTERVAL '10 minutes') AS past_cutoff`,
      [match.start_time]
    );
    if (cutoffCheck.rows[0]?.past_cutoff) {
      throw new AppError(
        ErrorCodes.MATCH_NOT_JOINABLE,
        'Team actions are closed (10 minutes before start time)',
        409
      );
    }

    // ── Step 2: Lock team FOR UPDATE ─────────────────────────────────────────
    const teamRes = await client.query<{ id: number; status: string; replace_count: number }>(
      `SELECT id, status, COALESCE(replace_count, 0) AS replace_count FROM teams WHERE id = $1 FOR UPDATE`,
      [teamId]
    );
    if (!teamRes.rowCount || !['forming', 'confirmed'].includes(teamRes.rows[0].status)) {
      throw new AppError(ErrorCodes.MATCH_NOT_JOINABLE, 'Team is no longer active', 409);
    }
    if (Number(teamRes.rows[0].replace_count || 0) >= 1) {
      throw new AppError(
        ErrorCodes.TEAM_INVALID,
        'Team changes are closed: Teammate can only be replaced one time',
        400
      );
    }

    if (teamRes.rows[0].status === 'confirmed') {
      const playerRowUpdates: Array<{ newUserId: string; rowId: number }> = [];

      for (const pair of pairs) {
        // Confirmed team: verify old player is in match_players for this team
        const oldPlayerRes = await client.query<{ id: number }>(
          `SELECT id FROM match_players WHERE match_id = $1 AND team_id = $2 AND user_id = $3 AND refunded_at IS NULL FOR UPDATE`,
          [matchId, teamId, pair.oldUserId]
        );
        if (!oldPlayerRes.rowCount) {
          throw new AppError(ErrorCodes.NOT_FOUND, `Player not found in this team: ${pair.oldFfId}`, 404);
        }

        // Validate new user is not already joined
        const newUserJoined = await client.query(
          `SELECT id FROM match_players WHERE match_id = $1 AND user_id = $2 AND refunded_at IS NULL`,
          [matchId, pair.newUserId]
        );
        if (newUserJoined.rowCount) {
          throw new AppError(
            ErrorCodes.ALREADY_JOINED,
            'New player has already joined this match',
            409
          );
        }

        playerRowUpdates.push({
          newUserId: pair.newUserId,
          rowId: oldPlayerRes.rows[0].id,
        });
      }

      // Swap in match_players
      for (const update of playerRowUpdates) {
        await client.query(
          `UPDATE match_players SET user_id = $1 WHERE id = $2`,
          [update.newUserId, update.rowId]
        );
      }

      await client.query(
        `UPDATE teams SET replace_count = replace_count + 1 WHERE id = $1`,
        [teamId]
      );
      return;
    }

    // ── Step 3: Lock invites FOR UPDATE (forming teams) ──────────────────────
    const inviteUpdates: Array<{ oldInviteId: number; newUserId: string }> = [];

    for (const pair of pairs) {
      const oldInviteRes = await client.query<{ id: number; status: string }>(
        `SELECT id, status FROM team_invites WHERE team_id = $1 AND invited_user_id = $2 FOR UPDATE`,
        [teamId, pair.oldUserId]
      );
      if (!oldInviteRes.rowCount) {
        throw new AppError(ErrorCodes.NOT_FOUND, `Invite for old player not found: ${pair.oldFfId}`, 404);
      }
      const oldInvite = oldInviteRes.rows[0];
      if (oldInvite.status === 'accepted') {
        throw new AppError(
          ErrorCodes.TEAM_INVALID,
          'Cannot replace a member who has already accepted',
          400
        );
      }

      // Validate new user is not already joined or in an active team
      const newUserJoined = await client.query(
        `SELECT id FROM match_players WHERE match_id = $1 AND user_id = $2 AND refunded_at IS NULL`,
        [matchId, pair.newUserId]
      );
      if (newUserJoined.rowCount) {
        throw new AppError(
          ErrorCodes.ALREADY_JOINED,
          'New player has already joined this match',
          409
        );
      }
      const newUserInTeam = await client.query(
        `SELECT t.id FROM teams t
         LEFT JOIN team_invites ti ON ti.team_id = t.id AND ti.invited_user_id = $2 AND ti.status = 'pending'
         WHERE t.match_id = $1 AND t.status IN ('forming', 'confirmed') AND t.id <> $3
           AND (t.leader_id = $2 OR ti.id IS NOT NULL)`,
        [matchId, pair.newUserId, teamId]
      );
      if (newUserInTeam.rowCount) {
        throw new AppError(
          ErrorCodes.ALREADY_JOINED,
          'New player is already in a team for this match',
          409
        );
      }

      inviteUpdates.push({
        oldInviteId: oldInvite.id,
        newUserId: pair.newUserId,
      });
    }

    for (const update of inviteUpdates) {
      // Mark old invite expired (not deleted)
      await client.query(
        `UPDATE team_invites SET status = 'expired', responded_at = now() WHERE id = $1`,
        [update.oldInviteId]
      );

      // Re-inviting a previously declined/expired user on the same team reactivates the row
      const existingNewInvite = await client.query<{ id: number; status: string }>(
        `SELECT id, status FROM team_invites WHERE team_id = $1 AND invited_user_id = $2 FOR UPDATE`,
        [teamId, update.newUserId]
      );

      if (existingNewInvite.rowCount) {
        const row = existingNewInvite.rows[0];
        if (row.status === 'accepted') {
          throw new AppError(ErrorCodes.ALREADY_JOINED, 'Player is already accepted on this team', 409);
        }
        await client.query(
          `UPDATE team_invites SET status = 'pending', responded_at = NULL, created_at = now() WHERE id = $1`,
          [row.id]
        );
      } else {
        await client.query(
          `INSERT INTO team_invites (team_id, invited_user_id, status) VALUES ($1, $2, 'pending')`,
          [teamId, update.newUserId]
        );
      }
    }

    await client.query(
      `UPDATE teams SET replace_count = replace_count + 1 WHERE id = $1`,
      [teamId]
    );
  });
}

/**
 * 6. Disband a team: DELETE /matches/:id/teams/mine
 *
 * Requirements & Lock Order (Change #1):
 * - Non-locking read to find team.
 * - Lock match FOR UPDATE.
 * - Lock team FOR UPDATE.
 * - Lock invites FOR UPDATE (mark pending -> expired).
 * - Find all paid members where refunded_at IS NULL.
 * - Lock wallets in ascending user_id.
 * - Refund every paid member to exact wallets.
 * - Set match_players.refunded_at = now().
 * - Set team status = 'disbanded'.
 * - Releases reserved seats immediately.
 */
export async function disbandTeam(leaderId: string, rawMatchId: string): Promise<void> {
  const matchId = normalizeMatchId(rawMatchId);
  await withTransaction(async (client: PoolClient) => {
    // ── Step 1: Non-locking read of team ──────────────────────────────────────
    const teamPeek = await client.query<{ id: number; status: string }>(
      `SELECT id, status FROM teams WHERE match_id = $1 AND leader_id = $2 AND status IN ('forming', 'confirmed')`,
      [matchId, leaderId]
    );
    if (!teamPeek.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Active team not found', 404);
    }
    const teamId = teamPeek.rows[0].id.toString();

    // ── Step 2: Lock match FOR UPDATE ────────────────────────────────────────
    const matchRes = await client.query(
      `SELECT id, start_time, status FROM matches WHERE id = $1 FOR UPDATE`,
      [matchId]
    );
    if (!matchRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
    }
    const match = matchRes.rows[0];

    // Cutoff check: cannot disband after cutoff
    const cutoffCheck = await client.query<{ past_cutoff: boolean }>(
      `SELECT (now() >= $1::timestamptz - INTERVAL '10 minutes') AS past_cutoff`,
      [match.start_time]
    );
    if (cutoffCheck.rows[0]?.past_cutoff) {
      throw new AppError(
        ErrorCodes.MATCH_NOT_JOINABLE,
        'Team actions are closed (10 minutes before start time)',
        409
      );
    }

    // ── Step 3: Lock team FOR UPDATE ─────────────────────────────────────────
    const teamRes = await client.query(
      `SELECT id, status FROM teams WHERE id = $1 FOR UPDATE`,
      [teamId]
    );
    if (!teamRes.rowCount || teamRes.rows[0].status === 'disbanded') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Team already disbanded', 404);
    }
    if (teamRes.rows[0].status === 'confirmed') {
      throw new AppError(
        ErrorCodes.MATCH_NOT_JOINABLE,
        'Cannot disband team once formed. Team formation is final.',
        409
      );
    }

    // ── Step 4: Lock invites FOR UPDATE ──────────────────────────────────────
    await client.query(
      `UPDATE team_invites SET status = 'expired' WHERE team_id = $1 AND status = 'pending'`,
      [teamId]
    );

    // ── Step 5: Find all paid players on this team ────────────────────────────
    const paidPlayersRes = await client.query<{ id: number; user_id: number }>(
      `SELECT id, user_id
       FROM match_players
       WHERE match_id = $1 AND team_id = $2 AND refunded_at IS NULL`,
      [matchId, teamId]
    );

    // ── Step 6: Lock wallets in ascending user_id order ───────────────────────
    const userIdsToLock = Array.from(
      new Set(paidPlayersRes.rows.map((p) => p.user_id.toString()))
    ).sort((a, b) => a.localeCompare(b));

    for (const uid of userIdsToLock) {
      await client.query(`SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE`, [uid]);
    }

    // ── Step 7: Refund each player via refundEntryFee ─────────────────────────
    for (const p of paidPlayersRes.rows) {
      await refundEntryFee(client, p.id.toString(), matchId);
    }

    // ── Step 8: Mark team disbanded ──────────────────────────────────────────
    await client.query(`UPDATE teams SET status = 'disbanded' WHERE id = $1`, [teamId]);
  });
}

/**
 * 7. Lookup teammate by username, user ID (BW-USR-X), or Free Fire UID: GET /matches/lookup-teammate?username=...
 */
export async function lookupTeammate(
  leaderId: string,
  identifier: string,
  matchId?: string
): Promise<{ exists: boolean; userId?: string; username?: string; ffId?: string; ffName?: string; name?: string; message?: string }> {
  const cleanId = (identifier || '').trim();
  if (!cleanId) {
    return { exists: false, message: 'Invalid username, check username or register the player' };
  }

  const parsedUserId = parseUserId(cleanId);
  const formattedUserId = parsedUserId !== null ? formatUserId(parsedUserId) : null;
  const rawUserId = parsedUserId !== null ? String(parsedUserId) : null;

  // Check if leader entered their own username, user ID (BW-USR-X), or Free Fire ID
  const leaderRes = await query<{ id: string | number; username: string; ff_id: string }>(
    `SELECT id, username, ff_id FROM users WHERE id = $1`,
    [leaderId]
  );
  if (leaderRes.rowCount) {
    const lRow = leaderRes.rows[0];
    const isSelf =
      (formattedUserId !== null && formatUserId(lRow.id).toLowerCase() === formattedUserId.toLowerCase()) ||
      (rawUserId !== null && lRow.id.toString() === rawUserId) ||
      (lRow.username && lRow.username.toLowerCase() === cleanId.toLowerCase()) ||
      (lRow.ff_id && lRow.ff_id.toLowerCase() === cleanId.toLowerCase()) ||
      (lRow.id && lRow.id.toString().toLowerCase() === cleanId.toLowerCase());

    if (isSelf) {
      return { exists: false, message: 'You cannot add yourself as a teammate' };
    }
  }

  let uRes;
  if (formattedUserId !== null && rawUserId !== null) {
    uRes = await query<{ id: string | number; username: string | null; ff_id: string; ff_name: string | null; name: string }>(
      `SELECT id, username, ff_id, ff_name, name FROM users
       WHERE (id = $1 OR id = $2 OR LOWER(id::text) = LOWER($3) OR LOWER(username) = LOWER($3) OR LOWER(ff_id) = LOWER($3)) AND deleted_at IS NULL
       ORDER BY CASE WHEN id = $1 OR id = $2 THEN 0 WHEN LOWER(username) = LOWER($3) THEN 1 ELSE 2 END LIMIT 1`,
      [formattedUserId, rawUserId, cleanId]
    );
  } else {
    uRes = await query<{ id: string | number; username: string | null; ff_id: string; ff_name: string | null; name: string }>(
      `SELECT id, username, ff_id, ff_name, name FROM users
       WHERE (LOWER(username) = LOWER($1) OR LOWER(ff_id) = LOWER($1)) AND deleted_at IS NULL
       ORDER BY CASE WHEN LOWER(username) = LOWER($1) THEN 0 ELSE 1 END LIMIT 1`,
      [cleanId]
    );
  }

  if (!uRes.rowCount) {
    return { exists: false, message: 'Invalid username, check username or register the player' };
  }

  const user = uRes.rows[0];

  if (matchId) {
    const cleanMatchId = normalizeMatchId(matchId);
    const joinedCheck = await query(
      `SELECT id FROM match_players WHERE match_id = $1 AND user_id = $2 AND refunded_at IS NULL`,
      [cleanMatchId, user.id]
    );
    if (joinedCheck.rowCount) {
      return { exists: false, message: 'Player has already joined this match' };
    }
  }

  return {
    exists: true,
    userId: formatUserId(user.id),
    username: user.username || undefined,
    ffId: user.ff_id,
    ffName: user.ff_name || user.name,
    name: user.name,
  };
}

/**
 * 8. Get my team details for a match: GET /matches/:id/teams/mine
 * Returns team members with Free Fire names and IDs for teammate management.
 */
export async function getMyTeam(userId: string, rawMatchId: string): Promise<MyTeamDto> {
  const matchId = normalizeMatchId(rawMatchId);
  const teamRes = await query<{
    id: number;
    match_id: number;
    leader_id: number;
    name: string | null;
    size: number;
    status: string;
    replace_count: number;
    match_status: string;
  }>(
    `SELECT t.id, t.match_id, t.leader_id, t.name, t.size, t.status, COALESCE(t.replace_count, 0) AS replace_count, m.status AS match_status
     FROM teams t
     JOIN matches m ON m.id = t.match_id
     LEFT JOIN match_players p ON p.team_id = t.id
     WHERE t.match_id = $1
       AND (t.leader_id = $2 OR p.user_id = $2)
       AND (t.status IN ('forming', 'confirmed') OR (m.status = 'cancelled' AND t.status IN ('forming', 'confirmed', 'disbanded')))
     LIMIT 1`,
    [matchId, userId]
  );

  if (!teamRes.rowCount) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Active team not found', 404);
  }

  const team = teamRes.rows[0];
  const teamId = team.id.toString();
  const leaderId = team.leader_id.toString();

  let members: MyTeamMemberDto[] = [];

  if (team.status === 'confirmed' || team.match_status === 'cancelled') {
    const membersRes = await query<{
      user_id: number;
      username: string;
      name: string;
      ff_name: string | null;
      ff_id: string;
    }>(
      `SELECT u.id AS user_id, u.username, u.name, u.ff_name, u.ff_id
       FROM match_players mp
       JOIN users u ON u.id = mp.user_id
       WHERE mp.team_id = $1 AND (mp.refunded_at IS NULL OR $3 = 'cancelled')
       ORDER BY (u.id = $2) DESC, mp.id ASC`,
      [teamId, leaderId, team.match_status]
    );

    members = membersRes.rows.map((r) => ({
      userId: r.user_id.toString(),
      username: r.username,
      name: r.name,
      ffName: r.ff_name || r.name,
      ffId: r.ff_id,
      isLeader: r.user_id.toString() === leaderId,
      status: team.status === 'confirmed' ? 'confirmed' : team.status,
    }));
  } else {
    // Forming team
    const leaderRes = await query<{
      user_id: number;
      username: string;
      name: string;
      ff_name: string | null;
      ff_id: string;
    }>(
      `SELECT u.id AS user_id, u.username, u.name, u.ff_name, u.ff_id FROM users u WHERE u.id = $1`,
      [leaderId]
    );

    const invitesRes = await query<{
      user_id: number;
      username: string;
      name: string;
      ff_name: string | null;
      ff_id: string;
      invite_status: string;
    }>(
      `SELECT u.id AS user_id, u.username, u.name, u.ff_name, u.ff_id, ti.status AS invite_status
       FROM team_invites ti
       JOIN users u ON u.id = ti.invited_user_id
       WHERE ti.team_id = $1 AND ti.status IN ('pending', 'accepted')
       ORDER BY ti.id ASC`,
      [teamId]
    );

    if (leaderRes.rowCount) {
      members.push({
        userId: leaderRes.rows[0].user_id.toString(),
        username: leaderRes.rows[0].username,
        name: leaderRes.rows[0].name,
        ffName: leaderRes.rows[0].ff_name || leaderRes.rows[0].name,
        ffId: leaderRes.rows[0].ff_id,
        isLeader: true,
        status: 'confirmed',
      });
    }

    invitesRes.rows.forEach((r) => {
      members.push({
        userId: r.user_id.toString(),
        username: r.username,
        name: r.name,
        ffName: r.ff_name || r.name,
        ffId: r.ff_id,
        isLeader: false,
        status: r.invite_status,
      });
    });
  }

  return {
    id: teamId,
    name: team.name,
    size: team.size,
    status: team.status,
    isLeader: leaderId === userId,
    replaceCount: Number(team.replace_count || 0),
    members,
  };
}
