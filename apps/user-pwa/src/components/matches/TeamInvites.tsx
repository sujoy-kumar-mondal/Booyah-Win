import React, { useState } from 'react';
import { Mail, Clock, X, AlertCircle, CheckCircle2, Trophy, Swords } from 'lucide-react';
import {
  acceptTeamInvite,
  declineTeamInvite,
  type TeamInviteDto,
} from '../../api/matches.js';
import { formatIndianRupees, formatISTDateTime, formatGameMode } from '../../utils/formatters.js';
import { useInvites } from '../../context/InvitesContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { ApiError } from '../../api/client.js';
import { useTranslation } from '../../i18n/LanguageContext.js';

export const TeamInvites: React.FC = () => {
  const { invites, isLoading, refetchInvites } = useInvites();
  const { user, refreshProfile } = useAuth();
  const { t } = useTranslation();

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
      setActionMessage(res.message || t('matches.inviteAcceptedSuccess'));
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'LOW_BALANCE') {
          setActionError(t('matches.insufficientWalletAcceptInvite'));
        } else if (err.code === 'MATCH_FULL') {
          setActionError(t('matches.matchFullError'));
        } else if (err.code === 'MATCH_NOT_JOINABLE') {
          setActionError(t('matches.registrationClosed'));
        } else {
          setActionError(err.message || t('matches.failedToAcceptInvite'));
        }
      } else {
        setActionError(t('common.networkErrorTryAgain'));
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
      setActionMessage(res.message || t('matches.inviteDeclined'));
    } catch (err: any) {
      setActionError(err?.message || t('matches.failedToDeclineInvite'));
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
          <h4 className="mt-2 text-sm font-bold text-slate-300">{t('matches.noPendingInvitesTitle')}</h4>
          <p className="mt-1">{t('matches.noPendingInvitesDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingInvites.map((invite) => (
            <div
              key={invite.id}
              data-testid={`invite-card-${invite.id}`}
              className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-md space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 uppercase">
                      {t('matches.teamInviteBadge')}
                    </span>
                    {invite.gameMode && (
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300 border border-slate-700/60">
                        {formatGameMode(invite.gameMode)}
                      </span>
                    )}
                    {invite.teamMode && (
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300 border border-slate-700/60">
                        {invite.teamMode}
                      </span>
                    )}
                  </div>

                  <div className="font-semibold text-slate-100 text-sm truncate">
                    {invite.teamName || t('matches.teamInvitation')}
                  </div>

                  <div className="mt-1.5 space-y-1 text-xs">
                    <div className="text-slate-400">
                      {t('matches.invitedBy')}{' '}
                      <span className="font-semibold text-slate-200">
                        {invite.leaderName || invite.leaderFfName || invite.leaderFfId}
                      </span>
                      {invite.leaderName && invite.leaderFfId && (
                        <span className="text-[11px] text-slate-400 ml-1">
                          ({invite.leaderFfName ? `${invite.leaderFfName} • ` : ''}UID: <span className="font-mono text-slate-300">{invite.leaderFfId}</span>)
                        </span>
                      )}
                    </div>
                    <div className="text-slate-400">
                      {t('matches.invitedUser')}{' '}
                      <span className="font-semibold text-emerald-400">
                        {invite.invitedUserName || user?.name || t('matches.you')}
                      </span>
                      {(invite.invitedUserFfId || user?.ffId) && (
                        <span className="text-[11px] text-slate-400 ml-1">
                          ({(invite.invitedUserFfName || user?.ffName) ? `${invite.invitedUserFfName || user?.ffName} • ` : ''}UID: <span className="font-mono text-slate-300">{invite.invitedUserFfId || user?.ffId}</span>)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400">{t('matches.entryFee')}</span>
                  <div className="text-sm font-bold text-slate-100">
                    {formatIndianRupees(invite.entryFee)}
                  </div>
                </div>
              </div>

              {/* Rewards Summary */}
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950/60 p-2.5 border border-slate-800/80 text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Trophy className="h-3 w-3 text-amber-400 shrink-0" />
                    <span>{t('matches.firstPlacePrize')}</span>
                  </div>
                  <div className="font-bold text-emerald-400 text-xs sm:text-sm mt-0.5">
                    {invite.firstPlacePrize ? formatIndianRupees(invite.firstPlacePrize) : t('matches.tbd')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                    <Swords className="h-3 w-3 text-rose-400 shrink-0" />
                    <span>{t('matches.killReward')}</span>
                  </div>
                  <div className="font-bold text-slate-200 text-xs sm:text-sm mt-0.5">
                    {invite.killPrice && invite.killPrice !== '0.00'
                      ? `${formatIndianRupees(invite.killPrice)} ${t('matches.perKill')}`
                      : t('matches.none')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                <Clock className="h-3.5 w-3.5" />
                <span>{t('matches.startsAt')} {formatISTDateTime(invite.startTime)}</span>
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
                  {t('matches.accept')}
                </button>
                <button
                  type="button"
                  data-testid={`decline-invite-btn-${invite.id}`}
                  onClick={() => handleDecline(invite.id)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                >
                  {t('matches.decline')}
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
              <h3 className="text-base font-bold text-slate-100">{t('matches.confirmAcceptInviteTitle')}</h3>
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
                <span className="text-slate-400">{t('matches.team')}</span>
                <span className="font-semibold text-slate-200">
                  {selectedInvite.teamName || t('matches.teamInvitation')}
                </span>
              </div>
              {(selectedInvite.gameMode || selectedInvite.teamMode) && (
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('matches.matchMode')}</span>
                  <span className="font-medium text-slate-200">
                    {[
                      selectedInvite.gameMode ? formatGameMode(selectedInvite.gameMode) : null,
                      selectedInvite.teamMode ? selectedInvite.teamMode.toUpperCase() : null,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">{t('matches.invitedUserLabel')}</span>
                <span className="font-semibold text-emerald-400">
                  {selectedInvite.invitedUserName || user?.name || t('matches.you')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('matches.exactEntryFeeLabel')}</span>
                <span
                  data-testid="dialog-exact-fee"
                  className="font-bold text-emerald-400 text-sm"
                >
                  {formatIndianRupees(selectedInvite.entryFee)}
                </span>
              </div>
              {(selectedInvite.firstPlacePrize || (selectedInvite.killPrice && selectedInvite.killPrice !== '0.00')) && (
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('matches.rewards')}</span>
                  <span className="font-medium text-slate-200">
                    {[
                      selectedInvite.firstPlacePrize ? `1st: ${formatIndianRupees(selectedInvite.firstPlacePrize)}` : null,
                      selectedInvite.killPrice && selectedInvite.killPrice !== '0.00'
                        ? `${formatIndianRupees(selectedInvite.killPrice)}/${t('matches.perKill')}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">{t('matches.matchStartTimeLabel')}</span>
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
                {t('common.cancel')}
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
                {isSubmitting ? t('matches.accepting') : t('matches.confirmAcceptBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
