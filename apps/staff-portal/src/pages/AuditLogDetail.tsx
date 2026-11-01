/**
 * Dedicated Audit Log Detail Page
 * Section 16.5 & Audit Trace
 *
 * Requirements:
 * - Constraint 4: Never render forbidden keys named pan, aadhaar, token, and password in the DOM.
 * - Displays complete change information (Previous vs Current states, before/after diffs, updated keys).
 * - Full audit metadata: Staff name, staff ID, role, action, target resource, exact timestamp.
 */

import React, { useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAdminAuditLog, type AdminAuditLogDetailDto } from '../api/admin.js';
import {
  formatISTDate,
  formatIndianRupees,
  formatStaffId,
  formatUserId,
  copyToClipboard,
} from '../utils/formatters.js';
import { formatActionLabel } from './AuditLogs.js';
import {
  ArrowLeft,
  FileText,
  User,
  Shield,
  Layers,
  Clock,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Code,
  Tag,
  Sliders,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Forbidden keys that must NEVER appear in the DOM under any circumstances
const FORBIDDEN_KEYS = new Set(['pan', 'aadhaar', 'token', 'password']);

function isForbiddenKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (FORBIDDEN_KEYS.has(lower)) return true;
  return (
    lower.includes('pan') ||
    lower.includes('aadhaar') ||
    lower.includes('token') ||
    lower.includes('password')
  );
}

/**
 * Recursively filters out any forbidden sensitive keys from detail objects
 * and ensures user and staff IDs are formatted with standard prefixes.
 */
function sanitizeAuditPayload(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeAuditPayload);
  }
  if (typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (isForbiddenKey(k)) continue;
      const lower = k.toLowerCase();
      if (
        (lower === 'userid' || lower === 'vieweduserid' || lower === 'targetuserid' || lower === 'referredby') &&
        v !== null &&
        v !== undefined &&
        v !== ''
      ) {
        clean[k] = formatUserId(typeof v === 'string' || typeof v === 'number' ? v : String(v));
      } else if (
        (lower === 'adminid' || lower === 'staffid' || lower === 'deletedby') &&
        v !== null &&
        v !== undefined &&
        v !== ''
      ) {
        clean[k] = formatStaffId(typeof v === 'string' || typeof v === 'number' ? v : String(v));
      } else {
        clean[k] = sanitizeAuditPayload(v);
      }
    }
    return clean;
  }
  return obj;
}

function formatAttributeLabel(k: string): string {
  switch (k) {
    case 'userId': return 'User ID';
    case 'adminId': return 'Admin ID';
    case 'staffId': return 'Staff ID';
    case 'targetUserId': return 'Target User ID';
    case 'viewedUserId': return 'Viewed User ID';
    case 'tierId': return 'Tier ID';
    case 'gameMode': return 'Game Mode';
    case 'teamMode': return 'Team Mode';
    case 'startTime': return 'Start Time';
    case 'refundedPlayersCount': return 'Refunded Players';
    case 'totalPayoutPaise': return 'Total Payout';
    default:
      return k
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim();
  }
}

