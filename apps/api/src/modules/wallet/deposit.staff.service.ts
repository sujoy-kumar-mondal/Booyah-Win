/**
 * Deposit staff service – verify / approve / reject flow.
 *
 * Two-step approval flow:
 *   pending -> employee_approved -> approved
 *   or direct admin approval: pending -> approved (audited as deposit_approved_direct)
 *   rejection supported at either stage (employee can reject only pending; admin can reject both).
 *
 * Approval lock order:
 *   1. Non-locking SELECT on deposit to get user_id
 *   2. Non-locking SELECT on referrals to find referrer_id
 *   3. SELECT deposit FOR UPDATE + re-verify status
 *   4. Lock both wallets in ascending user_id
 *   5. Credit add_money (via wallet.service which uses UPDATE RETURNING)
 *   6. creditReferralReward
 *   7. Update deposit status + audit log
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
import { getSignedUrl } from '../../utils/storage.js';
import { creditWallet, creditReferralReward } from './wallet.service.js';

export interface StaffDepositDto {
  id: string;
  userId: string;
  userEmail: string;
  amount: string;
  utr: string;
  screenshotUrl: string;
  status: 'pending' | 'employee_approved' | 'approved' | 'rejected';
  rejectReason: string | null;
  needsAdmin: boolean;
  pendingMinutes: number | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  employeeReviewedAt: string | null;
  employeeReviewedBy: string | null;
}

async function enrichRow(row: any): Promise<StaffDepositDto> {
  const signedUrl = await getSignedUrl(row.screenshot_url, 60);
  const pendingMinutes = (row.status === 'pending' || row.status === 'employee_approved')
    ? Math.floor((Date.now() - new Date(row.created_at).getTime()) / 60000)
    : null;
  return {
    id:                 row.id.toString(),
    userId:             row.user_id.toString(),
    userEmail:          row.user_email,
    amount:             paiseToString(stringToPaise(row.amount.toString())),
    utr:                row.utr,
    screenshotUrl:      signedUrl,
    status:             row.status,
    rejectReason:       row.reject_reason ?? null,
    needsAdmin:         row.needs_admin,
    pendingMinutes,
    createdAt:          row.created_at.toISOString(),
    reviewedAt:         row.reviewed_at ? row.reviewed_at.toISOString() : null,
    reviewedBy:         row.reviewed_by ? row.reviewed_by.toString() : null,
    employeeReviewedAt: row.employee_reviewed_at ? row.employee_reviewed_at.toISOString() : null,
    employeeReviewedBy: row.employee_reviewed_by ? row.employee_reviewed_by.toString() : null,
  };
}

/** List deposits (staff view), oldest first. */
export async function listDepositsStaff(params: {
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: StaffDepositDto[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(params.limit || 20, 1), 100);

  let sql = `
    SELECT dr.id, dr.user_id, u.email AS user_email, dr.amount, dr.utr,
           dr.screenshot_url, dr.status, dr.reject_reason, dr.needs_admin,
           dr.created_at, dr.reviewed_at, dr.reviewed_by,
           dr.employee_reviewed_at, dr.employee_reviewed_by
    FROM deposit_requests dr
    JOIN users u ON u.id = dr.user_id
    WHERE 1=1
  `;
  const values: any[] = [];
  let p = 1;

  if (params.status) {
    sql += ` AND dr.status = $${p}`;
    values.push(params.status);
    p++;
  }
  if (params.cursor) {
    sql += ` AND dr.id > $${p}`;
    values.push(params.cursor);
    p++;
  }

  sql += ` ORDER BY dr.id ASC LIMIT $${p}`;
  values.push(limit + 1);

  const res = await query(sql, values);
  const hasNext = res.rows.length > limit;
  const rows    = hasNext ? res.rows.slice(0, limit) : res.rows;
  const nextCursor = hasNext ? rows[rows.length - 1].id.toString() : null;

  const items = await Promise.all(rows.map(enrichRow));
  return { items, nextCursor };
}

/** Verify a deposit (Step 1 by Employee). */
export async function verifyDeposit(
  staffId: string,
  staffEmail: string,
  staffRole: string,
  depositId: string
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
    const depRes = await client.query(
      `SELECT dr.id, dr.user_id, dr.status, u.email AS user_email
       FROM deposit_requests dr
       JOIN users u ON u.id = dr.user_id
       WHERE dr.id = $1
       FOR UPDATE OF dr`,
      [depositId]
    );

    if (!depRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Deposit not found', 404);
    }

    const dep = depRes.rows[0];

    if (dep.status !== 'pending') {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        `Deposit already ${dep.status}`,
        409
      );
    }

    // Staff cannot verify own deposit
    if (dep.user_email.toLowerCase() === staffEmail.toLowerCase()) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Staff cannot verify their own deposit',
        403
      );
    }

    await client.query(
      `UPDATE deposit_requests
       SET status = 'employee_approved', employee_reviewed_by = $1, employee_reviewed_at = now()
       WHERE id = $2`,
      [staffId, depositId]
    );

    await writeAuditLog(client, {
      staffId,
      action: 'deposit_verified',
      targetType: 'deposit_requests',
      targetId: depositId,
      details: { stage: 'employee_approved', userId: dep.user_id.toString() },
    });
  });
}

