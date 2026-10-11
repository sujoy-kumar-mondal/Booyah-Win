import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { joinMatchSolo, fetchMatch, type MatchUserDto } from '../../api/matches.js';
import { formatIndianRupees } from '../../utils/formatters.js';
import { ApiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';

interface SoloJoinDialogProps {
  match: MatchUserDto;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SoloJoinDialog: React.FC<SoloJoinDialogProps> = ({
  match,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { refreshProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLowBalance, setIsLowBalance] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    message: string;
    chargeBreakdown?: any;
  } | null>(null);

  if (!isOpen) return null;

  const handleConfirmJoin = async () => {
    if (isSubmitting) return; // Double-tap guard
    setIsSubmitting(true);
    setErrorMessage(null);
    setIsLowBalance(false);

    try {
      const res = await joinMatchSolo(match.id);
      // Success! Refetch wallets & notify
      await refreshProfile();
      setSuccessResult({
        message: res.message || 'Successfully joined match!',
        chargeBreakdown: (res as any).chargeBreakdown,
      });
      onSuccess();
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'LOW_BALANCE') {
          setIsLowBalance(true);
          setErrorMessage('Insufficient wallet balance to join this match.');
        } else if (err.code === 'MATCH_FULL') {
          setErrorMessage('This match is already full.');
        } else if (err.code === 'ALREADY_JOINED') {
          setErrorMessage('You have already joined this match.');
        } else if (err.code === 'MATCH_NOT_JOINABLE') {
          setErrorMessage('Registration for this match is closed.');
        } else if (err.code === 'TEAM_INVALID') {
          setErrorMessage('Invalid team configuration.');
        } else {
          setErrorMessage(err.message || 'Unable to join match.');
        }
      } else {
        // Network-level or timeout error: DO NOT retry automatically.
        // Refetch match & wallets to see if joined in background, and guide user.
        try {
          await fetchMatch(match.id);
          await refreshProfile();
        } catch {
          // ignore background sync error
        }
        setErrorMessage(
          'Network request failed. Please check "My Matches" before trying again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="solo-join-dialog-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div
        data-testid="solo-join-dialog"
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-base font-bold text-slate-100">Confirm Join Match</h3>
          <button
            type="button"
            data-testid="close-join-dialog-btn"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {successResult ? (
          <div className="py-5 text-center" data-testid="join-success-state">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <p className="mt-3 text-sm font-semibold text-slate-100">{successResult.message}</p>
            {successResult.chargeBreakdown && (
              <div
                data-testid="join-charge-breakdown"
                className="mt-3 rounded-lg bg-slate-800/60 p-3 text-xs text-slate-300"
              >
                <div className="font-semibold text-slate-200 mb-1">Deduction Breakdown:</div>
                {successResult.chargeBreakdown.cashback && (
                  <div>Cashback: {formatIndianRupees(successResult.chargeBreakdown.cashback)}</div>
                )}
                {successResult.chargeBreakdown.addMoney && (
                  <div>Add Money: {formatIndianRupees(successResult.chargeBreakdown.addMoney)}</div>
                )}
                {successResult.chargeBreakdown.winning && (
                  <div>Winning: {formatIndianRupees(successResult.chargeBreakdown.winning)}</div>
                )}
              </div>
            )}
            <button
              type="button"
              data-testid="close-success-btn"
              onClick={onClose}
              className="mt-4 w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-slate-800/50 p-4 border border-slate-800">
              <div className="text-xs text-slate-400">Entry Fee</div>
              <div
                data-testid="join-dialog-fee"
                className="mt-1 text-2xl font-extrabold text-slate-100"
              >
                {formatIndianRupees(match.entryFee)}
              </div>
            </div>

            {/* Rule text only - no browser-computed wallet breakdown */}
            <div
              data-testid="join-dialog-rule-text"
              className="rounded-xl bg-slate-950/60 p-3.5 border border-slate-800/80 text-xs leading-relaxed text-slate-300"
            >
              Up to 5% can come from cashback; the rest from Add Money, then Winning
            </div>

            {errorMessage && (
              <div
                data-testid="join-dialog-error"
                className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 flex items-start gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <div className="flex-1">
                  <p>{errorMessage}</p>
                  {isLowBalance && (
                    <Link
                      to="/wallet?tab=add"
                      data-testid="add-money-link"
                      className="mt-2 inline-block font-bold text-emerald-400 underline hover:text-emerald-300"
                    >
                      Add Money to Wallet
                    </Link>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                data-testid="cancel-join-btn"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-join-btn"
                onClick={handleConfirmJoin}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {isSubmitting ? 'Joining...' : 'Confirm & Join'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
