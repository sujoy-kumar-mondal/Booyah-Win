import React, { useState, useEffect, useRef } from 'react';
import { X, UserMinus, AlertTriangle, AlertCircle, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';
import { replaceTeamInvite, disbandTeam, lookupTeammate } from '../../api/matches.js';
import { ApiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useInvites } from '../../context/InvitesContext.js';
import { useTranslation } from '../../i18n/LanguageContext.js';

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
  const { t } = useTranslation();

  const [oldFfId, setOldFfId] = useState('');
  const [newFfId, setNewFfId] = useState('');
  const [newValidation, setNewValidation] = useState<{
    loading: boolean;
    exists?: boolean;
    ffName?: string;
    message?: string;
  }>({ loading: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const handleNewFfIdChange = (val: string) => {
    setNewFfId(val);
    const clean = val.trim();
    if (!clean) {
      setNewValidation({ loading: false });
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setNewValidation({ loading: true });
      try {
        const res = await lookupTeammate(clean, matchId);
        if (res && res.exists) {
          setNewValidation({ loading: false, exists: true, ffName: res.ffName });
        } else {
          setNewValidation({
            loading: false,
            exists: false,
            message: res?.message || t('matches.invalidUidCheck'),
          });
        }
      } catch (err: any) {
        setNewValidation({
          loading: false,
          exists: false,
          message: err?.message || t('matches.errorVerifyingUid'),
        });
      }
    }, 400);
  };

  if (!isOpen) return null;

  const handleReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Double-tap guard
    if (!oldFfId.trim() || !newFfId.trim()) {
      setErrorMessage(t('matches.bothUidsRequired'));
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
          setErrorMessage(t('matches.playerNotFound'));
        } else if (err.code === 'MATCH_NOT_JOINABLE') {
          setErrorMessage(t('matches.cutoffReachedError'));
        } else if (err.code === 'FORBIDDEN') {
          setErrorMessage(t('matches.onlyLeaderCanChangeTeammate'));
        } else if (err.code === 'TEAM_INVALID') {
          setErrorMessage(t('matches.invalidTeamReplacement'));
        } else {
          setErrorMessage(err.message || t('matches.failedToReplaceTeammate'));
        }
      } else {
        setErrorMessage(t('common.networkError'));
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
          setErrorMessage(t('matches.cannotDisbandCutoff'));
        } else {
          setErrorMessage(err.message || t('matches.failedToDisband'));
        }
      } else {
        setErrorMessage(t('common.networkError'));
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
              {mode === 'replace' ? t('matches.replaceTeammate') : t('matches.disbandTeamTitle')}
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
          {t('matches.teamChangesCutoffRule')}
        </div>

        {mode === 'replace' ? (
          <form onSubmit={handleReplace} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t('matches.oldFfIdLabel')}
              </label>
              <input
                type="text"
                data-testid="old-ffid-input"
                value={oldFfId}
                onChange={(e) => setOldFfId(e.target.value)}
                placeholder={t('matches.oldFfIdPlaceholder')}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t('matches.newFfIdLabel')}
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  data-testid="new-ffid-input"
                  value={newFfId}
                  onChange={(e) => handleNewFfIdChange(e.target.value)}
                  placeholder={t('matches.newFfIdPlaceholder')}
                  className={`w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none pr-32 transition-colors ${
                    newValidation.exists === true
                      ? 'border-emerald-500/70 focus:border-emerald-400'
                      : newValidation.exists === false
                      ? 'border-rose-500/70 focus:border-rose-400'
                      : 'border-slate-700 focus:border-emerald-500'
                  }`}
                  required
                />
                <div className="absolute right-2.5 flex items-center gap-1.5 pointer-events-none">
                  {newValidation.loading && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                      <span>{t('matches.checking')}</span>
                    </div>
                  )}
                  {newValidation.exists === true && (
                    <span
                      data-testid="new-member-ffname-badge"
                      className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/40 truncate max-w-[130px]"
                      title={newValidation.ffName}
                    >
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span className="truncate">{newValidation.ffName}</span>
                    </span>
                  )}
                </div>
              </div>

              {newValidation.exists === false && (
                <div
                  data-testid="new-member-error-text"
                  className="text-[11px] text-rose-400 font-medium px-1 flex items-center gap-1"
                >
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{newValidation.message || t('matches.invalidUidCheck')}</span>
                </div>
              )}
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
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                data-testid="confirm-replace-btn"
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {isSubmitting ? t('matches.replacing') : t('matches.replace')}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
              <p>
                {t('matches.disbandWarning')}
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
                {t('matches.keepTeam')}
              </button>
              <button
                type="button"
                data-testid="confirm-disband-btn"
                onClick={handleDisband}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-rose-500 py-2.5 text-xs font-bold text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {isSubmitting ? t('matches.disbanding') : t('matches.disbandAndRefund')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
