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
import { uploadScreenshot, deleteFile, getSignedUrl } from '../../utils/storage.js';
import { invalidateLeaderboardCache } from '../leaderboard/leaderboard.service.js';

export interface ResultEntry {
  userId: string;
  kills: number;
  position: number | null;
}

export interface PlayerPayoutCalculation {
  matchPlayerId: string;
  userId: string;
  teamId: string | null;
  kills: number;
  position: number | null;
  killRewardPaise: number;
  positionPrizePaise: number;
  payoutPaise: number;
  unpaidPaise: number;
  isDeleted: boolean;
}

/**
 * Pure function: calculates single player payout.
 * Useful for isolated unit testing of boundary conditions.
 */
export function calculatePlayerPayout(params: {
  kills: number;
  position: number | null;
  killPricePaise: number;
  minKillsForReward: number;
  positionPrizes: Record<string, string>;
  isLeader?: boolean;
  isTeamMode?: boolean;
  isDeleted?: boolean;
}): {
  killRewardPaise: number;
  positionPrizePaise: number;
  totalPaise: number;
  unpaidPaise: number;
} {
  const {
    kills,
    position,
    killPricePaise,
    minKillsForReward,
    positionPrizes,
    isLeader = true,
    isTeamMode = false,
    isDeleted = false,
  } = params;

  // Kill reward: (kills >= min_kills_for_reward) ? kills * kill_price : 0
  const killRewardPaise =
    kills >= minKillsForReward ? kills * killPricePaise : 0;

  // Position prize: from snapshot, beyond defined prizes pays 0
  let positionPrizePaise = 0;
  if (position !== null && positionPrizes && positionPrizes[String(position)]) {
    positionPrizePaise = stringToPaise(String(positionPrizes[String(position)]));
  }

  // In team modes: team leader receives position prize, individual killer receives kill reward
  if (isTeamMode && !isLeader) {
    positionPrizePaise = 0;
  }

  const earnedPaise = killRewardPaise + positionPrizePaise;

  if (isDeleted) {
    return {
      killRewardPaise: 0,
      positionPrizePaise: 0,
      totalPaise: 0,
      unpaidPaise: earnedPaise,
    };
  }

  return {
    killRewardPaise,
    positionPrizePaise,
    totalPaise: earnedPaise,
    unpaidPaise: 0,
  };
}

/**
 * Pure function: computes payouts for all active players in a match.
 */
export function computePayouts(
  match: {
    game_mode: string;
    team_mode: string;
    kill_price: string;
    min_kills_for_reward: number;
    position_prizes: Record<string, string>;
  },
  entries: ResultEntry[],
  players: Array<{
    id: string;
    user_id: string;
    team_id: string | null;
    leader_id?: string | null;
    deleted_at: any;
  }>
): PlayerPayoutCalculation[] {
  const isClashSquad = match.game_mode === 'clash_squad';
  const isTeamBR =
    match.game_mode === 'battle_royale' &&
    (match.team_mode === 'duo' || match.team_mode === 'squad');

  const killPricePaise = stringToPaise(String(match.kill_price || '0'));
  const minKills = match.min_kills_for_reward ?? 2;
  const prizes = match.position_prizes || {};

  const entryMap = new Map<string, ResultEntry>();
  for (const e of entries) {
    entryMap.set(String(e.userId), e);
  }

  // Pre-calculate team kill rewards for team Battle Royale
  const teamKillRewardMap = new Map<string, number>();
  if (isTeamBR) {
    for (const p of players) {
      if (!p.team_id) continue;
      const tId = String(p.team_id);
      const k = entryMap.get(String(p.user_id))?.kills ?? 0;
      const kReward = k >= minKills ? k * killPricePaise : 0;
      teamKillRewardMap.set(tId, (teamKillRewardMap.get(tId) || 0) + kReward);
    }
  }

  return players.map((p) => {
    const entry = entryMap.get(String(p.user_id));
    const kills = entry?.kills ?? 0;
    const position = entry?.position ?? null;
    const isDeleted = p.deleted_at !== null;

    if (isClashSquad) {
      // Clash Squad: position 1 prize goes to winning team's leader; everyone else 0
      const pos1Str = prizes['1'] ?? prizes[1 as any];
      if (!pos1Str) {
        throw new AppError(
          ErrorCodes.RESULT_INVALID,
          'Missing position 1 prize in match snapshot',
          400
        );
      }
      const pos1PrizePaise = stringToPaise(String(pos1Str));
      const isWinner = position === 1;
      const isLeader = p.leader_id
        ? String(p.user_id) === String(p.leader_id)
        : true;

      const earnedPaise = isWinner && isLeader ? pos1PrizePaise : 0;
      const payoutPaise = !isDeleted ? earnedPaise : 0;
      const unpaidPaise = isDeleted ? earnedPaise : 0;

      return {
        matchPlayerId: String(p.id),
        userId: String(p.user_id),
        teamId: p.team_id ? String(p.team_id) : null,
        kills: 0,
        position,
        killRewardPaise: 0,
        positionPrizePaise: isWinner && isLeader ? pos1PrizePaise : 0,
        payoutPaise,
        unpaidPaise,
        isDeleted,
      };
    }

    if (isTeamBR) {
      // Duo / Squad: All rewards (position prize + all team members' kill rewards) go to the team leader
      const isLeader = p.leader_id
        ? String(p.user_id) === String(p.leader_id)
        : false;

      const playerKillRewardPaise = kills >= minKills ? kills * killPricePaise : 0;

      let positionPrizePaise = 0;
      if (position !== null && prizes[String(position)]) {
        positionPrizePaise = stringToPaise(String(prizes[String(position)]));
      }

      if (isLeader) {
        const teamTotalKillsReward = p.team_id
          ? (teamKillRewardMap.get(String(p.team_id)) ?? playerKillRewardPaise)
          : playerKillRewardPaise;
        const totalLeaderEarnedPaise = positionPrizePaise + teamTotalKillsReward;

        return {
          matchPlayerId: String(p.id),
          userId: String(p.user_id),
          teamId: p.team_id ? String(p.team_id) : null,
          kills,
          position,
          killRewardPaise: teamTotalKillsReward,
          positionPrizePaise,
          payoutPaise: !isDeleted ? totalLeaderEarnedPaise : 0,
          unpaidPaise: isDeleted ? totalLeaderEarnedPaise : 0,
          isDeleted,
        };
      } else {
        // Non-leader teammates: kills and position recorded for history, payout is 0 (all rewards to leader)
        return {
          matchPlayerId: String(p.id),
          userId: String(p.user_id),
          teamId: p.team_id ? String(p.team_id) : null,
          kills,
          position,
          killRewardPaise: playerKillRewardPaise,
          positionPrizePaise: 0,
          payoutPaise: 0,
          unpaidPaise: 0,
          isDeleted,
        };
      }
    }

    // Solo Battle Royale
    const calc = calculatePlayerPayout({
      kills,
      position,
      killPricePaise,
      minKillsForReward: minKills,
      positionPrizes: prizes,
      isLeader: true,
      isTeamMode: false,
      isDeleted,
    });

    return {
      matchPlayerId: String(p.id),
      userId: String(p.user_id),
      teamId: null,
      kills,
      position,
      killRewardPaise: calc.killRewardPaise,
      positionPrizePaise: calc.positionPrizePaise,
      payoutPaise: calc.totalPaise,
      unpaidPaise: calc.unpaidPaise,
      isDeleted,
    };
  });
}

