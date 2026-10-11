/**
 * Currency & Date Formatters for Booyah Win User PWA
 * 
 * Rules:
 * - Pure string manipulation for Indian currency formatting.
 * - ZERO use of Number(), parseFloat(), parseInt(), or .toLocaleString().
 * - Dates rendered exclusively in IST (Asia/Kolkata).
 */

export function formatIndianRupees(amountStr: string | null | undefined): string {
  if (!amountStr || typeof amountStr !== 'string') {
    return 'Rs0.00';
  }

  const trimmed = amountStr.trim();
  if (!trimmed) {
    return 'Rs0.00';
  }

  const isNegative = trimmed.startsWith('-');
  const unsigned = isNegative ? trimmed.slice(1) : trimmed;

  const parts = unsigned.split('.');
  const rawInt = parts[0] || '0';
  const rawDec = parts[1] || '00';

  // Ensure exactly 2 decimal digits
  const dec = (rawDec + '00').slice(0, 2);

  // If integer part has 3 or fewer digits, no thousands grouping needed
  if (rawInt.length <= 3) {
    return `${isNegative ? '-' : ''}Rs${rawInt}.${dec}`;
  }

  const lastThree = rawInt.slice(-3);
  const rest = rawInt.slice(0, -3);

  // Group remaining digits into pairs of 2 from right to left
  let groupedRest = '';
  for (let i = rest.length; i > 0; i -= 2) {
    const start = Math.max(0, i - 2);
    const chunk = rest.slice(start, i);
    groupedRest = groupedRest ? `${chunk},${groupedRest}` : chunk;
  }

  return `${isNegative ? '-' : ''}Rs${groupedRest},${lastThree}.${dec}`;
}

/**
 * Format a UTC ISO timestamp to IST (Asia/Kolkata) string:
 * e.g. "15 Oct 2026, 04:30 PM"
 */
export function formatISTDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    const raw = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
    return raw.replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());
  } catch {
    return '';
  }
}

/**
 * Format availableAt timestamp into the standard cooldown message:
 * "Next change available on DD MMM YYYY, hh:mm A"
 */
export function formatCooldownMessage(availableAt: string | null | undefined): string | null {
  if (!availableAt) return null;
  const formatted = formatISTDateTime(availableAt);
  if (!formatted) return null;
  return `Next change available on ${formatted}`;
}
