import type { PoolClient } from 'pg';
import {
  ErrorCodes,
  formatDbNumeric,
  paiseToString,
  stringToPaise,
} from '@booyah/shared';
import { query, withTransaction } from '../../db/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  allocateEntryFee,
  creditReferralReward,
  refundEntryFee,
} from '../wallet/wallet.service.js';
import type {
  CreateTeamDto,
  ReplaceInviteDto,
  TeamDto,
  TeamInviteDto,
} from './matches.types.js';

/**
 * Helper to get the team size from the match mode & team mode.
 */
function getExpectedTeamSize(gameMode: string, teamMode: string): number {
  if (gameMode === 'clash_squad') return 4;
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
 * - Lock wallets in ascending user_id (leader, referrer).
 * - Charge leader with Section 6.1 allocation.
 * - Create team ('forming').
 * - Insert leader's match_players row with team_id.
 * - Create team_invites ('pending').
 * - Trigger leader's first-match referral reward.
 */
export async function createTeam(
  leaderId: string,
  matchId: string,
  dto: CreateTeamDto
): Promise<TeamDto> {
  const memberFfIds = Array.isArray(dto.memberFfIds)
    ? dto.memberFfIds.map((id) => (id || '').trim())
    : [];

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

    if (memberFfIds.length !== expectedSize - 1) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        `Expected ${expectedSize - 1} teammate Free Fire ID(s), got ${memberFfIds.length}`,
        400
      );
    }

    // Check for duplicates in memberFfIds
    const uniqueFfIds = new Set(memberFfIds.map((id) => id.toLowerCase()));
    if (uniqueFfIds.size !== memberFfIds.length) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'Duplicate teammate Free Fire IDs in invitation list',
        400
      );
    }

    // Read leader user info
    const leaderUserRes = await client.query(
      `SELECT id, ff_id FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [leaderId]
    );
    if (!leaderUserRes.rowCount) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'User account is inactive or not found', 403);
    }
    const leaderFfId = (leaderUserRes.rows[0].ff_id || '').toLowerCase();
    if (uniqueFfIds.has(leaderFfId)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Leader cannot invite themselves', 400);
    }

    // Lookup each invited member by Free Fire ID (must be registered, non-deleted)
    const invitedUserIds: string[] = [];
    const memberUsers: { id: string; ffId: string; name: string }[] = [];
    for (const ffId of memberFfIds) {
      const uRes = await client.query<{ id: number; ff_id: string; name: string }>(
        `SELECT id, ff_id, name FROM users WHERE LOWER(ff_id) = LOWER($1) AND deleted_at IS NULL`,
        [ffId]
      );
      if (!uRes.rowCount) {
        // Generic error that does not reveal whether the user is deleted or nonexistent
        throw new AppError(ErrorCodes.NOT_FOUND, 'Player not found', 404);
      }
      const member = uRes.rows[0];
      const memberIdStr = member.id.toString();
      invitedUserIds.push(memberIdStr);
      memberUsers.push({ id: memberIdStr, ffId: member.ff_id, name: member.name });
    }

    // ── 1. Read leader referrer non-locking ───────────────────────────────────
    const refRes = await client.query<{ referrer_id: number }>(
      `SELECT referrer_id FROM referrals WHERE referred_id = $1 AND credited_at IS NULL`,
      [leaderId]
    );
    const referrerId = refRes.rowCount ? refRes.rows[0].referrer_id.toString() : null;

    // ── 2. Lock match FOR UPDATE ─────────────────────────────────────────────
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

    // Clash Squad: at most 2 non-disbanded teams
    if (match.game_mode === 'clash_squad') {
      const csTeamsRes = await client.query<{ count: string }>(
        `SELECT count(*)::int AS count FROM teams WHERE match_id = $1 AND status IN ('forming', 'confirmed')`,
        [matchId]
      );
      if (Number(csTeamsRes.rows[0].count) >= 2) {
        throw new AppError(ErrorCodes.MATCH_FULL, 'Clash Squad allows at most 2 teams', 409);
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

    // ── 3. Lock wallets in ascending user_id (leader, leader referrer) ─────────
    const walletIdsToLock = referrerId
      ? [leaderId, referrerId].sort((a, b) => Number(a) - Number(b))
      : [leaderId];

    for (const wid of walletIdsToLock) {
      await client.query(`SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE`, [wid]);
    }

    // ── 4. Allocate full team entry fee for leader ────────────────────────────
    // For Clash Squad, the match entry fee is the team fee (e.g. ₹50 per team).
    // For Battle Royale (duo/squad), entry fee is per player, so leader pays fee * expectedSize.
    const feePaise = stringToPaise(match.entry_fee.toString());
    const totalTeamFeePaise =
      match.game_mode === 'clash_squad' ? feePaise : feePaise * expectedSize;
    const alloc = await allocateEntryFee(client, leaderId, totalTeamFeePaise, 'match', matchId);

    // ── 5. Create team directly with status 'confirmed' ───────────────────────
    const teamInsertRes = await client.query(
      `INSERT INTO teams (match_id, leader_id, name, size, status)
       VALUES ($1, $2, $3, $4, 'confirmed')
       RETURNING id, match_id, leader_id, name, size, status, created_at`,
      [matchId, leaderId, dto.teamName ? dto.teamName.trim() : null, expectedSize]
    );
    const team = teamInsertRes.rows[0];
    const teamId = team.id.toString();

    // ── 6. Insert leader's match_players row with total team fee paid ─────────
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

    // ── 7. Insert all teammates directly into match_players (fee paid by leader)
    for (const memberId of invitedUserIds) {
      await client.query(
        `INSERT INTO match_players (
           match_id, user_id, team_id, paid_add_money, paid_cashback, paid_winning
         ) VALUES ($1, $2, $3, 0, 0, 0)`,
        [matchId, memberId, teamId]
      );
    }

    // ── 8. First-match referral trigger for leader ────────────────────────────
    await creditReferralReward(client, leaderId);

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
          freeFireId: leaderUserRes.rows[0].ff_id,
          name: leaderUserRes.rows[0].name || '',
          role: 'leader',
          status: 'confirmed',
        },
        ...memberUsers.map((m) => ({
          userId: m.id,
          freeFireId: m.ffId,
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
 * - Lock wallets in ascending user_id (user, referrer).
 * - Allocate fee (Section 6.1). If LOW_BALANCE: transaction rolls back, leaves invite pending!
 * - Insert match_players row with team_id.
 * - Mark invite accepted.
 * - Trigger first-match referral reward.
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

    // Non-locking read of user's referrer
    const refRes = await client.query<{ referrer_id: number }>(
      `SELECT referrer_id FROM referrals WHERE referred_id = $1 AND credited_at IS NULL`,
      [userId]
    );
    const referrerId = refRes.rowCount ? refRes.rows[0].referrer_id.toString() : null;

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

    // ── Step 5: Lock wallets in ascending user_id (user, referrer) ────────────
    const walletIdsToLock = referrerId
      ? [userId, referrerId].sort((a, b) => Number(a) - Number(b))
      : [userId];

    for (const wid of walletIdsToLock) {
      await client.query(`SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE`, [wid]);
    }

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

    // ── Step 9: First-match referral trigger for teammate ─────────────────────
    await creditReferralReward(client, userId);

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
  matchId: string,
  dto: ReplaceInviteDto
): Promise<void> {
  const oldFfId = (dto.oldFfId || '').trim();
  const newFfId = (dto.newFfId || '').trim();

  if (!oldFfId || !newFfId) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'oldFfId and newFfId are required', 400);
  }
  if (oldFfId.toLowerCase() === newFfId.toLowerCase()) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'newFfId must be different from oldFfId', 400);
  }

  await withTransaction(async (client: PoolClient) => {
    // ── Non-locking user lookups ──────────────────────────────────────────────
    const oldUserRes = await client.query<{ id: number }>(
      `SELECT id FROM users WHERE LOWER(ff_id) = LOWER($1)`,
      [oldFfId]
    );
    if (!oldUserRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Player not found', 404);
    }
    const oldUserId = oldUserRes.rows[0].id.toString();

    const newUserRes = await client.query<{ id: number; ff_id: string }>(
      `SELECT id, ff_id FROM users WHERE LOWER(ff_id) = LOWER($1) AND deleted_at IS NULL`,
      [newFfId]
    );
    if (!newUserRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Player not found', 404);
    }
    const newUserId = newUserRes.rows[0].id.toString();

    if (newUserId === leaderId) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Leader cannot invite themselves', 400);
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
    const teamRes = await client.query(
      `SELECT id, status FROM teams WHERE id = $1 FOR UPDATE`,
      [teamId]
    );
    if (!teamRes.rowCount || !['forming', 'confirmed'].includes(teamRes.rows[0].status)) {
      throw new AppError(ErrorCodes.MATCH_NOT_JOINABLE, 'Team is no longer active', 409);
    }

    if (teamRes.rows[0].status === 'confirmed') {
      // Confirmed team: verify old player is in match_players for this team
      const oldPlayerRes = await client.query<{ id: number }>(
        `SELECT id FROM match_players WHERE match_id = $1 AND team_id = $2 AND user_id = $3 AND refunded_at IS NULL FOR UPDATE`,
        [matchId, teamId, oldUserId]
      );
      if (!oldPlayerRes.rowCount) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Player not found in this team', 404);
      }
      if (oldUserId === leaderId) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Leader cannot replace themselves', 400);
      }

      // Validate new user is not already joined
      const newUserJoined = await client.query(
        `SELECT id FROM match_players WHERE match_id = $1 AND user_id = $2 AND refunded_at IS NULL`,
        [matchId, newUserId]
      );
      if (newUserJoined.rowCount) {
        throw new AppError(
          ErrorCodes.ALREADY_JOINED,
          'New player has already joined this match',
          409
        );
      }

      // Swap in match_players
      await client.query(
        `UPDATE match_players SET user_id = $1 WHERE id = $2`,
        [newUserId, oldPlayerRes.rows[0].id]
      );
      return;
    }

    // ── Step 3: Lock invites FOR UPDATE (forming teams) ──────────────────────
    const oldInviteRes = await client.query<{ id: number; status: string }>(
      `SELECT id, status FROM team_invites WHERE team_id = $1 AND invited_user_id = $2 FOR UPDATE`,
      [teamId, oldUserId]
    );
    if (!oldInviteRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Invite for old player not found', 404);
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
      [matchId, newUserId]
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
      [matchId, newUserId, teamId]
    );
    if (newUserInTeam.rowCount) {
      throw new AppError(
        ErrorCodes.ALREADY_JOINED,
        'New player is already in a team for this match',
        409
      );
    }

    // Mark old invite expired (not deleted)
    await client.query(
      `UPDATE team_invites SET status = 'expired', responded_at = now() WHERE id = $1`,
      [oldInvite.id]
    );

    // Change #5: Re-inviting a previously declined/expired user on the same team
    // reactivates the row; otherwise insert new pending invite
    const existingNewInvite = await client.query<{ id: number; status: string }>(
      `SELECT id, status FROM team_invites WHERE team_id = $1 AND invited_user_id = $2 FOR UPDATE`,
      [teamId, newUserId]
    );

    if (existingNewInvite.rowCount) {
      const row = existingNewInvite.rows[0];
      if (row.status === 'accepted') {
        throw new AppError(ErrorCodes.ALREADY_JOINED, 'Player is already accepted on this team', 409);
      }
      // Reactivate
      await client.query(
        `UPDATE team_invites SET status = 'pending', responded_at = NULL, created_at = now() WHERE id = $1`,
        [row.id]
      );
    } else {
      await client.query(
        `INSERT INTO team_invites (team_id, invited_user_id, status) VALUES ($1, $2, 'pending')`,
        [teamId, newUserId]
      );
    }
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
export async function disbandTeam(leaderId: string, matchId: string): Promise<void> {
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
    ).sort((a, b) => Number(a) - Number(b));

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
 * 7. Lookup teammate by Free Fire UID: GET /matches/lookup-teammate?ffId=...
 */
export async function lookupTeammate(
  leaderId: string,
  ffId: string,
  matchId?: string
): Promise<{ exists: boolean; ffId?: string; ffName?: string; name?: string; message?: string }> {
  const cleanFfId = (ffId || '').trim();
  if (!cleanFfId) {
    return { exists: false, message: 'Invalid UID, Check UID or Register the Player' };
  }

  // Check if leader entered their own Free Fire ID
  const leaderRes = await query<{ ff_id: string }>(
    `SELECT ff_id FROM users WHERE id = $1`,
    [leaderId]
  );
  if (
    leaderRes.rowCount &&
    leaderRes.rows[0].ff_id &&
    leaderRes.rows[0].ff_id.toLowerCase() === cleanFfId.toLowerCase()
  ) {
    return { exists: false, message: 'You cannot add yourself as a teammate' };
  }

  const uRes = await query<{ id: number; ff_id: string; ff_name: string; name: string }>(
    `SELECT id, ff_id, ff_name, name FROM users WHERE LOWER(ff_id) = LOWER($1) AND deleted_at IS NULL`,
    [cleanFfId]
  );

  if (!uRes.rowCount) {
    return { exists: false, message: 'Invalid UID, Check UID or Register the Player' };
  }

  const user = uRes.rows[0];

  if (matchId) {
    const joinedCheck = await query(
      `SELECT id FROM match_players WHERE match_id = $1 AND user_id = $2 AND refunded_at IS NULL`,
      [matchId, user.id]
    );
    if (joinedCheck.rowCount) {
      return { exists: false, message: 'Player has already joined this match' };
    }
  }

  return {
    exists: true,
    ffId: user.ff_id,
    ffName: user.ff_name || user.name,
    name: user.name,
  };
}
