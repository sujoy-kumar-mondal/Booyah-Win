/**
 * Ordinal formatting utilities.
 */

/**
 * Returns the ordinal representation of a positive integer (e.g. 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd, 23rd).
 */
export function getOrdinal(n: number): string {
  if (!Number.isInteger(n) || n <= 0) {
    return `${n}`;
  }
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

/**
 * Returns the position label for match history or results.
 * - Battle Royale: 1 -> Booyah, 2 -> Second, 3 -> Third, 4+ -> ordinal (4th, 11th, 21st, etc.), null/undefined -> Lost.
 * - Clash Squad: 1 -> Booyah, else Lost.
 */
export function getPositionLabel(
  position: number | null | undefined,
  gameMode?: string
): string {
  if (position === null || position === undefined) {
    return 'Lost';
  }
  if (gameMode === 'clash_squad') {
    return position === 1 ? 'Booyah' : 'Lost';
  }
  if (position === 1) return 'Booyah';
  if (position === 2) return 'Second';
  if (position === 3) return 'Third';
  return getOrdinal(position);
}
