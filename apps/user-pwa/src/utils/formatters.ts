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
      numberingSystem: 'latn',
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

/**
 * Formats signed transaction amount with +/- sign and accessible label.
 * Requirement 12: Credits and debits carry the +/- sign and an accessible label, not color alone.
 */
export function formatSignedRupees(amountStr: string | null | undefined): {
  text: string;
  isCredit: boolean;
  accessibleLabel: string;
} {
  if (!amountStr || typeof amountStr !== 'string') {
    return { text: 'Rs0.00', isCredit: true, accessibleLabel: 'Zero rupees' };
  }
  const trimmed = amountStr.trim();
  const isDebit = trimmed.startsWith('-');
  const clean = isDebit ? trimmed.slice(1) : trimmed;
  const formatted = formatIndianRupees(clean);

  if (isDebit) {
    return {
      text: `-${formatted}`,
      isCredit: false,
      accessibleLabel: `Debit of ${formatted}`,
    };
  }

  // Pure zero check
  if (clean === '0' || clean === '0.00' || clean === '00' || clean === '0.0') {
    return {
      text: formatted,
      isCredit: true,
      accessibleLabel: 'Zero rupees',
    };
  }

  return {
    text: `+${formatted}`,
    isCredit: true,
    accessibleLabel: `Credit of ${formatted}`,
  };
}

/**
 * Safely parses a 2-decimal money string into integer paise using BigInt.
 * Strictly avoids Number(), parseFloat(), and floating point arithmetic.
 */
export function parseRupeesToPaiseBigInt(val: string | null | undefined): bigint {
  if (!val || typeof val !== 'string') return 0n;
  const trimmed = val.trim();
  if (!trimmed || !/^-?\d+(\.\d{1,2})?$/.test(trimmed)) return 0n;

  const isNeg = trimmed.startsWith('-');
  const clean = isNeg ? trimmed.slice(1) : trimmed;
  const [intPart, decPart = ''] = clean.split('.');
  const decPadded = (decPart + '00').slice(0, 2);
  const paise = BigInt(intPart || '0') * 100n + BigInt(decPadded);
  return isNeg ? -paise : paise;
}

/**
 * Checks if total balance is strictly less than the entry fee.
 * Compares integer paise via BigInt, never Number().
 */
export function isTotalBelowFee(
  totalRupees: string | null | undefined,
  feeRupees: string | null | undefined
): boolean {
  if (!feeRupees) return false;
  const totalPaise = parseRupeesToPaiseBigInt(totalRupees);
  const feePaise = parseRupeesToPaiseBigInt(feeRupees);
  return totalPaise < feePaise;
}

/**
 * Formats game mode for user display (e.g. "BATTLE_ROYALE" -> "BATTLE ROYALE", "battle_royale" -> "Battle Royale").
 * Replaces underscores with spaces so no raw enum underscores are shown to players.
 */
export function formatGameMode(mode: string | null | undefined): string {
  if (!mode) return '';
  const withSpaces = mode.replace(/_/g, ' ').trim();
  if (withSpaces === withSpaces.toLowerCase()) {
    return withSpaces
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return withSpaces;
}

/**
 * Formats weekly leaderboard date range in IST:
 * e.g. "Mon, 13 Oct – Sun, 19 Oct IST"
 */
export function formatWeekRange(
  weekStartIso: string | null | undefined,
  weekEndIso: string | null | undefined
): string {
  if (!weekStartIso || !weekEndIso) return '';
  try {
    const s = new Date(weekStartIso);
    const e = new Date(weekEndIso);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';

    const fmt = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      numberingSystem: 'latn',
    });
    return `${fmt.format(s)} – ${fmt.format(e)} IST`;
  } catch {
    return '';
  }
}

/**
 * Formats match status for user display (e.g. "room_open" -> "ROOM OPEN", "upcoming" -> "UPCOMING", "live" -> "LIVE").
 * Replaces underscores with spaces so no raw enum underscores are shown to players.
 */
export function formatMatchStatus(status: string | null | undefined): string {
  if (!status) return '';
  return status.replace(/_/g, ' ').trim().toUpperCase();
}

/**
 * Formats a Date of Birth string (YYYY-MM-DD) into a clean, human-readable date:
 * e.g. "2003-07-15" -> "15 Jul 2003"
 */
export function formatDateOfBirth(dob: string | null | undefined): string {
  if (!dob) return '—';
  const trimmed = dob.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    const [, y, m, d] = match;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(m, 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${parseInt(d, 10)} ${months[monthIndex]} ${y}`;
    }
  }
  return trimmed || '—';
}

/**
 * Extracts initials from a user's full name.
 * e.g. "sujoy kumar mondal" -> "SKM"
 * e.g. "Pro Player" -> "PP"
 */
export function getUserInitials(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return 'BW';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'BW';
  const initials = parts.map((p) => p[0].toUpperCase()).join('');
  return initials.slice(0, 4) || 'BW';
}

/**
 * Calculates remaining time until match start:
 * e.g. "in 51m", "in 3h", "in 2d", or "Live" if already started
 */
export function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const target = new Date(isoString).getTime();
    if (isNaN(target)) return '';
    const now = Date.now();
    const diffMs = target - now;

    if (diffMs <= 0) {
      return 'Live';
    }

    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) {
      return `in ${Math.max(1, diffMins)}m`;
    }

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `in ${diffHours}h`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `in ${diffDays}d`;
  } catch {
    return '';
  }
}

/**
 * Formats match start time for card badge:
 * e.g. "Today 6:30 PM", "Tomorrow 9:00 PM", or "15 Oct 6:30 PM"
 */
export function formatMatchTimeBadge(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const target = new Date(isoString);
    if (isNaN(target.getTime())) return '';

    // IST date comparison
    const now = new Date();
    const targetIST = new Date(target.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

    const isToday =
      targetIST.getDate() === nowIST.getDate() &&
      targetIST.getMonth() === nowIST.getMonth() &&
      targetIST.getFullYear() === nowIST.getFullYear();

    const tomorrow = new Date(nowIST);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      targetIST.getDate() === tomorrow.getDate() &&
      targetIST.getMonth() === tomorrow.getMonth() &&
      targetIST.getFullYear() === tomorrow.getFullYear();

    const timeStr = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      numberingSystem: 'latn',
    }).format(target).replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());

    if (isToday) return `Today ${timeStr}`;
    if (isTomorrow) return `Tomorrow ${timeStr}`;

    const dateStr = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      numberingSystem: 'latn',
    }).format(target);

    return `${dateStr} ${timeStr}`;
  } catch {
    return formatISTDateTime(isoString);
  }
}

/**
 * Returns integer rupees without decimal digits if .00:
 * e.g. "1340.00" -> "1340", "5.00" -> "5", "12.50" -> "12.50"
 */
export function formatCompactRupees(amountStr: string | null | undefined): string {
  if (!amountStr || typeof amountStr !== 'string') return '0';
  const clean = amountStr.trim().replace(/^Rs/i, '').trim();
  if (clean.endsWith('.00')) {
    return clean.slice(0, -3);
  }
  return clean;
}



