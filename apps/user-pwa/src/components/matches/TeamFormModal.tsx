import React, { useState, useEffect, useRef } from 'react';
import { X, Users, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { createTeam, lookupTeammate, type MatchUserDto } from '../../api/matches.js';
import { formatIndianRupees } from '../../utils/formatters.js';
import { paiseToString, stringToPaise } from '@booyah/shared';
import { ApiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useInvites } from '../../context/InvitesContext.js';
import { useTranslation } from '../../i18n/LanguageContext.js';

interface TeamFormModalProps {
  match: MatchUserDto;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ValidationState {
  loading: boolean;
  exists?: boolean;
  ffName?: string;
  name?: string;
  message?: string;
}

export const TeamFormModal: React.FC<TeamFormModalProps> = ({
  match,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { refreshProfile } = useAuth();
  const { refetchInvites } = useInvites();
  const { t } = useTranslation();

  const teamSize = match.teamMode.toLowerCase() === 'duo' ? 2 : 4;
  const neededMembers = teamSize - 1;

  const [teamName, setTeamName] = useState('');
  const [memberFfIds, setMemberFfIds] = useState<string[]>(Array(neededMembers).fill(''));
  const [validations, setValidations] = useState<Record<number, ValidationState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Debounce timers per input
  const debounceTimers = useRef<Record<number, any>>({});

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  if (!isOpen) return null;

  const isClashSquad = match.gameMode?.toLowerCase() === 'clash_squad';
  const feePaise = stringToPaise(match.entryFee.toString());
  // For Clash Squad, the match entry fee is the total team fee (e.g. ₹50).
  // For Battle Royale (duo/squad), entry fee is per player, so total team fee = fee * teamSize.
  const totalTeamFeePaise = isClashSquad ? feePaise : feePaise * teamSize;
  const totalTeamFeeStr = paiseToString(totalTeamFeePaise);

  const validateUid = async (index: number, val: string) => {
    const clean = val.trim();
    if (!clean) {
      setValidations((prev) => ({
        ...prev,
        [index]: { loading: false },
      }));
      return;
    }

    setValidations((prev) => ({
      ...prev,
      [index]: { loading: true },
    }));

    try {
      const res = await lookupTeammate(clean, match.id);
      if (res && res.exists) {
        setValidations((prev) => ({
          ...prev,
          [index]: {
            loading: false,
            exists: true,
            ffName: res.ffName,
            name: res.name,
          },
        }));
      } else {
        setValidations((prev) => ({
          ...prev,
          [index]: {
            loading: false,
            exists: false,
            message: res?.message || t('matches.invalidUidCheck'),
          },
        }));
      }
    } catch (err: any) {
      setValidations((prev) => ({
        ...prev,
        [index]: {
          loading: false,
          exists: false,
          message: err?.message || 'Error verifying UID. Please try again.',
        },
      }));
    }
  };

  const handleMemberChange = (index: number, val: string) => {
    const updated = [...memberFfIds];
    updated[index] = val.trim();
    setMemberFfIds(updated);

    if (debounceTimers.current[index]) {
      clearTimeout(debounceTimers.current[index]);
    }

    debounceTimers.current[index] = setTimeout(() => {
      validateUid(index, val);
    }, 400);
  };

  const handleMemberBlur = (index: number) => {
    if (debounceTimers.current[index]) {
      clearTimeout(debounceTimers.current[index]);
    }
    validateUid(index, memberFfIds[index]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Double-tap guard

    // Check all slots filled
    const emptySlot = memberFfIds.some((id) => !id);
    if (emptySlot) {
      setErrorMessage(t('matches.allTeammatesRequired', { count: neededMembers }));
      return;
    }

    // Check duplicate UIDs in form
    const lowerIds = memberFfIds.map((id) => id.toLowerCase());
    const uniqueIds = new Set(lowerIds);
    if (uniqueIds.size !== lowerIds.length) {
      setErrorMessage(t('matches.uniqueTeammatesRequired'));
      return;
    }

    // Check any invalid UID
    for (let i = 0; i < neededMembers; i++) {
      const v = validations[i];
      if (v?.exists === false) {
        setErrorMessage(t('matches.teammateUidInvalidAt', { index: i + 1 }));
        return;
      }
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
        if (err.code === 'NOT_FOUND') {
          setErrorMessage(t('matches.playerNotFound'));
        } else if (err.code === 'LOW_BALANCE') {
          setErrorMessage(t('matches.insufficientWalletTeamFee', { fee: formatIndianRupees(totalTeamFeeStr) }));
        } else if (err.code === 'MATCH_FULL') {
          setErrorMessage(t('matches.matchAlreadyFull'));
        } else if (err.code === 'MATCH_NOT_JOINABLE') {
          setErrorMessage(t('matches.registrationClosed'));
        } else if (err.code === 'TEAM_INVALID') {
          setErrorMessage(t('matches.invalidTeamConfig'));
        } else if (err.code === 'ALREADY_JOINED') {
          setErrorMessage(t('matches.teamAlreadyJoined'));
        } else {
          setErrorMessage(err.message || t('matches.unableToJoin'));
        }
      } else {
        setErrorMessage(t('matches.networkFailedCheckMatches'));
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
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-slate-100">
              {t('matches.formTeamTitle', { mode: match.teamMode.toUpperCase() })}
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
          {/* Fee Breakdown Box */}
          <div className="rounded-xl bg-slate-800/60 p-3.5 border border-slate-800 space-y-1.5 text-xs">
            {isClashSquad ? (
              <div className="flex justify-between items-center text-slate-400">
                <span>{t('matches.teamEntryFee')}</span>
                <span className="font-semibold text-slate-200">{formatIndianRupees(match.entryFee)}</span>
              </div>
            ) : (
              <div className="flex justify-between items-center text-slate-400">
                <span>{t('matches.entryFeePerPlayer')}</span>
                <span className="font-semibold text-slate-200">{formatIndianRupees(match.entryFee)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-slate-400">
              <span>{t('matches.teamSize')}</span>
              <span className="font-semibold text-slate-200">{t('matches.teamSizePlayers', { count: teamSize })}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-700/60">
              <div>
                <span className="font-bold text-slate-200 block">{t('matches.totalTeamFee')}</span>
                <span className="text-[10px] text-emerald-400">{t('matches.deductedFromWallet')}</span>
              </div>
              <span className="text-base font-extrabold text-emerald-400">
                {formatIndianRupees(totalTeamFeeStr)}
              </span>
            </div>
          </div>

          {/* Cutoff Notice */}
          <div
            data-testid="team-cutoff-rule"
            className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-300"
          >
            {t('matches.teamChangesCutoffNotice')}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('matches.teamNameOptional')}
            </label>
            <input
              type="text"
              data-testid="team-name-input"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder={t('matches.teamNamePlaceholder')}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              {t('matches.teammateUidsRequired', { count: neededMembers })}
            </label>
            {memberFfIds.map((ffId, idx) => {
              const val = validations[idx];
              return (
                <div key={idx} className="space-y-1">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      data-testid={`member-ffid-input-${idx}`}
                      value={ffId}
                      onChange={(e) => handleMemberChange(idx, e.target.value)}
                      onBlur={() => handleMemberBlur(idx)}
                      placeholder={t('matches.teammateUidLabel', { n: idx + 1 })}
                      className={`w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none pr-32 transition-colors ${
                        val?.exists === true
                          ? 'border-emerald-500/70 focus:border-emerald-400'
                          : val?.exists === false
                          ? 'border-rose-500/70 focus:border-rose-400'
                          : 'border-slate-700 focus:border-emerald-500'
                      }`}
                      required
                    />

                    {/* Right side status / Free fire game name badge */}
                    <div className="absolute right-2.5 flex items-center gap-1.5 pointer-events-none">
                      {val?.loading && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                          <span>{t('matches.checking')}</span>
                        </div>
                      )}
                      {val?.exists === true && (
                        <span
                          data-testid={`member-ffname-badge-${idx}`}
                          className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/40 truncate max-w-[130px]"
                          title={val.ffName}
                        >
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                          <span className="truncate">{val.ffName}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Error text below input if invalid */}
                  {val?.exists === false && (
                    <div
                      data-testid={`member-error-text-${idx}`}
                      className="text-[11px] text-rose-400 font-medium px-1 flex items-center gap-1"
                    >
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{val.message || t('matches.invalidUidCheck')}</span>
                    </div>
                  )}
                </div>
              );
            })}
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
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              data-testid="submit-team-btn"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {isSubmitting ? t('matches.creatingTeam') : t('matches.formTeamTitle', { mode: match.teamMode.toUpperCase() })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
