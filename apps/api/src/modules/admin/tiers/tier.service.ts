import {
  formatDbNumeric,
  paiseToString,
  stringToPaise,
  ErrorCodes,
} from '@booyah/shared';
import { query, withTransaction } from '../../../db/index.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { writeAuditLog } from '../../../utils/audit.js';

export interface TierPositionDto {
  position: number;
  prize: string;
}

export interface EntryTierDto {
  id: string;
  gameMode: 'battle_royale' | 'clash_squad';
  teamMode: 'solo' | 'duo' | 'squad';
  entryFee: string;
  killPrice: string;
  minKillsForReward: number;
  maxPlayers: number;
  minPlayers: number;
  positions: TierPositionDto[];
  createdAt: string;
}

export class TierService {
  /**
   * Validates positions are contiguous 1..N with no gaps, and mode rules.
   */
  private static validateTierConfig(input: {
    gameMode: 'battle_royale' | 'clash_squad';
    teamMode: 'solo' | 'duo' | 'squad';
    entryFee: string;
    killPrice: string;
    minKillsForReward: number;
    maxPlayers: number;
    minPlayers: number;
    positions: { position: number; prize: string }[];
  }): void {
    const entryFeePaise = stringToPaise(input.entryFee);
    if (entryFeePaise <= 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Entry fee must be greater than zero', 400);
    }

    const killPricePaise = stringToPaise(input.killPrice);
    if (killPricePaise < 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Kill price cannot be negative', 400);
    }

    // Clash squad constraints
    if (input.gameMode === 'clash_squad') {
      if (input.teamMode !== 'squad') {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Clash Squad team mode must be squad',
          400
        );
      }
      if (input.maxPlayers !== 8 || input.minPlayers !== 8) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Clash Squad must have exactly 8 max and min players',
          400
        );
      }
      if (killPricePaise !== 0) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Clash Squad kill price must be 0',
          400
        );
      }
      if (input.positions.length !== 1 || input.positions[0].position !== 1) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Clash Squad must have only position 1 prize',
          400
        );
      }
    } else {
      // Battle Royale constraints
      if (input.maxPlayers < input.minPlayers) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Max players cannot be less than min players',
          400
        );
      }
    }

    // Validate positions: must be sorted 1..N with no gaps
    const sorted = [...input.positions].sort((a, b) => a.position - b.position);
    for (let i = 0; i < sorted.length; i++) {
      const expectedPos = i + 1;
      if (sorted[i].position !== expectedPos) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          `Positions must be contiguous 1..N with no gaps. Missing position ${expectedPos}`,
          400
        );
      }
      const prizePaise = stringToPaise(sorted[i].prize);
      if (prizePaise < 0) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Prizes cannot be negative', 400);
      }
    }
  }

  /**
   * Calculates profit guard warning (Section 10.1).
   */
  private static calculateProfitGuard(input: {
    gameMode: 'battle_royale' | 'clash_squad';
    entryFee: string;
    killPrice: string;
    maxPlayers: number;
    minPlayers: number;
    positions: { position: number; prize: string }[];
  }): string | undefined {
    const entryFeePaise = stringToPaise(input.entryFee);
    const killPricePaise = stringToPaise(input.killPrice);
    const minCollectedPaise = entryFeePaise * input.minPlayers;

    let totalPrizesPaise = 0;
    for (const p of input.positions) {
      totalPrizesPaise += stringToPaise(p.prize);
    }

    let maxPayoutPaise = totalPrizesPaise;
    if (input.gameMode === 'battle_royale') {
      maxPayoutPaise += killPricePaise * (input.maxPlayers - 1);
    }

    if (minCollectedPaise < maxPayoutPaise) {
      return `Profit guard warning: Max possible payout (₹${paiseToString(
        maxPayoutPaise
      )}) exceeds minimum collected fees (₹${paiseToString(minCollectedPaise)}).`;
    }

    return undefined;
  }

  /**
   * Creates an entry tier.
   */
  static async createTier(
    adminId: string,
    input: {
      gameMode: 'battle_royale' | 'clash_squad';
      teamMode: 'solo' | 'duo' | 'squad';
      entryFee: string;
      killPrice?: string;
      minKillsForReward?: number;
      maxPlayers?: number;
      minPlayers?: number;
      positions: { position: number; prize: string }[];
  }): Promise<{ tier: EntryTierDto; warning?: string }> {
    const isCs = input.gameMode === 'clash_squad';
    const killPrice = input.killPrice ?? (isCs ? '0.00' : '0.00');
    const minKills = input.minKillsForReward ?? (isCs ? 0 : 2);
    const maxPlayers = input.maxPlayers ?? (isCs ? 8 : 48);
    const minPlayers = input.minPlayers ?? (isCs ? 8 : 24);

    this.validateTierConfig({
      gameMode: input.gameMode,
      teamMode: input.teamMode,
      entryFee: input.entryFee,
      killPrice,
      minKillsForReward: minKills,
      maxPlayers,
      minPlayers,
      positions: input.positions,
    });

    const entryFeePaise = stringToPaise(input.entryFee);
    const killPricePaise = stringToPaise(killPrice);

    const warning = this.calculateProfitGuard({
      gameMode: input.gameMode,
      entryFee: input.entryFee,
      killPrice,
      maxPlayers,
      minPlayers,
      positions: input.positions,
    });

    return await withTransaction(async (client) => {
      // Check duplicate on (game_mode, team_mode, entry_fee) among non-deleted
      const dupCheck = await client.query(
        `SELECT id FROM entry_tiers
         WHERE game_mode = $1 AND team_mode = $2 AND entry_fee = $3 AND deleted_at IS NULL`,
        [input.gameMode, input.teamMode, formatDbNumeric(entryFeePaise)]
      );

      if (dupCheck.rowCount && dupCheck.rowCount > 0) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'An active entry tier with this mode, team mode, and fee already exists',
          409
        );
      }

      // Insert tier
      const tierRes = await client.query(
        `INSERT INTO entry_tiers (
           game_mode, team_mode, entry_fee, kill_price,
           min_kills_for_reward, max_players, min_players
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, game_mode, team_mode, entry_fee, kill_price,
                   min_kills_for_reward, max_players, min_players, created_at`,
        [
          input.gameMode,
          input.teamMode,
          formatDbNumeric(entryFeePaise),
          formatDbNumeric(killPricePaise),
          minKills,
          maxPlayers,
          minPlayers,
        ]
      );

      const tierRow = tierRes.rows[0];
      const tierId = tierRow.id.toString();

      // Insert position prizes
      for (const p of input.positions) {
        const prizePaise = stringToPaise(p.prize);
        await client.query(
          `INSERT INTO tier_position_prizes (tier_id, position, prize)
           VALUES ($1, $2, $3)`,
          [tierId, p.position, formatDbNumeric(prizePaise)]
        );
      }

      // Rule #9: Audit row in transaction
      await writeAuditLog(client, {
        staffId: adminId,
        action: 'tier_created',
        targetType: 'entry_tiers',
        targetId: tierId,
        details: {
          gameMode: input.gameMode,
          teamMode: input.teamMode,
          entryFee: input.entryFee,
          positionsCount: input.positions.length,
        },
      });

      const tierDto: EntryTierDto = {
        id: tierId,
        gameMode: tierRow.game_mode,
        teamMode: tierRow.team_mode,
        entryFee: paiseToString(entryFeePaise),
        killPrice: paiseToString(killPricePaise),
        minKillsForReward: tierRow.min_kills_for_reward,
        maxPlayers: tierRow.max_players,
        minPlayers: tierRow.min_players,
        positions: input.positions.map((p) => ({
          position: p.position,
          prize: paiseToString(stringToPaise(p.prize)),
        })),
        createdAt: tierRow.created_at.toISOString(),
      };

      return { tier: tierDto, warning };
    });
  }

  /**
   * Lists active tiers (excluding soft-deleted ones).
   */
  static async listTiers(): Promise<EntryTierDto[]> {
    const res = await query(
      `SELECT t.id, t.game_mode, t.team_mode, t.entry_fee, t.kill_price,
              t.min_kills_for_reward, t.max_players, t.min_players, t.created_at,
              json_agg(json_build_object('position', p.position, 'prize', p.prize) ORDER BY p.position) as positions
       FROM entry_tiers t
       JOIN tier_position_prizes p ON t.id = p.tier_id
       WHERE t.deleted_at IS NULL
       GROUP BY t.id
       ORDER BY t.id ASC`
    );

    return res.rows.map((row) => ({
      id: row.id.toString(),
      gameMode: row.game_mode,
      teamMode: row.team_mode,
      entryFee: paiseToString(stringToPaise(row.entry_fee.toString())),
      killPrice: paiseToString(stringToPaise(row.kill_price.toString())),
      minKillsForReward: row.min_kills_for_reward,
      maxPlayers: row.max_players,
      minPlayers: row.min_players,
      positions: (row.positions || []).map((p: any) => ({
        position: p.position,
        prize: paiseToString(stringToPaise(p.prize.toString())),
      })),
      createdAt: row.created_at.toISOString(),
    }));
  }

  /**
   * Gets a single tier by ID.
   */
  static async getTierById(id: string): Promise<EntryTierDto> {
    const res = await query(
      `SELECT t.id, t.game_mode, t.team_mode, t.entry_fee, t.kill_price,
              t.min_kills_for_reward, t.max_players, t.min_players, t.created_at,
              json_agg(json_build_object('position', p.position, 'prize', p.prize) ORDER BY p.position) as positions
       FROM entry_tiers t
       JOIN tier_position_prizes p ON t.id = p.tier_id
       WHERE t.id = $1 AND t.deleted_at IS NULL
       GROUP BY t.id`,
      [id]
    );

    if (res.rowCount === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Entry tier not found', 404);
    }

    const row = res.rows[0];
    return {
      id: row.id.toString(),
      gameMode: row.game_mode,
      teamMode: row.team_mode,
      entryFee: paiseToString(stringToPaise(row.entry_fee.toString())),
      killPrice: paiseToString(stringToPaise(row.kill_price.toString())),
      minKillsForReward: row.min_kills_for_reward,
      maxPlayers: row.max_players,
      minPlayers: row.min_players,
      positions: (row.positions || []).map((p: any) => ({
        position: p.position,
        prize: paiseToString(stringToPaise(p.prize.toString())),
      })),
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * Updates a tier.
   */
  static async updateTier(
    adminId: string,
    id: string,
    updates: {
      gameMode?: 'battle_royale' | 'clash_squad';
      teamMode?: 'solo' | 'duo' | 'squad';
      entryFee?: string;
      killPrice?: string;
      minKillsForReward?: number;
      maxPlayers?: number;
      minPlayers?: number;
      positions?: { position: number; prize: string }[];
    }
  ): Promise<{ tier: EntryTierDto; warning?: string }> {
    const existing = await this.getTierById(id);

    const merged = {
      gameMode: updates.gameMode ?? existing.gameMode,
      teamMode: updates.teamMode ?? existing.teamMode,
      entryFee: updates.entryFee ?? existing.entryFee,
      killPrice: updates.killPrice ?? existing.killPrice,
      minKillsForReward: updates.minKillsForReward ?? existing.minKillsForReward,
      maxPlayers: updates.maxPlayers ?? existing.maxPlayers,
      minPlayers: updates.minPlayers ?? existing.minPlayers,
      positions: updates.positions ?? existing.positions,
    };

    this.validateTierConfig(merged);

    const warning = this.calculateProfitGuard(merged);

    return await withTransaction(async (client) => {
      // Check duplicate conflict
      const entryFeePaise = stringToPaise(merged.entryFee);
      const dupCheck = await client.query(
        `SELECT id FROM entry_tiers
         WHERE game_mode = $1 AND team_mode = $2 AND entry_fee = $3 AND deleted_at IS NULL AND id != $4`,
        [merged.gameMode, merged.teamMode, formatDbNumeric(entryFeePaise), id]
      );

      if (dupCheck.rowCount && dupCheck.rowCount > 0) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'An active entry tier with this mode, team mode, and fee already exists',
          409
        );
      }

      await client.query(
        `UPDATE entry_tiers
         SET game_mode = $1, team_mode = $2, entry_fee = $3, kill_price = $4,
             min_kills_for_reward = $5, max_players = $6, min_players = $7
         WHERE id = $8`,
        [
          merged.gameMode,
          merged.teamMode,
          formatDbNumeric(entryFeePaise),
          formatDbNumeric(stringToPaise(merged.killPrice)),
          merged.minKillsForReward,
          merged.maxPlayers,
          merged.minPlayers,
          id,
        ]
      );

      if (updates.positions) {
        await client.query('DELETE FROM tier_position_prizes WHERE tier_id = $1', [id]);
        for (const p of updates.positions) {
          await client.query(
            `INSERT INTO tier_position_prizes (tier_id, position, prize)
             VALUES ($1, $2, $3)`,
            [id, p.position, formatDbNumeric(stringToPaise(p.prize))]
          );
        }
      }

      // Rule #9: Audit row in transaction
      await writeAuditLog(client, {
        staffId: adminId,
        action: 'tier_updated',
        targetType: 'entry_tiers',
        targetId: id,
        details: { updatedFields: Object.keys(updates) },
      });

      const updatedTier = await this.getTierById(id);
      return { tier: updatedTier, warning };
    });
  }

  /**
   * Soft deletes a tier.
   */
  static async deleteTier(adminId: string, id: string): Promise<void> {
    await withTransaction(async (client) => {
      const res = await client.query(
        `UPDATE entry_tiers
         SET deleted_at = now()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id`,
        [id]
      );

      if (res.rowCount === 0) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Entry tier not found', 404);
      }

      // Rule #9: Audit row in transaction
      await writeAuditLog(client, {
        staffId: adminId,
        action: 'tier_deleted',
        targetType: 'entry_tiers',
        targetId: id,
      });
    });
  }

  /**
   * Seeds default tiers from Section 10.2 (Rule #10).
   */
  static async seedDefaultTiers(): Promise<void> {
    // Tier 1: Battle Royale, solo, ₹10, kill ₹5, min 2 kills, 48/24 players, positions 1: ₹50, 2: ₹40, 3: ₹30
    const t1Check = await query(
      `SELECT id FROM entry_tiers
       WHERE game_mode = 'battle_royale' AND team_mode = 'solo' AND entry_fee = 10.00 AND deleted_at IS NULL`
    );

    if (t1Check.rowCount === 0) {
      const t1 = await query(
        `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
         VALUES ('battle_royale', 'solo', 10.00, 5.00, 2, 48, 24)
         RETURNING id`
      );
      const t1Id = t1.rows[0].id;
      await query(
        `INSERT INTO tier_position_prizes (tier_id, position, prize) VALUES
         ($1, 1, 50.00), ($1, 2, 40.00), ($1, 3, 30.00)`,
        [t1Id]
      );
    }

    // Tier 2: Clash Squad, squad, ₹50, kill 0, 8/8 players, position 1: ₹75
    const t2Check = await query(
      `SELECT id FROM entry_tiers
       WHERE game_mode = 'clash_squad' AND team_mode = 'squad' AND entry_fee = 50.00 AND deleted_at IS NULL`
    );

    if (t2Check.rowCount === 0) {
      const t2 = await query(
        `INSERT INTO entry_tiers (game_mode, team_mode, entry_fee, kill_price, min_kills_for_reward, max_players, min_players)
         VALUES ('clash_squad', 'squad', 50.00, 0.00, 0, 8, 8)
         RETURNING id`
      );
      const t2Id = t2.rows[0].id;
      await query(
        `INSERT INTO tier_position_prizes (tier_id, position, prize) VALUES
         ($1, 1, 75.00)`,
        [t2Id]
      );
    }
  }
}
