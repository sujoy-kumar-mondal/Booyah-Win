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
 * are never stored in plaintext (Rule #4).
 */
export function sanitizeAuditDetails(
  details?: Record<string, unknown>
): Record<string, unknown> | null {
  if (!details) return null;
  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(details)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('pan') ||
      lowerKey.includes('aadhaar') ||
      lowerKey.includes('token') ||
      lowerKey.includes('otp') ||
      lowerKey.includes('password')
    ) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

/**
 * Writes an append-only audit row in the same transaction or client pool (Rule #9).
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

  await queryFn(
    `INSERT INTO audit_logs (staff_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      params.staffId,
      params.action,
      params.targetType ?? null,
      params.targetId ? String(params.targetId) : null,
      sanitized ? JSON.stringify(sanitized) : null,
    ]
  );
}
