import { describe, it, expect } from 'vitest';
import {
  formatIndianRupees,
  formatISTDateTime,
  formatCooldownMessage,
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
