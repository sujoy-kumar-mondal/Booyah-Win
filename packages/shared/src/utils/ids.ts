/**
 * Standard ID Formatting and Parsing Utilities for Booyah Win
 *
 * Rules:
 * Match       → BW-MCH-<matchnumber>
 * Withdrawal  → BW-WDL-<withdrawalnumber>
 * Deposit     → BW-DPT-<depositnumber>
 * Transaction → BW-TRX-<transactionnumber>
 * User        → BW-USR-<usernumber>
 * Staff       → BW-STF-<staffnumber>
 */

export function formatMatchId(id: string | number | null | undefined): string {
  if (id === null || id === undefined || id === '') return '';
  const clean = String(id).replace(/^(BW-(?:MAT|MCH)-|M|#)/i, '').trim();
  return clean ? `BW-MCH-${clean}` : '';
}

export function formatTransactionId(id: string | number | null | undefined): string {
  if (id === null || id === undefined || id === '') return '';
  // Strips existing prefixes like BW-0000154, BW-TRX-, TRX-, BW-DPT-, DPT-, BW-WDL-, etc.
  const clean = String(id).replace(/^(?:BW-(?:TRX|TXN|DPT|DEP|WDL|WTH)-|TRX-|TXN-|DEP-|DPT-|WTH-|WDL-|T|#|BW-0*)/i, '').trim();
  return clean ? `BW-TRX-${clean}` : '';
}

export const formatDepositId = formatTransactionId;
export const formatWithdrawalId = formatTransactionId;

export function formatUserId(id: string | number | null | undefined): string {
  if (id === null || id === undefined || id === '') return '';
  const clean = String(id).replace(/^(BW-(?:USR)-|USR-|U|#)/i, '').trim();
  return clean ? `BW-USR-${clean}` : '';
}

/**
 * Parses a User ID string (e.g. "BW-USR-10", "bw-usr-10", "USR-10") into its numeric ID.
 * Returns null if the input does not match a User ID pattern.
 */
export function parseUserId(idStr: string | null | undefined): number | null {
  if (!idStr) return null;
  const clean = String(idStr).trim();
  const match = clean.match(/^(?:BW-)?(?:USR-)+(\d+)$/i) || clean.match(/^(?:BW-USR-)+(\d+)$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  if (isNaN(num) || !Number.isSafeInteger(num) || num <= 0) return null;
  return num;
}

export function formatStaffId(id: string | number | null | undefined): string {
  if (id === null || id === undefined || id === '') return '';
  const clean = String(id).replace(/^(BW-(?:STF)-|STF-|S|#)/i, '').trim();
  return clean ? `BW-STF-${clean}` : '';
}

/**
 * Formats a ledger reference ID based on its ref_type and ledger transaction type.
 * e.g. ref_type = 'admin_adjustment' -> 'BW-STF-1'
 *      ref_type = 'match'            -> 'BW-MCH-53'
 *      ref_type = 'deposit'          -> 'BW-DPT-12'
 *      ref_type = 'withdrawal'       -> 'BW-WDL-5'
 *      ref_type = 'referral'         -> 'BW-USR-2'
 */
export function formatLedgerRefId(
  refId: string | number | null | undefined,
  type?: string | null,
  refType?: string | null
): string {
  if (refId === null || refId === undefined || refId === '') return '';
  const str = String(refId).trim();
  const upper = str.toUpperCase();
  const normRef = (refType || '').toLowerCase();
  const normType = (type || '').toLowerCase();

  // Deposits and withdrawals are transactions themselves; they don't have a separate ref ID
  if (
    normRef === 'deposit' ||
    normType === 'add_money' ||
    normRef === 'withdrawal' ||
    normType === 'withdrawal_hold' ||
    normType === 'withdrawal_refund' ||
    upper.startsWith('BW-DPT-') ||
    upper.startsWith('BW-WDL-')
  ) {
    return '';
  }

  if (
    upper.startsWith('BW-MCH-') ||
    upper.startsWith('BW-USR-') ||
    upper.startsWith('BW-TRX-') ||
    upper.startsWith('BW-STF-')
  ) {
    return str;
  }

  if (normRef === 'admin_adjustment' || normType === 'admin_adjustment' || normRef === 'staff') {
    return formatStaffId(str);
  }
  if (normRef === 'match' || normType === 'refund' || normType === 'join_fee' || normType === 'winning') {
    return formatMatchId(str);
  }
  if (
    normRef === 'referral' ||
    normType === 'referral' ||
    normRef === 'user' ||
    normRef === 'joining_reward' ||
    normType === 'joining_reward'
  ) {
    return formatUserId(str);
  }
  return str;
}

/**
 * Extracts raw entity number from any ID string (e.g. "BW-MCH-53" -> "53", "BW-USR-10" -> "10")
 */
export function parseEntityNumber(idStr: string | null | undefined): string {
  if (!idStr) return '';
  const match = String(idStr).match(/\d+/);
  return match ? match[0] : '';
}

