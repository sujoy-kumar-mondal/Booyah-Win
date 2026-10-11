import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { requestLoginOtp, verifyLoginOtp } from '../api/auth.js';
import { OtpInput } from '../components/common/OtpInput.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { validateEmail } from '../utils/validation.js';
import { ApiError } from '../api/client.js';
import { Flame, Mail, ArrowRight, RotateCcw, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { secondsLeft, isCounting, startCountdown } = useCountdown(60);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailErr = validateEmail(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }

    setIsSubmitting(true);
    try {
      await requestLoginOtp(email.trim().toLowerCase());
      setStep('otp');
      startCountdown(60);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Unable to send OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError('Please enter the full 6-digit OTP code');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyLoginOtp(email.trim().toLowerCase(), otp);
      await login(res.token, res.user as any);
      navigate('/');
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Verification failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (isCounting || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await requestLoginOtp(email.trim().toLowerCase());
      startCountdown(60);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Unable to resend OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] flex-col justify-center py-6 w-full max-w-md mx-auto">
      {/* Brand Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
          <Flame className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-black tracking-wider text-slate-100">
          BOOYAH<span className="text-emerald-400">WIN</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400">Competitive Free Fire Match Platform</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl backdrop-blur-md">
        {error && (
          <div
            role="alert"
            data-testid="login-error-alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="player@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'Sending Code...' : 'Continue with OTP'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="text-center">
              <p className="text-xs text-slate-400">
                Enter the 6-digit verification code sent to <br />
                <span className="font-semibold text-slate-200">{email}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setOtp('');
                  setError(null);
                }}
                className="mt-1 text-xs text-emerald-400 hover:underline"
              >
                Change email
              </button>
            </div>

            <div>
              <label className="block text-center text-xs font-semibold text-slate-300 mb-3">
                Security Code (OTP)
              </label>
              <OtpInput value={otp} onChange={setOtp} disabled={isSubmitting} />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400">Didn't receive code?</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isCounting || isSubmitting}
                className="flex items-center gap-1 font-semibold text-emerald-400 hover:underline disabled:text-slate-600 disabled:no-underline"
              >
                <RotateCcw className={`h-3 w-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                {isCounting ? `Resend in ${secondsLeft}s` : 'Resend OTP'}
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otp.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'Verifying...' : 'Verify & Log In'}
            </button>
          </form>
        )}
      </div>

      {/* Footer / Switch to Registration */}
      <div className="mt-6 text-center text-xs text-slate-400">
        New here?{' '}
        <Link to="/register" className="font-semibold text-emerald-400 hover:underline">
          Create an Account
        </Link>
      </div>
    </div>
  );
};
