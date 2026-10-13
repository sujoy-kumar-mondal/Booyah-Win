/**
 * Matches List Page for Booyah Win Staff Portal
 * Accessible by both Employees and Admins.
 *
 * Requirements & Changes:
 * - Filter by status, game mode, team mode, date range (from, to).
 * - Cursor pagination.
 * - Columns: display ID (M + id), mode, team mode, entry fee, seats taken / max, start time in IST, status.
 * - Actions per row appear only when match status permits (open room, go live, cancel, add result).
 * - Double-click guards (ref plus disabled state).
 * - Confirm dialogs using data from exact row acted on.
 * - 409 conflict handling displays "This request was already processed" and refreshes row.
 * - Room password masked with reveal toggle, no logging, copy button with clipboard fallback.
 * - Change 3: Hide Cancel on live match for employees; if server returns FORBIDDEN, show server's answer.
 * - Change 12: Loading, empty, and error states, plus a refresh control.
 */

import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  getStaffMatches,
  openStaffMatchRoom,
  goLiveStaffMatch,
  cancelStaffMatch,
} from '../api/matches.js';
import type { MatchStaffDto } from '../api/types.js';
import { useStaffAuth } from '../context/StaffAuthContext.js';
import { formatIndianRupees, formatISTDate, copyToClipboard } from '../utils/formatters.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import {
  Swords,
  Plus,
  RefreshCw,
  Search,
  Eye,
  EyeOff,
  Copy,
  Check,
  Radio,
  DoorOpen,
  XCircle,
  FileSpreadsheet,
  AlertCircle,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';