/**
 * Validates result entries against match snapshot and active roster.
 */
export function validateResultEntries(
  match: {
    game_mode: string;
    team_mode: string;
    position_prizes: Record<string, string>;
  },
  entries: ResultEntry[],
  activePlayers: Array<{
    id: string;
    user_id: string;
    team_id: string | null;
    leader_id?: string | null;
  }>
): void {
  const N = activePlayers.length;
  if (N === 0) {
    throw new AppError(
      ErrorCodes.RESULT_INVALID,
      'Match has no active players',
      400
    );
  }

  // 1. Entry count and duplicate checks
  if (!Array.isArray(entries) || entries.length !== N) {
    throw new AppError(
      ErrorCodes.RESULT_INVALID,
      `Entries count (${entries?.length ?? 0}) must equal active player count (${N})`,
      400
    );
  }

  const activeUserIdSet = new Set(
    activePlayers.map((p) => String(p.user_id))
  );
  const entryUserIds = new Set<string>();

  for (const e of entries) {
    const uid = String(e.userId);
    if (!activeUserIdSet.has(uid)) {
      throw new AppError(
        ErrorCodes.RESULT_INVALID,
        `Entry contains user ${uid} who is not an active player in this match`,
        400
      );
    }
    if (entryUserIds.has(uid)) {
      throw new AppError(
        ErrorCodes.RESULT_INVALID,
        `Duplicate entry for user ${uid}`,
        400
      );
    }
    entryUserIds.add(uid);
  }

  // 2. Kills validation
  const teamSize =
    match.team_mode === 'duo' ? 2 : match.team_mode === 'squad' ? 4 : 1;
  const maxIndividualKills =
    match.team_mode === 'solo' ? Math.max(0, N - 1) : Math.max(0, N - teamSize);
  const maxTotalKills = Math.max(0, N - 1);

  let totalKills = 0;
  for (const e of entries) {
    if (
      typeof e.kills !== 'number' ||
      !Number.isInteger(e.kills) ||
      e.kills < 0
    ) {
      throw new AppError(
        ErrorCodes.RESULT_INVALID,
        `Invalid kills for user ${e.userId}: must be non-negative integer`,
        400
      );
    }
    if (e.kills > maxIndividualKills) {
      throw new AppError(
        ErrorCodes.RESULT_INVALID,
        `User ${e.userId} has ${e.kills} kills, which exceeds maximum allowed (${maxIndividualKills})`,
        400
      );
    }
    totalKills += e.kills;
  }

  if (totalKills > maxTotalKills) {
    throw new AppError(
      ErrorCodes.RESULT_INVALID,
      `Total kills (${totalKills}) exceeds maximum allowed (${maxTotalKills})`,
      400
    );
  }

  // 3. Positions validation
  const prizeSnapshot = match.position_prizes || {};
  const validSnapshotPositions = new Set(
    Object.keys(prizeSnapshot).map(String)
  );

  for (const e of entries) {
    if (e.position !== null && e.position !== undefined) {
      if (!Number.isInteger(e.position) || e.position < 1) {
        throw new AppError(
          ErrorCodes.RESULT_INVALID,
          `Invalid position ${e.position} for user ${e.userId}`,
          400
        );
      }
      if (!validSnapshotPositions.has(String(e.position))) {
        throw new AppError(
          ErrorCodes.RESULT_INVALID,
          `Position ${e.position} does not exist in position_prizes snapshot`,
          400
        );
      }
    }
  }

  // Exactly one position 1
  const pos1Entries = entries.filter((e) => e.position === 1);
  if (pos1Entries.length === 0) {
    throw new AppError(
      ErrorCodes.RESULT_INVALID,
      'Exactly one position 1 must exist',
      400
    );
  }

  // Team mode position rules
  if (match.team_mode === 'solo') {
    if (pos1Entries.length !== 1) {
      throw new AppError(
        ErrorCodes.RESULT_INVALID,
        'Solo match must have exactly one position 1',
        400
      );
    }

    // Unique non-lost positions
    const seenPositions = new Set<number>();
    for (const e of entries) {
      if (e.position !== null) {
        if (seenPositions.has(e.position)) {
          throw new AppError(
            ErrorCodes.RESULT_INVALID,
            `Duplicate position ${e.position} in solo match`,
            400
          );
        }
        seenPositions.add(e.position);
      }
    }
  } else {
    // Duo / Squad
    // Group active players by team_id
    const teamToMembers = new Map<string, string[]>();
    for (const p of activePlayers) {
      const tid = p.team_id ? String(p.team_id) : 'no_team';
      if (!teamToMembers.has(tid)) teamToMembers.set(tid, []);
      teamToMembers.get(tid)!.push(String(p.user_id));
    }

    const entryMap = new Map<string, ResultEntry>();
    for (const e of entries) {
      entryMap.set(String(e.userId), e);
    }

    const teamPositions = new Map<string, number | null>();

    for (const [tid, memberUids] of teamToMembers.entries()) {
      const positions = memberUids.map((uid) => entryMap.get(uid)?.position ?? null);
      const firstPos = positions[0];
      const allSame = positions.every((pos) => pos === firstPos);
      if (!allSame) {
        throw new AppError(
          ErrorCodes.RESULT_INVALID,
          `All members of team ${tid} must share the same position`,
          400
        );
      }
      teamPositions.set(tid, firstPos);
    }

    // Check non-lost positions unique per team
    const seenTeamPositions = new Set<number>();
    for (const [tid, pos] of teamPositions.entries()) {
      if (pos !== null) {
        if (seenTeamPositions.has(pos)) {
          throw new AppError(
            ErrorCodes.RESULT_INVALID,
            `Non-lost position ${pos} is shared by multiple teams`,
            400
          );
        }
        seenTeamPositions.add(pos);
      }
    }

    // Exactly one team with position 1
    const pos1Teams = Array.from(teamPositions.entries()).filter(
      ([_, pos]) => pos === 1
    );
    if (pos1Teams.length !== 1) {
      throw new AppError(
        ErrorCodes.RESULT_INVALID,
        'Exactly one team must have position 1',
        400
      );
    }
  }
}

