/**
 * Step-Up OTP Verification Modal (Root-level portal)
 *
 * Requirements:
 * - Rendered in separate portal container (#modal-root) sibling of #root
 * - Applies inert to #root when open
 * - Automatically registers with client.ts via registerReauthHandler
 * - Dispatches requestStepUpOtp on open
 * - Verifies OTP via verifyStepUpOtp
 * - Retries the blocked API call transparently without losing form data or logging out
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { registerReauthHandler } from '../../api/client.js';
import { requestStepUpOtp, verifyStepUpOtp } from '../../api/staff.js';
import { getFriendlyErrorMessage } from '../../utils/errors.js';
import { ShieldAlert, KeyRound, Loader2, RotateCw, X } from 'lucide-react';

export const StepUpOtpModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSendOtp = useCallback(async () => {
    setIsSending(true);
    setError(null);
    try {
      const res = await requestStepUpOtp();
      setStatusMessage(res.message || 'A verification code has been sent to your registered staff email.');
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  }, []);

  const openPrompt = useCallback((): Promise<boolean> => {
    setOtp('');
    setError(null);
    setStatusMessage(null);
    setIsOpen(true);

    // Automatically trigger OTP request on prompt
    handleSendOtp();

    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, [handleSendOtp]);

  useEffect(() => {
    registerReauthHandler(openPrompt);
    return () => {
      registerReauthHandler(null);
    };
  }, [openPrompt]);

  useEffect(() => {
    const rootEl = document.getElementById('root');
    if (!rootEl) return;

    if (isOpen) {
      rootEl.setAttribute('inert', '');
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => {
        clearTimeout(timer);
        rootEl.removeAttribute('inert');
      };
    } else {
      rootEl.removeAttribute('inert');
    }
  }, [isOpen]);

  const handleClose = () => {
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
    setIsOpen(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await verifyStepUpOtp(cleanOtp);
      // Elevation succeeded: resolve true and close
      if (resolveRef.current) {
        resolveRef.current(true);
        resolveRef.current = null;
      }
      setIsOpen(false);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalRoot = document.getElementById('modal-root') || document.body;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      data-testid="step-up-otp-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-up-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 id="step-up-dialog-title" className="text-base font-bold text-slate-100">
                Security Verification Required
              </h2>
              <p className="text-xs text-slate-400">Step-up authentication required for sensitive actions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            data-testid="step-up-close-btn"
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            title="Cancel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Informational Banner */}
        {statusMessage && (
          <div
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400"
            data-testid="step-up-status-message"
          >
            {statusMessage}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400"
            data-testid="step-up-error-message"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="step-up-otp" className="block text-xs font-semibold text-slate-300">
              Enter 6-Digit Code
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <KeyRound className="h-4 w-4" />
              </div>
              <input
                ref={inputRef}
                id="step-up-otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="123456"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, ''));
                  setError(null);
                }}
                data-testid="step-up-otp-input"
                className="w-full font-mono tracking-widest text-center rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-3.5 py-2.5 text-base text-slate-100 placeholder-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              disabled={isSending || isLoading}
              onClick={handleSendOtp}
              data-testid="step-up-resend-btn"
              className="text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isSending ? 'animate-spin' : ''}`} />
              <span>Resend Code</span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              data-testid="step-up-cancel-btn"
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="w-1/3 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              data-testid="step-up-verify-btn"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-amber-500/10"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Verify & Proceed</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    modalRoot
  );
};
