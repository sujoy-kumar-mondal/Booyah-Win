import React, { useState } from 'react';
import { Mail, Clock, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  acceptTeamInvite,
  declineTeamInvite,
  type TeamInviteDto,
} from '../../api/matches.js';
import { formatIndianRupees, formatISTDateTime } from '../../utils/formatters.js';
import { useInvites } from '../../context/InvitesContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { ApiError } from '../../api/client.js';

export const TeamInvites: React.FC = () => {
  const { invites, isLoading, refetchInvites } = useInvites();
  const { refreshProfile } = useAuth();

  // Confirm accept dialog state (Requirement 4)
  const [selectedInvite, setSelectedInvite] = useState<TeamInviteDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingInvites = invites.filter((i) => i.status === 'pending');

  const handleConfirmAccept = async () => {
    if (!selectedInvite || isSubmitting) return; // Double-tap guard
    setIsSubmitting(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const res = await acceptTeamInvite(selectedInvite.id);
      await refreshProfile();
      await refetchInvites();
      setActionMessage(res.message || 'Invite accepted successfully!');
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'LOW_BALANCE') {
          setActionError('Insufficient wallet balance to accept this invite.');
        } else if (err.code === 'MATCH_FULL') {
          setActionError('This match is already full.');
        } else if (err.code === 'MATCH_NOT_JOINABLE') {
          setActionError('Registration for this match is closed.');
        } else {
          setActionError(err.message || 'Failed to accept invite.');
        }
      } else {
        setActionError('Network error. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async (inviteId: string) => {
    if (isSubmitting) return; // Double-tap guard
    setIsSubmitting(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const res = await declineTeamInvite(inviteId);
      await refreshProfile();
      await refetchInvites();
      setActionMessage(res.message || 'Invite declined.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to decline invite.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div data-testid="team-invites-container" className="space-y-4">
      {actionMessage && (
        <div
          data-testid="invite-action-result-success"
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-emerald-400 hover:text-emerald-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div
          data-testid="invite-action-result-error"
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-300 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-400 hover:text-rose-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {pendingInvites.length === 0 && !isLoading ? (
        <div
          data-testid="invites-empty-state"
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400"
        >
          <Mail className="mx-auto h-8 w-8 text-slate-600" />
          <h4 className="mt-2 text-sm font-bold text-slate-300">No Pending Invites</h4>
          <p className="mt-1">When teammates invite you to Duo or Squad matches, they appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingInvites.map((invite) => (
            <div
              key={invite.id}
              data-testid={`invite-card-${invite.id}`}
              className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-md space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 uppercase">
                    Team Invite
                  </span>
                  <div className="mt-1 font-semibold text-slate-100 text-sm">
                    {invite.teamName || 'Team Invitation'}
                  </div>
                  <div className="text-xs text-slate-400">
                    Invited by:{' '}
                    <span className="font-mono text-slate-300">{invite.leaderFfId}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400">Entry Fee</span>
                  <div className="text-sm font-bold text-slate-100">
                    {formatIndianRupees(invite.entryFee)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                <Clock className="h-3.5 w-3.5" />
                <span>Starts: {formatISTDateTime(invite.startTime)}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  data-testid={`accept-invite-btn-${invite.id}`}
                  onClick={() => setSelectedInvite(invite)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-emerald-500 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  data-testid={`decline-invite-btn-${invite.id}`}
                  onClick={() => handleDecline(invite.id)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Requirement 4: Confirm Accept Dialog */}
      {selectedInvite && (
        <div
          data-testid="accept-confirm-dialog-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
        >
          <div
            data-testid="accept-confirm-dialog"
            className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100">Confirm Accept Invite</h3>
              <button
                type="button"
                data-testid="close-accept-dialog-btn"
                onClick={() => setSelectedInvite(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-800/40 p-4 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Team</span>
                <span className="font-semibold text-slate-200">
                  {selectedInvite.teamName || 'Team Invitation'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Exact Entry Fee</span>
                <span
                  data-testid="dialog-exact-fee"
                  className="font-bold text-emerald-400 text-sm"
                >
                  {formatIndianRupees(selectedInvite.entryFee)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Match Start Time</span>
                <span
                  data-testid="dialog-start-time"
                  className="font-semibold text-slate-200"
                >
                  {formatISTDateTime(selectedInvite.startTime)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                data-testid="cancel-accept-btn"
                onClick={() => setSelectedInvite(null)}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-accept-btn"
                onClick={async () => {
                  await handleConfirmAccept();
                  setSelectedInvite(null);
                }}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {isSubmitting ? 'Accepting...' : 'Confirm Accept'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
