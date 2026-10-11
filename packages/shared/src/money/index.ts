/**
 * Money utilities:
 * Database columns are NUMERIC(12,2).
 * Code must use integer paise, NEVER floating point numbers.
 * API inputs and outputs format money as 2-decimal strings (e.g. "10.00", "0.50").
 */

export function paiseToString(paise: number | bigint): string {
  const p = BigInt(paise);
  const isNegative = p < 0n;
  const abs = isNegative ? -p : p;
  const rupees = abs / 100n;
  const rem = abs % 100n;
  const remStr = rem.toString().padStart(2, '0');
  const result = `${rupees.toString()}.${remStr}`;
  return isNegative ? `-${result}` : result;
}

export function stringToPaise(rupeeStr: string): number {
  const trimmed = rupeeStr.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`Invalid money string format: "${rupeeStr}"`);
  }

  const isNegative = trimmed.startsWith('-');
  const clean = isNegative ? trimmed.slice(1) : trimmed;
  const parts = clean.split('.');
  const whole = BigInt(parts[0]);
  let fraction = 0n;

  if (parts.length > 1) {
    const fracStr = parts[1].padEnd(2, '0').slice(0, 2);
    fraction = BigInt(fracStr);
  }

  const totalPaise = whole * 100n + fraction;
  const signed = isNegative ? -totalPaise : totalPaise;

  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`Money value overflow: "${rupeeStr}"`);
  }

  return Number(signed);
}

export function formatDbNumeric(paise: number | bigint): string {
  return paiseToString(paise);
}

/**
 * Parse a user-supplied money string into integer paise.
 * Rejects: more than 2 decimal places, zero, negative, NaN, non-numeric.
 * Throws a user-friendly Error (caught by controllers and wrapped in AppError).
 */
export function parseMoney(raw: string | number): number {
  const s = String(raw).trim();

  if (s === '' || s === 'NaN' || s === 'Infinity' || s === '-Infinity') {
    throw new Error('Invalid amount');
  }

  // Reject more than 2 decimal places
  const dotIdx = s.indexOf('.');
  if (dotIdx !== -1 && s.length - dotIdx - 1 > 2) {
    throw new Error('Amount must have at most 2 decimal places');
  }

  // Must match a valid money pattern (positive only)
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    throw new Error('Invalid amount');
  }

  const paise = stringToPaise(s);

  if (paise <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  return paise;
}