/**
 * Submit match result (Staff: employee or admin).
 * Auto-approve allowed for admin only.
 */
export async function submitResultStaff(params: {
  staffId: string;
  staffRole: string;
  matchId: string;
  payload: any;
  fileBuffer?: Buffer;
  autoApprove?: boolean;
}): Promise<{
  id: string;
  matchId: string;
  status: string;
  screenshotUrl: string;
  approved: boolean;
}> {
  const { staffId, staffRole, matchId, payload, fileBuffer, autoApprove } =
    params;

  if (autoApprove && staffRole !== 'admin') {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      'Only admin can auto-approve results',
      403
    );
  }

  if (!fileBuffer) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      'Screenshot is required',
      400
    );
  }

  // Upload screenshot first (enforces <= 2 MB and magic bytes)
  let storageKey: string;
  try {
    storageKey = await uploadScreenshot(fileBuffer);
  } catch (err: any) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      err.message || 'Screenshot upload failed',
      400
    );
  }

  try {
    return await withTransaction(async (client: PoolClient) => {
      // 1. Conflict of interest check: staff email vs player emails
      const staffRes = await client.query<{ email: string }>(
        'SELECT email FROM staff WHERE id = $1',
        [staffId]
      );
      const staffEmail = staffRes.rows[0]?.email?.toLowerCase();

      const rosterEmailsRes = await client.query<{ email: string }>(
        `SELECT u.email
         FROM match_players mp
         JOIN users u ON u.id = mp.user_id
         WHERE mp.match_id = $1 AND mp.refunded_at IS NULL`,
        [matchId]
      );
      if (
        staffEmail &&
        rosterEmailsRes.rows.some(
          (r) => r.email.toLowerCase() === staffEmail
        )
      ) {
        throw new AppError(
          ErrorCodes.FORBIDDEN,
          'Staff member cannot submit or approve results for a match they participated in',
          403
        );
      }

      // 2. Lock match first
      const matchRes = await client.query(
        `SELECT id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
                position_prizes, status, max_players, min_players
         FROM matches
         WHERE id = $1 FOR UPDATE`,
        [matchId]
      );

      if (!matchRes.rowCount) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
      }
      const match = matchRes.rows[0];

      // 3. Lock existing result
      const resultRes = await client.query(
        `SELECT id, status, entries, screenshot_url
         FROM match_results
         WHERE match_id = $1 FOR UPDATE`,
        [matchId]
      );
      const existingResult = resultRes.rows[0];

      if (existingResult?.status === 'approved') {
        throw new AppError(
          ErrorCodes.RESULT_LOCKED,
          'Approved result is locked',
          409
        );
      }

      if (match.status !== 'live') {
        throw new AppError(
          ErrorCodes.INVALID_TRANSITION,
          `Cannot submit result for match with status ${match.status} (must be live)`,
          409
        );
      }

      // 4. Query active roster
      const playersRes = await client.query<{
        id: string;
        user_id: string;
        team_id: string | null;
        leader_id: string | null;
        deleted_at: any;
      }>(
        `SELECT mp.id, mp.user_id, mp.team_id, t.leader_id, u.deleted_at
         FROM match_players mp
         JOIN users u ON u.id = mp.user_id
         LEFT JOIN teams t ON t.id = mp.team_id
         WHERE mp.match_id = $1 AND mp.refunded_at IS NULL`,
        [matchId]
      );
      const activePlayers = playersRes.rows;

      // 5. Build and validate normalized entries
      let normalizedEntries: ResultEntry[] = [];

      if (match.game_mode === 'clash_squad') {
        const winningTeamId =
          payload.winningTeamId ?? payload.entries?.winningTeamId;
        if (!winningTeamId) {
          throw new AppError(
            ErrorCodes.RESULT_INVALID,
            'winningTeamId is required for Clash Squad',
            400
          );
        }

        // Validate team belongs to match
        const teamCheckRes = await client.query(
          `SELECT id, leader_id FROM teams WHERE id = $1 AND match_id = $2 AND status != 'disbanded'`,
          [winningTeamId, matchId]
        );
        if (!teamCheckRes.rowCount) {
          throw new AppError(
            ErrorCodes.RESULT_INVALID,
            'Winning team does not belong to this match',
            400
          );
        }

        // Validate position 1 prize exists
        if (!match.position_prizes?.['1'] && !match.position_prizes?.[1]) {
          throw new AppError(
            ErrorCodes.RESULT_INVALID,
            'Missing position 1 prize in match snapshot',
            400
          );
        }

        normalizedEntries = activePlayers.map((p) => ({
          userId: String(p.user_id),
          kills: 0,
          position: String(p.team_id) === String(winningTeamId) ? 1 : null,
        }));
      } else {
        const rawEntries = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.entries)
          ? payload.entries
          : null;

        if (!rawEntries) {
          throw new AppError(
            ErrorCodes.RESULT_INVALID,
            'entries array is required',
            400
          );
        }

        normalizedEntries = rawEntries.map((e: any) => ({
          userId: String(e.userId ?? e.user_id),
          kills: Number(e.kills ?? 0),
          position:
            e.position === null || e.position === undefined
              ? null
              : Number(e.position),
        }));

        validateResultEntries(match, normalizedEntries, activePlayers);
      }

      // 6. Save or update match_results row
      let resultId: string;
      if (!existingResult) {
        const insRes = await client.query(
          `INSERT INTO match_results (match_id, entries, screenshot_url, status, submitted_by)
           VALUES ($1, $2, $3, 'pending_approval', $4)
           RETURNING id`,
          [
            matchId,
            JSON.stringify(normalizedEntries),
            storageKey,
            staffId,
          ]
        );
        resultId = insRes.rows[0].id.toString();

        await writeAuditLog(client, {
          staffId,
          action: 'match_result_submitted',
          targetType: 'match',
          targetId: matchId,
          details: { resultId },
        });
      } else {
        resultId = existingResult.id.toString();
        const oldEntries = existingResult.entries;
        const oldScreenshot = existingResult.screenshot_url;
        const previousStatus = existingResult.status;

        await client.query(
          `UPDATE match_results
           SET entries = $1, screenshot_url = $2, status = 'pending_approval',
               submitted_by = $3, reject_reason = NULL, approved_by = NULL,
               approved_at = NULL, created_at = now()
           WHERE id = $4`,
          [
            JSON.stringify(normalizedEntries),
            storageKey,
            staffId,
            resultId,
          ]
        );

        await writeAuditLog(client, {
          staffId,
          action:
            previousStatus === 'rejected'
              ? 'match_result_resubmitted'
              : 'match_result_updated',
          targetType: 'match',
          targetId: matchId,
          details: {
            resultId,
            previousStatus,
            oldEntries,
            oldScreenshot,
          },
        });
      }

      // 7. Auto-approve if requested and admin
      if (autoApprove) {
        const computed = computePayouts(match, normalizedEntries, activePlayers);
        const payeesToCredit = computed.filter(
          (c) => c.payoutPaise > 0 && !c.isDeleted
        );
        const sortedUserIds = Array.from(
          new Set(payeesToCredit.map((c) => c.userId))
        ).sort((a, b) => Number(a) - Number(b));

        for (const uid of sortedUserIds) {
          await client.query(
            `SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE`,
            [uid]
          );
        }

        for (const payee of payeesToCredit) {
          const payoutFormatted = paiseToString(payee.payoutPaise);
          await client.query(
            `UPDATE wallets SET winning = winning + $1 WHERE user_id = $2`,
            [payoutFormatted, payee.userId]
          );

          const wRes = await client.query(
            `SELECT add_money, cashback, winning FROM wallets WHERE user_id = $1`,
            [payee.userId]
          );
          const w = wRes.rows[0];
          const winPaise = stringToPaise(w.winning.toString());
          const totPaise =
            stringToPaise(w.add_money.toString()) +
            stringToPaise(w.cashback.toString()) +
            winPaise;

          await client.query(
            `INSERT INTO wallet_ledger
             (user_id, wallet, type, amount, balance_after, total_after, ref_id)
             VALUES ($1, 'winning', 'winning', $2, $3, $4, $5)`,
            [
              payee.userId,
              payoutFormatted,
              paiseToString(winPaise),
              paiseToString(totPaise),
              matchId,
            ]
          );
        }

        for (const p of computed) {
          await client.query(
            `UPDATE match_players
             SET kills = $1, position = $2, payout = $3
             WHERE id = $4`,
            [
              p.kills,
              p.position,
              paiseToString(p.payoutPaise),
              p.matchPlayerId,
            ]
          );
        }

        await client.query(
          `UPDATE match_results
           SET status = 'approved', approved_by = $1, approved_at = now()
           WHERE id = $2`,
          [staffId, resultId]
        );

        await client.query(
          `UPDATE matches SET status = 'completed' WHERE id = $1`,
          [matchId]
        );

        const skippedPayees = computed
          .filter((c) => c.isDeleted && c.unpaidPaise > 0)
          .map((c) => ({
            userId: c.userId,
            unpaidAmount: paiseToString(c.unpaidPaise),
          }));

        await writeAuditLog(client, {
          staffId,
          action: 'match_result_submitted_and_approved',
          targetType: 'match',
          targetId: matchId,
          details: {
            resultId,
            totalPayoutPaise: computed.reduce(
              (acc, c) => acc + c.payoutPaise,
              0
            ),
            skippedPayees: skippedPayees.length > 0 ? skippedPayees : undefined,
          },
        });

        return {
          id: resultId,
          matchId,
          status: 'approved',
          screenshotUrl: storageKey,
          approved: true,
        };
      }

      return {
        id: resultId,
        matchId,
        status: 'pending_approval',
        screenshotUrl: storageKey,
        approved: false,
      };
    });
  } catch (err) {
    // Delete uploaded screenshot on any failure path
    await deleteFile(storageKey).catch(() => {});
    throw err;
  }
}

