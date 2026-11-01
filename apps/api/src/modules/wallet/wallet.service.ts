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
  parseCashbackPercentToBasisPoints,
  ErrorCodes,
  formatMatchId,
  formatDepositId,
  formatWithdrawalId,
  formatTransactionId,
  formatUserId,
} from '@booyah/shared';
import { AppError } from '../../middleware/errorHandler.js';
import { RULES } from '../../config/rules.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SingleWalletKind = 'add_money' | 'cashback' | 'winning';
export type WalletKind = SingleWalletKind | 'all';
export type LedgerType =
  | 'add_money'
  | 'referral'
  | 'joining_reward'
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
    explicitId?: string | null;
  }
): Promise<string> {
  let formattedRefId: string | null = params.refId != null ? params.refId.toString() : null;
  if (formattedRefId) {
    if (params.refType === 'match') formattedRefId = formatMatchId(formattedRefId);
    else if (params.refType === 'deposit' || params.refType === 'withdrawal') formattedRefId = formatTransactionId(formattedRefId);
    else if (params.refType === 'joining_reward') formattedRefId = formatUserId(formattedRefId);
  }

  if (params.explicitId) {
    const formattedExplicitId = formatTransactionId(params.explicitId);
    const existing = await client.query('SELECT 1 FROM wallet_ledger WHERE id = $1', [formattedExplicitId]);
    if (!existing.rowCount) {
      const res = await client.query<{ id: string }>(
        `INSERT INTO wallet_ledger
           (id, user_id, wallet, type, amount, balance_after, total_after, ref_type, ref_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          formattedExplicitId,
          params.userId,
          params.wallet,
          params.type,
          formatDbNumeric(params.amountPaise),
          formatDbNumeric(params.balanceAfterPaise),
          formatDbNumeric(params.totalAfterPaise),
          params.refType ?? null,
          formattedRefId,
        ]
      );
      return res.rows[0].id.toString();
    }
  }

  const res = await client.query<{ id: string }>(
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
      formattedRefId,
    ]
  );
  return res.rows[0].id.toString();
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
  walletKind: SingleWalletKind,
  amountPaise: number,
  ledgerType: LedgerType,
  refType: string | null = null,
  refId: string | number | null = null,
  explicitId?: string | null
): Promise<string> {
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
    explicitId,
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
  walletKind: SingleWalletKind,
  amountPaise: number,
  ledgerType: LedgerType,
  refType: string | null = null,
  refId: string | number | null = null,
  explicitId?: string | null
): Promise<string> {
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
    explicitId,
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

  // Read cashback_max_percent setting INSIDE transaction from DB (no cache)
  const settingRes = await client.query<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'cashback_max_percent'"
  );
  const rawPercent = settingRes.rows[0]?.value?.trim() || '5';
  let basisPoints = 500;
  try {
    basisPoints = parseCashbackPercentToBasisPoints(rawPercent);
  } catch {
    basisPoints = 500;
  }

  // Integer BigInt math: cap = floor(feePaise * basisPoints / 10000)
  const cashbackCap = Number((BigInt(feePaise) * BigInt(basisPoints)) / 10000n);
  const cashbackPart = Math.min(w.cashback, cashbackCap);

  let remaining = feePaise - cashbackPart;
  const fromAddMoney = Math.min(w.add_money, remaining);
  remaining -= fromAddMoney;
  const fromWinning = Math.min(w.winning, remaining);
  remaining -= fromWinning;

  if (remaining > 0) {
    throw new AppError(ErrorCodes.LOW_BALANCE, 'Low balance, please add money', 402);
  }

  let updRes: { rows: WalletRow[]; rowCount: number | null };
  try {
    updRes = await client.query<WalletRow>(
      `UPDATE wallets
       SET cashback = cashback - $1,
           add_money = add_money - $2,
           winning = winning - $3
       WHERE user_id = $4
       RETURNING add_money, cashback, winning`,
      [
        formatDbNumeric(cashbackPart),
        formatDbNumeric(fromAddMoney),
        formatDbNumeric(fromWinning),
        userId,
      ]
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

  const updatedWallet = walletPaise(updRes.rows[0]);
  const totalAfter = updatedWallet.add_money + updatedWallet.cashback + updatedWallet.winning;

  // Single transaction: if only one wallet contributed, tag that wallet. If split across multiple wallets, tag 'all'.
  const nonZeroCount = (cashbackPart > 0 ? 1 : 0) + (fromAddMoney > 0 ? 1 : 0) + (fromWinning > 0 ? 1 : 0);
  let walletKind: WalletKind = 'all';
  let balanceAfter = totalAfter;

  if (nonZeroCount === 1) {
    if (cashbackPart > 0) {
      walletKind = 'cashback';
      balanceAfter = updatedWallet.cashback;
    } else if (fromAddMoney > 0) {
      walletKind = 'add_money';
      balanceAfter = updatedWallet.add_money;
    } else {
      walletKind = 'winning';
      balanceAfter = updatedWallet.winning;
    }
  }

  await insertLedgerRow(client, {
    userId,
    wallet: walletKind,
    type: 'join_fee',
    amountPaise: -feePaise,
    balanceAfterPaise: balanceAfter,
    totalAfterPaise: totalAfter,
    refType,
    refId,
  });

  return { paidCashback: cashbackPart, paidAddMoney: fromAddMoney, paidWinning: fromWinning };
}

/**
 * Refund entry fee. Exact amounts back to exact wallets.
 * Generates a single refund transaction for the total amount.
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
  const totalRefundPaise = cashbackPaise + addMoneyPaise + winningPaise;

  if (totalRefundPaise > 0) {
    const updRes = await client.query<WalletRow>(
      `UPDATE wallets
       SET cashback = cashback + $1,
           add_money = add_money + $2,
           winning = winning + $3
       WHERE user_id = $4
       RETURNING add_money, cashback, winning`,
      [
        formatDbNumeric(cashbackPaise),
        formatDbNumeric(addMoneyPaise),
        formatDbNumeric(winningPaise),
        userId,
      ]
    );

    if (!updRes.rowCount) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Wallet not found for user ${userId}`, 404);
    }

    const updatedWallet = walletPaise(updRes.rows[0]);
    const totalAfter = updatedWallet.add_money + updatedWallet.cashback + updatedWallet.winning;

    const nonZeroCount = (cashbackPaise > 0 ? 1 : 0) + (addMoneyPaise > 0 ? 1 : 0) + (winningPaise > 0 ? 1 : 0);
    let walletKind: WalletKind = 'all';
    let balanceAfter = totalAfter;

    if (nonZeroCount === 1) {
      if (cashbackPaise > 0) {
        walletKind = 'cashback';
        balanceAfter = updatedWallet.cashback;
      } else if (addMoneyPaise > 0) {
        walletKind = 'add_money';
        balanceAfter = updatedWallet.add_money;
      } else {
        walletKind = 'winning';
        balanceAfter = updatedWallet.winning;
      }
    }

    await insertLedgerRow(client, {
      userId,
      wallet: walletKind,
      type: 'refund',
      amountPaise: totalRefundPaise,
      balanceAfterPaise: balanceAfter,
      totalAfterPaise: totalAfter,
      refType: 'match',
      refId: matchId,
    });
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