export const AuditLogDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  // Initial state passed from AuditLogs list table row click if available
  const initialLog = location.state?.log as AdminAuditLogDetailDto | undefined;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['admin-audit-log-detail', id],
    queryFn: () => getAdminAuditLog(id || ''),
    enabled: !!id,
    initialData: initialLog && initialLog.id === id ? { log: initialLog } : undefined,
    initialDataUpdatedAt: 0,
    retry: 1,
  });

  const log: AdminAuditLogDetailDto | undefined = data?.log;

  const handleCopy = async (text: string, key: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  if (isLoading && !log) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4" data-testid="audit-detail-loading">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
        <p className="text-sm font-medium text-slate-400">Loading audit log details #{id}...</p>
      </div>
    );
  }

  if (isError || !log) {
    return (
      <div className="space-y-6" data-testid="audit-detail-error">
        <button
          type="button"
          onClick={() => navigate('/audit-logs')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Audit Logs
        </button>

        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-100">Audit Log Not Found</h3>
            <p className="text-xs text-rose-300 mt-1">
              {error instanceof Error ? error.message : `Unable to find audit event record with ID #${id}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/audit-logs')}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Return to Audit Logs List
          </button>
        </div>
      </div>
    );
  }

  // Strictly sanitized details object free of forbidden keys
  const safeDetails = sanitizeAuditPayload(log.details) || {};

  // Extract change structures
  const hasChangesObject =
    safeDetails.changes &&
    typeof safeDetails.changes === 'object' &&
    !Array.isArray(safeDetails.changes);

  const changesEntries: Array<{
    key: string;
    oldVal: any;
    newVal: any;
  }> = [];

  if (hasChangesObject) {
    for (const [key, val] of Object.entries(safeDetails.changes)) {
      if (isForbiddenKey(key)) continue;
      if (val && typeof val === 'object' && ('old' in val || 'new' in val)) {
        changesEntries.push({
          key,
          oldVal: (val as any).old,
          newVal: (val as any).new,
        });
      } else if (val && typeof val === 'object' && ('before' in val || 'after' in val)) {
        changesEntries.push({
          key,
          oldVal: (val as any).before,
          newVal: (val as any).after,
        });
      } else if (val && typeof val === 'object' && ('previous' in val || 'current' in val)) {
        changesEntries.push({
          key,
          oldVal: (val as any).previous,
          newVal: (val as any).current,
        });
      }
    }
  }

  // Key-level before/after attributes (e.g. oldKey vs newKey, oldValue vs newValue)
  const hasKeyDiff =
    ('oldKey' in safeDetails || 'newKey' in safeDetails) ||
    ('oldValue' in safeDetails || 'newValue' in safeDetails);

  // Extract updated fields/keys arrays
  const updatedKeysList: string[] = Array.isArray(safeDetails.updatedKeys)
    ? safeDetails.updatedKeys.filter((k: any) => typeof k === 'string' && !isForbiddenKey(k))
    : Array.isArray(safeDetails.updatedFields)
    ? safeDetails.updatedFields.filter((k: any) => typeof k === 'string' && !isForbiddenKey(k))
    : [];

  // Remaining general attributes excluding raw changes blob and handled list keys
  const generalAttributes: Array<{ key: string; value: any }> = [];
  const handledKeys = new Set([
    'changes',
    'oldKey',
    'newKey',
    'oldValue',
    'newValue',
    'old',
    'new',
    'updatedKeys',
    'updatedFields',
  ]);

  for (const [k, v] of Object.entries(safeDetails)) {
    if (isForbiddenKey(k)) continue;
    if (handledKeys.has(k)) continue;
    generalAttributes.push({ key: k, value: v });
  }

  // Target navigation link helper
  const getTargetLink = () => {
    if (!log.targetType) return null;
    const type = log.targetType.toLowerCase();
    if (type === 'app_settings' || type === 'settings') return '/settings';
    if (type === 'important_update' || type === 'update') return '/updates';
    if (type === 'banners' || type === 'banner') return '/banners';
    if (type === 'entry_tiers' || type === 'tier') return '/tiers';
    if (type === 'employee' || type === 'staff') return '/employees';
    if (type === 'user' && log.targetId) return `/users`;
    if (type === 'match' && log.targetId) return `/matches/${log.targetId}`;
    return null;
  };

  const targetLink = getTargetLink();

  return (
    <div className="space-y-6 pb-12" data-testid="audit-log-detail-page">
      {/* Top Breadcrumb & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/audit-logs')}
          data-testid="back-to-audit-logs-btn"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors self-start"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Audit Logs
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="refresh-audit-detail-btn"
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300">
                Log #{log.id}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Tag className="w-3.5 h-3.5" />
                {formatActionLabel(log.action)}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
              <FileText className="h-6 w-6 text-emerald-400 shrink-0" />
              Audit Log Event Details
            </h1>
            <p className="text-xs text-slate-400">
              Immutable event recorded in system audit logs on {formatISTDate(log.createdAt)}.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-right self-start md:self-auto">
            <Clock className="h-4 w-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Timestamp (IST)</div>
              <div className="text-xs font-semibold text-slate-200">{formatISTDate(log.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Staff Member Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-400" />
              Staff Member
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              {log.staffRole ? log.staffRole.toUpperCase() : 'STAFF'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-slate-500 text-[11px] block">Staff Name</span>
              <span className="font-semibold text-slate-100 text-sm">
                {log.staffName || 'System Process / Direct Action'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-[11px] block">Staff ID</span>
                <span className="font-mono font-semibold text-slate-300">
                  {log.staffId ? formatStaffId(log.staffId) : '—'}
                </span>
              </div>
              {log.staffEmail && (
                <div className="text-right">
                  <span className="text-slate-500 text-[11px] block">Email</span>
                  <span className="text-slate-300">{log.staffEmail}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Target Resource Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-400" />
              Target Resource
            </span>
            {targetLink && (
              <Link
                to={targetLink}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold transition-colors"
              >
                Go to resource <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-slate-500 text-[11px] block">Resource Type</span>
              <span className="font-semibold text-slate-100 capitalize text-sm">
                {log.targetType?.replace('_', ' ') || 'Global Resource / System'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Target ID</span>
              <span className="font-mono font-semibold text-slate-300">
                {log.targetId
                  ? log.targetType === 'staff' || log.targetType === 'employee'
                    ? formatStaffId(log.targetId)
                    : log.targetType === 'user'
                    ? formatUserId(log.targetId)
                    : log.targetId
                  : 'N/A (Global / Settings)'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Category Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3 md:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              Event Classification
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              AUDIT TRACE
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-slate-500 text-[11px] block">Action Identifier</span>
              <span className="font-mono font-semibold text-slate-200">{log.action}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Readable Description</span>
              <span className="font-medium text-slate-300">{formatActionLabel(log.action)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Changes & Values: Previous vs Current Information */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Sliders className="h-4 w-4 text-emerald-400" />
            Previous & Current Information About Changes
          </h2>
        </div>

        {/* Case A: Structured State Changes (Before & After Table) */}
        {changesEntries.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Detailed Field-by-Field State Changes
              </span>
              <span className="text-xs text-emerald-400 font-mono font-semibold">
                {changesEntries.length} {changesEntries.length === 1 ? 'change' : 'changes'} recorded
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" data-testid="audit-changes-table">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3 w-1/4">Modified Field / Setting</th>
                    <th className="px-4 py-3 w-1/3 text-rose-300">Previous Value (Before)</th>
                    <th className="px-2 py-3 w-8 text-center text-slate-500">→</th>
                    <th className="px-4 py-3 w-1/3 text-emerald-300">Current Value (After)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {changesEntries.map((change) => {
                    const oldStr =
                      change.oldVal === null || change.oldVal === undefined || change.oldVal === ''
                        ? '— (Empty / Not Set)'
                        : typeof change.oldVal === 'object'
                        ? JSON.stringify(change.oldVal)
                        : String(change.oldVal);

                    const newStr =
                      change.newVal === null || change.newVal === undefined || change.newVal === ''
                        ? '— (Cleared / Empty)'
                        : typeof change.newVal === 'object'
                        ? JSON.stringify(change.newVal)
                        : String(change.newVal);

                    return (
                      <tr key={change.key} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-slate-300 font-semibold align-top">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/80 text-[11px] text-sky-300">
                            {change.key}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-rose-300 font-mono text-[11px] break-all whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {oldStr}
                          </div>
                        </td>
                        <td className="px-2 py-3.5 text-center text-slate-500 align-middle">
                          <ArrowRight className="h-4 w-4 mx-auto text-slate-500" />
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-emerald-300 font-mono text-[11px] break-all whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {newStr}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Case B: Direct Old vs New Key / Value diff card */}
        {hasKeyDiff && changesEntries.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Direct Transition Diff
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-1.5">
                <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">
                  Previous State / Key
                </span>
                <div className="font-mono text-xs text-rose-200 break-all">
                  {String(safeDetails.oldKey ?? safeDetails.oldValue ?? safeDetails.old ?? 'None / Unset')}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1.5">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                  New State / Key
                </span>
                <div className="font-mono text-xs text-emerald-200 break-all">
                  {String(safeDetails.newKey ?? safeDetails.newValue ?? safeDetails.new ?? 'None / Cleared')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Case C: Updated Keys/Fields Badges */}
        {updatedKeysList.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Modified Keys & Fields ({updatedKeysList.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {updatedKeysList.map((keyName) => (
                <span
                  key={keyName}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-mono font-medium text-slate-200 border border-slate-700 shadow-sm"
                >
                  <Tag className="h-3 w-3 text-sky-400" />
                  {keyName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* General Attributes & Details Parameters */}
        {generalAttributes.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Event Parameters & Specific Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {generalAttributes.map(({ key, value }) => {
                let displayVal = '';
                if (value === null || value === undefined) {
                  displayVal = '—';
                } else if (typeof value === 'boolean') {
                  displayVal = value ? 'True' : 'False';
                } else if (Array.isArray(value)) {
                  displayVal = value.length > 0 ? value.join(', ') : 'Empty list';
                } else if (typeof value === 'object') {
                  displayVal = JSON.stringify(value);
                } else {
                  displayVal = String(value);
                }

                // Currency formatting
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

                // Format dates
                if (
                  key === 'startTime' ||
                  key === 'endTime' ||
                  (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))
                ) {
                  displayVal = formatISTDate(value);
                }

                return (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 space-y-1"
                    data-testid={`audit-attr-${key}`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                      {formatAttributeLabel(key)}
                    </span>
                    <span className="text-xs font-semibold text-slate-200 break-words font-mono block">
                      {displayVal}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {changesEntries.length === 0 && !hasKeyDiff && generalAttributes.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-8 text-center text-slate-500 text-xs">
            No additional parameter payloads associated with this event.
          </div>
        )}
      </div>

      {/* Raw Event JSON Inspector (Sanitized) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowRawJson((prev) => !prev)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Code className="h-4 w-4 text-emerald-400" />
            Sanitized Audit Event Payload (JSON)
          </span>
          <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
            {showRawJson ? 'Hide' : 'Expand'}
            {showRawJson ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>

        {showRawJson && (
          <div className="border-t border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Payload guarantees zero exposure of confidential credentials (pan, aadhaar, token, password).
              </span>
              <button
                type="button"
                onClick={() => handleCopy(JSON.stringify(safeDetails, null, 2), 'json')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                {copiedKey === 'json' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied JSON</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            <pre className="text-[11px] font-mono text-emerald-300/90 bg-slate-900/90 rounded-xl p-4 overflow-x-auto border border-slate-800/80 max-h-96">
              {JSON.stringify(safeDetails, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
