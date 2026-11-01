/**
 * Audit Logs Page (Admin Only)
 * Section 16.5
 *
 * Requirements:
 * - Constraint 4: Never render the raw "details" object of an audit entry.
 *   Show an allowlisted set of keys per action (wallet, amount, reason, ids) and nothing else.
 *   Details containing keys named pan, aadhaar, token, and password must not appear in the DOM.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminAuditLogs, type AdminAuditLogItemDto } from '../api/admin.js';
import { formatISTDate, formatIndianRupees, formatStaffId, formatUserId } from '../utils/formatters.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import {
  FileText,
  RefreshCw,
  Filter,
  Calendar,
  User,
  AlertCircle,
  Tag,
  ChevronRight,
  Sliders,
  Gamepad2,
  Play,
  QrCode,
} from 'lucide-react';

// Forbidden keys that must NEVER appear in the DOM under any circumstances
const FORBIDDEN_KEYS = new Set(['pan', 'aadhaar', 'token', 'password']);

// Strict allowlist per action
const ACTION_ALLOWLIST: Record<string, string[]> = {
  deposit_approved: ['amount', 'userId'],
  deposit_rejected: ['amount', 'userId', 'reason'],
  deposit_verified: ['amount', 'userId', 'utr'],
  deposit_approved_direct: ['amount', 'userId'],
  withdrawal_approved: ['amount', 'userId'],
  withdrawal_rejected: ['amount', 'userId', 'reason'],
  withdrawal_verified: ['amount', 'userId', 'upiId'],
  withdrawal_paid: ['amount', 'userId', 'reference'],
  withdrawal_paid_direct: ['amount', 'userId'],
  balance_adjusted: ['wallet', 'amount', 'reason', 'adminId'],
  user_deleted: ['reason', 'deletedBy'],
  tier_created: ['entryFee', 'gameMode', 'teamMode', 'positionsCount'],
  tier_updated: ['updatedFields'],
  tier_deleted: [],
  employee_created: ['name', 'email', 'mobile'],
  employee_updated: ['updatedFields'],
  employee_deleted: [],
  match_created: ['tierId', 'gameMode', 'teamMode', 'startTime'],
  match_room_opened: ['roomId'],
  match_went_live: [],
  match_cancelled: ['reason', 'refundedPlayersCount'],
  match_result_submitted: ['resultId'],
  match_result_approved: ['resultId', 'totalPayoutPaise', 'payeesCount'],
  match_result_resubmitted: ['resultId'],
  match_result_submitted_and_approved: ['resultId', 'totalPayoutPaise'],
  result_rejected: ['reason', 'resultId'],
  result_reversed: ['reason'],
  settings_updated: ['updatedKeys'],
  settings_payment_qr_updated: ['newKey', 'oldKey'],
  settings_match_banner_deleted: ['gameMode', 'oldKey'],
  settings_match_banner_cs_deleted: ['gameMode', 'oldKey'],
  important_update_created: ['title', 'category', 'heading', 'isActive', 'sortOrder'],
  important_update_modified: ['title', 'category', 'heading', 'isActive', 'sortOrder'],
  important_update_deleted: ['title', 'category', 'heading'],
  banner_created: ['title', 'targetUrl', 'sortOrder', 'isActive'],
  banner_updated: ['title', 'targetUrl', 'sortOrder', 'isActive'],
  banner_deleted: ['title'],
  notification_sent: ['title', 'target', 'type'],
  notification_deleted: ['notificationId', 'title'],
  step_up: ['method', 'verified'],
  user_viewed: ['viewedUserId', 'reason'],
  user_view_limit_exceeded: ['reason'],
  __fallback: [
    'title',
    'category',
    'heading',
    'wallet',
    'amount',
    'reason',
    'adminId',
    'staffId',
    'userId',
    'targetId',
    'id',
    'updatedKeys',
    'updatedFields',
    'gameMode',
    'isActive',
    'sortOrder',
  ],
};

/**
 * Converts snake_case audit actions to human-readable Title Case labels.
 * e.g. "deposit_approved" -> "Deposit Approved", "settings_payment_qr_updated" -> "Settings Payment QR Updated"
 */
