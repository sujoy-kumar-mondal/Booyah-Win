import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  X,
  Trophy,
  Clock,
  Users,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import type { MatchUserDto } from '../../api/matches.js';
import {
  formatIndianRupees,
  formatISTDateTime,
  isTotalBelowFee,
} from '../../utils/formatters.js';
import { useAuth } from '../../context/AuthContext.js';
import { SoloJoinDialog } from './SoloJoinDialog.js';
import { TeamFormModal } from './TeamFormModal.js';
import { TeamManageModal } from './TeamManageModal.js';

interface MatchDetailModalProps {
  match: MatchUserDto;
  isOpen: boolean;
  onClose: () => void;
  onRefreshMatch: () => void;
}

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  match,
  isOpen,
  onClose,
  onRefreshMatch,
}) => {
  const { wallets } = useAuth();
  let queryClient: any = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // If rendered outside QueryClientProvider
  }

  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<'roomId' | 'roomPassword' | null>(null);

  // Sub-dialogs
  const [soloDialogOpen, setSoloDialogOpen] = useState(false);
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [teamManageMode, setTeamManageMode] = useState<'replace' | 'disband' | null>(null);

  // Requirement 12: Ensure room password is NOT kept in query cache after leaving screen
  useEffect(() => {
    return () => {
      if (queryClient) {
        queryClient.removeQueries({ queryKey: ['match', match.id] });
      }
    };
  }, [match.id, queryClient]);

  if (!isOpen) return null;

  // Requirement 12: Clear "Copied" after a few seconds
  const handleCopy = async (text: string | null | undefined, field: 'roomId' | 'roomPassword') => {
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedField(field);
      setTimeout(() => {
        setCopiedField(null);
      }, 2500); // 2.5 seconds
    } catch {
      // Fallback
    }
  };

  const isSolo = match.teamMode.toLowerCase() === 'solo';
  const isBR =
    match.gameMode.toLowerCase().includes('battle') || match.gameMode.toLowerCase() === 'br';

  const canJoinStatus = match.status === 'upcoming' || match.status === 'room_open';
  const isFull = match.joinedPlayers >= match.maxPlayers;
  const isJoined = match.hasJoined;

  const lowBalanceSoftHint = !isJoined && isTotalBelowFee(wallets?.total, match.entryFee);

  const showRoomCredentials =
    isJoined && (match.status === 'room_open' || match.status === 'live');

  const handleOpenJoinFlow = () => {
    if (isSolo) {
      setSoloDialogOpen(true);
    } else {
      setTeamFormOpen(true);
    }
  };

  return (
    <>
      <div
        data-testid="match-detail-modal-overlay"
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm overflow-y-auto"
      >
        <div
          data-testid="match-detail-modal"
          className="my-auto w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <span className="inline-block rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                {match.gameMode} • {match.teamMode}
              </span>
              <h2 className="mt-1 text-base font-bold text-slate-100">Match Details</h2>
            </div>
            <button
              type="button"
              data-testid="close-detail-modal-btn"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {/* Status & Timing */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-800/40 p-3 border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400" /> Start Time (IST)
                </span>
                <span data-testid="match-start-time" className="mt-1 block font-semibold text-slate-200">
                  {formatISTDateTime(match.startTime)}
                </span>
              </div>
              <div className="rounded-xl bg-slate-800/40 p-3 border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-slate-400" /> Seats Status
                </span>
                {/* Requirement 10: Label seats in team modes as defined by API: seats reserved vs players joined */}
                <span data-testid="match-seats-label" className="mt-1 block font-semibold text-slate-200">
                  {match.teamMode.toLowerCase() === 'solo'
                    ? `${match.joinedPlayers} / ${match.maxPlayers} players joined`
                    : `${match.seatsTaken} seats reserved vs ${match.joinedPlayers} players joined`}
                </span>
              </div>
            </div>

            {/* Fee & Prizes */}
            <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Entry Fee</span>
                <span data-testid="detail-entry-fee" className="text-base font-bold text-slate-100">
                  {formatIndianRupees(match.entryFee)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs py-2 border-b border-slate-800/80">
                <span className="text-slate-400">Kill Price</span>
                <span data-testid="detail-kill-price" className="font-semibold text-slate-200">
                  {formatIndianRupees(match.prizes.killPrice)} per kill
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-2">
                <span className="text-slate-400">Status</span>
                <span className="font-bold text-emerald-400 uppercase">
                  {match.status}
                </span>
              </div>

              {isBR && (
                <div
                  data-testid="br-kill-rule-note"
                  className="mt-3 rounded-lg bg-emerald-500/10 p-2 text-[11px] text-emerald-300 border border-emerald-500/20"
                >
                  minimum 2 kills to earn kill rewards
                </div>
              )}
            </div>

            {/* Prize breakdown table */}
            {match.prizes.positions && Object.keys(match.prizes.positions).length > 0 && (
              <div className="rounded-xl bg-slate-800/40 p-3.5 border border-slate-800 text-xs">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
                  <Trophy className="h-4 w-4 text-amber-400" /> Position Prizes
                </div>
                <div className="space-y-1 text-slate-400">
                  {Object.entries(match.prizes.positions).map(([pos, amt]) => (
                    <div key={pos} className="flex justify-between py-0.5">
                      <span>Rank {pos}</span>
                      <span className="font-medium text-slate-200">
                        {formatIndianRupees(amt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Room Credentials (when joined and room_open or live) */}
            {showRoomCredentials && (
              <div
                data-testid="room-credentials-box"
                className="rounded-xl bg-emerald-950/30 border border-emerald-500/30 p-4 text-xs space-y-3"
              >
                <div className="font-bold text-emerald-400 flex items-center justify-between">
                  <span>Room Access Credentials</span>
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 uppercase">
                    {match.status}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Room ID</span>
                    <span data-testid="room-id-value" className="font-mono text-sm font-bold text-slate-100">
                      {match.roomId || 'Pending'}
                    </span>
                  </div>
                  {match.roomId && (
                    <button
                      type="button"
                      data-testid="copy-room-id-btn"
                      onClick={() => handleCopy(match.roomId, 'roomId')}
                      className="flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
                    >
                      {copiedField === 'roomId' ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Room Password</span>
                    <span
                      data-testid="room-password-value"
                      className="font-mono text-sm font-bold text-slate-100"
                    >
                      {passwordRevealed ? match.roomPassword || 'Pending' : '••••••••'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {match.roomPassword && (
                      <>
                        <button
                          type="button"
                          data-testid="toggle-reveal-password-btn"
                          onClick={() => setPasswordRevealed(!passwordRevealed)}
                          className="rounded bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
                          title={passwordRevealed ? 'Hide Password' : 'Reveal Password'}
                        >
                          {passwordRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          data-testid="copy-room-password-btn"
                          onClick={() => handleCopy(match.roomPassword, 'roomPassword')}
                          className="flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
                        >
                          {copiedField === 'roomPassword' ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Team Actions Section (if team mode and user is joined in team) */}
            {isJoined && match.isInTeam && (
              <div
                data-testid="my-team-section"
                className="rounded-xl bg-slate-800/40 p-4 border border-slate-800 text-xs space-y-3"
              >
                <div className="flex justify-between items-center">
                  <div className="font-bold text-slate-100 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-emerald-400" />
                    <span>My Team</span>
                  </div>
                </div>

                {/* Requirement 6: Cutoff as a rule */}
                <div
                  data-testid="team-changes-rule-note"
                  className="rounded-lg bg-slate-900/80 p-2.5 text-[11px] text-amber-300/90 border border-amber-500/10"
                >
                  team changes close 10 minutes before the start
                </div>

                {/* Team Actions */}
                {canJoinStatus && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      data-testid="open-replace-teammate-btn"
                      onClick={() => setTeamManageMode('replace')}
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                    >
                      Replace Teammate
                    </button>
                    <button
                      type="button"
                      data-testid="open-disband-team-btn"
                      onClick={() => setTeamManageMode('disband')}
                      className="flex-1 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                    >
                      Disband Team
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Soft Low Balance Warning (Requirement 3) */}
            {lowBalanceSoftHint && (
              <div
                data-testid="soft-low-balance-hint"
                className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300 flex items-start gap-2"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  Your total wallet balance ({formatIndianRupees(wallets?.total)}) is below the entry fee.
                  You can still proceed; if balance is insufficient, you can add money.
                </span>
              </div>
            )}

            {/* Join / Action Button */}
            <div>
              {isJoined ? (
                <button
                  type="button"
                  data-testid="joined-status-btn"
                  disabled
                  className="w-full rounded-xl bg-emerald-500/20 border border-emerald-500/30 py-3 text-xs font-bold text-emerald-400 cursor-default"
                >
                  ✓ Already Joined
                </button>
              ) : isFull ? (
                <button
                  type="button"
                  data-testid="match-full-btn"
                  disabled
                  className="w-full rounded-xl bg-slate-800 py-3 text-xs font-bold text-slate-400 cursor-not-allowed"
                >
                  Match Full
                </button>
              ) : !canJoinStatus ? (
                <button
                  type="button"
                  data-testid="match-closed-btn"
                  disabled
                  className="w-full rounded-xl bg-slate-800 py-3 text-xs font-bold text-slate-400 cursor-not-allowed"
                >
                  Registration Closed
                </button>
              ) : (
                /* Requirement 3: Join button stays enabled unless match state forbids joining */
                <button
                  type="button"
                  data-testid="join-match-btn"
                  onClick={handleOpenJoinFlow}
                  className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-bold text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/10"
                >
                  {isSolo ? 'Join Match' : `Form ${match.teamMode.toUpperCase()} Team`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Solo Join Dialog */}
      {soloDialogOpen && (
        <SoloJoinDialog
          match={match}
          isOpen={soloDialogOpen}
          onClose={() => setSoloDialogOpen(false)}
          onSuccess={() => {
            onRefreshMatch();
          }}
        />
      )}

      {/* Team Form Modal */}
      {teamFormOpen && (
        <TeamFormModal
          match={match}
          isOpen={teamFormOpen}
          onClose={() => setTeamFormOpen(false)}
          onSuccess={() => {
            onRefreshMatch();
          }}
        />
      )}

      {/* Team Manage Modal */}
      {teamManageMode && (
        <TeamManageModal
          matchId={match.id}
          isOpen={!!teamManageMode}
          mode={teamManageMode}
          onClose={() => setTeamManageMode(null)}
          onSuccess={() => {
            onRefreshMatch();
          }}
        />
      )}
    </>
  );
};
