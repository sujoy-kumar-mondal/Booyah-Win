/**
 * Deposit staff service – approve / reject.
 *
 * Change #6 – approval lock order:
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
import { getDepositSettings } from './deposit.service.js';
import { creditWallet, creditReferralReward } from './wallet.service.js';

export interface StaffDepositDto {
  id: string;
  userId: string;
  userEmail: string;
  amount: string;
  utr: string;
  screenshotUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason: string | null;
  needsAdmin: boolean;
  pendingMinutes: number | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

async function enrichRow(row: any): Promise<StaffDepositDto> {
  const signedUrl = await getSignedUrl(row.screenshot_url, 60);
  const pendingMinutes = row.status === 'pending'
    ? Math.floor((Date.now() - new Date(row.created_at).getTime()) / 60000)
    : null;
  return {
    id:            row.id.toString(),
    userId:        row.user_id.toString(),
    userEmail:     row.user_email,
    amount:        paiseToString(stringToPaise(row.amount.toString())),
    utr:           row.utr,
    screenshotUrl: signedUrl,
    status:        row.status,
    rejectReason:  row.reject_reason ?? null,
    needsAdmin:    row.needs_admin,
    pendingMinutes,
    createdAt:     row.created_at.toISOString(),
    reviewedAt:    row.reviewed_at ? row.reviewed_at.toISOString() : null,
    reviewedBy:    row.reviewed_by ? row.reviewed_by.toString() : null,
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
           dr.created_at, dr.reviewed_at, dr.reviewed_by
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

/** Approve a deposit (change #6 lock order). */
export async function approveDeposit(
  staffId: string,
  staffEmail: string,
  staffRole: string,
  depositId: string
): Promise<void> {
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

    if (dep.status !== 'pending') {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        `Deposit already ${dep.status}`,
        409
      );
    }

    // Admin threshold check (re-read at approval time)
    const { thresholdPaise } = await getDepositSettings(client);
    const amountPaise = stringToPaise(dep.amount.toString());
    if ((dep.needs_admin || amountPaise >= thresholdPaise) && staffRole !== 'admin') {
      throw new AppError(
        ErrorCodes.ADMIN_APPROVAL_REQUIRED,
        'This deposit requires admin approval',
        403
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
    await client.query(
      `UPDATE deposit_requests
       SET status = 'approved', reviewed_by = $1, reviewed_at = now()
       WHERE id = $2`,
      [staffId, depositId]
    );

    await writeAuditLog(client, {
      staffId,
      action: 'deposit_approved',
      targetType: 'deposit_requests',
      targetId: depositId,
      details: { amount: paiseToString(amountPaise), userId },
    });
  });
}

/** Reject a deposit. */
export async function rejectDeposit(
  staffId: string,
  depositId: string,
  reason: string
): Promise<void> {
  if (!reason || reason.trim().length < 5) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      'Rejection reason must be at least 5 characters',
      400
    );
  }

  await withTransaction(async (client: PoolClient) => {
    const depRes = await client.query(
      `SELECT id, status FROM deposit_requests WHERE id = $1 FOR UPDATE`,
      [depositId]
    );
    if (!depRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Deposit not found', 404);
    }
    const dep = depRes.rows[0];
    if (dep.status !== 'pending') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, `Deposit already ${dep.status}`, 409);
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
      details: { reason: reason.trim() },
    });
  });
}
