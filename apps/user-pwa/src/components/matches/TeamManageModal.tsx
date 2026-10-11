import React, { useState } from 'react';
import { X, UserMinus, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { replaceTeamInvite, disbandTeam } from '../../api/matches.js';
import { ApiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useInvites } from '../../context/InvitesContext.js';

interface TeamManageModalProps {
  matchId: string;
  isOpen: boolean;
  mode: 'replace' | 'disband';
  onClose: () => void;
  onSuccess: () => void;
}

export const TeamManageModal: React.FC<TeamManageModalProps> = ({
  matchId,
  isOpen,
  mode,
  onClose,
  onSuccess,
}) => {
  const { refreshProfile } = useAuth();
  const { refetchInvites } = useInvites();

  const [oldFfId, setOldFfId] = useState('');
  const [newFfId, setNewFfId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Double-tap guard
    if (!oldFfId.trim() || !newFfId.trim()) {
      setErrorMessage('Please enter both the current and new Free Fire IDs.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await replaceTeamInvite(matchId, {
        oldFfId: oldFfId.trim(),
        newFfId: newFfId.trim(),
      });
      await refreshProfile();
      await refetchInvites();
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        // Requirement 7: Teammate lookup errors use friendly error text only
        if (err.code === 'NOT_FOUND') {
          setErrorMessage('Player not found.');
        } else if (err.code === 'MATCH_NOT_JOINABLE') {
          setErrorMessage('Registration for this match is closed (10-minute cutoff reached).');
        } else if (err.code === 'TEAM_INVALID') {
          setErrorMessage('Invalid team or member replacement.');
        } else {
          setErrorMessage(err.message || 'Failed to replace teammate.');
        }
      } else {
        setErrorMessage('Network error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisband = async () => {
    if (isSubmitting) return; // Double-tap guard
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await disbandTeam(matchId);
      await refreshProfile();
      await refetchInvites();
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'MATCH_NOT_JOINABLE') {
          setErrorMessage('Cannot disband team within 10 minutes of match start.');
        } else {
          setErrorMessage(err.message || 'Failed to disband team.');
        }
      } else {
        setErrorMessage('Network error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="team-manage-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div
        data-testid="team-manage-modal"
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            {mode === 'replace' ? (
              <RefreshCw className="h-5 w-5 text-emerald-400" />
            ) : (
              <UserMinus className="h-5 w-5 text-rose-400" />
            )}
            <h3 className="text-base font-bold text-slate-100">
              {mode === 'replace' ? 'Replace Teammate' : 'Disband Team'}
            </h3>
          </div>
          <button
            type="button"
            data-testid="close-manage-modal-btn"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cutoff Notice as rule */}
        <div
          data-testid="team-manage-cutoff-rule"
          className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-300"
        >
          Rule: Team changes close 10 minutes before the start.
        </div>

        {mode === 'replace' ? (
          <form onSubmit={handleReplace} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Current Teammate Free Fire ID
              </label>
              <input
                type="text"
                data-testid="old-ffid-input"
                value={oldFfId}
                onChange={(e) => setOldFfId(e.target.value)}
                placeholder="Old Free Fire ID"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                New Teammate Free Fire ID
              </label>
              <input
                type="text"
                data-testid="new-ffid-input"
                value={newFfId}
                onChange={(e) => setNewFfId(e.target.value)}
                placeholder="New Free Fire ID"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            {errorMessage && (
              <div
                data-testid="manage-modal-error"
                className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                data-testid="cancel-manage-btn"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="confirm-replace-btn"
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {isSubmitting ? 'Replacing...' : 'Replace'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
              <p>
                Are you sure you want to disband this team? All joined and pending players will be
                refunded their entry fee.
              </p>
            </div>

            {errorMessage && (
              <div
                data-testid="manage-modal-error"
                className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                data-testid="cancel-disband-btn"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Keep Team
              </button>
              <button
                type="button"
                data-testid="confirm-disband-btn"
                onClick={handleDisband}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-rose-500 py-2.5 text-xs font-bold text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {isSubmitting ? 'Disbanding...' : 'Disband & Refund'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
