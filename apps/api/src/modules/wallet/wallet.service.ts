/**
 * Wallet Service — THE ONLY CODE ALLOWED TO CHANGE BALANCES.
 *
 * Rules:
 *  - All methods accept a PoolClient; caller owns the transaction and lock order.
 *  - Integer paise throughout; DB is NUMERIC(12,2).
 *  - One wallet_ledger row per operation, balance_after and total_after are read
 *    from the UPDATE...RETURNING row – no separate SELECT needed.
 *  - total_after = sum of all three wallets after the UPDATE.
 *
 * Lock order (spec §4.1): callers MUST lock wallet rows in ascending user_id
 * before calling any method here.
 */

import type { PoolClient } from 'pg';
import {
  formatDbNumeric,
  paiseToString,
  stringToPaise,
  ErrorCodes,
} from '@booyah/shared';
import { AppError } from '../../middleware/errorHandler.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WalletKind = 'add_money' | 'cashback' | 'winning';
export type LedgerType =
  | 'add_money'
  | 'referral'
  | 'join_fee'
  | 'refund'
  | 'winning'
  | 'withdrawal_hold'
  | 'withdrawal_paid'
  | 'withdrawal_refund'
  | 'admin_adjustment'
  | 'reversal';

interface WalletRow {
  add_money: string;
  cashback: string;
  winning: string;
}

function walletPaise(row: WalletRow) {
  return {
    add_money: stringToPaise(row.add_money.toString()),
    cashback:  stringToPaise(row.cashback.toString()),
    winning:   stringToPaise(row.winning.toString()),
  };
}

