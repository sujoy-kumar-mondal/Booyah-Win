import { describe, it, expect } from 'vitest';
import { buildISTIsoString, isFutureIST } from '../src/utils/formatters.js';

describe('Phase 5 Proof: IST Time Picker and Datetime Offset Validation', () => {
  it('buildISTIsoString constructs a proper ISO 8601 string with fixed +05:30 offset', () => {
    const iso = buildISTIsoString('2026-10-15', '16:30');
    expect(iso).toBe('2026-10-15T16:30:00+05:30');

    // Handles seconds if provided
    const withSec = buildISTIsoString('2026-10-15', '16:30:45');
    expect(withSec).toBe('2026-10-15T16:30:45+05:30');

    // Handles single digits with zero padding
    const padded = buildISTIsoString('2026-10-15', '9:5');
    expect(padded).toBe('2026-10-15T09:05:00+05:30');

    // Handles datetime already containing T separator
    const fromCombined = buildISTIsoString('2026-10-15T14:00');
    expect(fromCombined).toBe('2026-10-15T14:00:00+05:30');
  });

  it('buildISTIsoString returns empty string for missing or invalid inputs', () => {
    expect(buildISTIsoString('', '')).toBe('');
    expect(buildISTIsoString('2026-10-15', '')).toBe('');
  });

  it('isFutureIST correctly identifies future and past timestamps relative to current time', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(isFutureIST(futureDate)).toBe(true);

    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(isFutureIST(pastDate)).toBe(false);

    // Invalid string returns false
    expect(isFutureIST('not-a-date')).toBe(false);
    expect(isFutureIST('')).toBe(false);
  });
});
