import { formatStaffId, formatUserId } from '@booyah/shared';

export type Queryable =
  | { query: (text: string, params?: any[]) => Promise<any> }
  | ((text: string, params?: any[]) => Promise<any>);

export interface AuditLogParams {
  staffId: string | number;
  action: string;
  targetType?: string;
  targetId?: string | number;
  details?: Record<string, unknown>;
}

/**
 * Sanitizes audit log details so that PAN, Aadhaar, OTPs, or tokens
 * are never stored in plaintext (Rule #4), and ensures User IDs
 * and Staff IDs are always formatted with prefixes (e.g. BW-USR-2, BW-STF-1).
 */
export function sanitizeAuditDetails(
  details?: Record<string, unknown> | string | null
): Record<string, unknown> | null {
  if (!details) return null;
  let raw: Record<string, unknown>;
  if (typeof details === 'string') {
    try {
      raw = JSON.parse(details);
    } catch {
      return null;
    }
  } else if (typeof details === 'object' && !Array.isArray(details)) {
    raw = details as Record<string, unknown>;
  } else {
    return null;
  }
  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('pan') ||
      lowerKey.includes('aadhaar') ||
      lowerKey.includes('token') ||
      lowerKey.includes('otp') ||
      lowerKey.includes('password')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (
      (lowerKey === 'userid' ||
        lowerKey === 'vieweduserid' ||
        lowerKey === 'targetuserid' ||
        lowerKey === 'referredby' ||
        lowerKey === 'referrerid' ||
        lowerKey === 'referredid') &&
      val !== null &&
      val !== undefined &&
      val !== ''
    ) {
      sanitized[key] = formatUserId(String(val));
    } else if (
      (lowerKey === 'adminid' ||
        lowerKey === 'staffid' ||
        lowerKey === 'deletedby') &&
      val !== null &&
      val !== undefined &&
      val !== ''
    ) {
      sanitized[key] = formatStaffId(String(val));
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      sanitized[key] = sanitizeAuditDetails(val as Record<string, unknown>);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

/**
 * Writes an append-only audit row in the same transaction or client pool (Rule #9).
 * Guarantees that staff IDs and User IDs are stored in the database with their
 * standard prefixes (BW-STF-1 and BW-USR-2).
 */
export async function writeAuditLog(
  clientOrPool: Queryable,
  params: AuditLogParams
): Promise<void> {
  const sanitized = sanitizeAuditDetails(params.details);
  const queryFn =
    typeof clientOrPool === 'function'
      ? clientOrPool
      : clientOrPool.query.bind(clientOrPool);

  const formattedStaffId = formatStaffId(params.staffId);
  const targetType = params.targetType ?? null;

  let formattedTargetId: string | null = null;
  if (params.targetId !== undefined && params.targetId !== null && params.targetId !== '') {
    if (targetType === 'user') {
      formattedTargetId = formatUserId(params.targetId);
    } else if (targetType === 'staff' || targetType === 'employee') {
      formattedTargetId = formatStaffId(params.targetId);
    } else {
      formattedTargetId = String(params.targetId);
    }
  }

  await queryFn(
    `INSERT INTO audit_logs (staff_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      formattedStaffId,
      params.action,
      targetType,
      formattedTargetId,
      sanitized ? JSON.stringify(sanitized) : null,
    ]
  );
}
