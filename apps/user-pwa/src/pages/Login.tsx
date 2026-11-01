import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { requestLoginOtp, verifyLoginOtp } from '../api/auth.js';
import { OtpInput } from '../components/common/OtpInput.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { validateEmail } from '../utils/validation.js';
import { ApiError } from '../api/client.js';
import { getUserFriendlyErrorMessage } from '../api/errorMessages.js';
import { Mail, ArrowRight, RotateCcw, AlertCircle, Clipboard, SquarePen } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.js';
import { subscribeToPushNotifications } from '../utils/pushNotifications.js';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { t, language } = useTranslation();

  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize from searchParams if present (e.g. from copy-otp link)
  useEffect(() => {
    const urlOtp = searchParams.get('otp') || searchParams.get('code');
    const urlEmail = searchParams.get('email');
    if (urlEmail && !email) {
      setEmail(urlEmail);
    }
    if (urlOtp) {
      const clean = urlOtp.replace(/\D/g, '').slice(0, 6);
      if (clean) {
        setOtp(clean);
        setOtpSent(true);
      }
    }
  }, [searchParams]);

  const { secondsLeft, isCounting, startCountdown } = useCountdown(60);

  const handleClipboardPaste = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        const clean = text.replace(/\D/g, '').slice(0, 6);
        if (clean) {
          setOtp(clean);
        }
      }
    } catch {
      // Ignored if user cancels or permission denied
    }
  };

  const handleEditEmail = () => {
    setOtpSent(false);
    setOtp('');
    setError(null);
    const emailInput = document.getElementById('login-email') as HTMLInputElement;
    emailInput?.focus();
  };

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
      const res = await requestLoginOtp(email.trim().toLowerCase());
      if (res.registered === false) {
        setError(
          language === 'bn'
            ? 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। অনুগ্রহ করে প্রথমে অ্যাকাউন্ট তৈরি করুন।'
            : 'No account found with this email. Please create an account first.'
        );
        return;
      }
      setOtpSent(true);
      startCountdown(60);
    } catch (err: any) {
      setError(
        err instanceof ApiError
          ? getUserFriendlyErrorMessage(err.code, false, language)
          : getUserFriendlyErrorMessage('NETWORK_ERROR', false, language)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError(
        language === 'bn'
          ? 'অনুগ্রহ করে সম্পূর্ণ ৬-সংখ্যার OTP কোড লিখুন'
          : 'Please enter the full 6-digit OTP code'
      );
      return;
    }

    // Pre-request notification permission synchronously during user click gesture
    const permPromise =
      typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default'
        ? Notification.requestPermission().catch(() => 'default' as NotificationPermission)
        : null;

    setIsSubmitting(true);
    try {
      const res = await verifyLoginOtp(email.trim().toLowerCase(), otp);
      await login(res.token, res.user as any);
      if (permPromise) {
        await permPromise;
      }
      try {
        await Promise.race([
          subscribeToPushNotifications(),
          new Promise((resolve) => setTimeout(resolve, 4000)),
        ]);
      } catch {}
      navigate('/');
    } catch (err: any) {
      setError(
        err instanceof ApiError
          ? getUserFriendlyErrorMessage(err.code, false, language)
          : getUserFriendlyErrorMessage('VALIDATION_ERROR', false, language)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (isCounting || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await requestLoginOtp(email.trim().toLowerCase());
      if (res.registered === false) {
        setError(
          language === 'bn'
            ? 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। অনুগ্রহ করে প্রথমে অ্যাকাউন্ট তৈরি করুন।'
            : 'No account found with this email. Please create an account first.'
        );
        setOtpSent(false);
        return;
      }
      setOtp('');
      startCountdown(60);
    } catch (err: any) {
      setError(
        err instanceof ApiError
          ? getUserFriendlyErrorMessage(err.code, false, language)
          : getUserFriendlyErrorMessage('NETWORK_ERROR', false, language)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div data-testid="login-page"
      className="flex flex-col justify-center py-4 sm:py-6 w-full max-w-md mx-auto">
      {/* Brand Header */}
      <div className="mb-8 text-center">
        <img
          src="/assets/logo_full.png"
          alt="Booyah Win - Tournament Platform"
          className="mx-auto h-20 w-auto object-contain drop-shadow-[0_4px_16px_rgba(244,162,45,0.18)]"
        />
        <h1 className="sr-only">Booyah Win</h1>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-6 shadow-xl backdrop-blur-md">
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

        <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
              {t('auth.emailLabel')}
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
                disabled={isSubmitting || otpSent}
                readOnly={otpSent}
                className={`w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 ${
                  otpSent ? 'pr-11 font-medium text-slate-100' : 'pr-4 text-slate-100'
                } text-sm placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-90`}
                required
              />
              {otpSent && (
                <button
                  type="button"
                  onClick={handleEditEmail}
                  disabled={isSubmitting}
                  data-testid="login-change-email-btn"
                  aria-label={t('auth.changeEmail') || 'Change email'}
                  className="absolute right-3 top-3 p-1 text-emerald-400 hover:text-emerald-300 transition active:scale-95"
                >
                  <SquarePen className="h-4 w-4" />
                </button>
              )}
            </div>
            {otpSent && (
              <p
                data-testid="otp-sent-success-msg"
                className="mt-2 text-xs font-medium text-emerald-400"
              >
                {t('auth.codeSentSuccess') || '6-digit verification code sent successfully'}
              </p>
            )}
          </div>

          {otpSent && (
            <div className="space-y-4 pt-1 animate-in fade-in duration-200">
              <div>
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <label className="text-xs font-semibold text-slate-300">
                    {t('auth.enterOtp')}
                  </label>
                  {typeof navigator !== 'undefined' && !!navigator.clipboard && (
                    <button
                      type="button"
                      onClick={handleClipboardPaste}
                      disabled={isSubmitting}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
                    >
                      <Clipboard className="h-3 w-3" />
                      <span>{language === 'bn' ? 'পেস্ট করুন' : 'Paste'}</span>
                    </button>
                  )}
                </div>
                <OtpInput value={otp} onChange={setOtp} disabled={isSubmitting} />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-400">{t('auth.didntReceiveCode') || "Didn't receive code?"}</span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isCounting || isSubmitting}
                  className="flex items-center gap-1 font-semibold text-emerald-400 hover:underline disabled:text-slate-600 disabled:no-underline"
                >
                  <RotateCcw className={`h-3 w-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                  {isCounting ? `${t('auth.resendIn')} ${secondsLeft}s` : t('auth.resendOtp')}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || (otpSent ? otp.length !== 6 : !email.trim())}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting
              ? (otpSent ? t('auth.verifyingOtp') : t('auth.requestingOtp'))
              : (otpSent ? t('auth.verifyOtp') : t('auth.requestOtp'))}
            {!otpSent && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
      </div>

      {/* Footer / Switch to Registration */}
      <div className="mt-6 text-center text-xs text-slate-400">
        {t('auth.dontHaveAccount')}{' '}
        <Link to="/register" className="font-semibold text-emerald-400 hover:underline">
          {t('auth.registerLink')}
        </Link>
      </div>
    </div>
  );
};
