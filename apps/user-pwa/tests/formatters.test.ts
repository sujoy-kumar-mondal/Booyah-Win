import { describe, it, expect } from 'vitest';
import {
  formatIndianRupees,
  formatISTDateTime,
  formatCooldownMessage,
  formatGameMode,
  formatMatchStatus,
  calculateMatchPrizePool,
  formatNavbarName,
  formatAccountHeaderName,
} from '../src/utils/formatters.js';

describe('formatIndianRupees (Pure String Manipulation)', () => {
  it('formats Rs1,250.50 exactly as specified in Requirement 6', () => {
    expect(formatIndianRupees('1250.50')).toBe('Rs1,250.50');
  });

  it('formats Rs1,00,000.00 with Indian lakh grouping as specified in Requirement 6', () => {
    expect(formatIndianRupees('100000.00')).toBe('Rs1,00,000.00');
  });

  it('formats small amounts with standard two decimal places', () => {
    expect(formatIndianRupees('0')).toBe('Rs0.00');
    expect(formatIndianRupees('0.00')).toBe('Rs0.00');
    expect(formatIndianRupees('10.00')).toBe('Rs10.00');
    expect(formatIndianRupees('75.5')).toBe('Rs75.50');
    expect(formatIndianRupees('999.00')).toBe('Rs999.00');
  });

  it('formats thousands, lakhs, and crores correctly with Indian grouping', () => {
    expect(formatIndianRupees('1000.00')).toBe('Rs1,000.00');
    expect(formatIndianRupees('10000.00')).toBe('Rs10,000.00');
    expect(formatIndianRupees('1234567.89')).toBe('Rs12,34,567.89');
    expect(formatIndianRupees('10000000.00')).toBe('Rs1,00,00,000.00'); // 1 crore
  });

  it('handles negative balances gracefully', () => {
    expect(formatIndianRupees('-1250.50')).toBe('-Rs1,250.50');
    expect(formatIndianRupees('-100000.00')).toBe('-Rs1,00,000.00');
  });

  it('handles null, undefined, and empty string safely', () => {
    expect(formatIndianRupees(null)).toBe('Rs0.00');
    expect(formatIndianRupees(undefined)).toBe('Rs0.00');
    expect(formatIndianRupees('')).toBe('Rs0.00');
  });
});

describe('formatISTDateTime & formatCooldownMessage', () => {
  it('formats timestamps strictly in Asia/Kolkata (IST)', () => {
    // 2026-10-15T12:00:00.000Z in UTC -> 17:30 in IST
    const utcIso = '2026-10-15T12:00:00.000Z';
    const formatted = formatISTDateTime(utcIso);
    expect(formatted).toContain('15 Oct 2026');
    expect(formatted).toContain('05:30 PM');
  });

  it('formats cooldown messages with "Next change available on ..."', () => {
    const utcIso = '2026-10-15T12:00:00.000Z';
    const msg = formatCooldownMessage(utcIso);
    expect(msg).toMatch(/^Next change available on 15 Oct 2026/);
    expect(msg).toContain('05:30 PM');
  });

  it('returns null when availableAt is null or undefined', () => {
    expect(formatCooldownMessage(null)).toBeNull();
    expect(formatCooldownMessage(undefined)).toBeNull();
  });
});

describe('formatGameMode', () => {
  it('formats BATTLE_ROYALE without underscores to BATTLE ROYALE', () => {
    expect(formatGameMode('BATTLE_ROYALE')).toBe('BATTLE ROYALE');
  });

  it('formats battle_royale to Battle Royale', () => {
    expect(formatGameMode('battle_royale')).toBe('Battle Royale');
  });

  it('formats CLASH_SQUAD and clash_squad without underscores', () => {
    expect(formatGameMode('CLASH_SQUAD')).toBe('CLASH SQUAD');
    expect(formatGameMode('clash_squad')).toBe('Clash Squad');
  });

  it('handles null and undefined gracefully', () => {
    expect(formatGameMode(null)).toBe('');
    expect(formatGameMode(undefined)).toBe('');
  });
});

describe('formatMatchStatus', () => {
  it('formats room_open without underscores to ROOM OPEN', () => {
    expect(formatMatchStatus('room_open')).toBe('ROOM OPEN');
  });

  it('formats other statuses to uppercase strings', () => {
    expect(formatMatchStatus('upcoming')).toBe('UPCOMING');
    expect(formatMatchStatus('live')).toBe('LIVE');
    expect(formatMatchStatus('completed')).toBe('COMPLETED');
    expect(formatMatchStatus('cancelled')).toBe('CANCELLED');
  });

  it('handles null and undefined gracefully', () => {
    expect(formatMatchStatus(null)).toBe('');
    expect(formatMatchStatus(undefined)).toBe('');
  });
});

describe('calculateMatchPrizePool (Possible kill * per kill price + positions)', () => {
  it('calculates solo mode (48 players) with possible kills = 47', () => {
    // 47 * 5 = 235 + 100 = 335
    const prize = calculateMatchPrizePool({
      teamMode: 'solo',
      maxPlayers: 48,
      prizes: {
        positions: { '1': 100 },
        killPrice: '5.00',
      },
    });
    expect(prize).toBe(335);
  });

  it('calculates duo mode (48 players) with possible kills = 46', () => {
    // 46 * 5 = 230 + 95 = 325
    const prize = calculateMatchPrizePool({
      teamMode: 'duo',
      maxPlayers: 48,
      prizes: {
        positions: { '1': 60, '2': 35 },
        killPrice: '5.00',
      },
    });
    expect(prize).toBe(325);
  });

  it('calculates squad mode (48 players) with possible kills = 44', () => {
    // 44 * 10 = 440 + 150 = 590
    const prize = calculateMatchPrizePool({
      teamMode: 'squad',
      maxPlayers: 48,
      prizes: {
        positions: { '1': 150 },
        killPrice: '10.00',
      },
    });
    expect(prize).toBe(590);
  });

  it('does not calculate kill bounty when kill price is 0', () => {
    // kill price is 0 -> 80
    const prize = calculateMatchPrizePool({
      teamMode: 'squad',
      maxPlayers: 8,
      prizes: {
        positions: { '1': 80 },
        killPrice: '0.00',
      },
    });
    expect(prize).toBe(80);
  });
});

describe('formatNavbarName & formatAccountHeaderName', () => {
  it('formats navbar name with two words + ellipsis for long names', () => {
    expect(formatNavbarName('SUJOY KUMAR MONDAL BCA')).toBe('SUJOY KUMAR ...');
    expect(formatNavbarName('SUJOY KUMAR MONDAL')).toBe('SUJOY KUMAR ...');
    expect(formatNavbarName('SUJOY KUMAR')).toBe('SUJOY KUMAR');
    expect(formatNavbarName('ALEXANDER')).toBe('ALEXANDER');
    expect(formatNavbarName(null)).toBe('Player');
  });

  it('formats account header name with three words + ellipsis for 4+ word names', () => {
    expect(formatAccountHeaderName('SUJOY KUMAR MONDAL BCA')).toBe('SUJOY KUMAR MONDAL...');
    expect(formatAccountHeaderName('SUJOY KUMAR MONDAL')).toBe('SUJOY KUMAR MONDAL');
    expect(formatAccountHeaderName('Sujoy Kumar Mondal')).toBe('Sujoy Kumar Mondal');
    expect(formatAccountHeaderName('SUJOY KUMAR')).toBe('SUJOY KUMAR');
    expect(formatAccountHeaderName(null)).toBe('Player');
  });
});
