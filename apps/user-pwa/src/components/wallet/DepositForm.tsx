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
  const queryClient = useQueryClient();

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
          "We couldn't confirm your submission. Check My Deposits before sending again"
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
            utr: 'This UTR has already been submitted',
          }));
          return;
        }
        if (err.code === ErrorCodes.DEPOSIT_LIMIT) {
          setSubmissionError('You may have at most 3 pending deposits at a time');
          return;
        }
        if (err.code === ErrorCodes.RATE_LIMITED) {
          setSubmissionError('Too many requests. Please slow down.');
          return;
        }
        if (err.code === ErrorCodes.VALIDATION_ERROR) {
          setSubmissionError(err.message || 'Validation failed. Please verify your details.');
          return;
        }
      }

      setSubmissionError(err?.message || 'Failed to submit deposit. Please try again.');
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
          <h3 className="text-lg font-bold text-slate-100">Deposit Submitted</h3>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            Verified within 30 minutes
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Request ID:</span>
            <span className="font-mono font-semibold text-slate-200">
              {submittedDeposit.id}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Amount:</span>
            <span className="font-semibold text-emerald-400">
              {formatIndianRupees(submittedDeposit.amount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">UTR / Ref:</span>
            <span className="font-mono text-slate-200">{submittedDeposit.utr}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Status:</span>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
              Pending Verification
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
            Add More
          </button>
          {onViewDeposits && (
            <button
              type="button"
              onClick={onViewDeposits}
              data-testid="view-deposits-btn"
              className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 font-bold"
            >
              My Deposits
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
          Loading payment details...
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
            Payment System Offline
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {paymentInfo?.message || 'Payment information not configured yet'}
          </p>
          <p className="text-[11px] text-slate-400">
            Deposits are temporarily disabled. Please check back shortly or contact support.
          </p>
        </div>
      )}

      {/* QR Code and UPI ID display when configured */}
      {!isLoadingInfo && isConfigured && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <QrCode className="h-4 w-4" />
              Step 1: Scan & Pay via UPI
            </span>
            <span className="text-[11px] text-slate-400">
              Min Rs{paymentInfo?.minDeposit || '10.00'} • Max Rs{paymentInfo?.maxDeposit || '5000.00'}
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
                Official Booyah Win QR
              </span>
            </div>
          ) : (
            <div className="p-4 text-center rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-400">
              QR Code unavailable. Please use the UPI ID below.
            </div>
          )}

          {/* UPI ID with Copy button (Requirement 10) */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Merchant UPI ID
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
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
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
          Step 2: Enter Transaction Details
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
            Amount Paid (Rs) <span className="text-rose-400">*</span>
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
            UTR / Transaction ID (12-25 digits/letters) <span className="text-rose-400">*</span>
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
            Payment Screenshot (JPG/PNG/WebP, max 2 MB) <span className="text-rose-400">*</span>
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
              <span className="text-xs font-semibold text-slate-300">Choose Screenshot</span>
              <span className="text-[10px] text-slate-500">Max size 2 MB</span>
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
                Change
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
        <button
          type="submit"
          disabled={!isConfigured || depositMutation.isPending}
          data-testid="submit-deposit-btn"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          {depositMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span data-testid="uploading-state-label">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Submit Deposit Request
            </>
          )}
        </button>
      </form>
    </div>
  );
};
