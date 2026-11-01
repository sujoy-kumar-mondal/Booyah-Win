/**
/**
 * Staff Transactions Service
 *
 * Provides platform-wide transaction listing, filtering, search, and detailed breakdown
 * for staff (Employees and Admins).
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
  formatStaffId,
  formatLedgerRefId,
  parseEntityNumber,
} from '@booyah/shared';
import { AppError } from '../../middleware/errorHandler.js';
import { getSignedUrl } from '../../utils/storage.js';

export interface StaffTransactionListItemDto {
  transactionId: string;    // BW-TRX-XXXXXXX
  id: number;
  userId: string;           // BW-USR-XXXXXXX
  userName: string;
  userEmail: string;
  userUsername?: string | null;
  wallet: string;           // 'add_money' | 'winning' | 'cashback' | 'all'
  walletName: string;       // 'Deposited' | 'Winning' | 'Cashback' | 'Deposited, Cashback & Winning'
  type: string;             // 'add_money' | 'join_fee' | 'winning' | 'refund' | 'withdrawal_hold' | 'withdrawal_refund' | 'referral' | 'admin_adjustment'
  amount: string;           // signed string, e.g. "-10.00" or "+50.00"
  balanceAfter: string;     // "120.00"
  totalAfter: string;       // "150.00"
  refType: string | null;
  refId: string | null;
  createdAt: string;        // ISO string
}

export interface StaffTransactionMatchDetail {
  id: number;
  matchId: string;
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

export interface StaffTransactionDepositDetail {
  id: string;
  amount: string;
  utr: string;
  screenshotUrl: string;
  status: string;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy?: string | null;
}

export interface StaffTransactionWithdrawalDetail {
  id: string;
  amount: string;
  upiId: string;
  status: string;
  rejectReason: string | null;
  payoutRef: string | null;
  createdAt: string;
  processedAt: string | null;
  processedBy?: string | null;
}

export interface StaffTransactionReferralDetail {
  id?: string;
  referredUserId?: string;
  referredUsername: string;
  referredName?: string | null;
}

export interface StaffTransactionAdjustmentDetail {
  reason?: string | null;
  adjustedBy?: string | null;
}

export interface StaffTransactionDetailDto {
  transactionId: string;    // BW-TRX-XXXXXXX
  id: number;
  userId: string;           // BW-USR-XXXXXXX
  userName: string;
  userEmail: string;
  userMobile?: string | null;
  userUsername?: string | null;
  userFfId?: string | null;
  userFfName?: string | null;
  type: string;             // ledger type
  createdAt: string;
  amount: string;           // signed amount, e.g. "-10.00" or "+80.00"
  balanceAfter: string;
  remainingAmount: string;  // total_after
  wallet: string;           // 'add_money' | 'cashback' | 'winning' | 'all'
  walletName: string;       // 'Deposited' | 'Winning' | 'Cashback' | 'Deposited, Cashback & Winning'
  status: 'successful' | 'cancelled' | 'rejected' | 'pending';
  statusReason: string | null;
  refType?: string | null;
  refId?: string | null;
  breakdown?: {
    deposited?: string;
    cashback?: string;
    winning?: string;
  } | null;
  match?: StaffTransactionMatchDetail | null;
  deposit?: StaffTransactionDepositDetail | null;
  withdrawal?: StaffTransactionWithdrawalDetail | null;
  referral?: StaffTransactionReferralDetail | null;
  adjustment?: StaffTransactionAdjustmentDetail | null;
}

export interface ListStaffTransactionsOptions {
  q?: string;
  userId?: string;
  wallet?: string;
  type?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  cursor?: string;
}

function resolveWalletName(wallet: string): string {
  if (wallet === 'winning') return 'Winning';
  if (wallet === 'cashback') return 'Cashback';
  if (wallet === 'all') return 'Deposited, Cashback & Winning';
  return 'Deposited';
}

function formatSignedPaiseString(amountPaise: number): string {
  const sign = amountPaise > 0 ? '+' : '';
  // paiseToString handles negative sign automatically
  return `${sign}${paiseToString(amountPaise)}`;
}

export async function listStaffTransactions(
  options: ListStaffTransactionsOptions
): Promise<{ items: StaffTransactionListItemDto[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit || 20, 1), 100);
  const params: any[] = [];

  let queryText = `
    SELECT 
      wl.id,
      wl.user_id,
      wl.wallet,
      wl.type,
      wl.amount,
      wl.balance_after,
      wl.total_after,
      wl.ref_type,
      wl.ref_id,
      wl.created_at,
      u.name AS user_name,
      u.email AS user_email,
      u.username AS user_username
    FROM wallet_ledger wl
    LEFT JOIN users u ON u.id = wl.user_id
    LEFT JOIN deposit_requests dr ON dr.id = wl.ref_id AND wl.ref_type = 'deposit'
    LEFT JOIN withdrawal_requests wr ON wr.id = wl.ref_id AND wl.ref_type = 'withdrawal'
    WHERE 1=1
  `;

  // Explicit User ID filter
  if (options.userId) {
    const rawUser = options.userId.trim();
    const cleanNum = parseEntityNumber(rawUser);
    if (cleanNum) {
      params.push(cleanNum);
      const p1 = params.length;
      params.push(`BW-USR-${cleanNum}`);
      const p2 = params.length;
      queryText += ` AND (wl.user_id::text = $${p1} OR wl.user_id::text = $${p2})`;
    } else {
      params.push(rawUser);
      queryText += ` AND wl.user_id::text = $${params.length}`;
    }
  }

  // Search filter
  const rawQ = (options.q || '').slice(0, 100).trim();
  if (rawQ) {
    const normalizedQ = rawQ.replace(/\s*-\s*/g, '-').trim();

    // Prefix-only checks (e.g. user typed "BW-TRX", "TRX", "BW-USR", "BW-MCH", "BW-STF", etc.)
    const isTrxPrefixOnly = /^(?:BW-)?TRX-?$/i.test(normalizedQ) || /^BW-?$/i.test(normalizedQ);
    const isUserPrefixOnly = /^(?:BW-)?USR-?$/i.test(normalizedQ);
    const isMatchPrefixOnly = /^(?:BW-)?MCH-?$/i.test(normalizedQ);
    const isDptPrefixOnly = /^(?:BW-)?DPT-?$/i.test(normalizedQ);
    const isWdlPrefixOnly = /^(?:BW-)?WDL-?$/i.test(normalizedQ);
    const isStfPrefixOnly = /^(?:BW-)?STF-?$/i.test(normalizedQ);

    const userMatch = normalizedQ.match(/^(?:BW-)?USR-(\d+)$/i);
    const trxMatch = normalizedQ.match(/^(?:BW-)?TRX-(\d+)$/i);
    const mchMatch = normalizedQ.match(/^(?:BW-)?MCH-(\d+)$/i);
    const dptMatch = normalizedQ.match(/^(?:BW-)?DPT-(\d+)$/i);
    const wdlMatch = normalizedQ.match(/^(?:BW-)?WDL-(\d+)$/i);
    const stfMatch = normalizedQ.match(/^(?:BW-)?STF-(\d+)$/i);

    if (isTrxPrefixOnly) {
      // User typed "BW-TRX", "TRX", "BW-TRX-", "BW-", etc. Show all transactions matching standard format
      queryText += ` AND (wl.id::text ILIKE 'BW-TRX-%' OR ('BW-TRX-' || regexp_replace(wl.id::text, '^BW-TRX-', '')) ILIKE 'BW-TRX-%')`;
    } else if (isUserPrefixOnly) {
      // User typed "BW-USR", "USR", etc.
      queryText += ` AND (wl.user_id::text ILIKE 'BW-USR-%' OR ('BW-USR-' || regexp_replace(wl.user_id::text, '^BW-USR-', '')) ILIKE 'BW-USR-%')`;
    } else if (isMatchPrefixOnly) {
      // User typed "BW-MCH", "MCH", etc.
      queryText += ` AND (wl.ref_type = 'match' OR wl.ref_id::text ILIKE 'BW-MCH-%' OR wl.type IN ('join_fee', 'winning', 'refund'))`;
    } else if (isDptPrefixOnly) {
      queryText += ` AND (wl.ref_type = 'deposit' OR wl.type = 'add_money')`;
    } else if (isWdlPrefixOnly) {
      queryText += ` AND (wl.ref_type = 'withdrawal' OR wl.type IN ('withdrawal_hold', 'withdrawal_refund'))`;
    } else if (isStfPrefixOnly) {
      queryText += ` AND (wl.ref_type = 'admin_adjustment' OR wl.type = 'admin_adjustment' OR wl.ref_id::text ILIKE 'BW-STF-%')`;
    } else if (userMatch) {
      // User explicitly filtered by User UID (e.g. BW-USR-1)
      const targetUserNum = userMatch[1];
      params.push(targetUserNum);
      const p1 = params.length;
      params.push(`BW-USR-${targetUserNum}`);
      const p2 = params.length;
      params.push(`BW-USR-${targetUserNum}%`);
      const p3 = params.length;
      queryText += ` AND (wl.user_id::text = $${p1} OR wl.user_id::text = $${p2} OR wl.user_id::text ILIKE $${p3} OR ('BW-USR-' || regexp_replace(wl.user_id::text, '^BW-USR-', '')) ILIKE $${p3})`;
    } else if (trxMatch) {
      // User explicitly filtered by Transaction ID (e.g. BW-TRX-159 or partial BW-TRX-16)
      const targetTrxNum = trxMatch[1];
      params.push(targetTrxNum);
      const p1 = params.length;
      params.push(`BW-TRX-${targetTrxNum}`);
      const p2 = params.length;
      params.push(`BW-TRX-${targetTrxNum}%`);
      const p3 = params.length;
      queryText += ` AND (wl.id::text = $${p1} OR wl.id::text = $${p2} OR wl.id::text ILIKE $${p3} OR ('BW-TRX-' || regexp_replace(wl.id::text, '^BW-TRX-', '')) ILIKE $${p3})`;
    } else if (mchMatch) {
      // User explicitly filtered by Match ID (e.g. BW-MCH-52)
      const targetMchNum = mchMatch[1];
      params.push(targetMchNum);
      const p1 = params.length;
      params.push(`BW-MCH-${targetMchNum}`);
      const p2 = params.length;
      params.push(`BW-MCH-${targetMchNum}%`);
      const p3 = params.length;
      queryText += ` AND (wl.ref_id::text = $${p1} OR wl.ref_id::text = $${p2} OR wl.ref_id::text ILIKE $${p3}) AND (wl.ref_type = 'match' OR wl.type IN ('join_fee', 'winning', 'refund'))`;
    } else if (dptMatch) {
      // User filtered by legacy Deposit ID (e.g. BW-DPT-12 or BW-TRX-12)
      const targetDptNum = dptMatch[1];
      params.push(targetDptNum);
      const p1 = params.length;
      params.push(`BW-DPT-${targetDptNum}`);
      const p2 = params.length;
      params.push(`BW-TRX-${targetDptNum}`);
      const p3 = params.length;
      params.push(`%${targetDptNum}%`);
      const p4 = params.length;
      queryText += ` AND (wl.ref_id::text = $${p1} OR wl.ref_id::text = $${p2} OR wl.ref_id::text = $${p3} OR wl.id::text = $${p3} OR wl.id::text ILIKE $${p4}) AND (wl.ref_type = 'deposit' OR wl.type = 'add_money')`;
    } else if (wdlMatch) {
      // User filtered by legacy Withdrawal ID (e.g. BW-WDL-5 or BW-TRX-5)
      const targetWdlNum = wdlMatch[1];
      params.push(targetWdlNum);
      const p1 = params.length;
      params.push(`BW-WDL-${targetWdlNum}`);
      const p2 = params.length;
      params.push(`BW-TRX-${targetWdlNum}`);
      const p3 = params.length;
      params.push(`%${targetWdlNum}%`);
      const p4 = params.length;
      queryText += ` AND (wl.ref_id::text = $${p1} OR wl.ref_id::text = $${p2} OR wl.ref_id::text = $${p3} OR wl.id::text = $${p3} OR wl.id::text ILIKE $${p4}) AND (wl.ref_type = 'withdrawal' OR wl.type IN ('withdrawal_hold', 'withdrawal_refund'))`;
    } else if (stfMatch) {
      // User explicitly filtered by Staff ID (e.g. BW-STF-1)
      const targetStfNum = stfMatch[1];
      params.push(targetStfNum);
      const p1 = params.length;
      params.push(`BW-STF-${targetStfNum}`);
      const p2 = params.length;
      params.push(`BW-STF-${targetStfNum}%`);
      const p3 = params.length;
      queryText += ` AND (wl.ref_id::text = $${p1} OR wl.ref_id::text = $${p2} OR wl.ref_id::text ILIKE $${p3}) AND (wl.ref_type = 'admin_adjustment' OR wl.type = 'admin_adjustment')`;
    } else if (rawQ.startsWith('@')) {
      // Username search
      const userTerm = rawQ.replace(/^@/, '').trim();
      const escaped = userTerm.replace(/[%_\\]/g, '\\$&');
      params.push(`%${escaped}%`);
      queryText += ` AND u.username ILIKE $${params.length} ESCAPE '\\'`;
    } else {
      // General free-text query
      const escaped = normalizedQ.replace(/[%_\\]/g, '\\$&');
      params.push(`%${escaped}%`);
      const pIdx = params.length;

      const num = /^\d+$/.test(normalizedQ) ? normalizedQ : null;
      let numClause = '';
      if (num) {
        params.push(num);
        const numIdx = params.length;
        numClause = `
          OR u.id::text = $${numIdx}
          OR wl.id::text = $${numIdx}
          OR wl.id::text ILIKE $${numIdx}
        `;
      }

      queryText += ` AND (
        u.name ILIKE $${pIdx} ESCAPE '\\'
        OR u.email ILIKE $${pIdx} ESCAPE '\\'
        OR u.username ILIKE $${pIdx} ESCAPE '\\'
        OR u.mobile ILIKE $${pIdx} ESCAPE '\\'
        OR wl.id::text ILIKE $${pIdx} ESCAPE '\\'
        OR ('BW-TRX-' || regexp_replace(wl.id::text, '^BW-TRX-', '')) ILIKE $${pIdx} ESCAPE '\\'
        OR wl.user_id::text ILIKE $${pIdx} ESCAPE '\\'
        OR ('BW-USR-' || regexp_replace(wl.user_id::text, '^BW-USR-', '')) ILIKE $${pIdx} ESCAPE '\\'
        OR wl.ref_id::text ILIKE $${pIdx} ESCAPE '\\'
        OR wl.ref_type::text ILIKE $${pIdx} ESCAPE '\\'
        OR wl.type::text ILIKE $${pIdx} ESCAPE '\\'
        OR replace(wl.type::text, '_', ' ') ILIKE $${pIdx} ESCAPE '\\'
        OR dr.utr ILIKE $${pIdx} ESCAPE '\\'
        OR wr.upi_id ILIKE $${pIdx} ESCAPE '\\'
        OR wr.payout_ref ILIKE $${pIdx} ESCAPE '\\'
        ${numClause}
      )`;
    }
  }

  // Wallet filter
  if (options.wallet && options.wallet !== 'all') {
    params.push(options.wallet);
    queryText += ` AND wl.wallet = $${params.length}`;
  }

  // Type filter
  if (options.type && options.type !== 'all') {
    if (options.type === 'withdrawal') {
      queryText += ` AND wl.type IN ('withdrawal_hold', 'withdrawal_refund')`;
    } else {
      params.push(options.type);
      queryText += ` AND wl.type = $${params.length}`;
    }
  }

  // Date filters
  if (options.fromDate) {
    params.push(options.fromDate);
    queryText += ` AND wl.created_at >= $${params.length}::date`;
  }
  if (options.toDate) {
    params.push(options.toDate);
    queryText += ` AND wl.created_at < ($${params.length}::date + interval '1 day')`;
  }

  // Cursor pagination
  if (options.cursor) {
    params.push(options.cursor);
    queryText += ` AND NULLIF(regexp_replace(wl.id, '^BW-TRX-', ''), '')::bigint < NULLIF(regexp_replace($${params.length}, '^BW-TRX-', ''), '')::bigint`;
  }

  queryText += ` ORDER BY NULLIF(regexp_replace(wl.id, '^BW-TRX-', ''), '')::bigint DESC LIMIT $${params.length + 1}`;
  params.push(limit + 1);

  const res = await query(queryText, params);
  const hasNext = res.rows.length > limit;
  const rows = hasNext ? res.rows.slice(0, limit) : res.rows;
  const nextCursor = hasNext ? rows[rows.length - 1].id.toString() : null;

  const items: StaffTransactionListItemDto[] = rows.map((row) => {
    const amountPaise = stringToPaise(row.amount.toString());
    const balanceAfterPaise = stringToPaise(row.balance_after.toString());
    const totalAfterPaise = stringToPaise(row.total_after.toString());

    return {
      transactionId: formatTransactionId(row.id),
      id: Number(parseEntityNumber(row.id)) || 0,
      userId: formatUserId(row.user_id),
      userName: row.user_name || 'Unknown User',
      userEmail: row.user_email || '',
      userUsername: row.user_username || null,
      wallet: row.wallet,
      walletName: resolveWalletName(row.wallet),
      type: row.type,
      amount: formatSignedPaiseString(amountPaise),
      balanceAfter: paiseToString(balanceAfterPaise),
      totalAfter: paiseToString(totalAfterPaise),
      refType: row.ref_type ?? null,
      refId: formatLedgerRefId(row.ref_id, row.type, row.ref_type),
      createdAt: row.created_at.toISOString(),
    };
  });

  return { items, nextCursor };
}