async function insertLedgerRow(
  client: PoolClient,
  params: {
    userId: string;
    wallet: WalletKind;
    type: LedgerType;
    amountPaise: number;       // positive = credit, negative = debit
    balanceAfterPaise: number;
    totalAfterPaise: number;
    refType?: string | null;
    refId?: string | number | null;
  }
): Promise<number> {
  const res = await client.query<{ id: number }>(
    `INSERT INTO wallet_ledger
       (user_id, wallet, type, amount, balance_after, total_after, ref_type, ref_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      params.userId,
      params.wallet,
      params.type,
      formatDbNumeric(params.amountPaise),
      formatDbNumeric(params.balanceAfterPaise),
      formatDbNumeric(params.totalAfterPaise),
      params.refType ?? null,
      params.refId ?? null,
    ]
  );
  return res.rows[0].id;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Credit a single wallet.
 * total_after is taken directly from the UPDATE...RETURNING row (change #10).
 * Returns the ledger row id.
 */
export async function creditWallet(
  client: PoolClient,
  userId: string,
  walletKind: WalletKind,
  amountPaise: number,
  ledgerType: LedgerType,
  refType: string | null = null,
  refId: string | number | null = null
): Promise<number> {
  if (amountPaise <= 0) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Credit amount must be positive', 400);
  }

  const res = await client.query<WalletRow>(
    `UPDATE wallets
     SET ${walletKind} = ${walletKind} + $1
     WHERE user_id = $2
     RETURNING add_money, cashback, winning`,
    [formatDbNumeric(amountPaise), userId]
  );

  if (!res.rowCount) {
    throw new AppError(ErrorCodes.NOT_FOUND, `Wallet not found for user ${userId}`, 404);
  }

  const w = walletPaise(res.rows[0]);
  const balanceAfter = w[walletKind];
  const totalAfter   = w.add_money + w.cashback + w.winning;

  return insertLedgerRow(client, {
    userId,
    wallet: walletKind,
    type: ledgerType,
    amountPaise,
    balanceAfterPaise: balanceAfter,
    totalAfterPaise: totalAfter,
    refType,
    refId,
  });
}

/**
 * Debit a single wallet.
 * DB CHECK >= 0 fires 23514 on overdraft; caught here and surfaced as 402.
 * total_after is taken from UPDATE...RETURNING (change #10).
 * Returns the ledger row id.
 */
export async function debitWallet(
  client: PoolClient,
  userId: string,
  walletKind: WalletKind,
  amountPaise: number,
  ledgerType: LedgerType,
  refType: string | null = null,
  refId: string | number | null = null
): Promise<number> {
  if (amountPaise <= 0) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Debit amount must be positive', 400);
  }

  let updRes: { rows: WalletRow[]; rowCount: number | null };
  try {
    updRes = await client.query<WalletRow>(
      `UPDATE wallets
       SET ${walletKind} = ${walletKind} - $1
       WHERE user_id = $2
       RETURNING add_money, cashback, winning`,
      [formatDbNumeric(amountPaise), userId]
    );
  } catch (err: any) {
    if (err?.code === '23514') {
      throw new AppError(ErrorCodes.LOW_BALANCE, 'Low balance, please add money', 402);
    }
    throw err;
  }

  if (!updRes.rowCount) {
    throw new AppError(ErrorCodes.NOT_FOUND, `Wallet not found for user ${userId}`, 404);
  }

  const w = walletPaise(updRes.rows[0]);
  const balanceAfter = w[walletKind];
  const totalAfter   = w.add_money + w.cashback + w.winning;

  return insertLedgerRow(client, {
    userId,
    wallet: walletKind,
    type: ledgerType,
    amountPaise: -amountPaise,    // ledger stores negative for debits
    balanceAfterPaise: balanceAfter,
    totalAfterPaise: totalAfter,
    refType,
    refId,
  });
}

/**
 * Entry fee allocation (spec §6.1). Integer math only.
 * cashbackCap = floor(feePaise * 5 / 100)
 * Order: cashback (capped) → add_money → winning → LOW_BALANCE if still short.
 *
 * Caller must have already locked the wallet row FOR UPDATE.
 */
export interface AllocationResult {
  paidCashback: number;   // paise
  paidAddMoney: number;
  paidWinning:  number;
}

export async function allocateEntryFee(
  client: PoolClient,
  userId: string,
  feePaise: number,
  refType: string | null = 'match',
  refId: string | number | null = null
): Promise<AllocationResult> {
  if (feePaise <= 0) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Entry fee must be positive', 400);
  }

  // Read current balances from the locked wallet row
  const walletRes = await client.query<WalletRow>(
    'SELECT add_money, cashback, winning FROM wallets WHERE user_id = $1',
    [userId]
  );
  if (!walletRes.rowCount) {
    throw new AppError(ErrorCodes.NOT_FOUND, `Wallet not found for user ${userId}`, 404);
  }
  const w = walletPaise(walletRes.rows[0]);

  const cashbackCap  = Math.floor(feePaise * 5 / 100);
  const cashbackPart = Math.min(w.cashback, cashbackCap);

  let remaining = feePaise - cashbackPart;
  const fromAddMoney = Math.min(w.add_money, remaining);
  remaining -= fromAddMoney;
  const fromWinning = Math.min(w.winning, remaining);
  remaining -= fromWinning;

  if (remaining > 0) {
    throw new AppError(ErrorCodes.LOW_BALANCE, 'Low balance, please add money', 402);
  }

  if (cashbackPart > 0) {
    await debitWallet(client, userId, 'cashback',  cashbackPart, 'join_fee', refType, refId);
  }
  if (fromAddMoney > 0) {
    await debitWallet(client, userId, 'add_money', fromAddMoney, 'join_fee', refType, refId);
  }
  if (fromWinning > 0) {
    await debitWallet(client, userId, 'winning',   fromWinning,  'join_fee', refType, refId);
  }

  return { paidCashback: cashbackPart, paidAddMoney: fromAddMoney, paidWinning: fromWinning };
}

/**
 * Refund entry fee. Exact amounts back to exact wallets.
 * Idempotent: no-op if refunded_at is already set.
 * Caller must have locked the wallet row before calling.
 */
export async function refundEntryFee(
  client: PoolClient,
  matchPlayerId: string | number,
  matchId: string | number
): Promise<void> {
  const res = await client.query(
    `SELECT id, user_id, paid_add_money, paid_cashback, paid_winning, refunded_at
     FROM match_players WHERE id = $1 FOR UPDATE`,
    [matchPlayerId]
  );

  if (!res.rowCount) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Match player record not found', 404);
  }

  const mp = res.rows[0];
  if (mp.refunded_at !== null) return; // idempotent

  const userId = mp.user_id.toString();
  const cashbackPaise = stringToPaise(mp.paid_cashback.toString());
  const addMoneyPaise = stringToPaise(mp.paid_add_money.toString());
  const winningPaise  = stringToPaise(mp.paid_winning.toString());

  if (cashbackPaise > 0) {
    await creditWallet(client, userId, 'cashback',  cashbackPaise, 'refund', 'match', matchId);
  }
  if (addMoneyPaise > 0) {
    await creditWallet(client, userId, 'add_money', addMoneyPaise, 'refund', 'match', matchId);
  }
  if (winningPaise > 0) {
    await creditWallet(client, userId, 'winning',   winningPaise,  'refund', 'match', matchId);
  }

  await client.query(
    'UPDATE match_players SET refunded_at = now() WHERE id = $1',
    [matchPlayerId]
  );
}

/**
 * Credit referral reward (spec §6.3).
 * Atomically claims the referral row (UPDATE WHERE credited_at IS NULL RETURNING).
 * Skips silently if already credited or referrer is soft-deleted.
 * Caller must have pre-locked BOTH wallets in ascending user_id before calling.
 */
export async function creditReferralReward(
  client: PoolClient,
  referredUserId: string
): Promise<void> {
  const res = await client.query<{ id: number; referrer_id: number; reward: string }>(
    `UPDATE referrals
     SET credited_at = now()
     WHERE referred_id = $1 AND credited_at IS NULL
     RETURNING id, referrer_id, reward`,
    [referredUserId]
  );

  if (!res.rowCount) return; // already credited or no referral

  const { id: referralId, referrer_id: referrerId, reward } = res.rows[0];
  const rewardPaise   = stringToPaise(reward.toString());
  const referrerIdStr = referrerId.toString();

  const referrerRes = await client.query(
    'SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL',
    [referrerIdStr]
  );
  if (!referrerRes.rowCount) return; // referrer deleted

  // Wallet already locked by caller in ascending user_id order; re-lock is a no-op.
  await client.query('SELECT 1 FROM wallets WHERE user_id = $1 FOR UPDATE', [referrerIdStr]);

  await creditWallet(
    client,
    referrerIdStr,
    'cashback',
    rewardPaise,
    'referral',
    'referral',
    referralId
  );
}

/**
 * Read-only wallet balances for display. Does NOT lock.
 */
export async function getWalletBalances(
  client: PoolClient,
  userId: string
): Promise<{ addMoney: string; cashback: string; winning: string; total: string }> {
  const res = await client.query<WalletRow>(
    'SELECT add_money, cashback, winning FROM wallets WHERE user_id = $1',
    [userId]
  );
  if (!res.rowCount) {
    throw new AppError(ErrorCodes.NOT_FOUND, `Wallet not found for user ${userId}`, 404);
  }
  const w = walletPaise(res.rows[0]);
  return {
    addMoney: paiseToString(w.add_money),
    cashback:  paiseToString(w.cashback),
    winning:   paiseToString(w.winning),
    total:     paiseToString(w.add_money + w.cashback + w.winning),
  };
}