export const Matches: React.FC = () => {
  const { staff } = useStaffAuth();
  const isAdmin = staff?.role === 'admin';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Filter States
  const [statusFilter, setStatusFilter] = useState('all');
  const [gameModeFilter, setGameModeFilter] = useState('all');
  const [teamModeFilter, setTeamModeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  // Masked room password visibility state (keyed by match ID)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Action Modals State
  const [openRoomTarget, setOpenRoomTarget] = useState<MatchStaffDto | null>(null);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [openRoomError, setOpenRoomError] = useState<string | null>(null);

  const [goLiveTarget, setGoLiveTarget] = useState<MatchStaffDto | null>(null);
  const [goLiveError, setGoLiveError] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<MatchStaffDto | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Double Click Guards
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Query Matches List
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      'staff-matches',
      statusFilter,
      gameModeFilter,
      teamModeFilter,
      fromDate,
      toDate,
      cursor,
    ],
    queryFn: () =>
      getStaffMatches({
        status: statusFilter,
        gameMode: gameModeFilter,
        teamMode: teamModeFilter,
        from: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
        to: toDate ? `${toDate}T23:59:59.999Z` : undefined,
        cursor,
        limit: 20,
      }),
    staleTime: 0,
    refetchInterval: cursor ? false : 10000,
  });

  const matches: MatchStaffDto[] = data?.matches || [];
  const nextCursor = data?.nextCursor;

  // Toggle reveal password
  const togglePasswordReveal = (matchId: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [matchId]: !prev[matchId],
    }));
  };

  // Copy text helper
  const handleCopy = async (text: string, key: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // ─── Open Room Action Handler ───────────────────────────────────────────────
  const handleOpenRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openRoomTarget || isSubmittingRef.current) return;
    if (!roomIdInput.trim() || !roomPasswordInput.trim()) {
      setOpenRoomError('Both Room ID and Room Password are required');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setOpenRoomError(null);

      await openStaffMatchRoom(openRoomTarget.id, roomIdInput.trim(), roomPasswordInput.trim());

      setOpenRoomTarget(null);
      setRoomIdInput('');
      setRoomPasswordInput('');
      queryClient.invalidateQueries({ queryKey: ['staff-matches'] });
    } catch (err: any) {
      if (err?.status === 409) {
        setOpenRoomError('This request was already processed');
        queryClient.invalidateQueries({ queryKey: ['staff-matches'] });
      } else {
        setOpenRoomError(getFriendlyErrorMessage(err));
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ─── Go Live Action Handler ─────────────────────────────────────────────────
  const handleGoLiveConfirm = async () => {
    if (!goLiveTarget || isSubmittingRef.current) return;

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setGoLiveError(null);

      await goLiveStaffMatch(goLiveTarget.id);

      setGoLiveTarget(null);
      queryClient.invalidateQueries({ queryKey: ['staff-matches'] });
    } catch (err: any) {
      if (err?.status === 409) {
        setGoLiveError('This request was already processed');
        queryClient.invalidateQueries({ queryKey: ['staff-matches'] });
      } else {
        setGoLiveError(getFriendlyErrorMessage(err, 'live'));
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ─── Cancel Match Action Handler ───────────────────────────────────────────
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget || isSubmittingRef.current) return;
    if (cancelReasonInput.trim().length < 5) {
      setCancelError('Cancellation reason must be at least 5 characters');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setCancelError(null);

      await cancelStaffMatch(cancelTarget.id, cancelReasonInput.trim());

      setCancelTarget(null);
      setCancelReasonInput('');
      queryClient.invalidateQueries({ queryKey: ['staff-matches'] });
    } catch (err: any) {
      if (err?.status === 409) {
        setCancelError('This request was already processed');
        queryClient.invalidateQueries({ queryKey: ['staff-matches'] });
      } else {
        setCancelError(getFriendlyErrorMessage(err, 'cancel'));
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="matches-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-100 flex items-center gap-2">
            <Swords className="h-6 w-6 text-emerald-400" />
            Tournament Matches
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage Free Fire custom rooms, track match progression, and enter validated results.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="btn-refresh"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/matches/create')}
            data-testid="btn-create-match"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10"
          >
            <Plus className="h-4 w-4" />
            Create Match
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCursor(undefined);
              }}
              data-testid="filter-status"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="room_open">Room Open</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Game Mode Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Game Mode
            </label>
            <select
              value={gameModeFilter}
              onChange={(e) => {
                setGameModeFilter(e.target.value);
                setCursor(undefined);
              }}
              data-testid="filter-game-mode"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All Modes</option>
              <option value="battle_royale">Battle Royale</option>
              <option value="clash_squad">Clash Squad</option>
            </select>
          </div>

          {/* Team Mode Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Team Mode
            </label>
            <select
              value={teamModeFilter}
              onChange={(e) => {
                setTeamModeFilter(e.target.value);
                setCursor(undefined);
              }}
              data-testid="filter-team-mode"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All Team Types</option>
              <option value="solo">Solo</option>
              <option value="duo">Duo</option>
              <option value="squad">Squad</option>
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              From (Date)
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCursor(undefined);
              }}
              data-testid="filter-from"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              To (Date)
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setCursor(undefined);
              }}
              data-testid="filter-to"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Clear Filters CTA */}
        {(statusFilter !== 'all' ||
          gameModeFilter !== 'all' ||
          teamModeFilter !== 'all' ||
          fromDate ||
          toDate ||
          cursor) && (
          <div className="flex justify-end pt-2 border-t border-slate-800/60">
            <button
              onClick={() => {
                setStatusFilter('all');
                setGameModeFilter('all');
                setTeamModeFilter('all');
                setFromDate('');
                setToDate('');
                setCursor(undefined);
              }}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Main Table / View */}
      {isLoading ? (
        <div
          data-testid="matches-loading"
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center"
        >
          <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400">Loading matches catalog...</p>
        </div>
      ) : isError ? (
        <div
          data-testid="matches-error"
          className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-rose-300 space-y-3"
        >
          <AlertCircle className="h-8 w-8 mx-auto text-rose-400" />
          <p className="text-sm font-semibold">{getFriendlyErrorMessage(error)}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-1.5 text-xs font-bold rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 hover:bg-rose-500/30"
          >
            Retry
          </button>
        </div>
      ) : matches.length === 0 ? (
        <div
          data-testid="matches-empty"
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400 space-y-2"
        >
          <Search className="h-8 w-8 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-300">No matches found</p>
          <p className="text-xs text-slate-500">
            Try adjusting your status, mode, or date range filters.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Match ID</th>
                  <th className="py-3.5 px-4">Game / Team Mode</th>
                  <th className="py-3.5 px-4">Entry Fee</th>
                  <th className="py-3.5 px-4">Seats / Max</th>
                  <th className="py-3.5 px-4">Start Time (IST)</th>
                  <th className="py-3.5 px-4">Room Credentials</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {matches.map((m: MatchStaffDto) => {
                  const isPasswordRevealed = !!revealedPasswords[m.id];
                  const effectiveSeats =
                    m.status === 'cancelled'
                      ? (m.joinedCount || (m.seatsTaken ?? 0))
                      : (m.seatsTaken ?? m.joinedCount);
                  const seatsDisplay = `${effectiveSeats} / ${m.maxPlayers}`;

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-800/30 transition-colors"
                      data-testid={`match-row-${m.id}`}
                    >
                      {/* Match Display ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-100">
                        <span data-testid={`match-id-${m.id}`}>M{m.id}</span>
                      </td>

                      {/* Mode Badge */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-200 capitalize">
                            {m.gameMode === 'battle_royale' ? 'Battle Royale' : 'Clash Squad'}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                            {m.teamMode}
                          </span>
                        </div>
                      </td>

                      {/* Entry Fee */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-emerald-400">
                        {formatIndianRupees(m.entryFee)}
                      </td>

                      {/* Seats / Capacity */}
                      <td className="py-3.5 px-4 font-mono">
                        <span
                          className={`font-semibold ${
                            effectiveSeats >= m.maxPlayers
                              ? 'text-amber-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {seatsDisplay}
                        </span>
                      </td>

                      {/* Start Time IST */}
                      <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                        {formatISTDate(m.startTime)}
                      </td>

                      {/* Room Credentials (if open or live) */}
                      <td className="py-3.5 px-4">
                        {m.status === 'room_open' || m.status === 'live' ? (
                          m.roomId ? (
                            <div className="space-y-1 font-mono text-[11px]">
                              {/* Room ID */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-500 text-[10px]">ID:</span>
                                <span className="font-bold text-slate-200">{m.roomId}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(m.roomId!, `room-id-${m.id}`)}
                                  className="text-slate-400 hover:text-slate-200 transition-colors"
                                  title="Copy Room ID"
                                >
                                  {copiedKey === `room-id-${m.id}` ? (
                                    <Check className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                              {/* Room Password Masked */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-500 text-[10px]">PW:</span>
                                <span className="font-bold text-slate-200">
                                  {isPasswordRevealed ? m.roomPassword : '••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => togglePasswordReveal(m.id)}
                                  className="text-slate-400 hover:text-slate-200 transition-colors"
                                  title={isPasswordRevealed ? 'Hide Password' : 'Show Password'}
                                  data-testid={`toggle-pw-${m.id}`}
                                >
                                  {isPasswordRevealed ? (
                                    <EyeOff className="h-3 w-3" />
                                  ) : (
                                    <Eye className="h-3 w-3" />
                                  )}
                                </button>
                                {m.roomPassword && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(m.roomPassword!, `room-pw-${m.id}`)}
                                    className="text-slate-400 hover:text-slate-200 transition-colors"
                                    title="Copy Password"
                                  >
                                    {copiedKey === `room-pw-${m.id}` ? (
                                      <Check className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Not set</span>
                          )
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            m.status === 'upcoming'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : m.status === 'room_open'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : m.status === 'live'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : m.status === 'completed'
                              ? 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                          data-testid={`status-badge-${m.id}`}
                        >
                          {m.status === 'live' && (
                            <Radio className="h-2.5 w-2.5 text-emerald-400 animate-pulse" />
                          )}
                          {m.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Contextual Action Buttons */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* UPCOMING Actions */}
                          {m.status === 'upcoming' && (
                            <>
                              {!m.startTime || new Date(m.startTime).getTime() > Date.now() ? (
                                <button
                                  onClick={() => {
                                    setOpenRoomTarget(m);
                                    setRoomIdInput(m.roomId || '');
                                    setRoomPasswordInput(m.roomPassword || '');
                                    setOpenRoomError(null);
                                  }}
                                  data-testid={`btn-open-room-${m.id}`}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 font-bold text-[11px] transition-colors"
                                >
                                  <DoorOpen className="h-3 w-3" />
                                  Open Room
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold text-[10px]">
                                  Expired
                                </span>
                              )}
                              <button
                                onClick={() => {
                                  setCancelTarget(m);
                                  setCancelReasonInput('');
                                  setCancelError(null);
                                }}
                                data-testid={`btn-cancel-${m.id}`}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 font-semibold text-[11px] transition-colors"
                              >
                                <XCircle className="h-3 w-3" />
                                Cancel
                              </button>
                            </>
                          )}

                          {/* ROOM OPEN Actions */}
                          {m.status === 'room_open' && (
                            <>
                              {(() => {
                                const isUnderfilled = (m.joinedCount ?? 0) < m.minPlayers;
                                const underfilledReason = m.gameMode === 'clash_squad'
                                  ? `Requires at least 2 confirmed teams (${m.minPlayers} players) to go live (currently ${m.joinedCount ?? 0})`
                                  : `Match requires at least ${m.minPlayers} players to go live (currently ${m.joinedCount ?? 0}/${m.minPlayers})`;
                                return (
                                  <button
                                    onClick={() => {
                                      setGoLiveTarget(m);
                                      setGoLiveError(null);
                                    }}
                                    disabled={isUnderfilled}
                                    title={isUnderfilled ? underfilledReason : undefined}
                                    data-testid={`btn-go-live-${m.id}`}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-bold text-[11px] transition-colors ${
                                      isUnderfilled
                                        ? 'bg-slate-800/40 border-slate-700/50 text-slate-500 cursor-not-allowed'
                                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                                    }`}
                                  >
                                    <Radio className={`h-3 w-3 ${isUnderfilled ? 'text-slate-500' : 'text-emerald-400 animate-pulse'}`} />
                                    Go Live
                                  </button>
                                );
                              })()}
                              <button
                                onClick={() => {
                                  setCancelTarget(m);
                                  setCancelReasonInput('');
                                  setCancelError(null);
                                }}
                                data-testid={`btn-cancel-${m.id}`}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 font-semibold text-[11px] transition-colors"
                              >
                                <XCircle className="h-3 w-3" />
                                Cancel
                              </button>
                            </>
                          )}

                          {/* LIVE Actions */}
                          {m.status === 'live' && (
                            <>
                              <button
                                onClick={() => navigate(`/matches/${m.id}/result`)}
                                data-testid={`btn-add-result-${m.id}`}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-[11px] hover:bg-emerald-400 transition-colors shadow-sm"
                              >
                                <FileSpreadsheet className="h-3 w-3" />
                                Add Result
                              </button>
                              {/* Change 3: Employees cannot cancel a live match (hidden in client) */}
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setCancelTarget(m);
                                    setCancelReasonInput('');
                                    setCancelError(null);
                                  }}
                                  data-testid={`btn-cancel-${m.id}`}
                                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 font-semibold text-[11px] transition-colors"
                                >
                                  <XCircle className="h-3 w-3" />
                                  Cancel
                                </button>
                              )}
                            </>
                          )}

                          {/* COMPLETED or CANCELLED Actions */}
                          {(m.status === 'completed' || m.status === 'cancelled') && (
                            <button
                              onClick={() => navigate(`/matches/${m.id}`)}
                              data-testid={`btn-view-${m.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 font-medium text-[11px] transition-colors"
                            >
                              Detail
                            </button>
                          )}

                          {/* Match Detail Link for active states */}
                          {m.status !== 'completed' && m.status !== 'cancelled' && (
                            <button
                              onClick={() => navigate(`/matches/${m.id}`)}
                              data-testid={`btn-detail-${m.id}`}
                              className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800"
                              title="View Match Detail"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cursor Pagination Bar */}
          {nextCursor && (
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <span className="text-xs text-slate-500">Showing matches page</span>
              <button
                onClick={() => setCursor(nextCursor)}
                data-testid="btn-next-page"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors"
              >
                Next Page
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Open Room Modal ─────────────────────────────────────────────────── */}
      {openRoomTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
            data-testid="modal-open-room"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <DoorOpen className="h-5 w-5 text-blue-400" />
                Open Custom Room (M{openRoomTarget.id})
              </h3>
              <button
                type="button"
                onClick={() => setOpenRoomTarget(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOpenRoomSubmit} className="space-y-4">
              <p className="text-xs text-slate-400">
                Opening the room changes match status to <strong>room_open</strong> and exposes credentials to confirmed players.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Free Fire Room ID *
                </label>
                <input
                  type="text"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  placeholder="e.g. 12345678"
                  data-testid="input-room-id"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Room Password *
                </label>
                <input
                  type="text"
                  value={roomPasswordInput}
                  onChange={(e) => setRoomPasswordInput(e.target.value)}
                  placeholder="e.g. secretpass"
                  data-testid="input-room-password"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {openRoomError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {openRoomError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenRoomTarget(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="btn-confirm-open-room"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Opening...' : 'Open Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Go Live Modal ───────────────────────────────────────────────────── */}
      {goLiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
            data-testid="modal-go-live"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Radio className="h-5 w-5 text-emerald-400 animate-pulse" />
                Transition Match to Live (M{goLiveTarget.id})
              </h3>
              <button
                type="button"
                onClick={() => setGoLiveTarget(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure the custom room is full and players have entered?
              Setting the match to <strong>LIVE</strong> locks the roster and enables result entry.
            </p>

            {(() => {
              const isTargetUnderfilled = (goLiveTarget.joinedCount ?? 0) < goLiveTarget.minPlayers;
              const underfilledReason = goLiveTarget.gameMode === 'clash_squad'
                ? `Requires at least 2 confirmed teams (${goLiveTarget.minPlayers} players) to go live (currently ${goLiveTarget.joinedCount ?? 0})`
                : `Match requires at least ${goLiveTarget.minPlayers} players to go live (currently ${goLiveTarget.joinedCount ?? 0}/${goLiveTarget.minPlayers})`;
              return (
                <>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
                    <div>Seats Taken: <strong className="text-slate-200">{goLiveTarget.seatsTaken ?? goLiveTarget.joinedCount}</strong> / {goLiveTarget.maxPlayers}</div>
                    <div>Min Required: <strong className="text-slate-200">{goLiveTarget.minPlayers}</strong></div>
                    <div>Enrolled Players: <strong className="text-slate-200">{goLiveTarget.joinedCount}</strong> / {goLiveTarget.minPlayers}</div>
                  </div>

                  {isTargetUnderfilled && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                      <div>
                        <strong className="block font-semibold">Minimum Players Requirement Not Fulfilled</strong>
                        <p className="mt-0.5 text-slate-300">
                          {underfilledReason}. Matches cannot go live until the minimum player requirement is fulfilled.
                        </p>
                      </div>
                    </div>
                  )}

                  {goLiveError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                      {goLiveError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setGoLiveTarget(null)}
                      disabled={isSubmitting}
                      className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleGoLiveConfirm}
                      disabled={isSubmitting || isTargetUnderfilled}
                      data-testid="btn-confirm-go-live"
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? 'Starting...' : 'Confirm Go Live'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── Cancel Match Modal ──────────────────────────────────────────────── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl space-y-4"
            data-testid="modal-cancel-match"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-400" />
                Cancel Tournament Match (M{cancelTarget.id})
              </h3>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <p className="text-xs text-rose-200">
                Cancelling this match will <strong>immediately refund all entry fees</strong> back to player wallets and mark the match cancelled. This action cannot be reversed.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cancellation Reason (min 5 characters) *
                </label>
                <textarea
                  rows={3}
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="e.g. Free Fire custom room connection failure"
                  data-testid="input-cancel-reason"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 focus:border-rose-500 focus:outline-none"
                  autoFocus
                />
              </div>

              {cancelError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {cancelError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-slate-200"
                >
                  Keep Match
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="btn-confirm-cancel"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-500 text-white hover:bg-rose-400 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
