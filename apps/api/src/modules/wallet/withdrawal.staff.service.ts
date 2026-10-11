/**
 * Withdrawal staff service – mark-paid / reject flow.
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
import { getDepositSettings } from './deposit.service.js';
import { creditWallet } from './wallet.service.js';

export interface StaffWithdrawalDto {
  id: string;
  userId: string;
  userEmail: string;
  amount: string;
  upiId: string;
  status: 'pending' | 'paid' | 'rejected';
  rejectReason: string | null;
  payoutRef: string | null;
  createdAt: string;
  processedAt: string | null;
  processedBy: string | null;
}

function rowToDto(row: any): StaffWithdrawalDto {
  return {
    id:           row.id.toString(),
    userId:       row.user_id.toString(),
    userEmail:    row.user_email,
    amount:       paiseToString(stringToPaise(row.amount.toString())),
    upiId:        row.upi_id,
    status:       row.status,
    rejectReason: row.reject_reason ?? null,
    payoutRef:    row.payout_ref ?? null,
    createdAt:    row.created_at.toISOString(),
    processedAt:  row.processed_at ? row.processed_at.toISOString() : null,
    processedBy:  row.processed_by ? row.processed_by.toString() : null,
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
    SELECT wr.id, wr.user_id, u.email AS user_email, wr.amount, wr.upi_id,
           wr.status, wr.reject_reason, wr.payout_ref,
           wr.created_at, wr.processed_at, wr.processed_by
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

/** Mark a withdrawal as paid. */
export async function markWithdrawalPaid(
  staffId: string,
  staffEmail: string,
  staffRole: string,
  withdrawalId: string,
  payoutRef: string
): Promise<void> {
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

    if (wr.status !== 'pending') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, `Withdrawal already ${wr.status}`, 409);
    }

    // Admin threshold check
    const { thresholdPaise } = await getDepositSettings(client);
    const amountPaise = stringToPaise(wr.amount.toString());
    if (amountPaise >= thresholdPaise && staffRole !== 'admin') {
      throw new AppError(
        ErrorCodes.ADMIN_APPROVAL_REQUIRED,
        'This withdrawal requires admin approval to mark as paid',
        403
      );
    }

    // Staff cannot process own withdrawal
    if (wr.user_email.toLowerCase() === staffEmail.toLowerCase()) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Staff cannot mark their own withdrawal as paid',
        403
      );
    }

    await client.query(
      `UPDATE withdrawal_requests
       SET status = 'paid', payout_ref = $1, processed_by = $2, processed_at = now()
       WHERE id = $3`,
      [payoutRef.trim(), staffId, withdrawalId]
    );

    await writeAuditLog(client, {
      staffId,
      action: 'withdrawal_paid',
      targetType: 'withdrawal_requests',
      targetId: withdrawalId,
      details: { payoutRef: payoutRef.trim(), amount: paiseToString(amountPaise) },
    });
  });
}

/** Reject a withdrawal and refund to winning wallet. */
export async function rejectWithdrawal(
  staffId: string,
  staffEmail: string,
  withdrawalId: string,
  reason: string
): Promise<void> {
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

    if (wr.status !== 'pending') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, `Withdrawal already ${wr.status}`, 409);
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
      details: { reason: reason.trim(), amount: paiseToString(amountPaise), refunded: true },
    });
  });
}