/**
 * Get match result (Staff: employee or admin).
 */
export async function getResultStaff(
  matchId: string
): Promise<{
  id: string;
  matchId: string;
  entries: ResultEntry[];
  screenshotUrl: string;
  signedScreenshotUrl: string;
  status: string;
  rejectReason: string | null;
  submittedBy: string;
  approvedBy: string | null;
  createdAt: string;
  approvedAt: string | null;
}> {
  const res = await query(
    `SELECT id, match_id, entries, screenshot_url, status, reject_reason,
            submitted_by, approved_by, created_at, approved_at
     FROM match_results
     WHERE match_id = $1`,
    [matchId]
  );

  if (!res.rowCount) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Match result not found', 404);
  }

  const row = res.rows[0];
  const signedScreenshotUrl = await getSignedUrl(row.screenshot_url, 3600);

  return {
    id: row.id.toString(),
    matchId: row.match_id.toString(),
    entries: row.entries,
    screenshotUrl: row.screenshot_url,
    signedScreenshotUrl,
    status: row.status,
    rejectReason: row.reject_reason ?? null,
    submittedBy: row.submitted_by.toString(),
    approvedBy: row.approved_by ? row.approved_by.toString() : null,
    createdAt: row.created_at.toISOString(),
    approvedAt: row.approved_at ? row.approved_at.toISOString() : null,
  };
}

