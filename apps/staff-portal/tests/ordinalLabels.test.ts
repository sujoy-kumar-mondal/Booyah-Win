import { describe, it, expect } from 'vitest';
import { getOrdinal, getPositionLabel } from '../src/utils/formatters.js';

describe('Phase 5 Proof: Ordinal Labels and Prize Position Formatting', () => {
  it('getOrdinal formats 1st, 2nd, 3rd, and teen numbers accurately', () => {
    expect(getOrdinal(1)).toBe('1st');
    expect(getOrdinal(2)).toBe('2nd');
    expect(getOrdinal(3)).toBe('3rd');
    expect(getOrdinal(4)).toBe('4th');
    expect(getOrdinal(10)).toBe('10th');
    expect(getOrdinal(11)).toBe('11th');
    expect(getOrdinal(12)).toBe('12th');
    expect(getOrdinal(13)).toBe('13th');
    expect(getOrdinal(21)).toBe('21st');
    expect(getOrdinal(22)).toBe('22nd');
    expect(getOrdinal(23)).toBe('23rd');
    expect(getOrdinal(24)).toBe('24th');
    expect(getOrdinal(101)).toBe('101st');
  });

  it('getPositionLabel formats position rankings with gameMode rules', () => {
    expect(getPositionLabel(1)).toBe('Booyah');
    expect(getPositionLabel(2)).toBe('Second');
    expect(getPositionLabel(3)).toBe('Third');
    expect(getPositionLabel(4)).toBe('4th');
    expect(getPositionLabel(11)).toBe('11th');
    expect(getPositionLabel(null)).toBe('Lost');
    expect(getPositionLabel(2, 'clash_squad')).toBe('Lost');
  });
});
