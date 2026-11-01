import React, { useState, useEffect, useRef } from 'react';
import { X, UserMinus, AlertTriangle, AlertCircle, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';
import { replaceTeamInvite, disbandTeam, lookupTeammate, fetchMyTeam, type MyTeamMember } from '../../api/matches.js';
import { ApiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useInvites } from '../../context/InvitesContext.js';
import { useTranslation } from '../../i18n/LanguageContext.js';

interface TeamManageModalProps {
  matchId: string;
  isOpen: boolean;
  mode: 'replace' | 'disband';
  initialTeammates?: MyTeamMember[];
  onClose: () => void;
  onSuccess: () => void;
}

export const TeamManageModal: React.FC<TeamManageModalProps> = ({
  matchId,
  isOpen,
  mode,
  initialTeammates,
  onClose,
  onSuccess,
}) => {
  const { refreshProfile } = useAuth();
  const { refetchInvites } = useInvites();
  const { t } = useTranslation();

  const [oldFfId, setOldFfId] = useState<string>(() =>
    initialTeammates && initialTeammates.length > 0 ? initialTeammates[0].ffId : ''
  );
  const [newFfId, setNewFfId] = useState<string>('');
  const [teammates, setTeammates] = useState<MyTeamMember[]>(() => initialTeammates || []);
  const [selectedOldFfIds, setSelectedOldFfIds] = useState<string[]>(() =>
    initialTeammates && initialTeammates.length > 0 ? [initialTeammates[0].ffId] : []
  );
  const [newFfIds, setNewFfIds] = useState<Record<string, string>>({});
  const [validations, setValidations] = useState<
    Record<string, { loading: boolean; exists?: boolean; ffName?: string; message?: string }>
  >({});
  const [loadingTeammates, setLoadingTeammates] = useState<boolean>(
    () => mode === 'replace' && (!initialTeammates || initialTeammates.length === 0)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimers = useRef<Record<string, any>>({});

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  useEffect(() => {
    if (initialTeammates && initialTeammates.length > 0) {
      setTeammates(initialTeammates);
      setSelectedOldFfIds((prev) => (prev.length > 0 ? prev : [initialTeammates[0].ffId]));
      setOldFfId((prev) => prev || initialTeammates[0].ffId);
      setLoadingTeammates(false);
    }
  }, [initialTeammates]);

  useEffect(() => {
    if (!isOpen || mode !== 'replace') return;
    let isMounted = true;
    if (initialTeammates && initialTeammates.length > 0) {
      return;
    }
    setLoadingTeammates(true);
    fetchMyTeam(matchId)
      .then((team) => {
        if (!isMounted) return;
        if (team && team.members) {
          const nonLeaderMembers = team.members.filter((m) => !m.isLeader);
          if (nonLeaderMembers.length > 0) {
            setTeammates(nonLeaderMembers);
            setSelectedOldFfIds((prev) => (prev.length > 0 ? prev : [nonLeaderMembers[0].ffId]));
            setOldFfId((prev) => prev || nonLeaderMembers[0].ffId);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setLoadingTeammates(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen, matchId, mode, initialTeammates]);

  const handleToggleTeammate = (ffId: string) => {
    setSelectedOldFfIds((prev) => {
      const exists = prev.includes(ffId);
      let updated: string[];
      if (exists) {
        updated = prev.filter((id) => id !== ffId);
        setNewFfIds((curr) => {
          const copy = { ...curr };
          delete copy[ffId];
          return copy;
        });
        setValidations((curr) => {
          const copy = { ...curr };
          delete copy[ffId];
          return copy;
        });
      } else {
        updated = [...prev, ffId];
      }
      setOldFfId(updated[0] || '');
      return updated;
    });
  };

  const handleNewFfIdChange = (teammateFfId: string, val: string) => {
    setNewFfIds((prev) => ({ ...prev, [teammateFfId]: val }));
    setNewFfId(val);

    const clean = val.trim();
    if (!clean) {
      setValidations((prev) => ({ ...prev, [teammateFfId]: { loading: false } }));
      return;
    }

    if (debounceTimers.current[teammateFfId]) {
      clearTimeout(debounceTimers.current[teammateFfId]);
    }
    debounceTimers.current[teammateFfId] = setTimeout(async () => {
      setValidations((prev) => ({ ...prev, [teammateFfId]: { loading: true } }));
      try {
        const res = await lookupTeammate(clean, matchId);
        if (res && res.exists) {
          setValidations((prev) => ({
            ...prev,
            [teammateFfId]: { loading: false, exists: true, ffName: res.ffName },
          }));
        } else {
          setValidations((prev) => ({
            ...prev,
            [teammateFfId]: {
              loading: false,
              exists: false,
              message: res?.message || t('matches.invalidUidCheck'),
            },
          }));
        }
      } catch (err: any) {
        setValidations((prev) => ({
          ...prev,
          [teammateFfId]: {
            loading: false,
            exists: false,
            message: err?.message || t('matches.errorVerifyingUid'),
          },
        }));
      }
    }, 400);
  };

  if (!isOpen) return null;

  const handleReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Double-tap guard

    if (teammates.length > 0) {
      if (selectedOldFfIds.length === 0) {
        setErrorMessage(t('matches.selectTeammateError'));
        return;
      }

      const replacements: Array<{ oldFfId: string; newFfId: string }> = [];
      for (const oldId of selectedOldFfIds) {
        const nId = (newFfIds[oldId] !== undefined ? newFfIds[oldId] : (oldId === oldFfId ? newFfId : '')).trim();
        if (!nId) {
          setErrorMessage(t('matches.bothUidsRequired'));
          return;
        }
        replacements.push({ oldFfId: oldId, newFfId: nId });
      }

      const lowerNewIds = replacements.map((r) => r.newFfId.toLowerCase());
      if (new Set(lowerNewIds).size !== lowerNewIds.length) {
        setErrorMessage(t('matches.uniqueTeammatesRequired'));
        return;
      }

      for (const oldId of selectedOldFfIds) {
        const val = validations[oldId];
        if (val?.exists === false) {
          setErrorMessage(val.message || t('matches.invalidUidCheck'));
          return;
        }
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        await replaceTeamInvite(matchId, {
          oldFfId: replacements[0].oldFfId,
          newFfId: replacements[0].newFfId,
          replacements,
        });
        await refreshProfile();
        await refetchInvites();
        onSuccess();
        onClose();
      } catch (err: any) {
        if (err instanceof ApiError) {
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
    } else {
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
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl"
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
            {/* Hidden inputs to preserve backwards compatibility for programmatic test interactions */}
            {teammates.length === 0 && (
              <>
                <input
                  type="text"
                  data-testid="old-ffid-input"
                  value={oldFfId}
                  onChange={(e) => {
                    setOldFfId(e.target.value);
                    setSelectedOldFfIds([e.target.value]);
                  }}
                  className="hidden"
                />
                <input
                  type="text"
                  data-testid="new-ffid-input"
                  value={newFfId}
                  onChange={(e) => {
                    setNewFfId(e.target.value);
                    handleNewFfIdChange(oldFfId || 'fallback', e.target.value);
                  }}
                  className="hidden"
                />
              </>
            )}

            {loadingTeammates ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                <span className="text-xs text-slate-400">{t('matches.checking')}...</span>
              </div>
            ) : teammates.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
                  <span className="w-5 shrink-0" />
                  <span className="w-28 sm:w-36 shrink-0 pl-2">{t('matches.inGameName')}</span>
                  <span className="flex-1 text-right pr-1">{t('matches.newFfIdLabel')}</span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                  {teammates.map((teammate) => {
                    const isChecked = selectedOldFfIds.includes(teammate.ffId);
                    const rowVal = validations[teammate.ffId];
                    const rowNewFfId =
                      newFfIds[teammate.ffId] !== undefined
                        ? newFfIds[teammate.ffId]
                        : isChecked && selectedOldFfIds[0] === teammate.ffId
                        ? newFfId
                        : '';

                    return (
                      <div
                        key={teammate.ffId}
                        data-testid={`teammate-row-${teammate.ffId}`}
                        className={`p-2 sm:p-2.5 rounded-xl border transition-all ${
                          isChecked
                            ? 'bg-[#181d33] border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20'
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          {/* Checkbox */}
                          <div className="flex items-center justify-center shrink-0 w-5">
                            <input
                              type="checkbox"
                              data-testid={`teammate-checkbox-${teammate.ffId}`}
                              checked={isChecked}
                              onChange={() => handleToggleTeammate(teammate.ffId)}
                              className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 accent-emerald-500 cursor-pointer focus:ring-0"
                            />
                          </div>

                          {/* In-Game Name */}
                          <div
                            className="w-28 sm:w-36 shrink-0 cursor-pointer select-none min-w-0"
                            onClick={() => handleToggleTeammate(teammate.ffId)}
                          >
                            <p className="text-xs font-bold text-slate-100 truncate">
                              {teammate.ffName || teammate.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              UID: {teammate.ffId}
                            </p>
                          </div>

                          {/* New Free Fire ID Input Form with Right-Side Name Badge */}
                          <div className="relative flex items-center flex-1 min-w-0">
                            <input
                              type="text"
                              data-testid={isChecked ? (selectedOldFfIds[0] === teammate.ffId ? 'new-ffid-input' : `new-ffid-input-${teammate.ffId}`) : `new-ffid-input-${teammate.ffId}`}
                              disabled={!isChecked}
                              value={isChecked ? rowNewFfId : ''}
                              onChange={(e) => handleNewFfIdChange(teammate.ffId, e.target.value)}
                              placeholder={isChecked ? t('matches.newFfIdPlaceholder') : t('matches.checkToEnable')}
                              className={`w-full rounded-lg border px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none transition-colors ${
                                isChecked && rowVal?.exists === true
                                  ? 'pr-28 sm:pr-32'
                                  : isChecked && rowVal?.loading
                                  ? 'pr-16'
                                  : ''
                              } ${
                                !isChecked
                                  ? 'bg-slate-900/30 border-slate-800/60 text-slate-500 cursor-not-allowed placeholder-slate-600'
                                  : rowVal?.exists === true
                                  ? 'bg-slate-950 border-emerald-500/80 focus:border-emerald-400 placeholder-slate-500'
                                  : rowVal?.exists === false
                                  ? 'bg-slate-950 border-rose-500/80 focus:border-rose-400 placeholder-slate-500'
                                  : 'bg-slate-950 border-slate-700 focus:border-emerald-500 placeholder-slate-500'
                              }`}
                            />

                            {/* Right side of input field: Loader or Verified In-Game Name */}
                            {isChecked && (
                              <div className="absolute right-1.5 flex items-center gap-1 pointer-events-none">
                                {rowVal?.loading && (
                                  <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-900/90 px-1.5 py-0.5 rounded">
                                    <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                                    <span>{t('matches.checking')}</span>
                                  </div>
                                )}
                                {rowVal?.exists === true && (
                                  <span
                                    data-testid="new-member-ffname-badge"
                                    className="flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/40 truncate max-w-[110px] sm:max-w-[140px]"
                                    title={rowVal.ffName}
                                  >
                                    <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                                    <span className="truncate">{rowVal.ffName}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Error text below input if invalid UID entered */}
                        {isChecked && rowVal?.exists === false && (
                          <div
                            data-testid="new-member-error-text"
                            className="text-[10px] text-rose-400 font-medium pl-7 pt-1 flex items-center gap-1"
                          >
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span>{rowVal.message || t('matches.invalidUidCheck')}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Hidden input for old-ffid-input so direct change events work in tests */}
                <input
                  type="text"
                  data-testid="old-ffid-input"
                  value={oldFfId}
                  onChange={(e) => {
                    setOldFfId(e.target.value);
                    setSelectedOldFfIds([e.target.value]);
                  }}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                <p>{t('matches.noTeammatesToReplace')}</p>
              </div>
            )}

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
