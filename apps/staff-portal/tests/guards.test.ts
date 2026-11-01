import { describe, it, expect, vi } from 'vitest';
import {
  moneyStringSchema,
  signedMoneyStringSchema,
  entryTierGuard,
  matchStaffDtoGuard,
  runGuard,
} from '../src/api/guards.js';
import { getFriendlyErrorMessage } from '../src/utils/errors.js';
import { ApiError } from '../src/api/client.js';

describe('Requirement 5 & 6: Staff Portal Runtime Response Guards', () => {
  it('moneyStringSchema accepts valid 2-decimal money strings and rejects numbers', () => {
    expect(moneyStringSchema.safeParse('25.00').success).toBe(true);
    expect(moneyStringSchema.safeParse('0.00').success).toBe(true);
    expect(moneyStringSchema.safeParse('1000.50').success).toBe(true);

    // Number strictly fails the guard
    expect(moneyStringSchema.safeParse(25).success).toBe(false);
    expect(moneyStringSchema.safeParse(25.5).success).toBe(false);

    // Invalid formatting fails the guard
    expect(moneyStringSchema.safeParse('25').success).toBe(false);
    expect(moneyStringSchema.safeParse('25.5').success).toBe(false);
  });

  it('signedMoneyStringSchema accepts signed and unsigned 2-decimal money strings', () => {
    expect(signedMoneyStringSchema.safeParse('120.00').success).toBe(true);
    expect(signedMoneyStringSchema.safeParse('+120.00').success).toBe(true);
    expect(signedMoneyStringSchema.safeParse('-120.00').success).toBe(true);

    // Number strictly fails
    expect(signedMoneyStringSchema.safeParse(-120).success).toBe(false);
    expect(signedMoneyStringSchema.safeParse(120).success).toBe(false);
  });

  it('entryTierGuard fails when entryFee is a number, preventing NaN or number rendering', () => {
    const rawWithNumber = {
      id: 'tier-1',
      gameMode: 'battle_royale',
      teamMode: 'solo',
      entryFee: 25.0, // Invalid: number instead of string
      killPrice: '10.00',
      minKillsForReward: 1,
      maxPlayers: 48,
      minPlayers: 20,
      positions: [{ position: 1, prize: '100.00' }],
      createdAt: '2026-10-11T10:00:00.000Z',
    };

    expect(() => {
      runGuard(entryTierGuard, rawWithNumber, 'GET /staff/entry-tiers');
    }).toThrow(ApiError);

    try {
      runGuard(entryTierGuard, rawWithNumber, 'GET /staff/entry-tiers');
    } catch (err: any) {
      expect(err.code).toBe('UNEXPECTED_RESPONSE');
      expect(err.message).toBe('unexpected response, please refresh');
      // getFriendlyErrorMessage displays the required friendly message
      expect(getFriendlyErrorMessage(err)).toBe('unexpected response, please refresh');
    }
  });

  it('guards tolerate extra keys in production and pass them through', () => {
    const rawWithExtra = {
      id: 'match-1',
      tierId: 'tier-1',
      gameMode: 'battle_royale',
      teamMode: 'solo',
      entryFee: '25.00',
      killPrice: '10.00',
      minKillsForReward: 1,
      positionPrizes: { '1': '100.00' },
      maxPlayers: 48,
      minPlayers: 20,
      startTime: '2026-10-11T12:00:00.000Z',
      status: 'upcoming',
      createdBy: 'staff-1',
      createdAt: '2026-10-11T10:00:00.000Z',
      joinedCount: 5,
      newBackendTelemetryField: 'ignored_by_client',
    };

    const parsed = runGuard(matchStaffDtoGuard, rawWithExtra, 'GET /staff/matches/match-1');
    expect(parsed.entryFee).toBe('25.00');
    expect((parsed as any).newBackendTelemetryField).toBe('ignored_by_client');
  });

  it('in development mode, extra keys emit a dev warning with endpoint name', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const rawWithExtra = {
      id: 'match-1',
      tierId: 'tier-1',
      gameMode: 'battle_royale',
      teamMode: 'solo',
      entryFee: '25.00',
      killPrice: '10.00',
      minKillsForReward: 1,
      positionPrizes: { '1': '100.00' },
      maxPlayers: 48,
      minPlayers: 20,
      startTime: '2026-10-11T12:00:00.000Z',
      status: 'upcoming',
      createdBy: 'staff-1',
      createdAt: '2026-10-11T10:00:00.000Z',
      joinedCount: 5,
      debugTraceId: 'trace-12345',
    };

    runGuard(matchStaffDtoGuard, rawWithExtra, 'GET /staff/matches/match-1');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[API Guard DEV Warning] Endpoint GET /staff/matches/match-1 contains extra undocumented keys: debugTraceId')
    );

    warnSpy.mockRestore();
  });
});
