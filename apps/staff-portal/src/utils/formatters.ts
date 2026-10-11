/**
 * String-only formatting utilities for Booyah Win Staff Portal
 *
 * Rules:
 * - Money is always formatted as strings with the Rs symbol; NEVER converted to JS Number.
 * - All dates are shown in IST (Asia/Kolkata).
 * - Exact boundary checks:
 *   Deposit overdue: strictly > 30 minutes (30 is false, 30.01 is true).
 *   Withdrawal overdue: strictly > 1440 minutes (1440 is false, 1440.01 is true).
 *   null or undefined values safely return false.
 */

/**
 * Formats a 2-decimal rupee string into Indian numbering format without floating-point arithmetic.
 * e.g. "1234567.89" -> "Rs12,34,567.89"
 */
export function formatIndianRupees(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return 'Rs0.00';
  const cleanStr =
    typeof val === 'number'
      ? (Number.isInteger(val) ? (val / 100).toFixed(2) : val.toFixed(2))
      : String(val).trim();
  if (!cleanStr) return 'Rs0.00';

  const isNeg = cleanStr.startsWith('-');
  const clean = isNeg ? cleanStr.slice(1) : cleanStr;

  const [intPart = '0', decPart = '00'] = clean.split('.');
  const paddedDec = (decPart + '00').slice(0, 2);

  // Indian thousand grouping: last 3 digits, then groups of 2
  let result = '';
  if (intPart.length <= 3) {
    result = intPart;
  } else {
    const lastThree = intPart.slice(-3);
    const remaining = intPart.slice(0, -3);
    const paired = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    result = `${paired},${lastThree}`;
  }

  return `${isNeg ? '-' : ''}Rs${result}.${paddedDec}`;
}

/**
 * Formats an ISO date string in Indian Standard Time (Asia/Kolkata).
 */
export function formatISTDate(isoStr: string | null | undefined): string {
  if (!isoStr) return '—';
  try {
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '—';
  }
}

/**
 * Formats age in minutes into human-readable string.
 * Handles decimal values and null safely.
 */
export function formatAgeMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 0) return '0m';

  if (minutes < 60) {
    // Show single decimal if fractional, or integer
    const formatted = Math.round(minutes * 10) / 10;
    return `${formatted}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMins = Math.floor(minutes % 60);
  if (remainingMins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMins}m`;
}

/**
 * Deposit highlight boundary test:
 * Strictly over 30 minutes (30 is false, 30.01 is true).
 * null / undefined returns false.
 */
export function isDepositOverdue(minutes: number | null | undefined): boolean {
  if (minutes === null || minutes === undefined) return false;
  return minutes > 30;
}

/**
 * Withdrawal highlight boundary test:
 * Strictly over 1440 minutes / 24 hours (1440 is false, 1440.01 is true).
 * null / undefined returns false.
 */
export function isWithdrawalOverdue(minutes: number | null | undefined): boolean {
  if (minutes === null || minutes === undefined) return false;
  return minutes > 1440;
}

// ─── Ordinals & Position Labels (Requirement 8) ─────────────────────────────

export { getOrdinal, getPositionLabel } from '@booyah/shared';

// ─── IST Datetime Builder (Change 7) ─────────────────────────────────────────

/**
 * Builds an ISO 8601 string with fixed +05:30 timezone offset from date and time text.
 * Strictly avoids browser local timezone conversions.
 * e.g. ("2026-10-15", "16:30") -> "2026-10-15T16:30:00+05:30"
 */
export function buildISTIsoString(dateText: string, timeText?: string): string {
  let d = dateText ? String(dateText).trim() : '';
  let t = timeText ? String(timeText).trim() : '';

  if (!t && d.includes('T')) {
    const parts = d.split('T');
    d = parts[0];
    t = parts[1];
  }

  if (!d || !t) return '';

  const timeParts = t.split(':');
  const hh = timeParts[0].padStart(2, '0');
  const mm = (timeParts[1] || '00').padStart(2, '0');
  const ss = (timeParts[2] || '00').padStart(2, '0');

  return `${d}T${hh}:${mm}:${ss}+05:30`;
}

/**
 * Checks whether an ISO string with offset represents a point in the future.
 */
export function isFutureIST(isoWithOffset: string): boolean {
  if (!isoWithOffset) return false;
  const targetTime = new Date(isoWithOffset).getTime();
  if (isNaN(targetTime)) return false;
  return targetTime > Date.now();
}

// ─── Clipboard Helper with Fallback (Change 10) ─────────────────────────────

/**
 * Copies text to clipboard with legacy fallback. Never logs secrets.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

