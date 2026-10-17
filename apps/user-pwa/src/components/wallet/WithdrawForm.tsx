import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext.js';
import { createWithdrawal, getWithdrawals } from '../../api/wallet.js';
import { validateWithdrawAmount } from '../../utils/validation.js';
import { formatIndianRupees } from '../../utils/formatters.js';
import { ApiError } from '../../api/client.js';
import { ErrorCodes } from '@booyah/shared';
import { useMaintenance } from '../../context/MaintenanceContext.js';
import { useTranslation } from '../../i18n/LanguageContext.js';
import {
  ArrowDownToLine,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Loader2,
  Info,
} from 'lucide-react';

interface WithdrawFormProps {
  onSuccess?: () => void;
  onViewWithdrawals?: () => void;
}

export const WithdrawForm: React.FC<WithdrawFormProps> = ({ onSuccess, onViewWithdrawals }) => {
  const { t } = useTranslation();
  const { user, wallets } = useAuth();
  const queryClient = useQueryClient();
  const { enabled: isMaintenance } = useMaintenance();

  const winningBalance = wallets?.winning || '0.00';
  const savedUpiId = user?.upiId || '';

  const [amount, setAmount] = useState('');
  const [confirmUpi, setConfirmUpi] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedWithdrawal, setSubmittedWithdrawal] = useState<any | null>(null);

  // Requirement 7: Double submit ref guard
  const isSubmittingRef = useRef(false);

  const withdrawMutation = useMutation({
    mutationFn: (payload: { amount: string; upiId: string; confirm: boolean }) =>
      createWithdrawal(payload),
    // Requirement 5: Never retry automatically
    retry: false,
    onSuccess: (data) => {
      setSubmittedWithdrawal(data);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onSuccess?.();
    },
    onError: (err: any) => {
      // Requirement 5: On network error or timeout
      const isNetworkOrTimeout =
        err?.code === 'NETWORK_ERROR' ||
        err?.code === 'NON_JSON_RESPONSE' ||
        err?.code === 'SERVER_UNAVAILABLE' ||
        err?.name === 'AbortError' ||
        err?.status === 502 ||
        err?.status === 503 ||
        err?.status === 504;

      if (isNetworkOrTimeout) {
        setSubmissionError(
          t('wallet.withdrawConfirmFailed')
        );
        queryClient.invalidateQueries({ queryKey: ['withdrawals'], refetchType: 'all' });
        getWithdrawals().catch(() => {});
        return;
      }

      if (err instanceof ApiError) {
        // Requirement 11: 48-hour lock message from API error code
        if (err.code === ErrorCodes.UPI_RECENTLY_CHANGED) {
          setSubmissionError(t('wallet.upiRecentlyChangedBlocked'));
          return;
        }
        if (err.code === ErrorCodes.WITHDRAWAL_PENDING) {
          setSubmissionError(t('wallet.withdrawalAlreadyPending'));
          return;
        }
        if (err.code === ErrorCodes.LOW_BALANCE) {
          setFieldErrors((prev) => ({
            ...prev,
            amount: t('wallet.insufficientWinningBalance'),
          }));
          return;
        }
        if (err.code === ErrorCodes.RATE_LIMITED) {
          setSubmissionError(t('wallet.tooManyRequests'));
          return;
        }
        if (err.code === ErrorCodes.VALIDATION_ERROR) {
          setSubmissionError(err.message || t('wallet.withdrawValidationFailed'));
          return;
        }
      }

      setSubmissionError(err?.message || t('wallet.withdrawalFailed'));
    },
  });

  const isUpiMatching =
    confirmUpi.trim().length > 0 &&
    confirmUpi.trim().toLowerCase() === savedUpiId.toLowerCase();

  const isFormValid =
    !validateWithdrawAmount(amount, winningBalance) && isUpiMatching && agreed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current || withdrawMutation.isPending) {
      return;
    }

    setSubmissionError(null);
    setFieldErrors({});

    const amountErr = validateWithdrawAmount(amount, winningBalance);
    const errors: Record<string, string> = {};

    if (amountErr) errors.amount = amountErr;
    if (!isUpiMatching) {
      errors.confirmUpi = t('wallet.upiNotMatching');
    }
    if (!agreed) {
      errors.agreed = t('wallet.confirmUpiRequired');
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    isSubmittingRef.current = true;
    try {
      await withdrawMutation.mutateAsync({
        amount: amount.trim(),
        upiId: confirmUpi.trim(),
        confirm: true,
      });
    } catch {
      // Handled in onError
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // Success view
  if (submittedWithdrawal) {
    return (
      <div
        className="rounded-2xl border border-emerald-500/30 bg-slate-900 p-6 text-center shadow-xl space-y-4"
        data-testid="withdrawal-success-view"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">{t('wallet.withdrawalRequested')}</h3>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            {t('wallet.settledWithin24h')}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">{t('wallet.requestId')}</span>
            <span className="font-mono font-semibold text-slate-200">
              {submittedWithdrawal.id}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{t('wallet.amount')}</span>
            <span className="font-semibold text-emerald-400">
              {formatIndianRupees(submittedWithdrawal.amount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{t('wallet.payoutUpi')}</span>
            <span className="font-mono text-slate-200">{submittedWithdrawal.upiId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{t('wallet.status')}</span>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
              {t('wallet.statusProcessing')}
            </span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setSubmittedWithdrawal(null);
              setAmount('');
              setConfirmUpi('');
              setAgreed(false);
            }}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            {t('wallet.newRequest')}
          </button>
          {onViewWithdrawals && (
            <button
              type="button"
              onClick={onViewWithdrawals}
              data-testid="view-withdrawals-btn"
              className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 font-bold"
            >
              {t('wallet.myWithdrawals')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="withdraw-form-container">
      {/* Withdrawable Balance Card */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 p-5 shadow-lg">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            {t('wallet.withdrawableBalanceCard')}
          </span>
          <span className="text-[11px] text-slate-400">{t('wallet.minWithdraw')}</span>
        </div>
        <div className="text-2xl font-black text-slate-100" data-testid="withdrawable-balance">
          {formatIndianRupees(winningBalance)}
        </div>
        <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
          <Info className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          {t('wallet.withdrawExplanation')}
        </p>
      </div>

      {/* Settlement Note */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 flex items-center gap-2.5 text-xs text-slate-300">
        <Clock className="h-4 w-4 text-emerald-400 shrink-0" />
        <span>{t('wallet.settlementNotice')}</span>
      </div>

      {/* Withdrawal Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg space-y-4"
        data-testid="withdraw-form"
      >
        <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 text-emerald-400">
          <ArrowDownToLine className="h-4 w-4" />
          {t('wallet.requestPayout')}
        </div>

        {submissionError && (
          <div
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-start gap-2"
            data-testid="withdraw-submission-error"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{submissionError}</span>
          </div>
        )}

        {/* Amount Field */}
        <div className="space-y-1.5">
          <label htmlFor="withdraw-amount" className="block text-xs font-medium text-slate-300">
            {t('wallet.withdrawAmountField')} <span className="text-rose-400">*</span>
          </label>
          <input
            id="withdraw-amount"
            type="text"
            inputMode="decimal"
            placeholder="Min 50.00"
            disabled={withdrawMutation.isPending}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setFieldErrors((prev) => ({ ...prev, amount: '' }));
              setSubmissionError(null);
            }}
            data-testid="withdraw-amount-input"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          {fieldErrors.amount && (
            <p className="text-xs text-rose-400" data-testid="withdraw-amount-error">
              {fieldErrors.amount}
            </p>
          )}
        </div>

        {/* Display Saved UPI ID */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1">
          <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            {t('wallet.verifiedSavedUpi')}
          </span>
          <span
            className="font-mono text-sm font-bold text-slate-200 select-all"
            data-testid="saved-upi-display"
          >
            {savedUpiId || t('wallet.noUpiSaved')}
          </span>
        </div>

        {/* Re-enter UPI ID Confirmation */}
        <div className="space-y-1.5">
          <label htmlFor="confirm-upi-input" className="block text-xs font-medium text-slate-300">
            {t('wallet.reenterUpiLabel')} <span className="text-rose-400">*</span>
          </label>
          <input
            id="confirm-upi-input"
            type="text"
            placeholder={t('wallet.reenterUpiPlaceholder')}
            disabled={withdrawMutation.isPending}
            value={confirmUpi}
            onChange={(e) => {
              setConfirmUpi(e.target.value);
              setFieldErrors((prev) => ({ ...prev, confirmUpi: '' }));
              setSubmissionError(null);
            }}
            data-testid="confirm-upi-input"
            className="w-full font-mono rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          {fieldErrors.confirmUpi && (
            <p className="text-xs text-rose-400" data-testid="confirm-upi-error">
              {fieldErrors.confirmUpi}
            </p>
          )}
        </div>

        {/* Confirmation Checkbox */}
        <div className="space-y-1.5">
          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              id="confirm-checkbox"
              disabled={withdrawMutation.isPending}
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                setFieldErrors((prev) => ({ ...prev, agreed: '' }));
              }}
              data-testid="confirm-checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20"
            />
            <span className="text-xs text-slate-300 leading-relaxed">
              {t('wallet.confirmUpiAgreement')}
            </span>
          </label>
          {fieldErrors.agreed && (
            <p className="text-xs text-rose-400" data-testid="confirm-checkbox-error">
              {fieldErrors.agreed}
            </p>
          )}
        </div>

        {/* Submit Button (stays disabled until amount valid, UPI matches, and checkbox ticked) */}
        {isMaintenance && (
          <p className="text-xs text-amber-400 text-center font-medium" data-testid="withdraw-maintenance-warning">
            {t('wallet.withdrawMaintenanceWarning')}
          </p>
        )}
        <button
          type="submit"
          disabled={!isFormValid || withdrawMutation.isPending || isMaintenance}
          data-testid="submit-withdraw-btn"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
        >
          {withdrawMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span data-testid="withdraw-uploading-label">{t('wallet.uploading')}</span>
            </>
          ) : (
            <>
              <ArrowDownToLine className="h-4 w-4" />
              {t('wallet.confirmWithdrawalBtn')}
            </>
          )}
        </button>
      </form>
    </div>
  );
};
