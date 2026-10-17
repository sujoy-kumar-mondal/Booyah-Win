import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPaymentInfo, createDeposit, getDeposits } from '../../api/wallet.js';
import {
  validateDepositAmount,
  validateUtr,
  validateScreenshot,
} from '../../utils/validation.js';
import { ApiError } from '../../api/client.js';
import { ErrorCodes } from '@booyah/shared';
import { formatIndianRupees } from '../../utils/formatters.js';
import { useMaintenance } from '../../context/MaintenanceContext.js';
import { useTranslation } from '../../i18n/LanguageContext.js';
import {
  QrCode,
  Copy,
  Check,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';

interface DepositFormProps {
  onSuccess?: () => void;
  onViewDeposits?: () => void;
}

export const DepositForm: React.FC<DepositFormProps> = ({ onSuccess, onViewDeposits }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enabled: isMaintenance } = useMaintenance();

  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedDeposit, setSubmittedDeposit] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  // Requirement 7: Double submit guard with ref in addition to disabled button
  const isSubmittingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch payment configuration (limits, UPI, QR URL)
  const {
    data: paymentInfo,
    isLoading: isLoadingInfo,
    refetch: refetchPaymentInfo,
  } = useQuery({
    queryKey: ['payment-info'],
    queryFn: getPaymentInfo,
    staleTime: 60 * 1000,
  });

  // Requirement 12: Revoke blob URLs on file change and unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setFile(selected);
    setFieldErrors((prev) => ({ ...prev, screenshot: '' }));
    setSubmissionError(null);

    if (selected) {
      const error = validateScreenshot(selected);
      if (error) {
        setFieldErrors((prev) => ({ ...prev, screenshot: error }));
      } else {
        const objUrl = URL.createObjectURL(selected);
        setPreviewUrl(objUrl);
      }
    }
  };

  // Requirement 10: Clipboard copy with fallback and visible "Copied" confirmation
  const handleCopyUpi = async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Mutation for deposit upload
  const depositMutation = useMutation({
    mutationFn: (formData: FormData) => createDeposit(formData),
    // Requirement 5: Never retry automatically
    retry: false,
    onSuccess: (data) => {
      setSubmittedDeposit(data);
      // TanStack Query invalidation
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
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
          t('wallet.depositConfirmFailed')
        );
        // Requirement 5: Refetch the lists
        queryClient.invalidateQueries({ queryKey: ['deposits'], refetchType: 'all' });
        getDeposits().catch(() => {});
        return;
      }

      if (err instanceof ApiError) {
        if (err.code === ErrorCodes.UTR_EXISTS) {
          setFieldErrors((prev) => ({
            ...prev,
            utr: t('wallet.utrAlreadySubmitted'),
          }));
          return;
        }
        if (err.code === ErrorCodes.DEPOSIT_LIMIT) {
          setSubmissionError(t('wallet.depositLimitPending'));
          return;
        }
        if (err.code === ErrorCodes.RATE_LIMITED) {
          setSubmissionError(t('wallet.tooManyRequests'));
          return;
        }
        if (err.code === ErrorCodes.VALIDATION_ERROR) {
          setSubmissionError(err.message || t('wallet.validationFailed'));
          return;
        }
      }

      setSubmissionError(err?.message || t('wallet.depositFailed'));
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Requirement 7: Ref guard against rapid double clicks
    if (isSubmittingRef.current || depositMutation.isPending) {
      return;
    }

    setSubmissionError(null);
    setFieldErrors({});

    // Client-side validations
    const amountErr = validateDepositAmount(
      amount,
      paymentInfo?.minDeposit,
      paymentInfo?.maxDeposit
    );
    const utrErr = validateUtr(utr);
    const fileErr = validateScreenshot(file);

    const errors: Record<string, string> = {};
    if (amountErr) errors.amount = amountErr;
    if (utrErr) errors.utr = utrErr;
    if (fileErr) errors.screenshot = fileErr;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    if (!file) return;

    isSubmittingRef.current = true;
    try {
      const formData = new FormData();
      formData.append('amount', amount.trim());
      formData.append('utr', utr.trim().toUpperCase());
      formData.append('screenshot', file);

      await depositMutation.mutateAsync(formData);
    } catch {
      // Handled in onError
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const isConfigured = !!paymentInfo?.configured && !!paymentInfo?.paymentUpiId;

  // After successful submission, render confirmation screen
  if (submittedDeposit) {
    return (
      <div
        className="rounded-2xl border border-emerald-500/30 bg-slate-900 p-6 text-center shadow-xl space-y-4"
        data-testid="deposit-success-view"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">{t('wallet.depositSubmitted')}</h3>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            {t('wallet.reviewNotice')}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">{t('wallet.requestId')}</span>
            <span className="font-mono font-semibold text-slate-200">
              {submittedDeposit.id}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{t('wallet.amount')}</span>
            <span className="font-semibold text-emerald-400">
              {formatIndianRupees(submittedDeposit.amount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{t('wallet.utrRef')}</span>
            <span className="font-mono text-slate-200">{submittedDeposit.utr}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{t('wallet.status')}</span>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
              {t('wallet.statusUnderReview')}
            </span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setSubmittedDeposit(null);
              setAmount('');
              setUtr('');
              setFile(null);
              setPreviewUrl(null);
            }}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            {t('wallet.addMore')}
          </button>
          {onViewDeposits && (
            <button
              type="button"
              onClick={onViewDeposits}
              data-testid="view-deposits-btn"
              className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 font-bold"
            >
              {t('wallet.myDeposits')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="deposit-form-container">
      {/* Loading state for payment configuration */}
      {isLoadingInfo && (
        <div className="flex items-center justify-center p-8 text-xs text-slate-400 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          {t('wallet.loadingPaymentDetails')}
        </div>
      )}

      {/* Unconfigured state warning banner */}
      {!isLoadingInfo && !isConfigured && (
        <div
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left space-y-2 shadow-lg"
          data-testid="payment-not-configured-banner"
        >
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <AlertTriangle className="h-4 w-4" />
            {t('wallet.paymentOfflineTitle')}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {paymentInfo?.message || t('wallet.paymentNotConfigured')}
          </p>
          <p className="text-[11px] text-slate-400">
            {t('wallet.paymentDisabledNotice')}
          </p>
        </div>
      )}

      {/* QR Code and UPI ID display when configured */}
      {!isLoadingInfo && isConfigured && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <QrCode className="h-4 w-4" />
              {t('wallet.step1ScanPay')}
            </span>
            <span className="text-[11px] text-slate-400">
              {t('wallet.minMaxDeposit', { min: paymentInfo?.minDeposit || '10.00', max: paymentInfo?.maxDeposit || '5000.00' })}
            </span>
          </div>

          {/* QR Image */}
          {paymentInfo?.qrUrl ? (
            <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl max-w-[200px] mx-auto shadow-md">
              <img
                src={paymentInfo.qrUrl}
                alt="Payment QR Code"
                data-testid="payment-qr-image"
                className="w-44 h-44 object-contain"
                onError={() => refetchPaymentInfo()}
              />
              <span className="mt-1 text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                {t('wallet.officialQr')}
              </span>
            </div>
          ) : (
            <div className="p-4 text-center rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-400">
              {t('wallet.qrUnavailable')}
            </div>
          )}

          {/* UPI ID with Copy button (Requirement 10) */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                {t('wallet.merchantUpiId')}
              </span>
              <span
                className="font-mono text-sm font-bold text-slate-100 select-all"
                data-testid="merchant-upi-id"
              >
                {paymentInfo?.paymentUpiId}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopyUpi(paymentInfo?.paymentUpiId || '')}
              data-testid="copy-upi-btn"
              className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-slate-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>{t('wallet.copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>{t('common.copy')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Deposit Submission Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg space-y-4"
        data-testid="deposit-form"
      >
        <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 text-emerald-400">
          <Upload className="h-4 w-4" />
          {t('wallet.step2EnterDetails')}
        </div>

        {submissionError && (
          <div
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-start gap-2"
            data-testid="deposit-submission-error"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{submissionError}</span>
          </div>
        )}

        {/* Amount Field */}
        <div className="space-y-1.5">
          <label htmlFor="deposit-amount" className="block text-xs font-medium text-slate-300">
            {t('wallet.amountPaid')} <span className="text-rose-400">*</span>
          </label>
          <input
            id="deposit-amount"
            type="text"
            inputMode="decimal"
            placeholder={paymentInfo?.minDeposit ? `e.g. ${paymentInfo.minDeposit}` : 'e.g. 100.00'}
            disabled={!isConfigured || depositMutation.isPending}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setFieldErrors((prev) => ({ ...prev, amount: '' }));
              setSubmissionError(null);
            }}
            data-testid="deposit-amount-input"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
          />
          {fieldErrors.amount && (
            <p className="text-xs text-rose-400" data-testid="deposit-amount-error">
              {fieldErrors.amount}
            </p>
          )}
        </div>

        {/* UTR / Transaction ID Field (Requirement: uppercased) */}
        <div className="space-y-1.5">
          <label htmlFor="deposit-utr" className="block text-xs font-medium text-slate-300">
            {t('wallet.utrTransactionId')} <span className="text-rose-400">*</span>
          </label>
          <input
            id="deposit-utr"
            type="text"
            placeholder="e.g. 123456789012"
            disabled={!isConfigured || depositMutation.isPending}
            value={utr}
            onChange={(e) => {
              // Section 4.5: stored uppercase
              setUtr(e.target.value.toUpperCase());
              setFieldErrors((prev) => ({ ...prev, utr: '' }));
              setSubmissionError(null);
            }}
            data-testid="deposit-utr-input"
            className="w-full font-mono rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none uppercase disabled:opacity-50"
          />
          {fieldErrors.utr && (
            <p className="text-xs text-rose-400" data-testid="deposit-utr-error">
              {fieldErrors.utr}
            </p>
          )}
        </div>

        {/* Screenshot Upload with Preview & Revocation */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            {t('wallet.paymentScreenshot')} <span className="text-rose-400">*</span>
          </label>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp"
            disabled={!isConfigured || depositMutation.isPending}
            onChange={handleFileChange}
            data-testid="deposit-screenshot-input"
            className="hidden"
          />

          {!previewUrl ? (
            <button
              type="button"
              disabled={!isConfigured || depositMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
              data-testid="upload-screenshot-btn"
              className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-center hover:border-emerald-500/50 hover:bg-slate-900 transition-colors disabled:opacity-50"
            >
              <ImageIcon className="h-6 w-6 text-slate-400 mb-1" />
              <span className="text-xs font-semibold text-slate-300">{t('wallet.chooseScreenshot')}</span>
              <span className="text-[10px] text-slate-500">{t('wallet.maxSize2Mb')}</span>
            </button>
          ) : (
            <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={previewUrl}
                  alt="Preview"
                  data-testid="screenshot-preview-image"
                  className="h-14 w-14 rounded-lg object-cover border border-slate-800"
                />
                <div className="text-left text-xs truncate max-w-[180px]">
                  <p className="font-semibold text-slate-200 truncate">{file?.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {file?.size ? `${Math.round(file.size / 1024)} KB` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2 py-1"
                data-testid="remove-screenshot-btn"
              >
                {t('wallet.change')}
              </button>
            </div>
          )}

          {fieldErrors.screenshot && (
            <p className="text-xs text-rose-400" data-testid="deposit-screenshot-error">
              {fieldErrors.screenshot}
            </p>
          )}
        </div>

        {/* Submit Button */}
        {isMaintenance && (
          <p className="text-xs text-amber-400 text-center font-medium" data-testid="deposit-maintenance-warning">
            {t('wallet.depositMaintenanceWarning')}
          </p>
        )}
        <button
          type="submit"
          disabled={!isConfigured || depositMutation.isPending || isMaintenance}
          data-testid="submit-deposit-btn"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          {depositMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span data-testid="uploading-state-label">{t('wallet.uploading')}</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {t('wallet.submitDeposit')}
            </>
          )}
        </button>
      </form>
    </div>
  );
};