export async function getStaffTransactionDetail(
  transactionIdParam: string
): Promise<StaffTransactionDetailDto> {
  const trimmed = transactionIdParam.trim();
  const upper = trimmed.toUpperCase();

  const isExplicitDep =
    upper.startsWith('DEP-') ||
    upper.startsWith('BW-DEP-') ||
    upper.startsWith('DPT-') ||
    upper.startsWith('BW-DPT-');
  const isExplicitWth =
    upper.startsWith('WTH-') ||
    upper.startsWith('BW-WTH-') ||
    upper.startsWith('WDL-') ||
    upper.startsWith('BW-WDL-');

  // Explicit Deposit lookup
  if (isExplicitDep) {
    const rawDepNum = parseEntityNumber(trimmed);
    const depKey = `BW-DPT-${rawDepNum}`;
    if (rawDepNum) {
      const ledgerDepRes = await query(
        `SELECT wl.*, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile,
                u.username AS user_username, u.ff_id AS user_ff_id, u.ff_name AS user_ff_name
         FROM wallet_ledger wl
         LEFT JOIN users u ON u.id = wl.user_id
         WHERE wl.ref_type = 'deposit' AND (wl.ref_id = $1 OR wl.ref_id = $2)
         ORDER BY NULLIF(regexp_replace(wl.id, '^BW-TRX-', ''), '')::bigint DESC LIMIT 1`,
        [depKey, rawDepNum]
      );
      if (ledgerDepRes.rows.length > 0) {
        return buildStaffTransactionDetailFromLedger(ledgerDepRes.rows[0]);
      }

      // Standalone/pending/rejected deposit lookup
      const depRes = await query(
        `SELECT dr.*, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile,
                u.username AS user_username, u.ff_id AS user_ff_id, u.ff_name AS user_ff_name,
                w.add_money, w.cashback, w.winning
         FROM deposit_requests dr
         LEFT JOIN users u ON u.id = dr.user_id
         LEFT JOIN wallets w ON w.user_id = dr.user_id
         WHERE dr.id = $1 OR dr.id = $2`,
        [depKey, rawDepNum]
      );

      if (depRes.rows.length > 0) {
        const dr = depRes.rows[0];
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
          userId: formatUserId(dr.user_id),
          userName: dr.user_name || 'Unknown User',
          userEmail: dr.user_email || '',
          userMobile: dr.user_mobile || null,
          userUsername: dr.user_username || null,
          userFfId: dr.user_ff_id || null,
          userFfName: dr.user_ff_name || null,
          type: 'add_money',
          createdAt: dr.created_at.toISOString(),
          amount: '+' + paiseToString(stringToPaise(dr.amount.toString())),
          balanceAfter: paiseToString(currentTotalPaise),
          remainingAmount: paiseToString(currentTotalPaise),
          wallet: 'add_money',
          walletName: 'Deposited',
          status: dr.status === 'approved' ? 'successful' : dr.status === 'rejected' ? 'rejected' : 'pending',
          statusReason: dr.reject_reason || (dr.status === 'pending' ? 'Verification in progress' : null),
          refType: null,
          refId: null,
          breakdown: null,
          deposit: {
            id: formatTransactionId(dr.id),
            amount: paiseToString(stringToPaise(dr.amount.toString())),
            utr: dr.utr,
            screenshotUrl: signedScreenshotUrl,
            status: dr.status,
            rejectReason: dr.reject_reason,
            createdAt: dr.created_at.toISOString(),
            reviewedAt: dr.reviewed_at ? dr.reviewed_at.toISOString() : null,
            reviewedBy: dr.reviewed_by ? formatStaffId(dr.reviewed_by) : null,
          },
          match: null,
          withdrawal: null,
          referral: null,
          adjustment: null,
        };
      }
    }
  }

  // Explicit Withdrawal lookup
  if (isExplicitWth) {
    const rawWthNum = parseEntityNumber(trimmed);
    const wthKey = `BW-WDL-${rawWthNum}`;
    if (rawWthNum) {
      const ledgerWthRes = await query(
        `SELECT wl.*, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile,
                u.username AS user_username, u.ff_id AS user_ff_id, u.ff_name AS user_ff_name
         FROM wallet_ledger wl
         LEFT JOIN users u ON u.id = wl.user_id
         WHERE wl.ref_type = 'withdrawal' AND (wl.ref_id = $1 OR wl.ref_id = $2)
         ORDER BY NULLIF(regexp_replace(wl.id, '^BW-TRX-', ''), '')::bigint DESC LIMIT 1`,
        [wthKey, rawWthNum]
      );
      if (ledgerWthRes.rows.length > 0) {
        return buildStaffTransactionDetailFromLedger(ledgerWthRes.rows[0]);
      }

      // Standalone/pending/rejected withdrawal lookup
      const wthRes = await query(
        `SELECT wr.*, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile,
                u.username AS user_username, u.ff_id AS user_ff_id, u.ff_name AS user_ff_name,
                w.add_money, w.cashback, w.winning
         FROM withdrawal_requests wr
         LEFT JOIN users u ON u.id = wr.user_id
         LEFT JOIN wallets w ON w.user_id = wr.user_id
         WHERE wr.id = $1 OR wr.id = $2`,
        [wthKey, rawWthNum]
      );

      if (wthRes.rows.length > 0) {
        const wr = wthRes.rows[0];
        const currentTotalPaise =
          wr.add_money != null && wr.winning != null && wr.cashback != null
            ? stringToPaise(wr.add_money.toString()) +
              stringToPaise(wr.winning.toString()) +
              stringToPaise(wr.cashback.toString())
            : 0;

        return {
          transactionId: formatTransactionId(wr.id),
          id: Number(rawWthNum) || 0,
          userId: formatUserId(wr.user_id),
          userName: wr.user_name || 'Unknown User',
          userEmail: wr.user_email || '',
          userMobile: wr.user_mobile || null,
          userUsername: wr.user_username || null,
          userFfId: wr.user_ff_id || null,
          userFfName: wr.user_ff_name || null,
          type: 'withdrawal',
          createdAt: wr.created_at.toISOString(),
          amount: '-' + paiseToString(stringToPaise(wr.amount.toString())),
          balanceAfter: paiseToString(currentTotalPaise),
          remainingAmount: paiseToString(currentTotalPaise),
          wallet: 'winning',
          walletName: 'Winning',
          status: wr.status === 'paid' ? 'successful' : wr.status === 'rejected' ? 'rejected' : 'pending',
          statusReason: wr.reject_reason || (wr.status === 'pending' ? 'Verification in progress' : null),
          refType: null,
          refId: null,
          breakdown: null,
          withdrawal: {
            id: formatTransactionId(wr.id),
            amount: paiseToString(stringToPaise(wr.amount.toString())),
            upiId: wr.upi_id,
            status: wr.status,
            rejectReason: wr.reject_reason,
            payoutRef: wr.payout_ref,
            createdAt: wr.created_at.toISOString(),
            processedAt: wr.processed_at ? wr.processed_at.toISOString() : null,
            processedBy: wr.processed_by ? formatStaffId(wr.processed_by) : null,
          },
          match: null,
          deposit: null,
          referral: null,
          adjustment: null,
        };
      }
    }
  }

  // Standard numeric or BW-TRX-XXXXXXX ledger lookup
  const rawId = parseEntityNumber(trimmed);
  if (!rawId) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Transaction not found', 404);
  }

  const prefixedId = `BW-TRX-${rawId}`;
  const ledgerRes = await query(
    `SELECT wl.*, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile,
            u.username AS user_username, u.ff_id AS user_ff_id, u.ff_name AS user_ff_name
     FROM wallet_ledger wl
     LEFT JOIN users u ON u.id = wl.user_id
     WHERE (wl.id = $1 OR wl.id = $2)`,
    [prefixedId, rawId]
  );

  if (ledgerRes.rows.length > 0) {
    return buildStaffTransactionDetailFromLedger(ledgerRes.rows[0]);
  }

  // Fallback: check deposit_requests or withdrawal_requests
  const depFallback = await query(
    `SELECT dr.*, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile,
            u.username AS user_username, u.ff_id AS user_ff_id, u.ff_name AS user_ff_name,
            w.add_money, w.cashback, w.winning
     FROM deposit_requests dr
     LEFT JOIN users u ON u.id = dr.user_id
     LEFT JOIN wallets w ON w.user_id = dr.user_id
     WHERE dr.id = $1 OR dr.id = $2 OR dr.id = $3`,
    [prefixedId, rawId, `BW-DPT-${rawId}`]
  );
  if (depFallback.rows.length > 0) {
    const dr = depFallback.rows[0];
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
      id: Number(rawId) || 0,
      userId: formatUserId(dr.user_id),
      userName: dr.user_name || 'Unknown User',
      userEmail: dr.user_email || '',
      userMobile: dr.user_mobile || null,
      userUsername: dr.user_username || null,
      userFfId: dr.user_ff_id || null,
      userFfName: dr.user_ff_name || null,
      type: 'add_money',
      createdAt: dr.created_at.toISOString(),
      amount: '+' + paiseToString(stringToPaise(dr.amount.toString())),
      balanceAfter: paiseToString(currentTotalPaise),
      remainingAmount: paiseToString(currentTotalPaise),
      wallet: 'add_money',
      walletName: 'Deposited',
      status: dr.status === 'approved' ? 'successful' : dr.status === 'rejected' ? 'rejected' : 'pending',
      statusReason: dr.reject_reason || (dr.status === 'pending' ? 'Verification in progress' : null),
      refType: null,
      refId: null,
      breakdown: null,
      deposit: {
        id: formatTransactionId(dr.id),
        amount: paiseToString(stringToPaise(dr.amount.toString())),
        utr: dr.utr,
        screenshotUrl: signedScreenshotUrl,
        status: dr.status,
        rejectReason: dr.reject_reason,
        createdAt: dr.created_at.toISOString(),
        reviewedAt: dr.reviewed_at ? dr.reviewed_at.toISOString() : null,
        reviewedBy: dr.reviewed_by ? formatStaffId(dr.reviewed_by) : null,
      },
      match: null,
      withdrawal: null,
      referral: null,
      adjustment: null,
    };
  }

  const wthFallback = await query(
    `SELECT wr.*, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile,
            u.username AS user_username, u.ff_id AS user_ff_id, u.ff_name AS user_ff_name,
            w.add_money, w.cashback, w.winning
     FROM withdrawal_requests wr
     LEFT JOIN users u ON u.id = wr.user_id
     LEFT JOIN wallets w ON w.user_id = wr.user_id
     WHERE wr.id = $1 OR wr.id = $2 OR wr.id = $3`,
    [prefixedId, rawId, `BW-WDL-${rawId}`]
  );
  if (wthFallback.rows.length > 0) {
    const wr = wthFallback.rows[0];
    const currentTotalPaise =
      wr.add_money != null && wr.winning != null && wr.cashback != null
        ? stringToPaise(wr.add_money.toString()) +
          stringToPaise(wr.winning.toString()) +
          stringToPaise(wr.cashback.toString())
        : 0;

    return {
      transactionId: formatTransactionId(wr.id),
      id: Number(rawId) || 0,
      userId: formatUserId(wr.user_id),
      userName: wr.user_name || 'Unknown User',
      userEmail: wr.user_email || '',
      userMobile: wr.user_mobile || null,
      userUsername: wr.user_username || null,
      userFfId: wr.user_ff_id || null,
      userFfName: wr.user_ff_name || null,
      type: 'withdrawal',
      createdAt: wr.created_at.toISOString(),
      amount: '-' + paiseToString(stringToPaise(wr.amount.toString())),
      balanceAfter: paiseToString(currentTotalPaise),
      remainingAmount: paiseToString(currentTotalPaise),
      wallet: 'winning',
      walletName: 'Winning',
      status: wr.status === 'paid' ? 'successful' : wr.status === 'rejected' ? 'rejected' : 'pending',
      statusReason: wr.reject_reason || (wr.status === 'pending' ? 'Verification in progress' : null),
      refType: null,
      refId: null,
      breakdown: null,
      withdrawal: {
        id: formatTransactionId(wr.id),
        amount: paiseToString(stringToPaise(wr.amount.toString())),
        upiId: wr.upi_id,
        status: wr.status,
        rejectReason: wr.reject_reason,
        payoutRef: wr.payout_ref,
        createdAt: wr.created_at.toISOString(),
        processedAt: wr.processed_at ? wr.processed_at.toISOString() : null,
        processedBy: wr.processed_by ? formatStaffId(wr.processed_by) : null,
      },
      match: null,
      deposit: null,
      referral: null,
      adjustment: null,
    };
  }

  throw new AppError(ErrorCodes.NOT_FOUND, 'Transaction not found', 404);
}

