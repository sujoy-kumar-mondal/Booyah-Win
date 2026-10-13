/**
 * Deposit service – user-facing.
 *
 * Change #1: wallet row is locked FOR UPDATE BEFORE counting pending deposits,
 *            so 10 simultaneous requests are serialised and the limit is exact.
 * Change #5: 23505 errors are mapped by constraint name, no pre-check SELECT.
 * Change #7: uploaded file is deleted on every failure path after upload.
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
import { uploadScreenshot, deleteFile } from '../../utils/storage.js';

const UTR_RE = /^[A-Za-z0-9]{10,25}$/;
const MAX_PENDING = 3;

export interface DepositDto {
  id: string;
  amount: string;
  utr: string;
  screenshotUrl: string;
  status: 'pending' | 'employee_approved' | 'approved' | 'rejected';
  rejectReason: string | null;
  needsAdmin: boolean;
  createdAt: string;
  reviewedAt: string | null;
}

function rowToDto(row: any): DepositDto {
  return {
    id:            row.id.toString(),
    amount:        paiseToString(stringToPaise(row.amount.toString())),
    utr:           row.utr,
    screenshotUrl: row.screenshot_url,
    status:        row.status,
    rejectReason:  row.reject_reason ?? null,
    needsAdmin:    row.needs_admin,
    createdAt:     row.created_at.toISOString(),
    reviewedAt:    row.reviewed_at ? row.reviewed_at.toISOString() : null,
  };
}

/**
 * Read deposit limits and threshold from app_settings.
 * Works with a PoolClient or the pool directly (for reads outside transactions).
 */
export async function getDepositSettings(client?: { query: any }): Promise<{
  minPaise: number;
  maxPaise: number;
  thresholdPaise: number;
}> {
  const q = client ? client.query.bind(client) : query;
  const res = await q(
    `SELECT key, value FROM app_settings
     WHERE key IN ('min_deposit','max_deposit','admin_approval_threshold')`
  );
  const map: Record<string, string> = {};
  for (const row of res.rows) map[row.key] = row.value;
  return {
    minPaise:       stringToPaise(map.min_deposit || '10.00'),
    maxPaise:       stringToPaise(map.max_deposit || '5000.00'),
    thresholdPaise: stringToPaise(map.admin_approval_threshold || '2000.00'),
  };
}

/**
 * Submit a new deposit request.
 *
 * Transaction order (change #1):
 *   1. Upload screenshot (outside tx – cleaned up on any failure)
 *   2. BEGIN
 *   3. Lock user's wallet FOR UPDATE          ← serialises pending-count check
 *   4. Validate limits from app_settings
 *   5. Count pending deposits
 *   6. INSERT deposit_requests (23505 mapped by constraint name, no pre-check)
 *   7. COMMIT
 *   8. On any error after upload → delete file
 */
export async function submitDeposit(
  userId: string,
  rawAmount: string,
  rawUtr: string,
  fileBuffer: Buffer
): Promise<DepositDto> {
  // 1. Validate amount before touching DB or storage
  let amountPaise: number;
  try {
    amountPaise = parseMoney(rawAmount);
  } catch (err: any) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, err.message, 400);
  }

  // 2. Validate UTR format
  const utr = rawUtr.trim().toUpperCase();
  if (!UTR_RE.test(rawUtr.trim())) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Invalid UTR / transaction ID format', 400);
  }

  // 3. Upload screenshot; change #7: delete on every downstream failure
  let screenshotKey: string;
  try {
    screenshotKey = await uploadScreenshot(fileBuffer);
  } catch (err: any) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, err.message, 400);
  }

  const cleanup = () => deleteFile(screenshotKey).catch(() => {});

  try {
    const dto = await withTransaction(async (client: PoolClient) => {
      // 4. Lock wallet row FOR UPDATE (serialises concurrent requests for same user)
      const lockRes = await client.query(
        'SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );
      if (!lockRes.rowCount) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Wallet not found', 404);
      }

      // 5. Read limits inside the transaction
      const { minPaise, maxPaise, thresholdPaise } = await getDepositSettings(client);

      if (amountPaise < minPaise) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          `Minimum deposit is ₹${paiseToString(minPaise)}`,
          400
        );
      }
      if (amountPaise > maxPaise) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          `Maximum deposit is ₹${paiseToString(maxPaise)}`,
          400
        );
      }

      // 6. Count pending deposits (serialised because wallet is locked)
      const pendingRes = await client.query(
        `SELECT count(*)::int AS c
         FROM deposit_requests
         WHERE user_id = $1 AND status IN ('pending', 'employee_approved')`,
        [userId]
      );
      if (pendingRes.rows[0].c >= MAX_PENDING) {
        throw new AppError(
          ErrorCodes.DEPOSIT_LIMIT,
          `You may have at most ${MAX_PENDING} pending deposits at a time`,
          409
        );
      }

      const needsAdmin = amountPaise >= thresholdPaise;

      // 7. INSERT – partial unique index enforces UTR uniqueness; catch 23505 by constraint
      try {
        const res = await client.query(
          `INSERT INTO deposit_requests
             (user_id, amount, utr, screenshot_url, needs_admin)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, user_id, amount, utr, screenshot_url, status,
                     reject_reason, needs_admin, created_at, reviewed_at`,
          [userId, formatDbNumeric(amountPaise), utr, screenshotKey, needsAdmin]
        );
        return rowToDto(res.rows[0]);
      } catch (err: any) {
        if (err?.code === '23505') {
          if (err.constraint === 'deposit_requests_utr_active_unique') {
            throw new AppError(ErrorCodes.UTR_EXISTS, 'This UTR has already been submitted', 409);
          }
          throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Duplicate entry', 409);
        }
        throw err;
      }
    });

    return dto;
  } catch (err) {
    // Change #7: clean up file on any tx failure
    await cleanup();
    throw err;
  }
}

/** List own deposit requests, newest first (cursor pagination). */
export async function listUserDeposits(
  userId: string,
  params: { limit?: number; cursor?: string }
): Promise<{ items: DepositDto[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(params.limit || 20, 1), 100);

  let sql = `
    SELECT id, amount, utr, screenshot_url, status, reject_reason,
           needs_admin, created_at, reviewed_at
    FROM deposit_requests
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
