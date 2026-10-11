/**
 * Match Detail Page for Booyah Win Staff Portal
 *
 * Requirements & Changes:
 * - Match summary, snapshot rules, room credentials with masked password and copy button.
 * - Roster table showing FF name, FF ID, fee breakdown, and refunded state.
 * - Teams list showing status (confirmed, forming, disbanded) and incomplete flags (memberUserIds.length < size).
 * - Action modals: Open Room, Go Live, Cancel (min 5 chars reason).
 * - Employees cannot cancel a live match (button hidden; handles FORBIDDEN if returned).
 * - 409 conflict handling displays "This request was already processed" and refetches.
 */

import React, { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getStaffMatchDetail,
  openStaffMatchRoom,
  goLiveStaffMatch,
  cancelStaffMatch,
} from '../api/matches.js';
import type { MatchDetailStaffDto, MatchTeamStaffDto } from '../api/types.js';
import { useStaffAuth } from '../context/StaffAuthContext.js';
import {
  formatIndianRupees,
  formatISTDate,
  copyToClipboard,
  getPositionLabel,
} from '../utils/formatters.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import {
  Swords,
  Users,
  DoorOpen,
  Radio,
  XCircle,
  FileSpreadsheet,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Check,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';

export const MatchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { staff } = useStaffAuth();
  const isAdmin = staff?.role === 'admin';

  // Room Password reveal & copy states
  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals state
  const [isOpenRoomModal, setIsOpenRoomModal] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [openRoomError, setOpenRoomError] = useState<string | null>(null);

  const [isGoLiveModal, setIsGoLiveModal] = useState(false);
  const [goLiveError, setGoLiveError] = useState<string | null>(null);

  const [isCancelModal, setIsCancelModal] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Double click guard
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch match details
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['staff-match-detail', id],
    queryFn: () => getStaffMatchDetail(id!),
    enabled: Boolean(id),
  });

  const match: MatchDetailStaffDto | undefined = data?.match;

  const handleCopy = async (text: string, key: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // ─── Open Room Handler ─────────────────────────────────────────────────────
  const handleOpenRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match || isSubmittingRef.current) return;
    if (!roomIdInput.trim() || !roomPasswordInput.trim()) {
      setOpenRoomError('Both Room ID and Room Password are required');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setOpenRoomError(null);

      await openStaffMatchRoom(match.id, roomIdInput.trim(), roomPasswordInput.trim());

      setIsOpenRoomModal(false);
      setRoomIdInput('');
      setRoomPasswordInput('');
      await queryClient.invalidateQueries({ queryKey: ['staff-match-detail', match.id] });
    } catch (err: any) {
      if (err?.code === 'INVALID_TRANSITION' || err?.status === 409) {
        setOpenRoomError('This request was already processed');
        await queryClient.invalidateQueries({ queryKey: ['staff-match-detail', match.id] });
      } else {
        setOpenRoomError(getFriendlyErrorMessage(err));
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ─── Go Live Handler ───────────────────────────────────────────────────────
  const handleGoLiveSubmit = async () => {
    if (!match || isSubmittingRef.current) return;

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setGoLiveError(null);

      await goLiveStaffMatch(match.id);

      setIsGoLiveModal(false);
      await queryClient.invalidateQueries({ queryKey: ['staff-match-detail', match.id] });
    } catch (err: any) {
      if (err?.code === 'INVALID_TRANSITION' || err?.status === 409) {
        setGoLiveError('This request was already processed');
        await queryClient.invalidateQueries({ queryKey: ['staff-match-detail', match.id] });
      } else {
        setGoLiveError(getFriendlyErrorMessage(err, 'live'));
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ─── Cancel Match Handler ──────────────────────────────────────────────────
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match || isSubmittingRef.current) return;
    if (cancelReasonInput.trim().length < 5) {
      setCancelError('Cancellation reason must be at least 5 characters');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setCancelError(null);

      await cancelStaffMatch(match.id, cancelReasonInput.trim());

      setIsCancelModal(false);
      setCancelReasonInput('');
      await queryClient.invalidateQueries({ queryKey: ['staff-match-detail', match.id] });
    } catch (err: any) {
      if (err?.code === 'FORBIDDEN') {
        setCancelError('Only administrators can cancel live matches');
      } else if (err?.code === 'INVALID_TRANSITION' || err?.status === 409) {
        setCancelError('This request was already processed');
        await queryClient.invalidateQueries({ queryKey: ['staff-match-detail', match.id] });
      } else {
        setCancelError(getFriendlyErrorMessage(err, 'cancel'));
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading match details...</p>
      </div>
    );
  }

  if (isError || !match) {
    return (
      <div className="max-w-xl mx-auto p-8 bg-red-950/40 border border-red-900 rounded-xl text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Match Not Found</h2>
        <p className="text-sm text-red-300">
          {getFriendlyErrorMessage(error)}
        </p>
        <Link
          to="/matches"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Matches List
        </Link>
      </div>
    );
  }

  const activePlayers = (match.players || []).filter((p) => !p.refundedAt);
  const refundedPlayers = (match.players || []).filter((p) => p.refundedAt);

  // Team mapping
  const teamMap = new Map<string, MatchTeamStaffDto>();
  (match.teams || []).forEach((t) => teamMap.set(t.id, t));

  return (
    <div className="space-y-6">
      {/* Top Header / Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Link to="/matches" className="hover:text-amber-400 transition-colors">
              Matches
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-200">M{match.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 font-mono">
              BW-MAT-{match.id}
            </h1>
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                match.status === 'live'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                  : match.status === 'room_open'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : match.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : match.status === 'cancelled'
                  ? 'bg-slate-800 text-slate-400 border-slate-700 line-through'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
              }`}
            >
              {match.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
            title="Refresh Match"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {match.status === 'upcoming' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setRoomIdInput('');
                  setRoomPasswordInput('');
                  setOpenRoomError(null);
                  setIsOpenRoomModal(true);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-amber-500/10"
              >
                <DoorOpen className="w-4 h-4" />
                Open Room
              </button>
              <button
                type="button"
                onClick={() => {
                  setCancelReasonInput('');
                  setCancelError(null);
                  setIsCancelModal(true);
                }}
                className="px-4 py-2 bg-red-950/50 hover:bg-red-900/60 border border-red-800 text-red-200 text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Cancel Match
              </button>
            </>
          )}

          {match.status === 'room_open' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setGoLiveError(null);
                  setIsGoLiveModal(true);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-rose-600/10"
              >
                <Radio className="w-4 h-4" />
                Go Live
              </button>
              <button
                type="button"
                onClick={() => {
                  setCancelReasonInput('');
                  setCancelError(null);
                  setIsCancelModal(true);
                }}
                className="px-4 py-2 bg-red-950/50 hover:bg-red-900/60 border border-red-800 text-red-200 text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Cancel Match
              </button>
            </>
          )}

          {match.status === 'live' && (
            <>
              <button
                type="button"
                onClick={() => navigate(`/matches/${match.id}/result`)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-amber-500/10"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Add Result
              </button>
              {/* Hide Cancel on live match for employees */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setCancelReasonInput('');
                    setCancelError(null);
                    setIsCancelModal(true);
                  }}
                  className="px-4 py-2 bg-red-950/50 hover:bg-red-900/60 border border-red-800 text-red-200 text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel Match
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Match Snapshot Details */}
        <div className="md:col-span-2 bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Swords className="w-5 h-5 text-amber-500" />
              Tournament Format & Economics
            </h2>
            <span className="text-xs font-mono text-slate-400">
              Tier #{match.tierId}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-500 block">Game Mode</span>
              <span className="font-semibold text-white capitalize">
                {match.gameMode.replace('_', ' ')}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Team Mode</span>
              <span className="font-semibold text-white capitalize">
                {match.teamMode}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Scheduled Start</span>
              <span className="font-medium text-amber-300">
                {formatISTDate(match.startTime)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Player Roster</span>
              <span className="font-medium text-white">
                {activePlayers.length} / {match.maxPlayers} (Min {match.minPlayers})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80 text-sm">
            <div>
              <span className="text-xs text-slate-500 block">Entry Fee</span>
              <span className="font-bold text-emerald-400 text-base">
                {formatIndianRupees(match.entryFee)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Kill Reward</span>
              <span className="font-bold text-emerald-400 text-base">
                {formatIndianRupees(match.killPrice)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Reward Threshold</span>
              <span className="font-semibold text-slate-200">
                {match.minKillsForReward} kills
              </span>
            </div>
          </div>

          {/* Position Prizes Breakdown */}
          {match.positionPrizes && Object.keys(match.positionPrizes).length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Position Prizes
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(match.positionPrizes).map(([pos, prize]) => (
                  <div
                    key={pos}
                    className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2"
                  >
                    <span className="text-slate-400 font-medium">
                      {getPositionLabel(Number(pos))}:
                    </span>
                    <span className="font-bold font-mono text-emerald-400">
                      {formatIndianRupees(prize)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {match.cancelReason && (
            <div className="p-4 bg-red-950/40 border border-red-900 rounded-lg text-xs text-red-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-red-300 mb-0.5">Cancellation Reason:</strong>
                {match.cancelReason}
              </div>
            </div>
          )}
        </div>

        {/* Room Credentials Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-500" />
                Room Credentials
              </h2>
              {match.roomId && (
                <span className="text-[11px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 font-semibold rounded border border-emerald-500/20">
                  Published
                </span>
              )}
            </div>

            {match.roomId ? (
              <div className="space-y-4">
                {/* Room ID */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                      Room ID
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(match.roomId!, 'room_id')}
                      className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                      title="Copy Room ID"
                    >
                      {copiedKey === 'room_id' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <span className="font-mono text-base font-bold text-white select-all">
                    {match.roomId}
                  </span>
                </div>

                {/* Room Password */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                      Room Password
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPasswordRevealed(!passwordRevealed)}
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                        title={passwordRevealed ? 'Hide Password' : 'Show Password'}
                      >
                        {passwordRevealed ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Reveal</span>
                          </>
                        )}
                      </button>

                      {match.roomPassword && (
                        <button
                          type="button"
                          onClick={() => handleCopy(match.roomPassword!, 'room_pw')}
                          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                          title="Copy Password"
                        >
                          {copiedKey === 'room_pw' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-base font-bold text-white select-all">
                    {passwordRevealed ? match.roomPassword : '••••••••••••'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-2">
                <DoorOpen className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  Custom room has not been opened yet.
                </p>
                {match.status === 'upcoming' && (
                  <button
                    type="button"
                    onClick={() => {
                      setRoomIdInput('');
                      setRoomPasswordInput('');
                      setOpenRoomError(null);
                      setIsOpenRoomModal(true);
                    }}
                    className="mt-2 text-xs text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-4"
                  >
                    Open Custom Room Now
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
            Room credentials are encrypted and never logged to console or audit trails.
          </div>
        </div>
      </div>

      {/* Teams Overview (for Duo, Squad, and Clash Squad) */}
      {match.teamMode !== 'solo' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              Registered Teams ({match.teams?.length || 0})
            </h2>
            <span className="text-xs text-slate-400">
              Only confirmed teams with full rosters count for result entries
            </span>
          </div>

          {!match.teams || match.teams.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No teams registered yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {match.teams.map((team) => {
                const isComplete =
                  team.status === 'confirmed' && team.memberUserIds.length >= team.size;
                const isIncomplete =
                  team.status === 'confirmed' && team.memberUserIds.length < team.size;

                return (
                  <div
                    key={team.id}
                    className={`p-4 rounded-xl border space-y-3 ${
                      team.status === 'disbanded'
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                        : isIncomplete
                        ? 'bg-amber-950/20 border-amber-800/40'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          {team.name || `Team #${team.id}`}
                        </span>
                        <span className="font-mono text-xs text-slate-500">
                          (ID: {team.id})
                        </span>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2">
                        {team.status === 'confirmed' ? (
                          isComplete ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Confirmed ({team.memberUserIds.length}/{team.size})
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Incomplete ({team.memberUserIds.length}/{team.size})
                            </span>
                          )
                        ) : team.status === 'forming' ? (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                            Forming ({team.memberUserIds.length}/{team.size})
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30 line-through">
                            Disbanded
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Member Details */}
                    <div className="space-y-1 text-xs">
                      <span className="text-slate-500 block text-[11px]">Members:</span>
                      <div className="flex flex-wrap gap-2">
                        {team.memberUserIds.map((uid) => {
                          const player = (match.players || []).find((p) => p.userId === uid);
                          const isLeader = team.leaderId === uid;
                          return (
                            <span
                              key={uid}
                              className={`px-2 py-1 rounded text-[11px] border flex items-center gap-1.5 ${
                                isLeader
                                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-semibold'
                                  : 'bg-slate-900 border-slate-800 text-slate-300'
                              }`}
                            >
                              <span>{player?.ffName || player?.name || `User #${uid}`}</span>
                              {isLeader && (
                                <span className="text-[9px] uppercase tracking-wider text-amber-400">
                                  ★ Leader
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {isIncomplete && (
                      <p className="text-[11px] text-amber-400/90 flex items-center gap-1 pt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Incomplete team: Cannot be assigned a position or prize in results.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Players Roster */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-0">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              Roster Players ({activePlayers.length} Active / {match.players?.length || 0} Total)
            </h2>
            <p className="text-xs text-slate-400">
              Verified players enrolled in the match custom room.
            </p>
          </div>
          {refundedPlayers.length > 0 && (
            <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">
              {refundedPlayers.length} Refunded
            </span>
          )}
        </div>

        {!match.players || match.players.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No players have joined this match yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Free Fire Identity</th>
                  {match.teamMode !== 'solo' && <th className="py-3 px-4">Team</th>}
                  <th className="py-3 px-4">Entry Fee Breakdown</th>
                  <th className="py-3 px-4">Joined At</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {match.players.map((p) => {
                  const isRefunded = Boolean(p.refundedAt);
                  const team = p.teamId ? teamMap.get(p.teamId) : null;

                  return (
                    <tr
                      key={p.userId}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        isRefunded ? 'opacity-50 line-through' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white block">{p.name}</span>
                        <span className="text-[11px] text-slate-500 font-mono">UID: {p.userId}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-amber-300 block">{p.ffName}</span>
                        <span className="text-[11px] text-slate-400 font-mono">FFID: {p.ffId}</span>
                      </td>
                      {match.teamMode !== 'solo' && (
                        <td className="py-3 px-4">
                          {team ? (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700">
                              {team.name || `Team #${team.id}`}
                            </span>
                          ) : (
                            <span className="text-slate-500">Solo</span>
                          )}
                        </td>
                      )}
                      <td className="py-3 px-4 text-slate-300">
                        <div className="space-y-0.5 text-[11px]">
                          <div>Deposit: <strong className="text-white">{formatIndianRupees(p.paidAddMoney)}</strong></div>
                          {Number(p.paidCashback) > 0 && (
                            <div>Cashback: <strong className="text-amber-400">{formatIndianRupees(p.paidCashback)}</strong></div>
                          )}
                          {Number(p.paidWinning) > 0 && (
                            <div>Winning: <strong className="text-emerald-400">{formatIndianRupees(p.paidWinning)}</strong></div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {formatISTDate(p.joinedAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isRefunded ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-red-950/60 text-red-400 border border-red-900 font-semibold">
                            Refunded
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-900 font-semibold">
                            Enrolled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── MODAL: Open Room ─────────────────────────────────────────────────── */}
      {isOpenRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <DoorOpen className="w-5 h-5 text-amber-500" />
              Open Custom Room (M{match.id})
            </h3>
            <p className="text-xs text-slate-400">
              Publish custom room ID and password to registered players. Match status will transition to room_open.
            </p>

            {openRoomError && (
              <div className="p-3 bg-red-950/50 border border-red-900 rounded-lg text-xs text-red-200">
                {openRoomError}
              </div>
            )}

            <form onSubmit={handleOpenRoomSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Room ID
                </label>
                <input
                  type="text"
                  required
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  placeholder="e.g. 1234567"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Room Password
                </label>
                <input
                  type="text"
                  required
                  value={roomPasswordInput}
                  onChange={(e) => setRoomPasswordInput(e.target.value)}
                  placeholder="e.g. secretpass"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpenRoomModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Opening Room...' : 'Publish Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Go Live ───────────────────────────────────────────────────── */}
      {isGoLiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-rose-500" />
              Transition Match to Live (M{match.id})
            </h3>
            <p className="text-xs text-slate-300">
              Confirm that players have entered the in-game room and the match has commenced.
            </p>

            {goLiveError && (
              <div className="p-3 bg-red-950/50 border border-red-900 rounded-lg text-xs text-red-200">
                {goLiveError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsGoLiveModal(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGoLiveSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Transitioning...' : 'Confirm Go Live'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Cancel Match ──────────────────────────────────────────────── */}
      {isCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Cancel Match & Refund Players (M{match.id})
            </h3>
            <p className="text-xs text-slate-300">
              Cancelling will refund all non-refunded player entry fees back to their source wallets (Add Money, Cashback, Winning) and log an audit trail.
            </p>

            {cancelError && (
              <div className="p-3 bg-red-950/50 border border-red-900 rounded-lg text-xs text-red-200">
                {cancelError}
              </div>
            )}

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cancellation Reason (Min 5 characters)
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="e.g. In-game server maintenance prevented room creation"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCancelModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || cancelReasonInput.trim().length < 5}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg disabled:opacity-50"
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
