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
import { Flame, Mail, ArrowRight, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

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
    }
  }, [step, registrationToken]);

  // Pre-fill referral code from ?ref= parameter or stored cookie
  useEffect(() => {
    const refParam = searchParams.get('ref') || searchParams.get('referral');
    let codeToUse = refParam ? refParam.trim().toUpperCase() : '';

    if (!codeToUse && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('booyah_ref');
        if (stored) {
          codeToUse = stored.trim().toUpperCase();
        } else {
          const match = document.cookie.match(/(?:^|;\s*)booyah_ref=([^;]+)/);
          if (match && match[1]) {
            codeToUse = decodeURIComponent(match[1]).trim().toUpperCase();
          }
        }
      } catch (e) {}
    }

    if (codeToUse) {
      setFormData((prev) => ({
        ...prev,
        referralCode: prev.referralCode || codeToUse,
      }));
    }
  }, [searchParams]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    const emailErr = validateEmail(email);
    if (emailErr) {
      setGeneralError(emailErr);
      return;
    }

    setIsSubmitting(true);
    try {
      await requestRegisterOtp(email.trim().toLowerCase());
      setStep('otp');
      startCountdown(60);
    } catch (err: any) {
      setGeneralError(err instanceof ApiError ? err.message : 'Unable to send OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (otp.length !== 6) {
      setGeneralError('Please enter the full 6-digit OTP code');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyRegisterOtp(email.trim().toLowerCase(), otp);
      setRegistrationToken(res.registrationToken);
      setStep('profile');
    } catch (err: any) {
      setGeneralError(err instanceof ApiError ? err.message : 'Invalid verification code.');
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
      setGeneralError(err instanceof ApiError ? err.message : 'Unable to resend OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!registrationToken) {
      setStep('email');
      return;
    }

    // Client-side validations
    const errors: Record<string, string> = {};
    const nameErr = validateName(formData.name);
    if (nameErr) errors.name = nameErr;

    const mobileErr = validateMobile(formData.mobile);
    if (mobileErr) errors.mobile = mobileErr;

    const ffIdErr = validateFfId(formData.ffId);
    if (ffIdErr) errors.ffId = ffIdErr;

    const ffNameErr = validateFfName(formData.ffName);
    if (ffNameErr) errors.ffName = ffNameErr;

    const upiErr = validateUpiId(formData.upiId);
    if (upiErr) errors.upiId = upiErr;

    const dobErr = validateDateOfBirth(formData.dateOfBirth);
    if (dobErr) errors.dateOfBirth = dobErr;

    if (!formData.confirm18Plus) {
      errors.confirm18Plus = 'You must confirm that you are at least 18 years old';
    }

    const refErr = validateReferralCode(formData.referralCode);
    if (refErr) errors.referralCode = refErr;

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
      });

      await login(res.token, res.user);
      navigate('/');
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'MOBILE_EXISTS') {
          setFieldErrors((prev) => ({ ...prev, mobile: 'This mobile number is already in use' }));
        } else if (err.code === 'FF_ID_EXISTS') {
          setFieldErrors((prev) => ({ ...prev, ffId: 'This Free Fire ID is already registered' }));
        } else if (err.code === 'UPI_EXISTS') {
          setFieldErrors((prev) => ({ ...prev, upiId: 'This UPI ID is already associated with another account' }));
        } else if (err.code === 'INVALID_REFERRAL') {
          setFieldErrors((prev) => ({ ...prev, referralCode: 'Referral code does not exist' }));
        } else {
          setGeneralError(err.message);
        }
      } else {
        setGeneralError('Registration failed. Please check your information and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] flex-col justify-center py-6 w-full max-w-md mx-auto">
      {/* Brand Header */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
          <Flame className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-black tracking-wider text-slate-100">
          PLAYER<span className="text-emerald-400">REGISTRATION</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          {step === 'profile' ? 'Step 3 of 3: Profile Details' : step === 'otp' ? 'Step 2 of 3: Verification' : 'Step 1 of 3: Email OTP'}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl backdrop-blur-md">
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

        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address
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
              {isSubmitting ? 'Sending Code...' : 'Get Verification Code'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : step === 'otp' ? (
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
                  setGeneralError(null);
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
              {isSubmitting ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCompleteRegistration} className="space-y-4" data-testid="registration-profile-form">
            {/* Full Name */}
            <div>
              <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-300 mb-1">
                Full Name (as per ID)
              </label>
              <input
                id="reg-name"
                type="text"
                placeholder="John Doe"
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
                Mobile Number (10 Digits)
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
                  Free Fire ID (Digits)
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
                  Free Fire IGN
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
                UPI ID (for withdrawals)
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
                Date of Birth (18+ Required)
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
                  Referral Code (Optional)
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
                <span>I confirm that I am at least 18 years of age or older.</span>
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
              {isSubmitting ? 'Completing Registration...' : 'Complete & Start Playing'}
            </button>
          </form>
        )}
      </div>

      {/* Footer / Switch to Login */}
      <div className="mt-6 text-center text-xs text-slate-400">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-emerald-400 hover:underline">
          Log In
        </Link>
      </div>
    </div>
  );
};
