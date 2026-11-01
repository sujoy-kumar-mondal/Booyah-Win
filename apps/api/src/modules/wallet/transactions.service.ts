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
import {
  paiseToString,
  stringToPaise,
  ErrorCodes,
  formatMatchId,
  formatWithdrawalId,
  formatDepositId,
  formatTransactionId,
  formatUserId,
  parseEntityNumber,
} from '@booyah/shared';
import { AppError } from '../../middleware/errorHandler.js';
import { getSignedUrl } from '../../utils/storage.js';

const FILTER_MAP: Record<string, string[]> = {
  add_money:      ['add_money'],
  referral:       ['referral'],
  joining_reward: ['joining_reward'],
  withdrawal:     ['withdrawal_hold', 'withdrawal_refund'],
  join_fee:       ['join_fee'],
  winning:        ['winning'],
  refund:         ['refund'],
};

export interface TransactionDto {
  transactionId: string;   // BW-TRX-XXXXXXX
  type: string;            // ledger type (display category)
  createdAt: string;
  amount: string;          // signed, e.g. "-50.00" or "100.00"
  remainingAmount: string; // total_after
  wallet: string;
  refType: string | null;
  refId: string | null;
  status: 'successful' | 'cancelled' | 'rejected' | 'pending';
  statusReason: string | null;
}

export interface TransactionMatchDetail {
  id: number;
  title: string;
  gameMode: string;
  teamMode: string;
  mapName: string | null;
  entryFee: string;
  killPrice: string;
  startTime: string;
  status: string;
  cancelReason: string | null;
  kills?: number | null;
  rank?: number | null;
  prizeAmount?: string | null;
}