async function buildStaffTransactionDetailFromLedger(
  row: any
): Promise<StaffTransactionDetailDto> {
  const amountPaise = stringToPaise(row.amount.toString());
  const balanceAfterPaise = stringToPaise(row.balance_after.toString());
  const totalAfterPaise = stringToPaise(row.total_after.toString());
  const userId = row.user_id;

  const walletName = resolveWalletName(row.wallet);

  let status: 'successful' | 'cancelled' | 'rejected' | 'pending' = 'successful';
  let statusReason: string | null = null;

  let breakdown: { deposited?: string; cashback?: string; winning?: string } | null = null;
  let matchDetail: StaffTransactionMatchDetail | null = null;
  let depositDetail: StaffTransactionDepositDetail | null = null;
  let withdrawalDetail: StaffTransactionWithdrawalDetail | null = null;
  let referralDetail: StaffTransactionReferralDetail | null = null;
  let adjustmentDetail: StaffTransactionAdjustmentDetail | null = null;

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
        const gameModeTitle = m.game_mode === 'clash_squad' ? 'CLASH SQUAD' : 'BATTLE ROYALE';
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
          matchId: formatMatchId(m.id),
          title,
          gameMode: m.game_mode,
          teamMode: m.team_mode || 'solo',
          mapName: m.map_name ?? null,
          entryFee: paiseToString(stringToPaise(m.entry_fee.toString())),
          killPrice: paiseToString(stringToPaise(m.kill_price.toString())),
          startTime: m.start_time.toISOString(),
          status: m.status,
          cancelReason: m.cancel_reason ?? null,
          kills,
          rank,
          prizeAmount,
        };

        if (m.status === 'cancelled') {
          status = 'cancelled';
          statusReason = m.cancel_reason || 'Match was cancelled';
        }
      }
    }
  }

  // Case B: Deposit interaction
  if (row.ref_type === 'deposit' || row.type === 'add_money') {
    const depId = row.ref_id;
    if (depId) {
      const depRes = await query(
        `SELECT id, amount, utr, screenshot_url, status, reject_reason, created_at, reviewed_at, reviewed_by
         FROM deposit_requests
         WHERE id = $1`,
        [depId]
      );

      if (depRes.rows.length > 0) {
        const dr = depRes.rows[0];
        let signedScreenshotUrl = dr.screenshot_url || '';
        if (dr.screenshot_url && dr.screenshot_url.trim()) {
          try {
            signedScreenshotUrl = await getSignedUrl(dr.screenshot_url.trim(), 86400);
          } catch {
            signedScreenshotUrl = dr.screenshot_url.trim();
          }
        }

        depositDetail = {
          id: formatTransactionId(dr.id),
          amount: paiseToString(stringToPaise(dr.amount.toString())),
          utr: dr.utr,
          screenshotUrl: signedScreenshotUrl,
          status: dr.status,
          rejectReason: dr.reject_reason ?? null,
          createdAt: dr.created_at.toISOString(),
          reviewedAt: dr.reviewed_at ? dr.reviewed_at.toISOString() : null,
          reviewedBy: dr.reviewed_by ? formatStaffId(dr.reviewed_by) : null,
        };

        if (dr.status === 'rejected') {
          status = 'rejected';
          statusReason = dr.reject_reason || 'Deposit request was rejected';
        }
      }
    }
  }

  // Case C: Withdrawal interaction
  if (row.ref_type === 'withdrawal' || ['withdrawal_hold', 'withdrawal_refund'].includes(row.type)) {
    const wthId = row.ref_id;
    if (wthId) {
      const wthRes = await query(
        `SELECT id, amount, upi_id, status, reject_reason, payout_ref, created_at, processed_at, processed_by
         FROM withdrawal_requests
         WHERE id = $1`,
        [wthId]
      );

      if (wthRes.rows.length > 0) {
        const wr = wthRes.rows[0];
        withdrawalDetail = {
          id: formatTransactionId(wr.id),
          amount: paiseToString(stringToPaise(wr.amount.toString())),
          upiId: wr.upi_id,
          status: wr.status,
          rejectReason: wr.reject_reason ?? null,
          payoutRef: wr.payout_ref ?? null,
          createdAt: wr.created_at.toISOString(),
          processedAt: wr.processed_at ? wr.processed_at.toISOString() : null,
          processedBy: wr.processed_by ? formatStaffId(wr.processed_by) : null,
        };

        if (wr.status === 'rejected') {
          status = 'rejected';
          statusReason = wr.reject_reason || 'Withdrawal was rejected';
        }
      }
    }
  }

  // Case D: Referral reward
  if (row.ref_type === 'referral' || row.type === 'referral') {
    const refUserId = row.ref_id;
    if (refUserId) {
      const refUserRes = await query(
        `SELECT id, name, username FROM users WHERE id = $1`,
        [refUserId]
      );
      if (refUserRes.rows.length > 0) {
        const ru = refUserRes.rows[0];
        referralDetail = {
          id: formatUserId(ru.id),
          referredUserId: formatUserId(ru.id),
          referredUsername: ru.username || 'User',
          referredName: ru.name || null,
        };
      }
    }
  }

  // Case E: Admin adjustment
  if (row.type === 'admin_adjustment' || row.ref_type === 'admin_adjustment') {
    const userNum = String(parseEntityNumber(row.user_id) || parseEntityNumber(userId) || '');
    const userPrefixed = formatUserId(row.user_id || userId);

    const auditRes = await query(
      `SELECT a.details, a.staff_id, s.name AS staff_name, s.email AS staff_email, a.created_at
       FROM audit_logs a
       LEFT JOIN staff s ON a.staff_id = s.id
       WHERE a.action IN ('balance_adjusted', 'admin_adjust_balance')
         AND (a.target_id = $1 OR a.target_id = $2 OR a.target_id = $3)
       ORDER BY ABS(EXTRACT(EPOCH FROM (a.created_at - $4))) ASC
       LIMIT 1`,
      [userId, userNum, userPrefixed, row.created_at]
    );

    let reason: string | null = null;
    let adjustedBy: string | null = null;
    if (auditRes.rows.length > 0) {
      const al = auditRes.rows[0];
      if (al.staff_id) {
        adjustedBy = formatStaffId(al.staff_id) + (al.staff_name ? ` (${al.staff_name})` : '');
      } else {
        adjustedBy = al.staff_email || 'Admin';
      }
      if (al.details && typeof al.details === 'object' && al.details.reason) {
        reason = String(al.details.reason);
      }
    }

    adjustmentDetail = {
      reason: reason || 'Balance adjustment by admin',
      adjustedBy: adjustedBy || (row.ref_id ? formatStaffId(row.ref_id) : 'Admin'),
    };
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
    transactionId: formatTransactionId(row.id),
    id: Number(parseEntityNumber(row.id)) || 0,
    userId: formatUserId(row.user_id),
    userName: row.user_name || 'Unknown User',
    userEmail: row.user_email || '',
    userMobile: row.user_mobile || null,
    userUsername: row.user_username || null,
    userFfId: row.user_ff_id || null,
    userFfName: row.user_ff_name || null,
    type: row.type,
    createdAt: row.created_at.toISOString(),
    amount: formatSignedPaiseString(amountPaise),
    balanceAfter: paiseToString(balanceAfterPaise),
    remainingAmount: paiseToString(totalAfterPaise),
    wallet: row.wallet,
    walletName,
    status,
    statusReason,
    refType: row.ref_type ?? null,
    refId: formatLedgerRefId(row.ref_id, row.type, row.ref_type),
    breakdown,
    match: matchDetail,
    deposit: depositDetail,
    withdrawal: withdrawalDetail,
    referral: referralDetail,
    adjustment: adjustmentDetail,
  };
}
