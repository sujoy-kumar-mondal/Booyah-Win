/**
 * Staff Login Page
 *
 * Requirements:
 * - 2-step OTP flow: email -> OTP
 * - Store token in sessionStorage, never log it
 * - Friendly messages chosen by error CODE, never raw server text
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStaffAuth } from '../context/StaffAuthContext.js';
import { requestStaffOtp, verifyStaffOtp } from '../api/staff.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import { Shield, Mail, KeyRound, ArrowRight, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useStaffAuth();

  const noticeMessage = (location.state as any)?.message as string | undefined;

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid staff email address');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await requestStaffOtp(cleanEmail);
      if (res.registered === false) {
        setError('Staff account not found. Please contact an administrator.');
        return;
      }
      setInfoMessage(res.message || 'If this email is registered, an OTP has been sent');
      setStep(2);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await verifyStaffOtp(email.trim(), cleanOtp);
      login(res.token, res.staff);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-100">Staff Portal</h1>
          <p className="text-xs text-slate-400">
            Booyah Win internal operations & financial settlement
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-sm space-y-5">
          {noticeMessage && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{noticeMessage}</span>
            </div>
          )}

          {error && (
            <div
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-start gap-2"
              data-testid="login-error-message"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleRequestOtp} className="space-y-4" data-testid="staff-login-step1">
              <div className="space-y-1.5">
                <label htmlFor="staff-email" className="block text-xs font-semibold text-slate-300">
                  Staff Email Address
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="staff-email"
                    type="email"
                    required
                    placeholder="employee@booyah.win"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    data-testid="staff-email-input"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                data-testid="request-otp-btn"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Continue with OTP</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4" data-testid="staff-login-step2">
              {infoMessage && (
                <p className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                  {infoMessage}
                </p>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="staff-otp" className="block text-xs font-semibold text-slate-300">
                    6-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setOtp('');
                      setError(null);
                    }}
                    data-testid="change-email-btn"
                    className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Change Email
                  </button>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    id="staff-otp"
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
                    data-testid="staff-otp-input"
                    className="w-full font-mono tracking-widest text-center rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-3.5 py-2.5 text-base text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                data-testid="verify-otp-btn"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