/** Final approve a deposit (Admin only). */
export async function approveDeposit(
  staffId: string,
  staffEmail: string,
  staffRole: string,
  depositId: string
): Promise<void> {
  // Only admin may execute final approval
  if (staffRole !== 'admin') {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      'Only administrators can approve deposits',
      403
    );
  }

  await withTransaction(async (client: PoolClient) => {
    // ── Step 1: non-locking read to get user_id ──────────────────────────────
    const peekRes = await client.query(
      'SELECT user_id FROM deposit_requests WHERE id = $1',
      [depositId]
    );
    if (!peekRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Deposit not found', 404);
    }
    const userId = peekRes.rows[0].user_id.toString();

    // ── Step 2: non-locking read to find referrer_id ─────────────────────────
    const refRes = await client.query(
      `SELECT referrer_id FROM referrals WHERE referred_id = $1 AND credited_at IS NULL`,
      [userId]
    );
    const referrerId: string | null =
      refRes.rowCount ? refRes.rows[0].referrer_id.toString() : null;

    // ── Step 3: lock deposit FOR UPDATE and re-verify status ─────────────────
    const depRes = await client.query(
      `SELECT dr.id, dr.user_id, dr.amount, dr.status, dr.needs_admin,
              u.email AS user_email
       FROM deposit_requests dr
       JOIN users u ON u.id = dr.user_id
       WHERE dr.id = $1
       FOR UPDATE OF dr`,
      [depositId]
    );
    if (!depRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Deposit not found', 404);
    }
    const dep = depRes.rows[0];

    if (dep.status !== 'pending' && dep.status !== 'employee_approved') {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        `Deposit already ${dep.status}`,
        409
      );
    }

    // Staff email vs user email guard
    if (dep.user_email.toLowerCase() === staffEmail.toLowerCase()) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Staff cannot approve their own deposit',
        403
      );
    }

    const amountPaise = stringToPaise(dep.amount.toString());
    const isDirect = dep.status === 'pending';

    // ── Step 4: lock both wallets in ascending user_id ────────────────────────
    const lockIds = referrerId
      ? [userId, referrerId].sort((a, b) => Number(a) - Number(b))
      : [userId];

    for (const lid of lockIds) {
      await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [lid]);
    }

    // ── Step 5: credit depositor's add_money ──────────────────────────────────
    await creditWallet(
      client, userId, 'add_money', amountPaise,
      'add_money', 'deposit', depositId
    );

    // ── Step 6: referral reward (credited exactly once) ───────────────────────
    await creditReferralReward(client, userId);

    // ── Step 7: mark approved + audit ────────────────────────────────────────
    // If direct approval from pending, employee_reviewed_by/employee_reviewed_at remain NULL
    await client.query(
      `UPDATE deposit_requests
       SET status = 'approved', reviewed_by = $1, reviewed_at = now()
       WHERE id = $2`,
      [staffId, depositId]
    );

    await writeAuditLog(client, {
      staffId,
      action: isDirect ? 'deposit_approved_direct' : 'deposit_approved',
      targetType: 'deposit_requests',
      targetId: depositId,
      details: {
        amount: paiseToString(amountPaise),
        userId,
        stage: dep.status,
        direct: isDirect,
      },
    });
  });
}

/** Reject a deposit (Employee for pending; Admin for pending or employee_approved). */
export async function rejectDeposit(
  staffId: string,
  arg2: string,
  arg3: string,
  arg4?: string,
  arg5?: string
): Promise<void> {
  let staffEmail = '';
  let staffRole = 'admin';
  let depositId = '';
  let reason = '';

  if (arg4 !== undefined && arg5 !== undefined) {
    // 5 arguments: (staffId, staffEmail, staffRole, depositId, reason)
    staffEmail = arg2;
    staffRole = arg3;
    depositId = arg4;
    reason = arg5;
  } else if (arg4 !== undefined) {
    // 4 arguments: (staffId, staffEmail, depositId, reason)
    staffEmail = arg2;
    depositId = arg3;
    reason = arg4;
    staffRole = 'admin';
  } else {
    // 3 arguments: (staffId, depositId, reason)
    depositId = arg2;
    reason = arg3;
    staffRole = 'admin';
  }

  if (!reason || reason.trim().length < 5) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      'Rejection reason must be at least 5 characters',
      400
    );
  }

  await withTransaction(async (client: PoolClient) => {
    const depRes = await client.query(
      `SELECT dr.id, dr.status, dr.user_id, u.email AS user_email
       FROM deposit_requests dr
       JOIN users u ON u.id = dr.user_id
       WHERE dr.id = $1
       FOR UPDATE OF dr`,
      [depositId]
    );
    if (!depRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Deposit not found', 404);
    }
    const dep = depRes.rows[0];

    if (dep.status !== 'pending' && dep.status !== 'employee_approved') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, `Deposit already ${dep.status}`, 409);
    }

    // Requirement 3: Employees may reject only pending; admin may reject employee_approved
    if (dep.status === 'employee_approved' && staffRole !== 'admin') {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Only administrators can reject requests awaiting final approval',
        403
      );
    }

    // Staff cannot reject their own deposit
    if (dep.user_email.toLowerCase() === staffEmail.toLowerCase()) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Staff cannot reject their own deposit',
        403
      );
    }

    await client.query(
      `UPDATE deposit_requests
       SET status = 'rejected', reject_reason = $1, reviewed_by = $2, reviewed_at = now()
       WHERE id = $3`,
      [reason.trim(), staffId, depositId]
    );

    await writeAuditLog(client, {
      staffId,
      action: 'deposit_rejected',
      targetType: 'deposit_requests',
      targetId: depositId,
      details: { reason: reason.trim(), stage: dep.status },
    });
  });
}