export function formatActionLabel(action: string | null | undefined): string {
  if (!action) return '';
  return action
    .split('_')
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === 'qr') return 'QR';
      if (lower === 'id') return 'ID';
      if (lower === 'cs') return 'CS';
      if (lower === 'utr') return 'UTR';
      if (lower === 'upi') return 'UPI';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export const AUDIT_ACTION_OPTIONS: Array<{ value: string; label: string }> = [
  // Financial & Wallet
  { value: 'deposit_approved', label: 'Deposit Approved' },
  { value: 'deposit_rejected', label: 'Deposit Rejected' },
  { value: 'deposit_verified', label: 'Deposit Verified' },
  { value: 'deposit_approved_direct', label: 'Deposit Approved Direct' },
  { value: 'withdrawal_approved', label: 'Withdrawal Approved' },
  { value: 'withdrawal_rejected', label: 'Withdrawal Rejected' },
  { value: 'withdrawal_verified', label: 'Withdrawal Verified' },
  { value: 'withdrawal_paid', label: 'Withdrawal Paid' },
  { value: 'withdrawal_paid_direct', label: 'Withdrawal Paid Direct' },
  { value: 'balance_adjusted', label: 'Balance Adjusted' },
  // Users & Staff
  { value: 'user_deleted', label: 'User Deleted' },
  { value: 'user_viewed', label: 'User Viewed' },
  { value: 'step_up', label: 'Step-Up Verification' },
  // Match Management
  { value: 'match_created', label: 'Match Created' },
  { value: 'match_room_opened', label: 'Match Room Opened' },
  { value: 'match_went_live', label: 'Match Went Live' },
  { value: 'match_cancelled', label: 'Match Cancelled' },
  // Results & Approvals
  { value: 'match_result_submitted', label: 'Match Result Submitted' },
  { value: 'match_result_approved', label: 'Match Result Approved' },
  { value: 'match_result_resubmitted', label: 'Match Result Resubmitted' },
  { value: 'match_result_submitted_and_approved', label: 'Match Result Submitted & Approved' },
  { value: 'result_rejected', label: 'Result Rejected' },
  { value: 'result_reversed', label: 'Result Reversed' },
  // Tiers
  { value: 'tier_created', label: 'Tier Created' },
  { value: 'tier_updated', label: 'Tier Updated' },
  { value: 'tier_deleted', label: 'Tier Deleted' },
  // Employees
  { value: 'employee_created', label: 'Employee Created' },
  { value: 'employee_updated', label: 'Employee Updated' },
  { value: 'employee_deleted', label: 'Employee Deleted' },
  // Settings & Banners
  { value: 'settings_updated', label: 'Settings Updated' },
  { value: 'settings_payment_qr_updated', label: 'Settings Payment QR Updated' },
  { value: 'settings_match_banner_deleted', label: 'Settings Match Banner Deleted' },
  { value: 'settings_match_banner_cs_deleted', label: 'Settings CS Match Banner Deleted' },
  { value: 'banner_created', label: 'Banner Created' },
  { value: 'banner_updated', label: 'Banner Updated' },
  { value: 'banner_deleted', label: 'Banner Deleted' },
  // Important Updates & Notifications
  { value: 'important_update_created', label: 'Important Update Created' },
  { value: 'important_update_modified', label: 'Important Update Modified' },
  { value: 'important_update_deleted', label: 'Important Update Deleted' },
  { value: 'notification_sent', label: 'Notification Sent' },
  { value: 'notification_deleted', label: 'Notification Deleted' },
];

function formatKeyLabel(key: string): string {
  switch (key) {
    case 'userId':
    case 'viewedUserId':
      return 'User';
    case 'targetUserId':
      return 'Target User';
    case 'adminId':
      return 'Admin';
    case 'staffId':
      return 'Staff';
    case 'deletedBy':
      return 'Deleted By';
    case 'entryFee':
      return 'Entry Fee';
    case 'gameMode':
      return 'Mode';
    case 'teamMode':
      return 'Team';
    case 'startTime':
      return 'Start';
    case 'endTime':
      return 'End';
    case 'refundedPlayersCount':
      return 'Refunded';
    case 'updatedKeys':
      return 'Keys';
    case 'updatedFields':
      return 'Fields';
    case 'positionsCount':
      return 'Positions';
    default:
      return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim();
  }
}