/**
 * Approve match result (Admin only).
 */
export async function approveResultAdmin(
  staffId: string,
  staffRole: string,
  matchId: string
): Promise<void> {
  if (staffRole !== 'admin') {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      'Admin privileges required to approve results',
      403
    );
  }

  await withTransaction(async (client: PoolClient) => {
    // Lock match first (consistent lock order: match -> result -> wallets)
    const matchRes = await client.query(
      `SELECT id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
              position_prizes, status
       FROM matches WHERE id = $1 FOR UPDATE`,
      [matchId]
    );

    if (!matchRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
    }
    const match = matchRes.rows[0];

    // Lock result
    const resultRes = await client.query(
      `SELECT id, entries, screenshot_url, status
       FROM match_results WHERE match_id = $1 FOR UPDATE`,
      [matchId]
    );

    if (!resultRes.rowCount) {
      throw new AppError(
        ErrorCodes.NOT_FOUND,
        'Match result not found',
        404
      );
    }
    const result = resultRes.rows[0];

    // Requirement 3: Check result status before match status: already approved -> RESULT_LOCKED
    if (result.status === 'approved') {
      throw new AppError(
        ErrorCodes.RESULT_LOCKED,
        'Approved result is locked',
        409
      );
    }
    if (result.status !== 'pending_approval') {
      throw new AppError(
        ErrorCodes.INVALID_TRANSITION,
        `Result cannot be approved from status ${result.status}`,
        409
      );
    }

    if (match.status !== 'live') {
      throw new AppError(
        ErrorCodes.INVALID_TRANSITION,
        `Match cannot be approved from status ${match.status} (must be live)`,
        409
      );
    }

    // Conflict of interest check
    const adminRes = await client.query<{ email: string }>(
      'SELECT email FROM staff WHERE id = $1',
      [staffId]
    );
    const adminEmail = adminRes.rows[0]?.email?.toLowerCase();

    const playersRes = await client.query<{
      id: string;
      user_id: string;
      team_id: string | null;
      leader_id: string | null;
      email: string;
      deleted_at: any;
    }>(
      `SELECT mp.id, mp.user_id, mp.team_id, t.leader_id, u.email, u.deleted_at
       FROM match_players mp
       JOIN users u ON u.id = mp.user_id
       LEFT JOIN teams t ON t.id = mp.team_id
       WHERE mp.match_id = $1 AND mp.refunded_at IS NULL`,
      [matchId]
    );
    const activePlayers = playersRes.rows;

    if (
      adminEmail &&
      activePlayers.some((p) => p.email.toLowerCase() === adminEmail)
    ) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Staff member cannot approve results for a match they participated in',
        403
      );
    }

    // Re-validate stored entries against current active roster
    const entries: ResultEntry[] = result.entries;
    if (match.game_mode === 'battle_royale') {
      validateResultEntries(match, entries, activePlayers);
    }

    // Recompute payouts
    const computed = computePayouts(match, entries, activePlayers);

    // Payee wallets lock in ascending user_id order
    const payeesToCredit = computed.filter(
      (c) => c.payoutPaise > 0 && !c.isDeleted
    );
    const sortedUserIds = Array.from(
      new Set(payeesToCredit.map((c) => c.userId))
    ).sort((a, b) => Number(a) - Number(b));

    for (const uid of sortedUserIds) {
      await client.query(
        `SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [uid]
      );
    }

    // Credit winning wallets and insert ledger rows
    for (const payee of payeesToCredit) {
      const payoutFormatted = paiseToString(payee.payoutPaise);
      await client.query(
        `UPDATE wallets SET winning = winning + $1 WHERE user_id = $2`,
        [payoutFormatted, payee.userId]
      );

      const wRes = await client.query(
        `SELECT add_money, cashback, winning FROM wallets WHERE user_id = $1`,
        [payee.userId]
      );
      const w = wRes.rows[0];
      const winPaise = stringToPaise(w.winning.toString());
      const totPaise =
        stringToPaise(w.add_money.toString()) +
        stringToPaise(w.cashback.toString()) +
        winPaise;

      await client.query(
        `INSERT INTO wallet_ledger
         (user_id, wallet, type, amount, balance_after, total_after, ref_id)
         VALUES ($1, 'winning', 'winning', $2, $3, $4, $5)`,
        [
          payee.userId,
          payoutFormatted,
          paiseToString(winPaise),
          paiseToString(totPaise),
          matchId,
        ]
      );
    }

    // Record kills, position, payout on match_players
    for (const p of computed) {
      await client.query(
        `UPDATE match_players
         SET kills = $1, position = $2, payout = $3
         WHERE id = $4`,
        [
          p.kills,
          p.position,
          paiseToString(p.payoutPaise),
          p.matchPlayerId,
        ]
      );
    }

    // Set match_results status to approved
    await client.query(
      `UPDATE match_results
       SET status = 'approved', approved_by = $1, approved_at = now()
       WHERE id = $2`,
      [staffId, result.id]
    );

    // Set match status to completed
    await client.query(
      `UPDATE matches SET status = 'completed' WHERE id = $1`,
      [matchId]
    );

    const skippedPayees = computed
      .filter((c) => c.isDeleted && c.unpaidPaise > 0)
      .map((c) => ({
        userId: c.userId,
        unpaidAmount: paiseToString(c.unpaidPaise),
      }));

    await writeAuditLog(client, {
      staffId,
      action: 'match_result_approved',
      targetType: 'match',
      targetId: matchId,
      details: {
        resultId: result.id.toString(),
        totalPayoutPaise: computed.reduce(
          (acc, c) => acc + c.payoutPaise,
          0
        ),
        payeesCount: payeesToCredit.length,
        skippedPayees: skippedPayees.length > 0 ? skippedPayees : undefined,
      },
    });
  });

  invalidateLeaderboardCache();
}

/**
 * Reject match result (Admin only).
 */
export async function rejectResultAdmin(
  staffId: string,
  staffRole: string,
  matchId: string,
  reason: string
): Promise<void> {
  if (staffRole !== 'admin') {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      'Admin privileges required to reject results',
      403
    );
  }

  const cleanReason = reason?.trim();
  if (!cleanReason) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      'Reject reason is required',
      400
    );
  }

  await withTransaction(async (client: PoolClient) => {
    // Lock match first
    const matchRes = await client.query(
      `SELECT id, status FROM matches WHERE id = $1 FOR UPDATE`,
      [matchId]
    );
    if (!matchRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
    }

    // Lock result
    const resultRes = await client.query(
      `SELECT id, status FROM match_results WHERE match_id = $1 FOR UPDATE`,
      [matchId]
    );
    if (!resultRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Result not found', 404);
    }

    const result = resultRes.rows[0];
    if (result.status === 'approved') {
      throw new AppError(
        ErrorCodes.RESULT_LOCKED,
        'Approved result is locked',
        409
      );
    }
    if (result.status !== 'pending_approval') {
      throw new AppError(
        ErrorCodes.INVALID_TRANSITION,
        `Result is not pending approval (currently ${result.status})`,
        409
      );
    }

    // Requirement 4: update match_results status to rejected, do NOT write into approved_by
    await client.query(
      `UPDATE match_results
       SET status = 'rejected', reject_reason = $1
       WHERE id = $2`,
      [cleanReason, result.id]
    );

    // Audit log records who rejected
    await writeAuditLog(client, {
      staffId,
      action: 'result_rejected',
      targetType: 'match',
      targetId: matchId,
      details: {
        reason: cleanReason,
        resultId: result.id.toString(),
        previousStatus: 'pending_approval',
      },
    });
  });
}

/**
 * Reverse approved result (Admin only).
 */
export async function reverseResultAdmin(
  staffId: string,
  staffRole: string,
  matchId: string,
  reason: string
): Promise<void> {
  if (staffRole !== 'admin') {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      'Admin privileges required to reverse results',
      403
    );
  }

  const cleanReason = reason?.trim();
  if (!cleanReason) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      'Reversal reason is required',
      400
    );
  }

  await withTransaction(async (client: PoolClient) => {
    // 1. Lock match and result
    const matchRes = await client.query(
      `SELECT id, status FROM matches WHERE id = $1 FOR UPDATE`,
      [matchId]
    );
    if (!matchRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
    }
    const match = matchRes.rows[0];

    const resultRes = await client.query(
      `SELECT id, entries, status, approved_by
       FROM match_results WHERE match_id = $1 FOR UPDATE`,
      [matchId]
    );
    if (!resultRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Result not found', 404);
    }
    const result = resultRes.rows[0];

    if (result.status !== 'approved' || match.status !== 'completed') {
      throw new AppError(
        ErrorCodes.INVALID_TRANSITION,
        'Cannot reverse a result that is not approved or a match that is not completed',
        409
      );
    }

    // 2. Query all match_players with payouts
    const mpRes = await client.query<{
      id: string;
      user_id: string;
      kills: number;
      position: number | null;
      payout: string;
    }>(
      `SELECT id, user_id, kills, position, payout
       FROM match_players
       WHERE match_id = $1 AND refunded_at IS NULL AND payout IS NOT NULL AND payout > 0
       ORDER BY user_id ASC`,
      [matchId]
    );
    const paidPlayers = mpRes.rows;

    // 3. Lock all payee wallets in ascending user_id order
    const payeeUserIds = Array.from(
      new Set(paidPlayers.map((p) => p.user_id.toString()))
    ).sort((a, b) => Number(a) - Number(b));

    const walletsMap = new Map<string, number>();
    for (const uid of payeeUserIds) {
      const wRes = await client.query<{ winning: string }>(
        `SELECT winning FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [uid]
      );
      if (wRes.rowCount) {
        walletsMap.set(uid, stringToPaise(wRes.rows[0].winning.toString()));
      }
    }

    // 4. Check if ANY payee lacks enough winning balance
    const affectedUsers: Array<{
      userId: string;
      winningPaise: number;
      requiredPaise: number;
    }> = [];

    for (const player of paidPlayers) {
      const uid = player.user_id.toString();
      const payoutPaise = stringToPaise(player.payout.toString());
      const currentWinPaise = walletsMap.get(uid) ?? 0;
      if (currentWinPaise < payoutPaise) {
        affectedUsers.push({
          userId: uid,
          winningPaise: currentWinPaise,
          requiredPaise: payoutPaise,
        });
      }
    }

    if (affectedUsers.length > 0) {
      throw new AppError(
        ErrorCodes.LOW_BALANCE,
        'Cannot reverse result: one or more players have insufficient winning balance',
        400,
        { affectedUsers }
      );
    }

    // 5. Debit winning wallets with ledger type 'reversal'
    for (const player of paidPlayers) {
      const uid = player.user_id.toString();
      const payoutPaise = stringToPaise(player.payout.toString());
      const payoutFormatted = paiseToString(payoutPaise);

      await client.query(
        `UPDATE wallets SET winning = winning - $1 WHERE user_id = $2`,
        [payoutFormatted, uid]
      );

      const wRes = await client.query(
        `SELECT add_money, cashback, winning FROM wallets WHERE user_id = $1`,
        [uid]
      );
      const w = wRes.rows[0];
      const winPaise = stringToPaise(w.winning.toString());
      const totPaise =
        stringToPaise(w.add_money.toString()) +
        stringToPaise(w.cashback.toString()) +
        winPaise;

      await client.query(
        `INSERT INTO wallet_ledger
         (user_id, wallet, type, amount, balance_after, total_after, ref_id)
         VALUES ($1, 'winning', 'reversal', $2, $3, $4, $5)`,
        [
          uid,
          `-${payoutFormatted}`,
          paiseToString(winPaise),
          paiseToString(totPaise),
          matchId,
        ]
      );
    }

    // 6. Clear stored kills, position, payout on match_players
    await client.query(
      `UPDATE match_players
       SET kills = NULL, position = NULL, payout = NULL
       WHERE match_id = $1`,
      [matchId]
    );

    // 7. Reset match back to 'live' and result back to 'rejected'
    await client.query(
      `UPDATE matches SET status = 'live' WHERE id = $1`,
      [matchId]
    );

    await client.query(
      `UPDATE match_results
       SET status = 'rejected', reject_reason = $1, approved_by = NULL, approved_at = NULL
       WHERE id = $2`,
      [cleanReason, result.id]
    );

    // 8. Requirement 5: Audit log stores old entries and every player's payout
    await writeAuditLog(client, {
      staffId,
      action: 'result_reversed',
      targetType: 'match',
      targetId: matchId,
      details: {
        reason: cleanReason,
        old_entries: result.entries,
        player_payouts: paidPlayers.map((p) => ({
          userId: p.user_id.toString(),
          kills: p.kills,
          position: p.position,
          payout: p.payout,
        })),
      },
    });
  });

  invalidateLeaderboardCache();
}

