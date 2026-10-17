/**
 * Withdrawal staff service – verify / mark-paid / reject flow.
 *
 * Two-step approval flow:
 *   pending -> employee_approved -> paid
 *   or direct admin approval: pending -> paid (audited as withdrawal_paid_direct)
 *   rejection supported at either stage (refunds held amount to winning wallet).
 *   employee can reject only pending; admin can reject both.
 */

import type { PoolClient } from 'pg';
import {
  ErrorCodes,
  paiseToString,
  stringToPaise,
} from '@booyah/shared';
import { query, withTransaction } from '../../db/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import { writeAuditLog } from '../../utils/audit.js';
import { creditWallet } from './wallet.service.js';

export interface StaffWithdrawalDto {
  id: string;
  userId: string;
  userName?: string;
  userEmail: string;
  amount: string;
  upiId: string;
  status: 'pending' | 'employee_approved' | 'paid' | 'rejected';
  rejectReason: string | null;
  payoutRef: string | null;
  createdAt: string;
  processedAt: string | null;
  processedBy: string | null;
  employeeReviewedAt: string | null;
  employeeReviewedBy: string | null;
}

function rowToDto(row: any): StaffWithdrawalDto {
  return {
    id:                 row.id.toString(),
    userId:             row.user_id.toString(),
    userName:           row.user_name || undefined,
    userEmail:          row.user_email,
    amount:             paiseToString(stringToPaise(row.amount.toString())),
    upiId:              row.upi_id,
    status:             row.status,
    rejectReason:       row.reject_reason ?? null,
    payoutRef:          row.payout_ref ?? null,
    createdAt:          row.created_at.toISOString(),
    processedAt:        row.processed_at ? row.processed_at.toISOString() : null,
    processedBy:        row.processed_by ? row.processed_by.toString() : null,
    employeeReviewedAt: row.employee_reviewed_at ? row.employee_reviewed_at.toISOString() : null,
    employeeReviewedBy: row.employee_reviewed_by ? row.employee_reviewed_by.toString() : null,
  };
}

/** List withdrawals (staff view), oldest first. */
export async function listWithdrawalsStaff(params: {
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: StaffWithdrawalDto[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(params.limit || 20, 1), 100);

  let sql = `
    SELECT wr.id, wr.user_id, u.name AS user_name, u.email AS user_email, wr.amount, wr.upi_id,
           wr.status, wr.reject_reason, wr.payout_ref,
           wr.created_at, wr.processed_at, wr.processed_by,
           wr.employee_reviewed_at, wr.employee_reviewed_by
    FROM withdrawal_requests wr
    JOIN users u ON u.id = wr.user_id
    WHERE 1=1
  `;
  const values: any[] = [];
  let pIdx = 1;

  if (params.status) {
    sql += ` AND wr.status = $${pIdx}`;
    values.push(params.status);
    pIdx++;
  }

  if (params.cursor) {
    sql += ` AND wr.id > $${pIdx}`;
    values.push(params.cursor);
    pIdx++;
  }

  sql += ` ORDER BY wr.id ASC LIMIT $${pIdx}`;
  values.push(limit + 1);

  const res = await query(sql, values);
  const hasNext = res.rows.length > limit;
  const rows = hasNext ? res.rows.slice(0, limit) : res.rows;
  const nextCursor = hasNext ? rows[rows.length - 1].id.toString() : null;

  return { items: rows.map(rowToDto), nextCursor };
}

/** Verify a withdrawal (Step 1 by Employee). */
export async function verifyWithdrawal(
  staffId: string,
  staffEmail: string,
  staffRole: string,
  withdrawalId: string
): Promise<void> {
  // Requirement 4: /verify is for employees only; admin gets 403 ADMINS_APPROVE_DIRECTLY
  if (staffRole === 'admin') {
    throw new AppError(
      ErrorCodes.ADMINS_APPROVE_DIRECTLY,
      'Admins approve directly',
      403
    );
  }

  await withTransaction(async (client: PoolClient) => {
    const wrRes = await client.query(
      `SELECT wr.id, wr.user_id, wr.status, u.email AS user_email
       FROM withdrawal_requests wr
       JOIN users u ON u.id = wr.user_id
       WHERE wr.id = $1
       FOR UPDATE OF wr`,
      [withdrawalId]
    );

    if (wrRes.rowCount === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Withdrawal not found', 404);
    }

    const wr = wrRes.rows[0];

    if (wr.status !== 'pending') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, `Withdrawal already ${wr.status}`, 409);
    }

    // Staff cannot verify own withdrawal
    if (wr.user_email.toLowerCase() === staffEmail.toLowerCase()) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Staff cannot verify their own withdrawal',
        403
      );
    }

    await client.query(
      `UPDATE withdrawal_requests
       SET status = 'employee_approved', employee_reviewed_by = $1, employee_reviewed_at = now()
       WHERE id = $2`,
      [staffId, withdrawalId]
    );

    await writeAuditLog(client, {
      staffId,
      action: 'withdrawal_verified',
      targetType: 'withdrawal_requests',
      targetId: withdrawalId,
      details: { stage: 'employee_approved', userId: wr.user_id.toString() },
    });
  });
}

