import type { PoolClient } from 'pg';
import { stringToPaise } from '@booyah/shared';
import { withTransaction } from '../../db/index.js';
import { refundEntryFee } from '../wallet/wallet.service.js';
import type { TickResultDto } from './matches.types.js';

let isTickInProgress = false;

export function isSchedulerTickRunning(): boolean {
  return isTickInProgress;
}

/**
 * Execute periodic background jobs (called by POST /internal/jobs/tick).
 * Uses strictly the database clock (now()).
 * Idempotent, safe to run twice at once with FOR UPDATE SKIP LOCKED.
 */
export async function runSchedulerTick(): Promise<TickResultDto> {
  isTickInProgress = true;
  try {
    let deletedOtpsCount = 0;
    let disbandedTeamsCount = 0;
    let cancelledMatchesCount = 0;
    let expiredInvitesCount = 0;

  // ── Job 1: Delete otp_requests older than 1 day ──────────────────────────────
  await withTransaction(async (client: PoolClient) => {
    const res = await client.query(
      `DELETE FROM otp_requests WHERE created_at < now() - INTERVAL '1 day'`
    );
    deletedOtpsCount = res.rowCount || 0;
  });

  // ── Job 2: Disband forming teams past 10m cutoff and refund paid members ─────
  await withTransaction(async (client: PoolClient) => {
    // Select forming teams in matches where start_time <= now() + 10m
    const teamsRes = await client.query<{
      id: number;
      match_id: number;
      leader_id: number;
    }>(
      `SELECT t.id, t.match_id, t.leader_id
       FROM teams t
       JOIN matches m ON m.id = t.match_id
       WHERE t.status = 'forming'
         AND m.status IN ('upcoming', 'room_open')
         AND m.start_time <= now() + INTERVAL '10 minutes'
       FOR UPDATE OF t SKIP LOCKED`
    );

    for (const team of teamsRes.rows) {
      const teamId = team.id.toString();
      const matchId = team.match_id.toString();

      // Lock match FOR UPDATE (consistent hierarchy)
      await client.query(`SELECT 1 FROM matches WHERE id = $1 FOR UPDATE`, [matchId]);

      // Lock invites FOR UPDATE and expire pending
      await client.query(
        `UPDATE team_invites SET status = 'expired' WHERE team_id = $1 AND status = 'pending'`,
        [teamId]
      );

      // Find all paid members of this forming team
      const paidPlayersRes = await client.query<{ id: number; user_id: number }>(
        `SELECT id, user_id
         FROM match_players
         WHERE match_id = $1 AND team_id = $2 AND refunded_at IS NULL`,
        [matchId, teamId]
      );

      // Lock wallets in ascending user_id order
      const userIdsToLock = Array.from(
        new Set(paidPlayersRes.rows.map((p) => p.user_id.toString()))
      ).sort((a, b) => Number(a) - Number(b));

      for (const uid of userIdsToLock) {
        await client.query(`SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE`, [uid]);
      }

      // Refund each paid member via refundEntryFee
      for (const p of paidPlayersRes.rows) {
        await refundEntryFee(client, p.id.toString(), matchId);
      }

      // Mark team disbanded
      await client.query(`UPDATE teams SET status = 'disbanded' WHERE id = $1`, [teamId]);
      disbandedTeamsCount++;
    }
  });

  // ── Job 3: Auto-cancel matches past start_time with fewer than min_players ───
  await withTransaction(async (client: PoolClient) => {
    // Select matches where start_time <= now() and status IN ('upcoming', 'room_open')
    const matchesRes = await client.query<{
      id: number;
      game_mode: string;
      team_mode: string;
      min_players: number;
    }>(
      `SELECT id, game_mode, team_mode, min_players
       FROM matches
       WHERE status IN ('upcoming', 'room_open')
         AND start_time <= now()
       FOR UPDATE SKIP LOCKED`
    );

    for (const match of matchesRes.rows) {
      const matchId = match.id.toString();
      let isUnderfilled = false;

      if (match.team_mode === 'solo') {
        const countRes = await client.query<{ count: string }>(
          `SELECT count(*)::int AS count FROM match_players WHERE match_id = $1 AND refunded_at IS NULL`,
          [matchId]
        );
        isUnderfilled = Number(countRes.rows[0].count) < match.min_players;
      } else if (match.game_mode === 'clash_squad') {
        // Clash Squad requires at least 2 confirmed teams
        const csTeamsRes = await client.query<{ count: string }>(
          `SELECT count(*)::int AS count FROM teams WHERE match_id = $1 AND status = 'confirmed'`,
          [matchId]
        );
        isUnderfilled = Number(csTeamsRes.rows[0].count) < 2;
      } else {
        // Duo / Squad: confirmed players = paid players on confirmed teams
        const teamPlayersRes = await client.query<{ count: string }>(
          `SELECT count(mp.id)::int AS count
           FROM match_players mp
           JOIN teams t ON t.id = mp.team_id
           WHERE mp.match_id = $1 AND t.status = 'confirmed' AND mp.refunded_at IS NULL`,
          [matchId]
        );
        isUnderfilled = Number(teamPlayersRes.rows[0].count) < match.min_players;
      }

      if (isUnderfilled) {
        // Auto-cancel match
        await client.query(
          `UPDATE matches SET status = 'cancelled', cancel_reason = 'Not enough players' WHERE id = $1`,
          [matchId]
        );

        // Disband all teams in this match
        await client.query(
          `UPDATE teams SET status = 'disbanded' WHERE match_id = $1 AND status != 'disbanded'`,
          [matchId]
        );

        // Expire all pending invites
        await client.query(
          `UPDATE team_invites SET status = 'expired'
           WHERE team_id IN (SELECT id FROM teams WHERE match_id = $1) AND status = 'pending'`,
          [matchId]
        );

        // Find all unrefunded players in this match
        const unrefundedPlayers = await client.query<{ id: number; user_id: number }>(
          `SELECT id, user_id
           FROM match_players
           WHERE match_id = $1 AND refunded_at IS NULL`,
          [matchId]
        );

        // Lock wallets in ascending user_id order
        const userIdsToLock = Array.from(
          new Set(unrefundedPlayers.rows.map((p) => p.user_id.toString()))
        ).sort((a, b) => Number(a) - Number(b));

        for (const uid of userIdsToLock) {
          await client.query(`SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE`, [uid]);
        }

        // Refund each unrefunded player via refundEntryFee
        for (const p of unrefundedPlayers.rows) {
          await refundEntryFee(client, p.id.toString(), matchId);
        }

        cancelledMatchesCount++;
      }
    }
  });

  // ── Job 4: Expire stale team invites ─────────────────────────────────────────
  await withTransaction(async (client: PoolClient) => {
    const res = await client.query(
      `UPDATE team_invites
       SET status = 'expired', responded_at = now()
       WHERE status = 'pending'
         AND team_id IN (
           SELECT t.id
           FROM teams t
           JOIN matches m ON m.id = t.match_id
           WHERE t.status = 'disbanded'
              OR m.status IN ('cancelled', 'completed')
              OR m.start_time <= now() + INTERVAL '10 minutes'
         )`
    );
    expiredInvitesCount = res.rowCount || 0;
  });

    return {
      deletedOtpsCount,
      disbandedTeamsCount,
      cancelledMatchesCount,
      expiredInvitesCount,
      timestamp: new Date().toISOString(),
    };
  } finally {
    isTickInProgress = false;
  }
}