export interface TransactionDepositDetail {
  id: string;
  amount: string;
  utr: string;
  screenshotUrl: string;
  status: string;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface TransactionWithdrawalDetail {
  id: string;
  amount: string;
  upiId: string;
  status: string;
  rejectReason: string | null;
  payoutRef: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface TransactionReferralDetail {
  id?: string;
  referredUserId?: string;
  referredUsername: string;
  referredName?: string | null;
}

export interface TransactionAdjustmentDetail {
  reason?: string | null;
}

export interface TransactionDetailDto {
  transactionId: string;   // BW-TRX-XXXXXXX
  id: number;
  type: string;            // ledger type
  createdAt: string;
  amount: string;          // signed amount, e.g. "-10.00" or "+80.00"
  remainingAmount: string; // total_after
  wallet: string;          // 'add_money' | 'cashback' | 'winning' | 'all'
  walletName: string;      // 'Deposited' | 'Winning' | 'Cashback' | 'Deposited, Cashback & Winning'
  status: 'successful' | 'cancelled' | 'rejected' | 'pending';
  statusReason: string | null;
  breakdown?: {
    deposited?: string;
    cashback?: string;
    winning?: string;
  } | null;
  match?: TransactionMatchDetail | null;
  deposit?: TransactionDepositDetail | null;
  withdrawal?: TransactionWithdrawalDetail | null;
  referral?: TransactionReferralDetail | null;
  adjustment?: TransactionAdjustmentDetail | null;
}

function formatDisplayId(id: string | number): string {
  return formatTransactionId(id);
}

export async function listTransactions(
  userId: string,
  params: {
    type?: string;
    limit?: number;
    cursor?: string;
    fromDate?: string;
    toDate?: string;
  }
): Promise<{ items: TransactionDto[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(params.limit || 20, 1), 100);

  let sql = `
    WITH combined_tx AS (
      -- 1. Committed wallet ledger entries
      SELECT
        wl.id,
        wl.wallet,
        wl.type,
        wl.amount,
        wl.total_after,
        wl.ref_type,
        wl.ref_id,
        wl.created_at,
        CASE
          WHEN wl.type = 'withdrawal_hold' AND wr.status IN ('pending', 'employee_approved') THEN 'pending'
          WHEN wl.type = 'withdrawal_hold' AND wr.status = 'rejected' THEN 'rejected'
          WHEN wl.type = 'reversal' THEN 'cancelled'
          ELSE 'successful'
        END AS status,
        CASE
          WHEN wl.type = 'withdrawal_hold' AND wr.status IN ('pending', 'employee_approved') THEN 'Verification in progress'
          WHEN wl.type = 'withdrawal_hold' AND wr.status = 'rejected' THEN wr.reject_reason
          ELSE NULL
        END AS status_reason
      FROM wallet_ledger wl
      LEFT JOIN withdrawal_requests wr ON (wr.id = wl.ref_id OR wr.id = wl.id) AND wl.ref_type = 'withdrawal'
      WHERE wl.user_id = $1

      UNION ALL

      -- 2. Pending and rejected deposit requests not in wallet_ledger
      SELECT
        dr.id,
        'add_money' AS wallet,
        'add_money' AS type,
        dr.amount,
        (COALESCE(w.add_money, 0) + COALESCE(w.cashback, 0) + COALESCE(w.winning, 0))::numeric(12,2) AS total_after,
        'deposit' AS ref_type,
        dr.id AS ref_id,
        dr.created_at,
        CASE
          WHEN dr.status IN ('pending', 'employee_approved') THEN 'pending'
          WHEN dr.status = 'rejected' THEN 'rejected'
          ELSE 'successful'
        END AS status,
        CASE
          WHEN dr.status IN ('pending', 'employee_approved') THEN 'Verification in progress'
          WHEN dr.status = 'rejected' THEN dr.reject_reason
          ELSE NULL
        END AS status_reason
      FROM deposit_requests dr
      LEFT JOIN wallets w ON w.user_id = dr.user_id
      WHERE dr.user_id = $1
        AND (dr.status != 'approved')
        AND NOT EXISTS (
          SELECT 1 FROM wallet_ledger wl
          WHERE wl.user_id = dr.user_id
            AND wl.ref_type = 'deposit'
            AND (wl.ref_id = dr.id OR wl.id = dr.id OR wl.ref_id = regexp_replace(dr.id, '^BW-TRX-', ''))
        )

      UNION ALL

      -- 3. Standalone withdrawal requests if any exist not in wallet_ledger
      SELECT
        wr.id,
        'winning' AS wallet,
        'withdrawal_hold' AS type,
        (-wr.amount)::numeric(12,2) AS amount,
        (COALESCE(w.add_money, 0) + COALESCE(w.cashback, 0) + COALESCE(w.winning, 0))::numeric(12,2) AS total_after,
        'withdrawal' AS ref_type,
        wr.id AS ref_id,
        wr.created_at,
        CASE
          WHEN wr.status IN ('pending', 'employee_approved') THEN 'pending'
          WHEN wr.status = 'rejected' THEN 'rejected'
          ELSE 'successful'
        END AS status,
        CASE
          WHEN wr.status IN ('pending', 'employee_approved') THEN 'Verification in progress'
          WHEN wr.status = 'rejected' THEN wr.reject_reason
          ELSE NULL
        END AS status_reason
      FROM withdrawal_requests wr
      LEFT JOIN wallets w ON w.user_id = wr.user_id
      WHERE wr.user_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM wallet_ledger wl
          WHERE wl.user_id = wr.user_id
            AND wl.ref_type = 'withdrawal'
            AND (wl.ref_id = wr.id OR wl.id = wr.id OR wl.ref_id = regexp_replace(wr.id, '^BW-TRX-', ''))
        )
    )
    SELECT id, wallet, type, amount, total_after, ref_type, ref_id, status, status_reason, created_at
    FROM combined_tx
    WHERE 1=1
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

  // Date filters (evaluated in Indian Standard Time 'Asia/Kolkata' to match IST display)
  const fromDateMatch = params.fromDate?.match(/^\d{4}-\d{2}-\d{2}/);
  if (fromDateMatch) {
    sql += ` AND (created_at AT TIME ZONE 'Asia/Kolkata')::date >= $${pIdx}::date`;
    values.push(fromDateMatch[0]);
    pIdx++;
  }
  const toDateMatch = params.toDate?.match(/^\d{4}-\d{2}-\d{2}/);
  if (toDateMatch) {
    sql += ` AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= $${pIdx}::date`;
    values.push(toDateMatch[0]);
    pIdx++;
  }

  // Cursor pagination (descending on numeric id)
  if (params.cursor) {
    sql += ` AND COALESCE(NULLIF(regexp_replace(id, '[^0-9]', '', 'g'), '')::bigint, 0) < COALESCE(NULLIF(regexp_replace($${pIdx}, '[^0-9]', '', 'g'), '')::bigint, 0)`;
    values.push(params.cursor);
    pIdx++;
  }

  sql += ` ORDER BY COALESCE(NULLIF(regexp_replace(id, '[^0-9]', '', 'g'), '')::bigint, 0) DESC LIMIT $${pIdx}`;
  values.push(limit + 1);

  const res = await query(sql, values);
  const hasNext = res.rows.length > limit;
  const rows = hasNext ? res.rows.slice(0, limit) : res.rows;
  const nextCursor = hasNext ? rows[rows.length - 1].id.toString() : null;

  const items: TransactionDto[] = rows.map((row) => {
    const amountPaise = stringToPaise(row.amount.toString());
    const totalAfterPaise = stringToPaise(row.total_after.toString());
    return {
      transactionId:   formatDisplayId(row.id),
      type:            row.type,
      createdAt:       row.created_at.toISOString(),
      amount:          paiseToString(amountPaise),      // may be negative (debit)
      remainingAmount: paiseToString(totalAfterPaise),
      wallet:          row.wallet,
      refType:         row.ref_type ?? null,
      refId:           row.ref_id ? row.ref_id.toString() : null,
      status:          row.status,
      statusReason:    row.status_reason ?? null,
    };
  });

  return { items, nextCursor };
}

async function buildDepositTransactionDetail(
  dr: any,
  rawDepNum: string
): Promise<TransactionDetailDto> {
  let signedScreenshotUrl = dr.screenshot_url || '';
  if (dr.screenshot_url && dr.screenshot_url.trim()) {
    try {
      signedScreenshotUrl = await getSignedUrl(dr.screenshot_url.trim(), 86400);
    } catch {
      signedScreenshotUrl = dr.screenshot_url.trim();
    }
  }
  const currentTotalPaise =
    dr.add_money != null && dr.winning != null && dr.cashback != null
      ? stringToPaise(dr.add_money.toString()) +
        stringToPaise(dr.winning.toString()) +
        stringToPaise(dr.cashback.toString())
      : 0;

  return {
    transactionId: formatTransactionId(dr.id),
    id: Number(rawDepNum) || 0,
    type: 'add_money',
    createdAt: dr.created_at.toISOString(),
    amount: paiseToString(stringToPaise(dr.amount.toString())),
    remainingAmount: paiseToString(currentTotalPaise),
    wallet: 'add_money',
    walletName: 'Deposited',
    status: dr.status === 'rejected' ? 'rejected' : 'pending',
    statusReason: dr.reject_reason || (dr.status === 'pending' ? 'Verification in progress' : null),
    deposit: {
      id: formatTransactionId(dr.id),
      amount: paiseToString(stringToPaise(dr.amount.toString())),
      utr: dr.utr,
      screenshotUrl: signedScreenshotUrl,
      status: dr.status,
      rejectReason: dr.reject_reason,
      createdAt: dr.created_at.toISOString(),
      reviewedAt: dr.reviewed_at ? dr.reviewed_at.toISOString() : null,
    },
    match: null,
    withdrawal: null,
    referral: null,
    adjustment: null,
  };
}

function buildWithdrawalTransactionDetail(
  wr: any,
  rawWthNum: string
): TransactionDetailDto {
  const currentTotalPaise =
    wr.add_money != null && wr.winning != null && wr.cashback != null
      ? stringToPaise(wr.add_money.toString()) +
        stringToPaise(wr.winning.toString()) +
        stringToPaise(wr.cashback.toString())
      : 0;

  return {
    transactionId: formatTransactionId(wr.id),
    id: Number(rawWthNum) || 0,
    type: 'withdrawal',
    createdAt: wr.created_at.toISOString(),
    amount: '-' + paiseToString(stringToPaise(wr.amount.toString())),
    remainingAmount: paiseToString(currentTotalPaise),
    wallet: 'winning',
    walletName: 'Winning',
    status: wr.status === 'paid' ? 'successful' : wr.status === 'rejected' ? 'rejected' : 'pending',
    statusReason: wr.reject_reason || (wr.status === 'pending' ? 'Verification in progress' : null),
    withdrawal: {
      id: formatTransactionId(wr.id),
      amount: paiseToString(stringToPaise(wr.amount.toString())),
      upiId: wr.upi_id,
      status: wr.status,
      rejectReason: wr.reject_reason,
      payoutRef: wr.payout_ref,
      createdAt: wr.created_at.toISOString(),
      processedAt: wr.processed_at ? wr.processed_at.toISOString() : null,
    },
    match: null,
    deposit: null,
    referral: null,
    adjustment: null,
  };
}

export async function getTransactionDetail(
  userId: string,
  transactionIdParam: string
): Promise<TransactionDetailDto> {
  const trimmed = transactionIdParam.trim();
  const rawId = parseEntityNumber(trimmed);
  if (!rawId) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Transaction not found', 404);
  }

  const trxId = formatTransactionId(rawId);
  const legacyDepId = `BW-DPT-${rawId}`;
  const legacyWthId = `BW-WDL-${rawId}`;
  const upper = trimmed.toUpperCase();

  const isExplicitDep = upper.startsWith('DEP-') || upper.startsWith('DPT-') || upper.startsWith('BW-DPT-');
  const isExplicitWth = upper.startsWith('WTH-') || upper.startsWith('WDL-') || upper.startsWith('BW-WDL-');

  // Explicit deposit lookup
  if (isExplicitDep) {
    const depRes = await query(
      `SELECT dr.id, dr.amount, dr.utr, dr.screenshot_url, dr.status, dr.reject_reason, dr.created_at, dr.reviewed_at,
              w.add_money, w.cashback, w.winning
       FROM deposit_requests dr
       LEFT JOIN wallets w ON w.user_id = dr.user_id
       WHERE (dr.id = $1 OR dr.id = $2 OR dr.id = $3) AND dr.user_id = $4`,
      [trxId, rawId, legacyDepId, userId]
    );
    if (depRes.rows.length > 0) {
      return buildDepositTransactionDetail(depRes.rows[0], rawId);
    }
  }

  // Explicit withdrawal lookup
  if (isExplicitWth) {
    const wthRes = await query(
      `SELECT wr.id, wr.amount, wr.upi_id, wr.status, wr.reject_reason, wr.payout_ref, wr.created_at, wr.processed_at,
              w.add_money, w.cashback, w.winning
       FROM withdrawal_requests wr
       LEFT JOIN wallets w ON w.user_id = wr.user_id
       WHERE (wr.id = $1 OR wr.id = $2 OR wr.id = $3) AND wr.user_id = $4`,
      [trxId, rawId, legacyWthId, userId]
    );
    if (wthRes.rows.length > 0) {
      return buildWithdrawalTransactionDetail(wthRes.rows[0], rawId);
    }
  }

  // 1. Check wallet_ledger
  const ledgerRes = await query(
    `SELECT id, user_id, wallet, type, amount, balance_after, total_after, ref_type, ref_id, created_at
     FROM wallet_ledger
     WHERE (id = $1 OR id = $2) AND user_id = $3
     ORDER BY NULLIF(regexp_replace(id, '^(?:BW-[A-Z]+-|[A-Z]+-)', ''), '')::bigint DESC LIMIT 1`,
    [trxId, rawId, userId]
  );

  if (ledgerRes.rows.length > 0) {
    return buildTransactionDetailFromLedger(userId, ledgerRes.rows[0]);
  }

  // 2. Check deposit_requests (e.g. pending or rejected deposit not in ledger)
  const depRes = await query(
    `SELECT dr.id, dr.amount, dr.utr, dr.screenshot_url, dr.status, dr.reject_reason, dr.created_at, dr.reviewed_at,
            w.add_money, w.cashback, w.winning
     FROM deposit_requests dr
     LEFT JOIN wallets w ON w.user_id = dr.user_id
     WHERE (dr.id = $1 OR dr.id = $2 OR dr.id = $3) AND dr.user_id = $4`,
    [trxId, rawId, legacyDepId, userId]
  );
  if (depRes.rows.length > 0) {
    return buildDepositTransactionDetail(depRes.rows[0], rawId);
  }

  // 3. Check withdrawal_requests (e.g. pending or rejected withdrawal not in ledger)
  const wthRes = await query(
    `SELECT wr.id, wr.amount, wr.upi_id, wr.status, wr.reject_reason, wr.payout_ref, wr.created_at, wr.processed_at,
            w.add_money, w.cashback, w.winning
     FROM withdrawal_requests wr
     LEFT JOIN wallets w ON w.user_id = wr.user_id
     WHERE (wr.id = $1 OR wr.id = $2 OR wr.id = $3) AND wr.user_id = $4`,
    [trxId, rawId, legacyWthId, userId]
  );
  if (wthRes.rows.length > 0) {
    return buildWithdrawalTransactionDetail(wthRes.rows[0], rawId);
  }

  throw new AppError(ErrorCodes.NOT_FOUND, 'Transaction not found', 404);
}

async function buildTransactionDetailFromLedger(
  userId: string,
  row: any
): Promise<TransactionDetailDto> {
  const amountPaise = stringToPaise(row.amount.toString());
  const totalAfterPaise = stringToPaise(row.total_after.toString());

  let walletName = 'Deposited';
  if (row.wallet === 'winning') walletName = 'Winning';
  else if (row.wallet === 'cashback') walletName = 'Cashback';
  else if (row.wallet === 'all') walletName = 'Deposited, Cashback & Winning';

  let status: 'successful' | 'cancelled' | 'rejected' | 'pending' = 'successful';
  let statusReason: string | null = null;

  let breakdown: { deposited?: string; cashback?: string; winning?: string } | null = null;
  let matchDetail: TransactionMatchDetail | null = null;
  let depositDetail: TransactionDepositDetail | null = null;
  let withdrawalDetail: TransactionWithdrawalDetail | null = null;

  // Case A: Match interaction (ref_type = 'match' or type in join_fee, winning, refund)
  if (row.ref_type === 'match' || ['join_fee', 'winning', 'refund'].includes(row.type)) {
    const matchId = row.ref_id;
    if (matchId) {
      const matchRes = await query(
        `SELECT id, game_mode, team_mode, entry_fee, kill_price, start_time, status, cancel_reason, map_name
         FROM matches
         WHERE id = $1`,
        [matchId]
      );

      if (matchRes.rows.length > 0) {
        const m = matchRes.rows[0];
        const gameModeTitle = m.game_mode === 'clash_squad' ? 'CLASH SQUAD' : m.game_mode === 'lone_wolf' ? 'LONE WOLF' : 'BATTLE ROYALE';
        const teamModeTitle = (m.team_mode || 'SOLO').toUpperCase();
        const cleanMatchId = formatMatchId(m.id);
        const title = `${gameModeTitle} | ${teamModeTitle} | ${cleanMatchId}`;

        const mpRes = await query(
          `SELECT paid_add_money, paid_cashback, paid_winning, kills, position, payout
           FROM match_players
           WHERE match_id = $1 AND user_id = $2`,
          [matchId, userId]
        );

        let kills: number | null = null;
        let rank: number | null = null;
        let prizeAmount: string | null = null;

        if (mpRes.rows.length > 0) {
          const mp = mpRes.rows[0];
          kills = mp.kills != null ? Number(mp.kills) : null;
          rank = mp.position != null ? Number(mp.position) : null;
          prizeAmount = mp.payout != null ? paiseToString(stringToPaise(mp.payout.toString())) : null;

          if (row.type === 'join_fee' || row.wallet === 'all') {
            breakdown = {
              deposited: paiseToString(stringToPaise(mp.paid_add_money.toString())),
              cashback: paiseToString(stringToPaise(mp.paid_cashback.toString())),
              winning: paiseToString(stringToPaise(mp.paid_winning.toString())),
            };
          }
        }

        matchDetail = {
          id: Number(parseEntityNumber(m.id)) || 0,
          title,
          gameMode: m.game_mode,
          teamMode: m.team_mode,
          mapName: m.map_name || 'Bermuda',
          entryFee: paiseToString(stringToPaise(m.entry_fee.toString())),
          killPrice: paiseToString(stringToPaise(m.kill_price.toString())),
          startTime: m.start_time.toISOString(),
          status: m.status,
          cancelReason: m.cancel_reason,
          kills,
          rank,
          prizeAmount,
        };

        if (m.status === 'cancelled' || row.type === 'refund') {
          status = 'cancelled';
          statusReason = m.cancel_reason || 'Match was cancelled';
        }
      }
    }
  }

  // Case B: Deposit interaction
  if (row.ref_type === 'deposit' || row.type === 'add_money') {
    let depositId = row.ref_id;
    if (!depositId && row.type === 'add_money') {
      const fallbackDep = await query(
        `SELECT id FROM deposit_requests
         WHERE user_id = $1 AND amount = $2
         ORDER BY NULLIF(regexp_replace(id, '^(?:BW-[A-Z]+-|[A-Z]+-)', ''), '')::bigint DESC LIMIT 1`,
        [userId, row.amount]
      );
      if (fallbackDep.rows.length > 0) {
        depositId = fallbackDep.rows[0].id;
      }
    }

    if (depositId) {
      const depRes = await query(
        `SELECT id, amount, utr, screenshot_url, status, reject_reason, created_at, reviewed_at
         FROM deposit_requests
         WHERE id = $1 AND user_id = $2`,
        [depositId, userId]
      );

      if (depRes.rows.length > 0) {
        const d = depRes.rows[0];
        let signedScreenshotUrl = d.screenshot_url || '';
        if (d.screenshot_url && d.screenshot_url.trim()) {
          try {
            signedScreenshotUrl = await getSignedUrl(d.screenshot_url.trim(), 86400);
          } catch {
            signedScreenshotUrl = d.screenshot_url.trim();
          }
        }

        depositDetail = {
          id: formatTransactionId(d.id),
          amount: paiseToString(stringToPaise(d.amount.toString())),
          utr: d.utr,
          screenshotUrl: signedScreenshotUrl,
          status: d.status,
          rejectReason: d.reject_reason,
          createdAt: d.created_at.toISOString(),
          reviewedAt: d.reviewed_at ? d.reviewed_at.toISOString() : null,
        };

        if (d.status === 'rejected') {
          status = 'rejected';
          statusReason = d.reject_reason || 'Deposit request was rejected';
        } else if (d.status === 'pending' || d.status === 'employee_approved') {
          status = 'pending';
        } else {
          status = 'successful';
        }
      }
    }
  }

  // Case C: Withdrawal interaction
  if (row.ref_type === 'withdrawal' || ['withdrawal_hold', 'withdrawal_paid', 'withdrawal_refund'].includes(row.type)) {
    const withdrawalId = row.ref_id;
    if (withdrawalId) {
      const withRes = await query(
        `SELECT id, amount, upi_id, status, reject_reason, payout_ref, created_at, processed_at
         FROM withdrawal_requests
         WHERE id = $1 AND user_id = $2`,
        [withdrawalId, userId]
      );

      if (withRes.rows.length > 0) {
        const w = withRes.rows[0];
        withdrawalDetail = {
          id: formatTransactionId(w.id),
          amount: paiseToString(stringToPaise(w.amount.toString())),
          upiId: w.upi_id,
          status: w.status,
          rejectReason: w.reject_reason,
          payoutRef: w.payout_ref,
          createdAt: w.created_at.toISOString(),
          processedAt: w.processed_at ? w.processed_at.toISOString() : null,
        };

        if (w.status === 'rejected' || row.type === 'withdrawal_refund') {
          status = 'rejected';
          statusReason = w.reject_reason || 'Withdrawal was rejected and refunded';
        } else if (w.status === 'pending' || w.status === 'employee_approved') {
          status = 'pending';
        } else {
          status = 'successful';
        }
      }
    }
  }

  // Case D: Referral interaction
  let referralDetail: TransactionReferralDetail | null = null;
  if (row.ref_type === 'referral' || row.type === 'referral') {
    const referralId = row.ref_id;
    if (referralId) {
      const refRes = await query(
        `SELECT r.id, r.referred_id, u.username AS referred_username, u.name AS referred_name
         FROM referrals r
         JOIN users u ON u.id = r.referred_id
         WHERE (r.id::text = $1 OR r.referred_id::text = $1) AND r.referrer_id = $2`,
        [referralId.toString(), userId]
      );
      if (refRes.rows.length > 0) {
        const rf = refRes.rows[0];
        referralDetail = {
          id: rf.id.toString(),
          referredUserId: rf.referred_id.toString(),
          referredUsername: rf.referred_username,
          referredName: rf.referred_name || null,
        };
      }
    }

    if (!referralDetail) {
      // Fallback: look up latest referral for this referrer
      const refRes = await query(
        `SELECT r.id, r.referred_id, u.username AS referred_username, u.name AS referred_name
         FROM referrals r
         JOIN users u ON u.id = r.referred_id
         WHERE r.referrer_id = $1
         ORDER BY r.id DESC LIMIT 1`,
        [userId]
      );
      if (refRes.rows.length > 0) {
        const rf = refRes.rows[0];
        referralDetail = {
          id: rf.id.toString(),
          referredUserId: rf.referred_id.toString(),
          referredUsername: rf.referred_username,
          referredName: rf.referred_name || null,
        };
      }
    }
  }

  // Case E: Admin adjustment reason
  let adjustmentDetail: TransactionAdjustmentDetail | null = null;
  if (row.type === 'admin_adjustment' || row.ref_type === 'admin_adjustment') {
    const userNum = String(parseEntityNumber(row.user_id) || parseEntityNumber(userId) || '');
    const userPrefixed = formatUserId(row.user_id || userId);

    const adjRes = await query(
      `SELECT details->>'reason' AS reason
       FROM audit_logs
       WHERE action IN ('balance_adjusted', 'admin_adjust_balance')
         AND target_type = 'user'
         AND (target_id = $1 OR target_id = $2 OR target_id = $3)
         AND ABS(EXTRACT(EPOCH FROM (created_at - $4))) <= 300
       ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - $4))) ASC
       LIMIT 1`,
      [userId, userNum, userPrefixed, row.created_at]
    );
    if (adjRes.rows.length > 0 && adjRes.rows[0].reason) {
      adjustmentDetail = {
        reason: adjRes.rows[0].reason,
      };
    } else {
      // Wider fallback for this user's adjustments
      const fallbackRes = await query(
        `SELECT details->>'reason' AS reason
         FROM audit_logs
         WHERE action IN ('balance_adjusted', 'admin_adjust_balance')
           AND target_type = 'user'
           AND (target_id = $1 OR target_id = $2 OR target_id = $3)
         ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - $4))) ASC
         LIMIT 1`,
        [userId, userNum, userPrefixed, row.created_at]
      );
      if (fallbackRes.rows.length > 0 && fallbackRes.rows[0].reason) {
        adjustmentDetail = {
          reason: fallbackRes.rows[0].reason,
        };
      } else {
        adjustmentDetail = {
          reason: 'Balance adjustment by admin',
        };
      }
    }
  }

  // Fallback single-wallet breakdown if not already populated
  if (!breakdown) {
    const absPaise = Math.abs(amountPaise);
    if (row.wallet === 'add_money') {
      breakdown = { deposited: paiseToString(absPaise) };
    } else if (row.wallet === 'cashback') {
      breakdown = { cashback: paiseToString(absPaise) };
    } else if (row.wallet === 'winning') {
      breakdown = { winning: paiseToString(absPaise) };
    }
  }

  return {
    transactionId:   formatDisplayId(row.id),
    id:              Number(parseEntityNumber(row.id)) || 0,
    type:            row.type,
    createdAt:       row.created_at.toISOString(),
    amount:          paiseToString(amountPaise),
    remainingAmount: paiseToString(totalAfterPaise),
    wallet:          row.wallet,
    walletName,
    status,
    statusReason,
    breakdown,
    match: matchDetail,
    deposit: depositDetail,
    withdrawal: withdrawalDetail,
    referral: referralDetail,
    adjustment: adjustmentDetail,
  };
}