/**
 * Renders ONLY allowlisted keys for an action.
 * Never outputs the raw details object or forbidden keys (pan, aadhaar, token, password).
 */
export function renderAuditDetails(
  action: string,
  details: Record<string, any> | null | undefined
): React.ReactNode {
  // Known actions with zero extra parameters
  if (action === 'tier_deleted') {
    return (
      <span className="text-slate-500 text-[11px] italic" data-testid="safe-audit-details">
        Tier deleted
      </span>
    );
  }

  if (action === 'employee_deleted') {
    return (
      <span className="text-slate-500 text-[11px] italic" data-testid="safe-audit-details">
        Employee deleted
      </span>
    );
  }

  if (action === 'match_went_live') {
    return (
      <div className="flex items-center gap-1 py-0.5 text-emerald-400 text-xs font-medium" data-testid="safe-audit-details">
        <Play className="h-3 w-3 fill-current" />
        <span>Match Went Live</span>
      </div>
    );
  }

  if (!details || typeof details !== 'object') {
    return (
      <span className="text-slate-500 text-[11px] italic" data-testid="safe-audit-details">
        No extra parameters
      </span>
    );
  }

  const allowlist = ACTION_ALLOWLIST[action] || ACTION_ALLOWLIST.__fallback;

  // Filter keys against allowlist and ensure no forbidden key leaks
  const safe: Record<string, any> = {};
  const safeEntries: Array<{ key: string; value: any }> = [];

  for (const key of allowlist) {
    const lowerKey = key.toLowerCase();
    if (FORBIDDEN_KEYS.has(lowerKey)) continue;
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('aadhaar') ||
      lowerKey.includes('pan')
    ) {
      continue;
    }

    if (key in details && details[key] !== undefined && details[key] !== null) {
      safe[key] = details[key];
      safeEntries.push({ key, value: details[key] });
    }
  }

  // 1. Important Updates: sleek 2-line layout
  if (
    action === 'important_update_created' ||
    action === 'important_update_modified' ||
    action === 'important_update_deleted'
  ) {
    return (
      <div className="flex flex-col gap-1 py-0.5 max-w-md" data-testid="safe-audit-details">
        <div className="flex items-center gap-1.5 flex-nowrap">
          <span
            className="font-semibold text-slate-200 text-xs truncate"
            title={safe.title}
            data-testid="audit-detail-title"
          >
            {safe.title}
          </span>
          {safe.sortOrder !== undefined && (
            <span
              className="text-[10px] font-mono text-slate-500 shrink-0"
              data-testid="audit-detail-sortOrder"
            >
              #{safe.sortOrder}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {safe.category && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 whitespace-nowrap"
              data-testid="audit-detail-category"
            >
              {safe.category}
            </span>
          )}
          {safe.isActive !== undefined && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                safe.isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
              data-testid="audit-detail-isActive"
            >
              {safe.isActive ? 'Active' : 'Inactive'}
            </span>
          )}
          {safe.heading && (
            <span
              className="text-[10px] text-slate-400 truncate max-w-[200px]"
              title={safe.heading}
              data-testid="audit-detail-heading"
            >
              {safe.heading}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 2. Settings Updated: compact count badge + nowrap preview
  if (action === 'settings_updated') {
    const rawKeys = Array.isArray(safe.updatedKeys)
      ? safe.updatedKeys
      : safe.updatedKeys
      ? [String(safe.updatedKeys)]
      : [];
    const keysCount = rawKeys.length;
    let displayVal = '';
    if (keysCount > 2) {
      displayVal = `${rawKeys.slice(0, 2).join(', ')} (+${keysCount - 2} more)`;
    } else {
      displayVal = rawKeys.join(', ');
    }

    return (
      <div className="flex items-center gap-2 flex-nowrap py-0.5 overflow-hidden" data-testid="safe-audit-details">
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap shrink-0">
          <Sliders className="h-3 w-3" />
          {keysCount} {keysCount === 1 ? 'setting' : 'settings'} modified
        </span>
        <span
          className="font-mono text-[11px] text-slate-300 whitespace-nowrap truncate max-w-[260px]"
          title={rawKeys.join(', ')}
          data-testid="audit-detail-updatedKeys"
        >
          {displayVal}
        </span>
      </div>
    );
  }

  // 3. Settings Match Banner Reset to default
  if (
    action === 'settings_match_banner_deleted' ||
    action === 'settings_match_banner_cs_deleted'
  ) {
    const isCs = action.includes('_cs_') || safe.gameMode === 'clash_squad';
    return (
      <div className="flex items-center gap-2 flex-wrap py-0.5" data-testid="safe-audit-details">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 whitespace-nowrap"
          data-testid="audit-detail-gameMode"
        >
          {isCs ? 'Clash Squad' : 'Battle Royale'}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 whitespace-nowrap">
          Reset to Default Graphic
        </span>
        {safe.oldKey && (
          <span className="sr-only" data-testid="audit-detail-oldKey">
            {String(safe.oldKey)}
          </span>
        )}
      </div>
    );
  }

  // 4. Payment QR Updated
  if (action === 'settings_payment_qr_updated') {
    return (
      <div className="flex items-center gap-2 py-0.5" data-testid="safe-audit-details">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 whitespace-nowrap">
          <QrCode className="h-3 w-3" />
          Payment QR Code Updated
        </span>
        {safe.newKey && <span className="sr-only" data-testid="audit-detail-newKey">{String(safe.newKey)}</span>}
        {safe.oldKey && <span className="sr-only" data-testid="audit-detail-oldKey">{String(safe.oldKey)}</span>}
      </div>
    );
  }

  // 5. Match Room Opened
  if (action === 'match_room_opened' && safe.roomId) {
    return (
      <div className="flex items-center gap-1.5 py-0.5" data-testid="safe-audit-details">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono whitespace-nowrap"
          data-testid="audit-detail-roomId"
        >
          <Gamepad2 className="h-3.5 w-3.5" />
          Room #{safe.roomId}
        </span>
      </div>
    );
  }

  // 6. Match Created
  if (action === 'match_created') {
    return (
      <div className="flex flex-col gap-1 py-0.5" data-testid="safe-audit-details">
        <div className="flex items-center gap-1.5 flex-wrap">
          {safe.tierId && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap"
              data-testid="audit-detail-tierId"
            >
              Tier #{safe.tierId}
            </span>
          )}
          {(safe.gameMode || safe.teamMode) && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 whitespace-nowrap">
              <span data-testid="audit-detail-gameMode">
                {safe.gameMode === 'clash_squad' ? 'Clash Squad' : 'Battle Royale'}
              </span>
              {safe.teamMode && (
                <span className="ml-1 font-semibold" data-testid="audit-detail-teamMode">
                  • {String(safe.teamMode).toUpperCase()}
                </span>
              )}
            </span>
          )}
        </div>
        {safe.startTime && (
          <div
            className="text-[10px] text-slate-400 font-mono flex items-center gap-1"
            data-testid="audit-detail-startTime"
          >
            <Calendar className="h-2.5 w-2.5 text-slate-500" />
            {formatISTDate(safe.startTime)}
          </div>
        )}
      </div>
    );
  }

  // 7. Match Went Live
  if (action === 'match_went_live') {
    return (
      <div className="flex items-center gap-1 py-0.5 text-emerald-400 text-xs font-medium" data-testid="safe-audit-details">
        <Play className="h-3 w-3 fill-current" />
        <span>Match Went Live</span>
      </div>
    );
  }

  // 8. Match Cancelled
  if (action === 'match_cancelled') {
    return (
      <div className="flex flex-col gap-0.5 py-0.5" data-testid="safe-audit-details">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 whitespace-nowrap"
            data-testid="audit-detail-refundedPlayersCount"
          >
            {safe.refundedPlayersCount || 0} players refunded
          </span>
        </div>
        {safe.reason && (
          <div
            className="text-[11px] text-rose-300/90 italic truncate max-w-xs"
            title={safe.reason}
            data-testid="audit-detail-reason"
          >
            {safe.reason}
          </div>
        )}
      </div>
    );
  }

  // 9. Balance Adjusted
  if (action === 'balance_adjusted') {
    return (
      <div className="flex flex-col gap-0.5 py-0.5" data-testid="safe-audit-details">
        <div className="flex items-center gap-1.5 flex-wrap">
          {safe.amount && (
            <span
              className="font-bold text-emerald-400 text-xs font-mono"
              data-testid="audit-detail-amount"
            >
              {formatIndianRupees(safe.amount)}
            </span>
          )}
          {safe.wallet && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20 whitespace-nowrap"
              data-testid="audit-detail-wallet"
            >
              {safe.wallet}
            </span>
          )}
          {safe.adminId && (
            <span
              className="text-[10px] font-mono text-slate-400"
              data-testid="audit-detail-adminId"
            >
              by {formatStaffId(safe.adminId)}
            </span>
          )}
        </div>
        {safe.reason && (
          <div
            className="text-[11px] text-slate-300 italic truncate max-w-xs"
            title={safe.reason}
            data-testid="audit-detail-reason"
          >
            {safe.reason}
          </div>
        )}
      </div>
    );
  }

  // 10. Deposits & Withdrawals
  if (action.startsWith('deposit_') || action.startsWith('withdrawal_')) {
    return (
      <div className="flex flex-col gap-0.5 py-0.5" data-testid="safe-audit-details">
        <div className="flex items-center gap-1.5 flex-wrap">
          {safe.amount && (
            <span
              className="font-bold text-emerald-400 text-xs font-mono"
              data-testid="audit-detail-amount"
            >
              {formatIndianRupees(safe.amount)}
            </span>
          )}
          {safe.userId && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap"
              data-testid="audit-detail-userId"
            >
              {formatUserId(safe.userId)}
            </span>
          )}
          {safe.utr && (
            <span
              className="text-[10px] font-mono text-slate-400 whitespace-nowrap"
              data-testid="audit-detail-utr"
            >
              UTR: {safe.utr}
            </span>
          )}
          {safe.upiId && (
            <span
              className="text-[10px] font-mono text-slate-400 whitespace-nowrap"
              data-testid="audit-detail-upiId"
            >
              UPI: {safe.upiId}
            </span>
          )}
          {safe.reference && (
            <span
              className="text-[10px] font-mono text-slate-400 whitespace-nowrap"
              data-testid="audit-detail-reference"
            >
              Ref: {safe.reference}
            </span>
          )}
        </div>
        {safe.reason && (
          <div
            className="text-[11px] text-rose-300/90 italic truncate max-w-xs"
            title={safe.reason}
            data-testid="audit-detail-reason"
          >
            {safe.reason}
          </div>
        )}
      </div>
    );
  }

  // 11. Banners
  if (action.startsWith('banner_')) {
    return (
      <div className="flex flex-col gap-1 py-0.5 max-w-md" data-testid="safe-audit-details">
        <div className="flex items-center gap-1.5 flex-nowrap">
          <span
            className="font-semibold text-slate-200 text-xs truncate"
            title={safe.title}
            data-testid="audit-detail-title"
          >
            {safe.title}
          </span>
          {safe.sortOrder !== undefined && (
            <span
              className="text-[10px] font-mono text-slate-500 shrink-0"
              data-testid="audit-detail-sortOrder"
            >
              #{safe.sortOrder}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {safe.isActive !== undefined && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                safe.isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
              data-testid="audit-detail-isActive"
            >
              {safe.isActive ? 'Active' : 'Inactive'}
            </span>
          )}
          {safe.targetUrl && (
            <span
              className="text-[10px] text-slate-400 truncate max-w-[200px]"
              title={safe.targetUrl}
              data-testid="audit-detail-targetUrl"
            >
              {safe.targetUrl}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 12. Tier Actions
  if (action === 'tier_created') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap py-0.5" data-testid="safe-audit-details">
        {safe.entryFee && (
          <span className="font-bold text-emerald-400 text-xs font-mono" data-testid="audit-detail-entryFee">
            {formatIndianRupees(safe.entryFee)}
          </span>
        )}
        {(safe.gameMode || safe.teamMode) && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 whitespace-nowrap">
            <span data-testid="audit-detail-gameMode">{safe.gameMode === 'clash_squad' ? 'Clash Squad' : 'Battle Royale'}</span>
            {safe.teamMode && <span className="ml-1 font-semibold" data-testid="audit-detail-teamMode">• {String(safe.teamMode).toUpperCase()}</span>}
          </span>
        )}
        {safe.positionsCount && (
          <span className="text-[10px] text-slate-400 font-mono" data-testid="audit-detail-positionsCount">
            {safe.positionsCount} positions
          </span>
        )}
      </div>
    );
  }

  if (action === 'tier_updated' || action === 'employee_updated') {
    const rawFields = Array.isArray(safe.updatedFields)
      ? safe.updatedFields
      : safe.updatedFields
      ? [String(safe.updatedFields)]
      : [];
    const fieldsCount = rawFields.length;
    let displayVal = '';
    if (fieldsCount > 2) {
      displayVal = `${rawFields.slice(0, 2).join(', ')} (+${fieldsCount - 2} more)`;
    } else {
      displayVal = rawFields.join(', ');
    }

    return (
      <div className="flex items-center gap-1.5 flex-nowrap py-0.5 overflow-hidden" data-testid="safe-audit-details">
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap shrink-0">
          <Sliders className="h-3 w-3" />
          {fieldsCount} modified
        </span>
        <span
          className="font-mono text-[11px] text-slate-300 whitespace-nowrap truncate max-w-[260px]"
          title={rawFields.join(', ')}
          data-testid="audit-detail-updatedFields"
        >
          {displayVal}
        </span>
      </div>
    );
  }

  if (action === 'tier_deleted') {
    return (
      <span className="text-slate-500 text-[11px] italic" data-testid="safe-audit-details">
        Tier deleted
      </span>
    );
  }

  // 13. User & Staff Actions
  if (action === 'user_deleted') {
    return (
      <div className="flex flex-col gap-0.5 py-0.5" data-testid="safe-audit-details">
        {safe.reason && (
          <div className="text-[11px] text-rose-300/90 italic truncate max-w-xs" title={safe.reason} data-testid="audit-detail-reason">
            {safe.reason}
          </div>
        )}
        {safe.deletedBy && (
          <div className="text-[10px] font-mono text-slate-400" data-testid="audit-detail-deletedBy">
            by {formatStaffId(safe.deletedBy)}
          </div>
        )}
      </div>
    );
  }

  if (action === 'user_viewed') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap py-0.5" data-testid="safe-audit-details">
        {safe.viewedUserId && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap" data-testid="audit-detail-viewedUserId">
            {formatUserId(safe.viewedUserId)}
          </span>
        )}
        {safe.reason && (
          <span className="text-[11px] text-slate-400 italic truncate max-w-xs" title={safe.reason} data-testid="audit-detail-reason">
            {safe.reason}
          </span>
        )}
      </div>
    );
  }

  if (action === 'employee_created') {
    return (
      <div className="flex flex-col gap-0.5 py-0.5" data-testid="safe-audit-details">
        {safe.name && (
          <span className="font-semibold text-slate-200 text-xs" data-testid="audit-detail-name">
            {safe.name}
          </span>
        )}
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
          {safe.email && <span data-testid="audit-detail-email">{safe.email}</span>}
          {safe.mobile && <span data-testid="audit-detail-mobile">• {safe.mobile}</span>}
        </div>
      </div>
    );
  }

  if (action === 'employee_deleted') {
    return (
      <span className="text-slate-500 text-[11px] italic" data-testid="safe-audit-details">
        Employee deleted
      </span>
    );
  }

  // 14. Fallback for any other safe entries
  if (safeEntries.length === 0) {
    return (
      <span className="text-slate-500 text-[11px] italic" data-testid="safe-audit-details">
        No extra parameters
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-0.5" data-testid="safe-audit-details">
      {safeEntries.map(({ key, value }) => {
        let displayVal = '';
        let fullTitle: string | undefined = undefined;

        if (Array.isArray(value)) {
          if (value.length > 2) {
            displayVal = `${value.slice(0, 2).join(', ')} (+${value.length - 2} more)`;
            fullTitle = value.join(', ');
          } else {
            displayVal = value.join(', ');
          }
        } else if (typeof value === 'boolean') {
          displayVal = value ? 'Active' : 'Inactive';
        } else if (typeof value === 'object') {
          displayVal = '[Object]';
        } else {
          displayVal = String(value);
        }

        // Format rupees if amount, entryFee, or amountPaise
        if ((key === 'amount' || key === 'entryFee') && typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value)) {
          displayVal = formatIndianRupees(value);
        } else if (key === 'amountPaise' && (typeof value === 'number' || typeof value === 'string')) {
          const num = Number(value);
          if (!isNaN(num)) {
            displayVal = formatIndianRupees((num / 100).toFixed(2));
          }
        }

        // Format user IDs (e.g. BW-USR-2, not 2)
        if (
          key === 'userId' ||
          key === 'viewedUserId' ||
          key === 'targetUserId' ||
          key === 'referredBy'
        ) {
          displayVal = formatUserId(value);
        }

        // Format staff IDs (e.g. BW-STF-1, not 1)
        if (key === 'adminId' || key === 'staffId' || key === 'deletedBy') {
          displayVal = formatStaffId(value);
        }

        // Format dates and timestamps
        if (
          key === 'startTime' ||
          key === 'endTime' ||
          (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))
        ) {
          displayVal = formatISTDate(value);
        }

        // Format gameMode & teamMode
        if (key === 'gameMode') {
          displayVal = value === 'battle_royale' ? 'Battle Royale' : value === 'clash_squad' ? 'Clash Squad' : String(value);
        } else if (key === 'teamMode') {
          displayVal = String(value).toUpperCase();
        }

        // Format refunded players count
        if (key === 'refundedPlayersCount') {
          displayVal = `${value} players`;
        }

        // Clean truncation for lengthy string values like title or heading
        if ((key === 'title' || key === 'heading') && displayVal.length > 40) {
          fullTitle = displayVal;
          displayVal = `${displayVal.slice(0, 40)}…`;
        }

        return (
          <span
            key={key}
            title={fullTitle}
            className="inline-flex items-center gap-1 rounded-md bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300 border border-slate-700/60 shadow-sm"
            data-testid={`audit-detail-${key}`}
          >
            <span className="text-slate-400 text-[10px] font-medium">{formatKeyLabel(key)}:</span>
            <span className="font-semibold text-slate-200">{displayVal}</span>
          </span>
        );
      })}
    </div>
  );
}

