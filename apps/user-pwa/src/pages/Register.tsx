import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { requestRegisterOtp, verifyRegisterOtp, completeRegistration, lookupReferralCode } from '../api/auth.js';
import { OtpInput } from '../components/common/OtpInput.js';
import { useCountdown } from '../hooks/useCountdown.js';
import {
  validateEmail,
  validateUsername,
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
import { Mail, ArrowRight, RotateCcw, AlertCircle, CheckCircle2, Clipboard, Gift, SquarePen, Lock } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.js';
import { subscribeToPushNotifications } from '../utils/pushNotifications.js';

export const getInitialReferralCode = (searchParams?: URLSearchParams): string => {
  // Read referral code only from URL search param ?ref= (never local storage)
  if (searchParams) {
    const refParam = searchParams.get('ref');
    if (refParam && /^@?[A-Za-z0-9_]{3,20}$/.test(refParam)) {
      return refParam.toLowerCase();
    }
  }
  return '';
};

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { t, language } = useTranslation();

  const hasRefParam = Boolean(
    searchParams.get('ref') && /^@?[A-Za-z0-9_]{3,20}$/.test(searchParams.get('ref') || '')
  );

  const [step, setStep] = useState<'verify' | 'profile'>('verify');
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  // The registration token lives ONLY in component state, never in localStorage/sessionStorage
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);

  // Form Fields - referralCode is initialized immediately from query param or persistent storage
  const [formData, setFormData] = useState(() => ({
    username: '',
    name: '',
    mobile: '',
    ffId: '',
    ffName: '',
    upiId: '',
    dateOfBirth: '',
    confirm18Plus: false,
    referralCode: getInitialReferralCode(searchParams),
  }));

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [referralValidation, setReferralValidation] = useState<{
    checking: boolean;
    isValid: boolean | null;
    referrerName: string | null;
    error: string | null;
  }>({
    checking: false,
    isValid: null,
    referrerName: null,
    error: null,
  });

  // Referral field is locked ONLY IF user arrived via referral link AND the referral code is valid.
  // If the referral code is invalid (e.g. s20035 not found), the field remains editable so the user can fix or remove it.
  const isReferralLocked =
    hasRefParam &&
    referralValidation.isValid === true &&
    formData.referralCode.replace(/^@/, '') === (searchParams.get('ref') || '').replace(/^@/, '').toLowerCase();

  const referralTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (referralTimerRef.current) {
        clearTimeout(referralTimerRef.current);
      }
    };
  }, []);

  const checkReferral = async (rawCode: string, currentUsername?: string) => {
    const code = rawCode.trim().toLowerCase();
    if (!code) {
      setReferralValidation({ checking: false, isValid: null, referrerName: null, error: null });
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.referralCode;
        return next;
      });
      return;
    }

    const formatErr = validateReferralCode(code);
    if (formatErr) {
      setReferralValidation({ checking: false, isValid: false, referrerName: null, error: formatErr });
      setFieldErrors((prev) => ({ ...prev, referralCode: formatErr }));
      return;
    }

    const normalizedCode = code.replace(/^@/, '');
    const usernameToCheck = (currentUsername ?? formData.username).trim().toLowerCase().replace(/^@/, '');
    if (usernameToCheck && normalizedCode === usernameToCheck) {
      const selfErr =
        language === 'bn'
          ? 'নিজের ইউজারনেম রেফারেল কোড হিসেবে ব্যবহার করা যাবে না'
          : 'Cannot use your own username as referral code';
      setReferralValidation({ checking: false, isValid: false, referrerName: null, error: selfErr });
      setFieldErrors((prev) => ({ ...prev, referralCode: selfErr }));
      return;
    }

    setReferralValidation((prev) => ({ ...prev, checking: true, error: null }));
    try {
      const res = await lookupReferralCode(normalizedCode);
      if (res && res.exists) {
        setReferralValidation({
          checking: false,
          isValid: true,
          referrerName: res.name || null,
          error: null,
        });
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.referralCode;
          return next;
        });
      } else {
        const notFoundErr =
          language === 'bn'
            ? 'ভুল রেফারেল কোড। এই ইউজারনেমে কোনো খেলোয়াড় নেই।'
            : 'Invalid referral code. No player found with this username.';
        setReferralValidation({
          checking: false,
          isValid: false,
          referrerName: null,
          error: notFoundErr,
        });
        setFieldErrors((prev) => ({ ...prev, referralCode: notFoundErr }));
      }
    } catch {
      setReferralValidation((prev) => ({ ...prev, checking: false }));
    }
  };

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
      // Ignored if permission denied or unsupported
    }
  };

  const handleEditEmail = () => {
    setOtpSent(false);
    setOtp('');
    setGeneralError(null);
  };

  // Guard: Step 2 (profile) is strictly unreachable without registrationToken in component state
  useEffect(() => {
    if (step === 'profile' && !registrationToken) {
      setStep('verify');
      setOtpSent(false);
      setGeneralError(
        language === 'bn'
          ? 'অনুগ্রহ করে প্রথমে ইমেইল যাচাইকরণ সম্পন্ন করুন।'
          : 'Please complete email verification first.'
      );
    }
  }, [step, registrationToken, language]);

  // Pre-fill and validate referral code from ?ref= parameter
  useEffect(() => {
    const code = getInitialReferralCode(searchParams);
    if (code) {
      setFormData((prev) => (prev.referralCode === code ? prev : { ...prev, referralCode: code }));
      checkReferral(code);
    }
  }, [searchParams]);

  // Pre-fill OTP and email from query params if coming from verification email
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

  // When reaching Profile step, ensure referral code is checked if not yet validated
  useEffect(() => {
    if (step === 'profile' && formData.referralCode) {
      if (referralValidation.isValid === null && !referralValidation.checking) {
        checkReferral(formData.referralCode, formData.username);
      }
    }
  }, [step, formData.referralCode, formData.username, referralValidation.isValid, referralValidation.checking]);

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
      setOtpSent(true);
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

  // Step 1 (Part 2): Verify OTP
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
      setOtp('');
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

    if (field === 'referralCode') {
      if (referralTimerRef.current) {
        clearTimeout(referralTimerRef.current);
      }
      const trimmed = String(value || '').trim();
      if (!trimmed) {
        setReferralValidation({ checking: false, isValid: null, referrerName: null, error: null });
      } else {
        referralTimerRef.current = setTimeout(() => {
          checkReferral(trimmed, formData.username);
        }, 400);
      }
    } else if (field === 'username') {
      if (formData.referralCode.trim()) {
        if (referralTimerRef.current) {
          clearTimeout(referralTimerRef.current);
        }
        referralTimerRef.current = setTimeout(() => {
          checkReferral(formData.referralCode, String(value || ''));
        }, 400);
      }
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    if (!registrationToken) {
      setGeneralError('Registration token missing. Please verify email again.');
      setStep('verify');
      setOtpSent(false);
      return;
    }

    // Client-side validation
    const errors: Record<string, string> = {};
    const usernameErr = validateUsername(formData.username);
    if (usernameErr) errors.username = usernameErr;

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
      const code = formData.referralCode.trim().toLowerCase();
      const normalizedCode = code.replace(/^@/, '');
      const refErr = validateReferralCode(code);
      const normalizedUsername = formData.username.trim().toLowerCase().replace(/^@/, '');
      if (refErr) {
        errors.referralCode = refErr;
      } else if (normalizedUsername && normalizedUsername === normalizedCode) {
        errors.referralCode =
          language === 'bn'
            ? 'নিজের ইউজারনেম রেফারেল কোড হিসেবে ব্যবহার করা যাবে না'
            : 'Cannot use your own username as referral code';
      } else if (referralValidation.isValid === false) {
        errors.referralCode =
          referralValidation.error ||
          (language === 'bn'
            ? 'ভুল রেফারেল কোড। অনুগ্রহ করে সঠিক কোড দিন বা ফাঁকা রাখুন।'
            : 'Invalid referral code. Please check the code or leave it blank.');
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // If referral code entered but not yet verified, verify it now before registration
    if (formData.referralCode.trim() && referralValidation.isValid !== true) {
      setIsSubmitting(true);
      try {
        const lookup = await lookupReferralCode(formData.referralCode.trim().replace(/^@/, '').toLowerCase());
        if (!lookup.exists) {
          const notFoundErr =
            language === 'bn'
              ? 'ভুল রেফারেল কোড। এই ইউজারনেমে কোনো খেলোয়াড় নেই।'
              : 'Invalid referral code. No player found with this username.';
          setReferralValidation({
            checking: false,
            isValid: false,
            referrerName: null,
            error: notFoundErr,
          });
          setFieldErrors((prev) => ({ ...prev, referralCode: notFoundErr }));
          setIsSubmitting(false);
          return;
        } else {
          setReferralValidation({
            checking: false,
            isValid: true,
            referrerName: lookup.name || null,
            error: null,
          });
        }
      } catch {
        // If lookup fails due to transient network, proceed to let backend validate
      }
    }

    // Pre-request notification permission synchronously during user click gesture
    const permPromise =
      typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default'
        ? Notification.requestPermission().catch(() => 'default' as NotificationPermission)
        : null;

    setIsSubmitting(true);
    try {
      const res = await completeRegistration({
        registrationToken,
        username: formData.username.trim().toLowerCase(),
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        ffId: formData.ffId.trim(),
        ffName: formData.ffName.trim(),
        upiId: formData.upiId.trim(),
        dateOfBirth: formData.dateOfBirth,
        confirm18Plus: formData.confirm18Plus,
        referralCode: formData.referralCode.trim().replace(/^@/, '') || undefined,
        language: language === 'bn' ? 'bn' : 'en',
      });

      await login(res.token, res.user);
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
      if (err instanceof ApiError) {
        if (err.code === 'USERNAME_EXISTS') {
          setFieldErrors((prev) => ({
            ...prev,
            username:
              language === 'bn'
                ? 'এই ইউজারনেমটি ইতিমধ্যে নেওয়া হয়েছে'
                : 'This username is already taken. Please choose another.',
          }));
        } else if (err.code === 'MOBILE_EXISTS') {
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
          const errMsg =
            language === 'bn'
              ? 'ভুল রেফারেল কোড। অনুগ্রহ করে সঠিক কোড দিন বা ফাঁকা রাখুন।'
              : 'Invalid referral code. Please check the code or leave it blank.';
          setReferralValidation({
            checking: false,
            isValid: false,
            referrerName: null,
            error: errMsg,
          });
          setFieldErrors((prev) => ({
            ...prev,
            referralCode: errMsg,
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
    <div className="flex flex-col justify-center py-4 sm:py-6 w-full max-w-md mx-auto" data-testid="register-page">
      {/* Brand Header */}
      <div className="mb-6 text-center">
        <img
          src="/assets/logo_full.png"
          alt="Booyah Win - Tournament Platform"
          className="mx-auto h-20 w-auto object-contain drop-shadow-[0_4px_16px_rgba(244,162,45,0.18)]"
        />
        <h1 className="sr-only">Booyah Win</h1>
      </div>

      {/* Progress Indicators */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <div
          className={`h-2 rounded-full transition-all ${
            step === 'verify' ? 'w-8 bg-emerald-500' : 'w-2 bg-emerald-500/50'
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

        {/* Step 1 Heading */}
        {step === 'verify' && (
          <div className="mb-5 text-center">
            <h2 className="text-xl font-black text-slate-100 tracking-tight">
              {t('auth.registerTitle') || 'Create an Account'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {t('auth.registerSubtitle') || 'Join thousands of competitive Free Fire players today'}
            </p>
          </div>
        )}

        {/* Active referral bonus banner if arriving with a referral code */}
        {formData.referralCode && (
          <div
            data-testid="referral-code-active-banner"
            className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300"
          >
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                {language === 'bn'
                  ? `রেফারেল কোড সক্রিয়: ${formData.referralCode}`
                  : `Referral code applied: ${formData.referralCode}`}
              </span>
            </div>
            {referralValidation.referrerName && (
              <span className="text-[11px] font-semibold text-emerald-400">
                ({referralValidation.referrerName})
              </span>
            )}
          </div>
        )}

        {/* ─── Step 1: Verification Form (Email + OTP combined) ─── */}
        {step === 'verify' && (
          <form
            onSubmit={otpSent ? handleVerifyOtp : handleRequestOtp}
            className="space-y-4"
            data-testid="registration-email-form"
          >
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
                  disabled={isSubmitting || otpSent}
                  readOnly={otpSent}
                  className={`w-full rounded-xl border bg-slate-950 py-3 pl-10 ${
                    otpSent ? 'pr-11 font-medium text-slate-100' : 'pr-4 text-slate-100'
                  } text-sm placeholder-slate-600 focus:outline-none ${
                    fieldErrors.email
                      ? 'border-rose-500'
                      : 'border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                  } disabled:opacity-90`}
                  required
                />
                {otpSent && (
                  <button
                    type="button"
                    onClick={handleEditEmail}
                    disabled={isSubmitting}
                    data-testid="registration-change-email-btn"
                    aria-label={t('auth.changeEmail') || 'Change email'}
                    className="absolute right-3 top-3 p-1 text-emerald-400 hover:text-emerald-300 transition active:scale-95"
                  >
                    <SquarePen className="h-4 w-4" />
                  </button>
                )}
              </div>
              {fieldErrors.email && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.email}</p>}
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
              <div
                data-testid="registration-otp-form"
                className="space-y-4 pt-1 animate-in fade-in duration-200"
              >
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
                : (otpSent ? (t('auth.verifyEmail') || t('auth.verifyOtp')) : (t('auth.getVerificationCode') || t('auth.requestOtp')))}
              {!otpSent && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        )}

        {/* ─── Step 3: Complete Profile Details ─── */}
        {step === 'profile' && (
          <form onSubmit={handleCompleteRegistration} className="space-y-4" data-testid="registration-profile-form">
            {/* Username */}
            <div>
              <label htmlFor="reg-username" className="block text-xs font-semibold text-slate-300 mb-1">
                {language === 'bn' ? 'ইউজারনেম' : 'Username'}
              </label>
              <input
                id="reg-username"
                type="text"
                placeholder={language === 'bn' ? 'উদাহরণ: pro_killer99' : 'e.g. pro_killer99'}
                value={formData.username}
                onChange={(e) => handleFieldChange('username', e.target.value.toLowerCase())}
                disabled={isSubmitting}
                className={`w-full rounded-xl border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                  fieldErrors.username ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                }`}
              />
              {fieldErrors.username ? (
                <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.username}</p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500">
                  {language === 'bn' ? 'অনন্য ইউজারনেম (৩-২০ অক্ষর, বর্ণ, সংখ্যা ও _)' : 'Unique username (3-20 chars, letters, numbers & _)'}
                </p>
              )}
            </div>

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
                {referralValidation.checking && (
                  <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                    <RotateCcw className="h-3 w-3 animate-spin text-slate-400" />
                    {language === 'bn' ? 'যাচাই করা হচ্ছে...' : 'Verifying...'}
                  </span>
                )}
                {!referralValidation.checking && referralValidation.isValid === true && (
                  <span
                    data-testid="referral-applied-badge"
                    className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {referralValidation.referrerName
                      ? `${language === 'bn' ? 'বোনাস কোড যুক্ত হয়েছে' : 'Bonus Applied'} (${referralValidation.referrerName})`
                      : 'Bonus Code Applied'}
                  </span>
                )}
                {!referralValidation.checking && referralValidation.isValid === false && (
                  <span
                    data-testid="referral-invalid-badge"
                    className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {language === 'bn' ? 'ভুল কোড' : 'Invalid Code'}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="reg-referral"
                  type="text"
                  placeholder={t('auth.referralCodePlaceholder') || "Enter friend's username"}
                  value={formData.referralCode}
                  readOnly={isReferralLocked}
                  disabled={isSubmitting}
                  data-testid="reg-referral-input"
                  onChange={(e) => {
                    if (isReferralLocked) return;
                    handleFieldChange('referralCode', e.target.value.toLowerCase());
                  }}
                  onBlur={() => {
                    if (!isReferralLocked && formData.referralCode.trim()) {
                      checkReferral(formData.referralCode, formData.username);
                    }
                  }}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                    isReferralLocked
                      ? 'bg-slate-900/80 text-slate-300 border-emerald-500/50 cursor-not-allowed select-none pr-9'
                      : 'bg-slate-950 text-slate-100 placeholder-slate-600 focus:outline-none'
                  } ${
                    !isReferralLocked && (fieldErrors.referralCode || referralValidation.isValid === false)
                      ? 'border-rose-500 text-rose-100 focus:border-rose-500'
                      : referralValidation.isValid === true
                      ? 'border-emerald-500/70 focus:border-emerald-500'
                      : 'border-slate-700 focus:border-emerald-500'
                  }`}
                />
                {isReferralLocked && (
                  <div
                    data-testid="referral-locked-icon"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none"
                    title={language === 'bn' ? 'রেফারেল লিঙ্ক দ্বারা লক করা' : 'Locked via referral link'}
                  >
                    <Lock className="h-4 w-4" />
                  </div>
                )}
              </div>
              {(fieldErrors.referralCode || referralValidation.error) && (
                <p data-testid="referral-error-text" className="mt-1 text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {fieldErrors.referralCode || referralValidation.error}
                </p>
              )}
              {referralValidation.isValid === true && !fieldErrors.referralCode && (
                <p data-testid="referral-success-text" className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  {language === 'bn'
                    ? `রেফারার: ${referralValidation.referrerName || 'সঠিক কোড'}`
                    : `Referrer: ${referralValidation.referrerName || 'Valid code'}`}
                </p>
              )}
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