/**
 * Preview payouts (Admin only, dry run).
 */
export async function previewPayoutsAdmin(matchId: string): Promise<{
  entries: Array<{
    userId: string;
    kills: number;
    position: number | null;
    killReward: string;
    positionPrize: string;
    payout: string;
    payoutPaise: number;
    isDeleted: boolean;
  }>;
  totalCollected: string;
  totalCollectedPaise: number;
  totalPayout: string;
  totalPayoutPaise: number;
  difference: string;
  differencePaise: number;
  warning: string | null;
}> {
  // Query match
  const matchRes = await query(
    `SELECT id, game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward,
            position_prizes, status
     FROM matches WHERE id = $1`,
    [matchId]
  );
  if (!matchRes.rowCount) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
  }
  const match = matchRes.rows[0];

  // Query result
  const resultRes = await query(
    `SELECT id, entries, status FROM match_results WHERE match_id = $1`,
    [matchId]
  );
  if (!resultRes.rowCount) {
    throw new AppError(
      ErrorCodes.NOT_FOUND,
      'No result submitted for this match',
      404
    );
  }
  const result = resultRes.rows[0];

  // Query active players and collected entry fees
  const playersRes = await query<{
    id: string;
    user_id: string;
    team_id: string | null;
    leader_id: string | null;
    paid_add_money: string;
    paid_cashback: string;
    paid_winning: string;
    deleted_at: any;
  }>(
    `SELECT mp.id, mp.user_id, mp.team_id, t.leader_id,
            mp.paid_add_money, mp.paid_cashback, mp.paid_winning, u.deleted_at
     FROM match_players mp
     JOIN users u ON u.id = mp.user_id
     LEFT JOIN teams t ON t.id = mp.team_id
     WHERE mp.match_id = $1 AND mp.refunded_at IS NULL`,
    [matchId]
  );
  const activePlayers = playersRes.rows;

  let totalCollectedPaise = 0;
  for (const p of activePlayers) {
    totalCollectedPaise +=
      stringToPaise(p.paid_add_money.toString()) +
      stringToPaise(p.paid_cashback.toString()) +
      stringToPaise(p.paid_winning.toString());
  }

  const computed = computePayouts(match, result.entries, activePlayers);
  const totalPayoutPaise = computed.reduce(
    (acc, c) => acc + c.payoutPaise,
    0
  );

  const differencePaise = totalCollectedPaise - totalPayoutPaise;
  const differenceFormatted =
    differencePaise >= 0
      ? paiseToString(differencePaise)
      : `-${paiseToString(Math.abs(differencePaise))}`;

  // Requirement 8: non-blocking warning when payout exceeds collected
  const warning =
    totalPayoutPaise > totalCollectedPaise
      ? 'Payout exceeds total entry fees collected'
      : null;

  return {
    entries: computed.map((c) => ({
      userId: c.userId,
      kills: c.kills,
      position: c.position,
      killReward: paiseToString(c.killRewardPaise),
      positionPrize: paiseToString(c.positionPrizePaise),
      payout: paiseToString(c.payoutPaise),
      payoutPaise: c.payoutPaise,
      isDeleted: c.isDeleted,
    })),
    totalCollected: paiseToString(totalCollectedPaise),
    totalCollectedPaise,
    totalPayout: paiseToString(totalPayoutPaise),
    totalPayoutPaise,
    difference: differenceFormatted,
    differencePaise,
    warning,
  };
}
