/**
 * Transaction history service (spec §6.4).
 *
 * Display ID: BW-XXXXXXX (ledger id zero-padded to 7 digits).
 * amount: signed string (negative = debit).
 * remainingAmount: total_after (sum of all three wallets after entry).
 *
 * Filter mapping:
 *   all            → no filter
 *   add_money      → type IN ('add_money')
 *   referral       → type IN ('referral')
 *   withdrawal     → type IN ('withdrawal_hold','withdrawal_refund')
 *   join_fee       → type IN ('join_fee')
 *   winning        → type IN ('winning')
 *   refund         → type IN ('refund')
 */

import { query } from '../../db/index.js';
import { paiseToString, stringToPaise } from '@booyah/shared';

const FILTER_MAP: Record<string, string[]> = {
  add_money:  ['add_money'],
  referral:   ['referral'],
  withdrawal: ['withdrawal_hold', 'withdrawal_refund'],
  join_fee:   ['join_fee'],
  winning:    ['winning'],
  refund:     ['refund'],
};

export interface TransactionDto {
  transactionId: string;   // BW-XXXXXXX
  type: string;            // ledger type (display category)
  createdAt: string;
  amount: string;          // signed, e.g. "-50.00" or "100.00"
  remainingAmount: string; // total_after
  wallet: string;
  refType: string | null;
  refId: string | null;
}

function formatDisplayId(id: number): string {
  return `BW-${String(id).padStart(7, '0')}`;
}

export async function listTransactions(
  userId: string,
  params: {
    type?: string;
    limit?: number;
    cursor?: string;
  }
): Promise<{ items: TransactionDto[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(params.limit || 20, 1), 100);

  let sql = `
    SELECT id, wallet, type, amount, total_after, ref_type, ref_id, created_at
    FROM wallet_ledger
    WHERE user_id = $1
  `;
  const values: any[] = [userId];
  let pIdx = 2;

  // Type filter
  const filterTypes = params.type ? FILTER_MAP[params.type] : null;
  if (filterTypes && filterTypes.length > 0) {
    const placeholders = filterTypes.map((_, i) => `$${pIdx + i}`).join(', ');
    sql += ` AND type IN (${placeholders})`;
    values.push(...filterTypes);
    pIdx += filterTypes.length;
  }

  // Cursor pagination (descending on id)
  if (params.cursor) {
    sql += ` AND id < $${pIdx}`;
    values.push(params.cursor);
    pIdx++;
  }

  sql += ` ORDER BY id DESC LIMIT $${pIdx}`;
  values.push(limit + 1);

  const res = await query(sql, values);
  const hasNext = res.rows.length > limit;
  const rows = hasNext ? res.rows.slice(0, limit) : res.rows;
  const nextCursor = hasNext ? rows[rows.length - 1].id.toString() : null;

  const items: TransactionDto[] = rows.map((row) => {
    const amountPaise = stringToPaise(row.amount.toString());
    const totalAfterPaise = stringToPaise(row.total_after.toString());
    return {
      transactionId:   formatDisplayId(Number(row.id)),
      type:            row.type,
      createdAt:       row.created_at.toISOString(),
      amount:          paiseToString(amountPaise),      // may be negative (debit)
      remainingAmount: paiseToString(totalAfterPaise),
      wallet:          row.wallet,
      refType:         row.ref_type ?? null,
      refId:           row.ref_id ? row.ref_id.toString() : null,
    };
  });

  return { items, nextCursor };
}