/** Mark a withdrawal as paid (Admin only final approval). */
export async function markWithdrawalPaid(
  staffId: string,
  staffEmail: string,
  staffRole: string,
  withdrawalId: string,
  payoutRef: string
): Promise<void> {
  // Only admin may execute final approval and mark paid
  if (staffRole !== 'admin') {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      'Only administrators can mark withdrawals as paid',
      403
    );
  }

  if (!payoutRef || payoutRef.trim().length === 0) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'payoutRef is required', 400);
  }

  await withTransaction(async (client: PoolClient) => {
    const wrRes = await client.query(
      `SELECT wr.id, wr.user_id, wr.amount, wr.status, u.email AS user_email
       FROM withdrawal_requests wr
       JOIN users u ON u.id = wr.user_id
       WHERE wr.id = $1
       FOR UPDATE OF wr`,
      [withdrawalId]
    );

    if (wrRes.rowCount === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Withdrawal not found', 404);
    }

    const wr = wrRes.rows[0];

    if (wr.status !== 'pending' && wr.status !== 'employee_approved') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, `Withdrawal already ${wr.status}`, 409);
    }

    // Staff cannot process own withdrawal
    if (wr.user_email.toLowerCase() === staffEmail.toLowerCase()) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Staff cannot mark their own withdrawal as paid',
        403
      );
    }

    const amountPaise = stringToPaise(wr.amount.toString());
    const isDirect = wr.status === 'pending';

    // If direct approval from pending, employee_reviewed_by/employee_reviewed_at remain NULL
    await client.query(
      `UPDATE withdrawal_requests
       SET status = 'paid', payout_ref = $1, processed_by = $2, processed_at = now()
       WHERE id = $3`,
      [payoutRef.trim(), staffId, withdrawalId]
    );

    await writeAuditLog(client, {
      staffId,
      action: isDirect ? 'withdrawal_paid_direct' : 'withdrawal_paid',
      targetType: 'withdrawal_requests',
      targetId: withdrawalId,
      details: {
        payoutRef: payoutRef.trim(),
        amount: paiseToString(amountPaise),
        stage: wr.status,
        direct: isDirect,
      },
    });
  });
}

/** Reject a withdrawal and refund to winning wallet. */
export async function rejectWithdrawal(
  staffId: string,
  arg2: string,
  arg3: string,
  arg4?: string,
  arg5?: string
): Promise<void> {
  let staffEmail = '';
  let staffRole = 'admin';
  let withdrawalId = '';
  let reason = '';

  if (arg4 !== undefined && arg5 !== undefined) {
    // 5 arguments: (staffId, staffEmail, staffRole, withdrawalId, reason)
    staffEmail = arg2;
    staffRole = arg3;
    withdrawalId = arg4;
    reason = arg5;
  } else if (arg4 !== undefined) {
    // 4 arguments: (staffId, staffEmail, withdrawalId, reason)
    staffEmail = arg2;
    withdrawalId = arg3;
    reason = arg4;
    staffRole = 'admin';
  } else {
    // 3 arguments: (staffId, withdrawalId, reason)
    withdrawalId = arg2;
    reason = arg3;
    staffRole = 'admin';
  }

  if (!reason || reason.trim().length < 5) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Rejection reason must be at least 5 characters', 400);
  }

  await withTransaction(async (client: PoolClient) => {
    const wrRes = await client.query(
      `SELECT wr.id, wr.user_id, wr.amount, wr.status, u.email AS user_email
       FROM withdrawal_requests wr
       JOIN users u ON u.id = wr.user_id
       WHERE wr.id = $1
       FOR UPDATE OF wr`,
      [withdrawalId]
    );

    if (wrRes.rowCount === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Withdrawal not found', 404);
    }

    const wr = wrRes.rows[0];

    if (wr.status !== 'pending' && wr.status !== 'employee_approved') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, `Withdrawal already ${wr.status}`, 409);
    }

    // Requirement 3: Employees may reject only pending; admin may reject employee_approved
    if (wr.status === 'employee_approved' && staffRole !== 'admin') {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Only administrators can reject requests awaiting final approval',
        403
      );
    }

    // Staff cannot process own withdrawal
    if (wr.user_email.toLowerCase() === staffEmail.toLowerCase()) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Staff cannot reject their own withdrawal',
        403
      );
    }

    const userId = wr.user_id.toString();
    const amountPaise = stringToPaise(wr.amount.toString());

    // Lock user wallet
    await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);

    // Refund to winning
    await creditWallet(
      client, userId, 'winning', amountPaise,
      'withdrawal_refund', 'withdrawal', withdrawalId
    );

    await client.query(
      `UPDATE withdrawal_requests
       SET status = 'rejected', reject_reason = $1, processed_by = $2, processed_at = now()
       WHERE id = $3`,
      [reason.trim(), staffId, withdrawalId]
    );

    await writeAuditLog(client, {
      staffId,
      action: 'withdrawal_rejected',
      targetType: 'withdrawal_requests',
      targetId: withdrawalId,
      details: {
        reason: reason.trim(),
        amount: paiseToString(amountPaise),
        refunded: true,
        stage: wr.status,
      },
    });
  });
}
