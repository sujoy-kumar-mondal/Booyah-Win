import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { requestRegisterOtp, verifyRegisterOtp, completeRegistration } from '../api/auth.js';
import { OtpInput } from '../components/common/OtpInput.js';
import { useCountdown } from '../hooks/useCountdown.js';
import {
  validateEmail,
  validateName,
  validateMobile,
  validateFfId,
  validateFfName,
  validateUpiId,
  validateDateOfBirth,
  validateReferralCode,
} from '../utils/validation.js';
import { ApiError } from '../api/client.js';
import { getUserFriendlyErrorMessage } from '../api/errorMessages.js';
import { Flame, Mail, ArrowRight, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.js';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { t, language } = useTranslation();

  const [step, setStep] = useState<'email' | 'otp' | 'profile'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  // The registration token lives ONLY in component state, never in localStorage/sessionStorage
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    ffId: '',
    ffName: '',
    upiId: '',
    dateOfBirth: '',
    confirm18Plus: false,
    referralCode: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { secondsLeft, isCounting, startCountdown } = useCountdown(60);

  // Guard: Step 3 is strictly unreachable without registrationToken in component state
  useEffect(() => {
    if (step === 'profile' && !registrationToken) {
      setStep('email');
      setGeneralError(
        language === 'bn'
          ? 'অনুগ্রহ করে প্রথমে ইমেইল যাচাইকরণ সম্পন্ন করুন।'
          : 'Please complete email verification first.'
      );
    }
  }, [step, registrationToken, language]);

  // Pre-fill referral code from ?ref= parameter or stored cookie
  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam && /^[A-Za-z0-9]{8}$/.test(refParam)) {
      setFormData((prev) => ({ ...prev, referralCode: refParam.toUpperCase() }));
    } else {
      try {
        if (typeof document !== 'undefined') {
          const match = document.cookie.match(/(?:^|;\s*)booyah_ref=([^;]+)/);
          if (match && match[1] && /^[A-Za-z0-9]{8}$/.test(match[1])) {
            setFormData((prev) => ({ ...prev, referralCode: match[1].toUpperCase() }));
          }
        }
      } catch {
        // ignore cookie read errors
      }
    }
  }, [searchParams]);

  // Step 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    const emailErr = validateEmail(email);
    if (emailErr) {
      setFieldErrors({ email: emailErr });
      return;
    }

    setIsSubmitting(true);
    try {
      await requestRegisterOtp(email.trim().toLowerCase());
      setStep('otp');
      startCountdown(60);
    } catch (err: any) {
      setGeneralError(
        err instanceof ApiError
          ? getUserFriendlyErrorMessage(err.code, false, language)
          : getUserFriendlyErrorMessage('NETWORK_ERROR', false, language)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (otp.length !== 6) {
      setGeneralError(
        language === 'bn'
          ? 'অনুগ্রহ করে সম্পূর্ণ ৬-সংখ্যার OTP কোড লিখুন'
          : 'Please enter the full 6-digit OTP code'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyRegisterOtp(email.trim().toLowerCase(), otp);
      setRegistrationToken(res.registrationToken);
      setStep('profile');
    } catch (err: any) {
      setGeneralError(
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
    setGeneralError(null);
    setIsSubmitting(true);
    try {
      await requestRegisterOtp(email.trim().toLowerCase());
      startCountdown(60);
    } catch (err: any) {
      setGeneralError(
        err instanceof ApiError
          ? getUserFriendlyErrorMessage(err.code, false, language)
          : getUserFriendlyErrorMessage('NETWORK_ERROR', false, language)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3: Complete Profile
  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    if (!registrationToken) {
      setGeneralError('Registration token missing. Please verify email again.');
      setStep('email');
      return;
    }

    // Client-side validation
    const errors: Record<string, string> = {};
    const nameErr = validateName(formData.name);
    if (nameErr) errors.name = nameErr;

    const mobileErr = validateMobile(formData.mobile);
    if (mobileErr) errors.mobile = mobileErr;

    const ffIdErr = validateFfId(formData.ffId);
    if (ffIdErr) errors.ffId = ffIdErr;

    const ffNameErr = validateFfName(formData.ffName);
    if (ffNameErr) errors.ffName = ffNameErr;

    const upiIdErr = validateUpiId(formData.upiId);
    if (upiIdErr) errors.upiId = upiIdErr;

    const dobErr = validateDateOfBirth(formData.dateOfBirth);
    if (dobErr) errors.dateOfBirth = dobErr;

    if (!formData.confirm18Plus) {
      errors.confirm18Plus =
        language === 'bn'
          ? 'অংশগ্রহণের জন্য আপনাকে ১৮ বছর বা তার বেশি বয়সী হতে হবে'
          : 'You must confirm that you are at least 18 years old';
    }

    if (formData.referralCode.trim()) {
      const refErr = validateReferralCode(formData.referralCode);
      if (refErr) errors.referralCode = refErr;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await completeRegistration({
        registrationToken,
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        ffId: formData.ffId.trim(),
        ffName: formData.ffName.trim(),
        upiId: formData.upiId.trim(),
        dateOfBirth: formData.dateOfBirth,
        confirm18Plus: formData.confirm18Plus,
        referralCode: formData.referralCode.trim() || undefined,
        language: language === 'bn' ? 'bn' : 'en',
      });

      await login(res.token, res.user);
      navigate('/');
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'MOBILE_EXISTS') {
          setFieldErrors((prev) => ({
            ...prev,
            mobile:
              language === 'bn'
                ? 'এই মোবাইল নম্বরটি অন্য অ্যাকাউন্টের সাথে যুক্ত'
                : 'This mobile number is already in use',
          }));
        } else if (err.code === 'FF_ID_EXISTS') {
          setFieldErrors((prev) => ({
            ...prev,
            ffId:
              language === 'bn'
                ? 'এই Free Fire ID-টি অন্য খেলোয়াড়ের নামে নিবন্ধিত'
                : 'This Free Fire ID is already registered',
          }));
        } else if (err.code === 'UPI_EXISTS') {
          setFieldErrors((prev) => ({
            ...prev,
            upiId:
              language === 'bn'
                ? 'এই UPI ID-টি অন্য অ্যাকাউন্টে ব্যবহৃত হচ্ছে'
                : 'This UPI ID is already associated with another account',
          }));
        } else if (err.code === 'INVALID_REFERRAL') {
          setFieldErrors((prev) => ({
            ...prev,
            referralCode:
              language === 'bn'
                ? 'ভুল রেফারেল কোড। অনুগ্রহ করে সঠিক কোড দিন বা ফাঁকা রাখুন'
                : 'Invalid referral code',
          }));
        } else {
          setGeneralError(getUserFriendlyErrorMessage(err.code, false, language));
        }
      } else {
        setGeneralError(getUserFriendlyErrorMessage('VALIDATION_ERROR', false, language));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] flex-col justify-center py-6 w-full max-w-md mx-auto" data-testid="register-page">
      {/* Brand Header */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
          <Flame className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-black tracking-wider text-slate-100">
          BOOYAH<span className="text-emerald-400">WIN</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400">Competitive Free Fire Match Platform</p>
      </div>

      {/* Progress Indicators */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <div
          className={`h-2 rounded-full transition-all ${
            step === 'email' ? 'w-8 bg-emerald-500' : 'w-2 bg-emerald-500/50'
          }`}
        />
        <div
          className={`h-2 rounded-full transition-all ${
            step === 'otp' ? 'w-8 bg-emerald-500' : step === 'profile' ? 'w-2 bg-emerald-500/50' : 'w-2 bg-slate-800'
          }`}
        />
        <div
          className={`h-2 rounded-full transition-all ${
            step === 'profile' ? 'w-8 bg-emerald-500' : 'w-2 bg-slate-800'
          }`}
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-6 shadow-xl backdrop-blur-md">
        {generalError && (
          <div
            role="alert"
            data-testid="register-error-alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{generalError}</span>
          </div>
        )}

        {/* ─── Step 1: Email Form ─── */}
        {step === 'email' && (
          <form onSubmit={handleRequestOtp} className="space-y-4" data-testid="registration-email-form">
            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t('auth.emailLabel')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  id="reg-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="player@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className={`w-full rounded-xl border bg-slate-950 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                    fieldErrors.email
                      ? 'border-rose-500'
                      : 'border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                  }`}
                  required
                />
              </div>
              {fieldErrors.email && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.email}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? t('auth.requestingOtp') : t('auth.getVerificationCode')}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* ─── Step 2: OTP Verification ─── */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-5" data-testid="registration-otp-form">
            <div className="text-center">
              <p className="text-xs text-slate-400">
                {t('auth.otpSentMessage')} <br />
                <span className="font-semibold text-slate-200">{email}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setOtp('');
                  setGeneralError(null);
                }}
                className="mt-1 text-xs text-emerald-400 hover:underline"
              >
                {t('auth.changeEmail')}
              </button>
            </div>

            <div>
              <label className="block text-center text-xs font-semibold text-slate-300 mb-3">
                {t('auth.enterOtp')}
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
                {isCounting ? `${t('auth.resendIn')} ${secondsLeft}s` : t('auth.resendOtp')}
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otp.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? t('auth.verifyingOtp') : t('auth.verifyEmail')}
            </button>
          </form>
        )}

        {/* ─── Step 3: Complete Profile Details ─── */}
        {step === 'profile' && (
          <form onSubmit={handleCompleteRegistration} className="space-y-4" data-testid="registration-profile-form">
            {/* Full Name */}
            <div>
              <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-300 mb-1">
                {t('auth.nameLabel')}
              </label>
              <input
                id="reg-name"
                type="text"
                placeholder={t('auth.namePlaceholder')}
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                disabled={isSubmitting}
                className={`w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                  fieldErrors.name ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                }`}
              />
              {fieldErrors.name && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.name}</p>}
            </div>

            {/* Mobile */}
            <div>
              <label htmlFor="reg-mobile" className="block text-xs font-semibold text-slate-300 mb-1">
                {t('auth.mobileLabel')}
              </label>
              <input
                id="reg-mobile"
                type="tel"
                inputMode="tel"
                placeholder="9876543210"
                value={formData.mobile}
                onChange={(e) => handleFieldChange('mobile', e.target.value)}
                disabled={isSubmitting}
                className={`w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                  fieldErrors.mobile ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                }`}
              />
              {fieldErrors.mobile && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.mobile}</p>}
            </div>

            {/* Free Fire ID & Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-ffId" className="block text-xs font-semibold text-slate-300 mb-1">
                  {t('auth.ffIdLabel')}
                </label>
                <input
                  id="reg-ffId"
                  type="text"
                  inputMode="numeric"
                  placeholder="12345678"
                  value={formData.ffId}
                  onChange={(e) => handleFieldChange('ffId', e.target.value)}
                  disabled={isSubmitting}
                  className={`w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                    fieldErrors.ffId ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                  }`}
                />
                {fieldErrors.ffId && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.ffId}</p>}
              </div>
              <div>
                <label htmlFor="reg-ffName" className="block text-xs font-semibold text-slate-300 mb-1">
                  {t('auth.ffNameLabel')}
                </label>
                <input
                  id="reg-ffName"
                  type="text"
                  placeholder="ProGamer"
                  value={formData.ffName}
                  onChange={(e) => handleFieldChange('ffName', e.target.value)}
                  disabled={isSubmitting}
                  className={`w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                    fieldErrors.ffName ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                  }`}
                />
                {fieldErrors.ffName && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.ffName}</p>}
              </div>
            </div>

            {/* UPI ID */}
            <div>
              <label htmlFor="reg-upiId" className="block text-xs font-semibold text-slate-300 mb-1">
                {t('auth.upiIdLabel')}
              </label>
              <input
                id="reg-upiId"
                type="text"
                placeholder="username@okhdfcbank"
                value={formData.upiId}
                onChange={(e) => handleFieldChange('upiId', e.target.value)}
                disabled={isSubmitting}
                className={`w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                  fieldErrors.upiId ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                }`}
              />
              {fieldErrors.upiId && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.upiId}</p>}
            </div>

            {/* Date of Birth */}
            <div>
              <label htmlFor="reg-dob" className="block text-xs font-semibold text-slate-300 mb-1">
                {t('auth.dobLabel')}
              </label>
              <input
                id="reg-dob"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleFieldChange('dateOfBirth', e.target.value)}
                disabled={isSubmitting}
                className={`w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                  fieldErrors.dateOfBirth ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                }`}
              />
              {fieldErrors.dateOfBirth && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.dateOfBirth}</p>}
            </div>

            {/* Referral Code */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="reg-referral" className="block text-xs font-semibold text-slate-300">
                  {t('auth.referralCodeLabel')}
                </label>
                {formData.referralCode && (
                  <span
                    data-testid="referral-applied-badge"
                    className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Bonus Code Applied
                  </span>
                )}
              </div>
              <input
                id="reg-referral"
                type="text"
                placeholder="REF123456"
                value={formData.referralCode}
                onChange={(e) => handleFieldChange('referralCode', e.target.value.toUpperCase())}
                disabled={isSubmitting}
                className={`w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                  fieldErrors.referralCode ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                }`}
              />
              {fieldErrors.referralCode && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.referralCode}</p>}
            </div>

            {/* 18+ Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.confirm18Plus}
                  onChange={(e) => handleFieldChange('confirm18Plus', e.target.checked)}
                  disabled={isSubmitting}
                  className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20"
                />
                <span>{t('auth.confirm18')}</span>
              </label>
              {fieldErrors.confirm18Plus && (
                <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.confirm18Plus}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting ? t('auth.completingRegistration') : t('auth.completeRegistration')}
            </button>
          </form>
        )}
      </div>

      {/* Footer / Switch to Login */}
      <div className="mt-6 text-center text-xs text-slate-400">
        {t('auth.alreadyHaveAccount')}{' '}
        <Link to="/login" className="font-semibold text-emerald-400 hover:underline">
          {t('auth.loginLink')}
        </Link>
      </div>
    </div>
  );
};
