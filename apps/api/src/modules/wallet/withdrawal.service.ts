/**
 * Withdrawal service – user-facing.
 *
 * Change #4 – correct operation order inside the transaction:
 *   1. Lock wallet FOR UPDATE
 *   2. Check winning balance
 *   3. INSERT withdrawal_requests → get id
 *   4. Debit winning with ref_id = withdrawal id
 *   (Never UPDATE ledger rows.)
 *
 * Change #5 – 23505 mapped by constraint name:
 *   withdrawal_requests_user_pending_unique → WITHDRAWAL_PENDING
 */

import type { PoolClient } from 'pg';
import {
  ErrorCodes,
  formatDbNumeric,
  paiseToString,
  parseMoney,
  stringToPaise,
} from '@booyah/shared';
import { query, withTransaction } from '../../db/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import { debitWallet } from './wallet.service.js';

const MIN_WITHDRAWAL_PAISE = 5000; // ₹50
const UPI_LOCK_HOURS = 48;

export interface WithdrawalDto {
  id: string;
  amount: string;
  upiId: string;
  status: 'pending' | 'paid' | 'rejected';
  rejectReason: string | null;
  payoutRef: string | null;
  createdAt: string;
  processedAt: string | null;
}

function rowToDto(row: any): WithdrawalDto {
  return {
    id:           row.id.toString(),
    amount:       paiseToString(stringToPaise(row.amount.toString())),
    upiId:        row.upi_id,
    status:       row.status,
    rejectReason: row.reject_reason ?? null,
    payoutRef:    row.payout_ref ?? null,
    createdAt:    row.created_at.toISOString(),
    processedAt:  row.processed_at ? row.processed_at.toISOString() : null,
  };
}

export async function requestWithdrawal(
  userId: string,
  storedUpiId: string,
  upiChangedAt: Date | null,
  rawAmount: string,
  submittedUpiId: string,
  confirm: boolean
): Promise<WithdrawalDto> {
  if (confirm !== true) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'confirm must be true', 400);
  }

  if (submittedUpiId.toLowerCase() !== storedUpiId.toLowerCase()) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      'UPI ID does not match your saved UPI ID',
      400
    );
  }

  if (upiChangedAt) {
    const diffMs = Date.now() - new Date(upiChangedAt).getTime();
    if (diffMs < UPI_LOCK_HOURS * 60 * 60 * 1000) {
      throw new AppError(
        ErrorCodes.UPI_RECENTLY_CHANGED,
        'Withdrawals are blocked for 48 hours after a UPI ID change',
        403
      );
    }
  }

  let amountPaise: number;
  try {
    amountPaise = parseMoney(rawAmount);
  } catch (err: any) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, err.message, 400);
  }

  if (amountPaise < MIN_WITHDRAWAL_PAISE) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      `Minimum withdrawal is ₹${paiseToString(MIN_WITHDRAWAL_PAISE)}`,
      400
    );
  }

  return withTransaction(async (client: PoolClient) => {
    // Step 1: lock wallet FOR UPDATE first (spec §8.1 + change #4)
    await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);

    // Step 2: check winning balance
    const walletRes = await client.query(
      'SELECT winning FROM wallets WHERE user_id = $1',
      [userId]
    );
    if (!walletRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Wallet not found', 404);
    }
    const winningPaise = stringToPaise(walletRes.rows[0].winning.toString());

    if (amountPaise > winningPaise) {
      throw new AppError(
        ErrorCodes.LOW_BALANCE,
        'Withdrawal amount exceeds your winning balance',
        402
      );
    }

    // Step 3: INSERT withdrawal_requests first → get id (change #4)
    let wr: any;
    try {
      const wrRes = await client.query(
        `INSERT INTO withdrawal_requests (user_id, amount, upi_id)
         VALUES ($1, $2, $3)
         RETURNING id, amount, upi_id, status, reject_reason, payout_ref, created_at, processed_at`,
        [userId, formatDbNumeric(amountPaise), submittedUpiId]
      );
      wr = wrRes.rows[0];
    } catch (err: any) {
      if (err?.code === '23505') {
        // Change #5: map by constraint name
        if (err.constraint === 'withdrawal_requests_user_pending_unique') {
          throw new AppError(
            ErrorCodes.WITHDRAWAL_PENDING,
            'You already have a pending withdrawal',
            409
          );
        }
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Duplicate entry', 409);
      }
      throw err;
    }

    const withdrawalId = wr.id;

    // Step 4: debit winning with ref_id = withdrawalId (change #4, never UPDATE ledger)
    await debitWallet(
      client, userId, 'winning', amountPaise,
      'withdrawal_hold', 'withdrawal', withdrawalId
    );

    return rowToDto(wr);
  });
}

/** List own withdrawal requests, newest first. */
export async function listUserWithdrawals(
  userId: string,
  params: { limit?: number; cursor?: string }
): Promise<{ items: WithdrawalDto[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(params.limit || 20, 1), 100);

  let sql = `
    SELECT id, amount, upi_id, status, reject_reason, payout_ref, created_at, processed_at
    FROM withdrawal_requests
    WHERE user_id = $1
  `;
  const values: any[] = [userId];
  let p = 2;

  if (params.cursor) {
    sql += ` AND id < $${p}`;
    values.push(params.cursor);
    p++;
  }

  sql += ` ORDER BY id DESC LIMIT $${p}`;
  values.push(limit + 1);

  const res = await query(sql, values);
  const hasNext = res.rows.length > limit;
  const rows    = hasNext ? res.rows.slice(0, limit) : res.rows;
  const nextCursor = hasNext ? rows[rows.length - 1].id.toString() : null;

  return { items: rows.map(rowToDto), nextCursor };
}