export const AuditLogs: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AdminAuditLogItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Filter state
  const [filterStaffId, setFilterStaffId] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Race condition guard
  const latestReqIdRef = useRef<number>(0);

  const fetchLogs = async (cursor?: string) => {
    const reqId = ++latestReqIdRef.current;
    if (!cursor) setIsLoading(true);
    else setIsLoadingMore(true);
    setListError(null);

    try {
      const data = await getAdminAuditLogs({
        staffId: filterStaffId.trim() || undefined,
        action: filterAction.trim() || undefined,
        from: filterFrom.trim() || undefined,
        to: filterTo.trim() || undefined,
        cursor,
        limit: 25,
      });

      if (reqId !== latestReqIdRef.current) return;

      if (cursor) {
        setLogs((prev) => [...prev, ...data.items]);
      } else {
        setLogs(data.items);
      }
      setNextCursor(data.nextCursor);
    } catch (err) {
      if (reqId === latestReqIdRef.current) {
        setListError(getFriendlyErrorMessage(err, 'audit'));
      }
    } finally {
      if (reqId === latestReqIdRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterStaffId, filterAction, filterFrom, filterTo]);

  const handleClearFilters = () => {
    setFilterStaffId('');
    setFilterAction('');
    setFilterFrom('');
    setFilterTo('');
  };

  const knownActionValues = new Set(AUDIT_ACTION_OPTIONS.map((opt) => opt.value));
  const dynamicActionOptions = logs
    .map((l) => l.action)
    .filter((act) => act && !knownActionValues.has(act))
    .filter((act, idx, arr) => arr.indexOf(act) === idx)
    .map((act) => ({ value: act, label: formatActionLabel(act) }));
  const allActionOptions = [...AUDIT_ACTION_OPTIONS, ...dynamicActionOptions];

  return (
    <div className="space-y-6" data-testid="audit-logs-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <FileText className="h-6 w-6 text-emerald-400" />
            Audit Logs
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Immutable administrative event trace covering financial adjustments, tier edits, and staff actions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchLogs()}
          disabled={isLoading}
          data-testid="refresh-audit-logs-btn"
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          Refresh
        </button>
      </div>

      {listError && (
        <div
          data-testid="audit-logs-error-banner"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-center gap-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{listError}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-emerald-400" />
            Filter Audit Entries
          </span>
          {(filterStaffId || filterAction || filterFrom || filterTo) && (
            <button
              type="button"
              onClick={handleClearFilters}
              data-testid="clear-filters-btn"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Staff ID</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={filterStaffId}
                onChange={(e) => setFilterStaffId(e.target.value)}
                placeholder="e.g. BW-STF-1"
                data-testid="filter-staffId-input"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-8 pr-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Action Type</label>
            <div className="relative">
              <Tag className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                data-testid="filter-action-select"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-8 pr-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">All Actions</option>
                {allActionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">From Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                data-testid="filter-from-input"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-8 pr-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">To Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                data-testid="filter-to-input"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-8 pr-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" data-testid="audit-logs-table">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Log ID</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Allowlisted Details</th>
                <th className="px-4 py-3 text-right">Timestamp (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500" data-testid="audit-logs-loading">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-400" />
                    Loading audit events...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500" data-testid="audit-logs-empty">
                    No audit records found matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => navigate(`/audit-logs/${log.id}`, { state: { log } })}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    data-testid={`audit-row-${log.id}`}
                    title="Click to view full audit details"
                  >
                    <td className="px-4 py-3 font-mono text-slate-400 group-hover:text-emerald-400 transition-colors">
                      #{log.id}
                    </td>
                    <td className="px-4 py-3">
                      {log.staffName ? (
                        <div>
                          <div className="font-semibold text-slate-200">
                            {log.staffName}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            ID: {formatStaffId(log.staffId)}
                          </div>
                        </div>
                      ) : (
                        <span className="font-mono font-semibold text-slate-300">
                          {log.staffId ? formatStaffId(log.staffId) : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-slate-700 whitespace-nowrap">
                        {formatActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-300 font-medium capitalize">
                        {log.targetType?.replace('_', ' ') || '—'}
                      </div>
                      {log.targetId && (
                        <div className="text-[10px] font-mono text-slate-500">
                          ID: {log.targetType === 'staff' || log.targetType === 'employee'
                            ? formatStaffId(log.targetId)
                            : log.targetType === 'user'
                            ? formatUserId(log.targetId)
                            : log.targetId}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[260px] max-w-lg">
                      {renderAuditDetails(log.action, log.details)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <span>{formatISTDate(log.createdAt)}</span>
                        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {nextCursor && (
          <div className="p-3 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={() => fetchLogs(nextCursor)}
              disabled={isLoadingMore}
              data-testid="load-more-audit-logs-btn"
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {isLoadingMore ? 'Loading more...' : 'Load More Audit Logs'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
