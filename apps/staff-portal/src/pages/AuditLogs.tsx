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
import { getAdminAuditLogs, type AdminAuditLogItemDto } from '../api/admin.js';
import { formatISTDate, formatIndianRupees } from '../utils/formatters.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import {
  FileText,
  RefreshCw,
  Filter,
  Calendar,
  User,
  AlertCircle,
  Tag,
} from 'lucide-react';

// Forbidden keys that must NEVER appear in the DOM under any circumstances
const FORBIDDEN_KEYS = new Set(['pan', 'aadhaar', 'token', 'password']);

// Strict allowlist per action
const ACTION_ALLOWLIST: Record<string, string[]> = {
  deposit_approved: ['amount', 'userId'],
  deposit_rejected: ['amount', 'userId', 'reason'],
  withdrawal_approved: ['amount', 'userId'],
  withdrawal_rejected: ['amount', 'userId', 'reason'],
  balance_adjusted: ['wallet', 'amount', 'reason', 'adminId', 'amountPaise'],
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
  __fallback: ['wallet', 'amount', 'reason', 'adminId', 'staffId', 'userId', 'targetId', 'id'],
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
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export const AUDIT_ACTION_OPTIONS: Array<{ value: string; label: string }> = [
  // Financial & Wallet
  { value: 'deposit_approved', label: 'Deposit Approved' },
  { value: 'deposit_rejected', label: 'Deposit Rejected' },
  { value: 'withdrawal_approved', label: 'Withdrawal Approved' },
  { value: 'withdrawal_rejected', label: 'Withdrawal Rejected' },
  { value: 'balance_adjusted', label: 'Balance Adjusted' },
  // Users
  { value: 'user_deleted', label: 'User Deleted' },
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
  // Settings
  { value: 'settings_updated', label: 'Settings Updated' },
  { value: 'settings_payment_qr_updated', label: 'Settings Payment QR Updated' },
];

/**
 * Renders ONLY allowlisted keys for an action.
 * Never outputs the raw details object or forbidden keys (pan, aadhaar, token, password).
 */
export function renderAuditDetails(
  action: string,
  details: Record<string, any> | null | undefined
): React.ReactNode {
  if (!details || typeof details !== 'object') {
    return <span className="text-slate-600">—</span>;
  }

  const allowlist = ACTION_ALLOWLIST[action] || ACTION_ALLOWLIST.__fallback;

  // Filter keys against allowlist and ensure no forbidden key leaks
  const safeEntries: Array<{ key: string; value: any }> = [];

  for (const key of allowlist) {
    const lowerKey = key.toLowerCase();
    if (FORBIDDEN_KEYS.has(lowerKey)) continue;
    if (lowerKey.includes('password') || lowerKey.includes('token') || lowerKey.includes('aadhaar') || lowerKey.includes('pan')) {
      continue;
    }

    if (key in details && details[key] !== undefined && details[key] !== null) {
      safeEntries.push({ key, value: details[key] });
    }
  }

  if (safeEntries.length === 0) {
    return <span className="text-slate-600">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="safe-audit-details">
      {safeEntries.map(({ key, value }) => {
        let displayVal = '';
        if (Array.isArray(value)) {
          displayVal = value.join(', ');
        } else if (typeof value === 'object') {
          displayVal = '[Object]';
        } else {
          displayVal = String(value);
        }

        // Format rupees if amount or balance
        if ((key === 'amount' || key === 'entryFee') && typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value)) {
          displayVal = formatIndianRupees(value);
        }

        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded bg-slate-800/80 px-2 py-0.5 text-[11px] font-mono text-slate-300 border border-slate-700/80"
            data-testid={`audit-detail-${key}`}
          >
            <span className="text-slate-500 font-sans font-medium">{key}:</span>
            <span className="font-semibold text-slate-200">{displayVal}</span>
          </span>
        );
      })}
    </div>
  );
}

export const AuditLogs: React.FC = () => {
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
                placeholder="e.g. 1"
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
                  <tr key={log.id} className="hover:bg-slate-800/20 transition-colors" data-testid={`audit-row-${log.id}`}>
                    <td className="px-4 py-3 font-mono text-slate-400">#{log.id}</td>
                    <td className="px-4 py-3">
                      {log.staffName ? (
                        <div>
                          <div className="font-semibold text-slate-200">
                            {log.staffName}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            ID: #{log.staffId}
                          </div>
                        </div>
                      ) : (
                        <span className="font-mono font-semibold text-slate-300">
                          {log.staffId ? `Staff #${log.staffId}` : '—'}
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
                        <div className="text-[10px] font-mono text-slate-500">ID: {log.targetId}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      {renderAuditDetails(log.action, log.details)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 whitespace-nowrap">
                      {formatISTDate(log.createdAt)}
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
