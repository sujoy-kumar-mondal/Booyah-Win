import React, { useState } from 'react';
import { X, Users, AlertCircle } from 'lucide-react';
import { createTeam, type MatchUserDto } from '../../api/matches.js';
import { formatIndianRupees } from '../../utils/formatters.js';
import { ApiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useInvites } from '../../context/InvitesContext.js';

interface TeamFormModalProps {
  match: MatchUserDto;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TeamFormModal: React.FC<TeamFormModalProps> = ({
  match,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { refreshProfile } = useAuth();
  const { refetchInvites } = useInvites();

  const teamSize = match.teamMode.toLowerCase() === 'duo' ? 2 : 4;
  const neededMembers = teamSize - 1;

  const [teamName, setTeamName] = useState('');
  const [memberFfIds, setMemberFfIds] = useState<string[]>(Array(neededMembers).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleMemberChange = (index: number, val: string) => {
    const updated = [...memberFfIds];
    updated[index] = val.trim();
    setMemberFfIds(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Double-tap guard

    // Basic client check
    const emptySlot = memberFfIds.some((id) => !id);
    if (emptySlot) {
      setErrorMessage(`Please enter all ${neededMembers} teammate Free Fire ID(s).`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createTeam(match.id, {
        teamName: teamName.trim() || undefined,
        memberFfIds,
      });
      await refreshProfile();
      await refetchInvites();
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        // Requirement 7: Teammate lookup errors use the friendly text of the API's error code only
        if (err.code === 'NOT_FOUND') {
          setErrorMessage('Player not found.');
        } else if (err.code === 'LOW_BALANCE') {
          setErrorMessage('Insufficient wallet balance to register team.');
        } else if (err.code === 'MATCH_FULL') {
          setErrorMessage('This match is already full.');
        } else if (err.code === 'MATCH_NOT_JOINABLE') {
          setErrorMessage('Registration for this match is closed.');
        } else if (err.code === 'TEAM_INVALID') {
          setErrorMessage('Invalid team configuration.');
        } else if (err.code === 'ALREADY_JOINED') {
          setErrorMessage('You or an invited teammate has already joined this match.');
        } else {
          setErrorMessage(err.message || 'Unable to register team.');
        }
      } else {
        setErrorMessage('Network error occurred. Please check connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="team-form-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div
        data-testid="team-form-modal"
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-slate-100">
              Form {match.teamMode.toUpperCase()} Team
            </h3>
          </div>
          <button
            type="button"
            data-testid="close-team-modal-btn"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-xl bg-slate-800/50 p-3 border border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">Entry Fee per Player</span>
            <span className="font-bold text-slate-100">{formatIndianRupees(match.entryFee)}</span>
          </div>

          {/* Requirement 6: Cutoff as a rule */}
          <div
            data-testid="team-cutoff-rule"
            className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300"
          >
            Notice: Team changes close 10 minutes before the start.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Team Name (Optional)
            </label>
            <input
              type="text"
              data-testid="team-name-input"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Thunder Strikers"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-slate-300">
              Teammate Free Fire IDs ({neededMembers} required)
            </label>
            {memberFfIds.map((ffId, idx) => (
              <div key={idx}>
                <input
                  type="text"
                  data-testid={`member-ffid-input-${idx}`}
                  value={ffId}
                  onChange={(e) => handleMemberChange(idx, e.target.value)}
                  placeholder={`Teammate ${idx + 1} Free Fire ID`}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>
            ))}
          </div>

          {errorMessage && (
            <div
              data-testid="team-form-error"
              className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 flex items-center gap-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              data-testid="cancel-team-btn"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="submit-team-btn"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Team...' : 'Form Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
