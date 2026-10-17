import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { updateProfile, uploadAvatar } from '../api/user.js';
import { formatCooldownMessage, formatDateOfBirth } from '../utils/formatters.js';
import { validateMobile, validateFfId, validateFfName, validateUpiId } from '../utils/validation.js';
import { ApiError } from '../api/client.js';
import type { UpdateProfilePayload } from '../api/types.js';
import { useTranslation } from '../i18n/LanguageContext.js';
import {
  User,
  Mail,
  Phone,
  Gamepad2,
  CreditCard,
  Calendar,
  Lock,
  LogOut,
  Save,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Clock,
  Gift,
  ChevronRight,
  Headphones,
  Download,
  Camera,
  ArrowLeft,
  Edit3,
  Loader2,
  ShieldCheck,
  Globe,
} from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, cooldowns, refreshProfile, logout } = useAuth();
  const { language, setLanguage, t } = useTranslation();

  // Mode: 'view' (profile summary) or 'edit' (dedicated credentials edit screen)
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const [form, setForm] = useState({
    mobile: user?.mobile || '',
    ffId: user?.ffId || '',
    ffName: user?.ffName || '',
    upiId: user?.upiId || '',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setForm({
        mobile: user.mobile || '',
        ffId: user.ffId || '',
        ffName: user.ffName || '',
        upiId: user.upiId || '',
      });
    }
  }, [user]);

  // Cooldown status checks
  const isMobileLocked = !!cooldowns?.mobileAvailableAt && new Date(cooldowns.mobileAvailableAt) > new Date();
  const isFfIdLocked = !!cooldowns?.ffIdAvailableAt && new Date(cooldowns.ffIdAvailableAt) > new Date();
  const isFfNameLocked = !!cooldowns?.ffNameAvailableAt && new Date(cooldowns.ffNameAvailableAt) > new Date();
  const isUpiLocked = !!cooldowns?.upiIdAvailableAt && new Date(cooldowns.upiIdAvailableAt) > new Date();

  // Generate dynamic initials for fallback avatar (e.g. "SK" for "Sujoy Kumar")
  const getInitials = (name?: string): string => {
    if (!name) return 'BW';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleCopyReferral = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setCopiedReferral(true);
      setTimeout(() => setCopiedReferral(false), 2000);
    }
  };

  const handleFieldChange = (field: string, val: string) => {
    setForm((prev) => ({ ...prev, [field]: val }));
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
    setGeneralError(null);
    setSuccessMessage(null);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = '';

    // Validate size (max 2 MB)
    if (file.size > 2 * 1024 * 1024) {
      setGeneralError('Profile image must be less than 2 MB.');
      return;
    }

    // Validate format
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setGeneralError('Please upload a valid image (JPEG, PNG, or WebP).');
      return;
    }

    setGeneralError(null);
    setIsUploadingPhoto(true);

    try {
      await uploadAvatar(file);
      await refreshProfile();
      setSuccessMessage('Profile photo updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setGeneralError(err instanceof ApiError ? err.message : 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessMessage(null);

    // Rule 8: Send ONLY changed fields
    const payload: UpdateProfilePayload = {};
    if (user?.mobile && form.mobile.trim() !== user.mobile.trim()) {
      payload.mobile = form.mobile.trim();
    }
    if (user?.ffId && form.ffId.trim() !== user.ffId.trim()) {
      payload.ffId = form.ffId.trim();
    }
    if (user?.ffName && form.ffName.trim() !== user.ffName.trim()) {
      payload.ffName = form.ffName.trim();
    }
    if (user?.upiId && form.upiId.trim() !== user.upiId.trim()) {
      payload.upiId = form.upiId.trim();
    }

    if (Object.keys(payload).length === 0) {
      setMode('view');
      return;
    }

    // Client-side validation for changed fields
    const errors: Record<string, string> = {};
    if (payload.mobile) {
      const err = validateMobile(payload.mobile);
      if (err) errors.mobile = err;
    }
    if (payload.ffId) {
      const err = validateFfId(payload.ffId);
      if (err) errors.ffId = err;
    }
    if (payload.ffName) {
      const err = validateFfName(payload.ffName);
      if (err) errors.ffName = err;
    }
    if (payload.upiId) {
      const err = validateUpiId(payload.upiId);
      if (err) errors.upiId = err;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateProfile(payload);
      await refreshProfile();
      setSuccessMessage('Profile credentials updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setMode('view');
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'MOBILE_EXISTS') {
          setFieldErrors((prev) => ({ ...prev, mobile: 'This mobile number is already in use' }));
        } else if (err.code === 'FF_ID_EXISTS') {
          setFieldErrors((prev) => ({ ...prev, ffId: 'This Free Fire ID is already registered' }));
        } else if (err.code === 'UPI_EXISTS') {
          setFieldErrors((prev) => ({ ...prev, upiId: 'This UPI ID is already associated with another account' }));
        } else if (err.code === 'IN_ACTIVE_MATCH') {
          setFieldErrors((prev) => ({
            ...prev,
            ffId: 'Cannot change Free Fire details while enrolled in an upcoming or live match',
            ffName: 'Cannot change Free Fire details while enrolled in an upcoming or live match',
          }));
        } else if (err.code === 'FIELD_COOLDOWN') {
          setGeneralError('One or more fields are currently under a 30-day cooldown.');
        } else if (err.details && typeof err.details === 'object') {
          const mappedDetails: Record<string, string> = {};
          for (const [k, v] of Object.entries(err.details)) {
            mappedDetails[k] = String(v);
          }
          setFieldErrors((prev) => ({ ...prev, ...mappedDetails }));
        } else {
          setGeneralError(err.message);
        }
      } else {
        setGeneralError('Failed to update profile. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadUrl = import.meta.env.VITE_APP_DOWNLOAD_URL;

  return (
    <div className="space-y-3" data-testid="profile-screen">
      {/* Hidden File Input for Avatar Photo Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoSelect}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        data-testid="avatar-file-input"
      />

      {/* Global Alerts */}
      {generalError && (
        <div
          role="alert"
          data-testid="profile-error-alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <span>{generalError}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          data-testid="profile-success-alert"
          className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          MODE 1: VIEW MODE (Real Profile Display matching reference mockup)
         ───────────────────────────────────────────────────────────────────────── */}
      {mode === 'view' && (
        <>
          {/* Profile Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h1 className="text-xl font-black text-slate-100">{t('profile.myProfile')}</h1>
              <p className="text-xs text-slate-400">{t('profile.subtitle')}</p>
            </div>
            <button
              onClick={logout}
              data-testid="logout-button"
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-400 transition-all hover:bg-rose-500/20 active:scale-[0.98]"
            >
              <LogOut className="h-4 w-4" />
              {t('profile.logout')}
            </button>
          </div>

          {/* User Hero Profile Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-lg">
            <div className="flex items-center gap-3.5 sm:gap-4.5 text-left">
              {/* Circular Avatar with Camera Upload Badge */}
              <div className="relative shrink-0">
                <div className="relative flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-500/40 shadow-lg bg-slate-950">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name || 'User avatar'}
                      data-testid="user-avatar-img"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      data-testid="user-avatar-fallback"
                      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 text-lg sm:text-xl font-black text-slate-100 tracking-wider shadow-inner"
                    >
                      {getInitials(user?.name)}
                    </div>
                  )}

                  {isUploadingPhoto && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                    </div>
                  )}
                </div>

                {/* Camera Overlay Badge Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  data-testid="upload-avatar-btn"
                  title={t('profile.changePhoto')}
                  aria-label={t('profile.uploadPhoto')}
                  className="absolute bottom-0 right-0 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-slate-900 border-2 border-slate-700 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 active:scale-95 transition-all shadow-md"
                >
                  <Camera className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
              </div>

              {/* Name, Email, and Action Buttons (Horizontal Right Beside Avatar) */}
              <div className="min-w-0 flex-1 space-y-0.5">
                <h2 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight leading-snug break-words" data-testid="profile-user-name">
                  {user?.name || 'Player'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 break-all" data-testid="profile-user-email">
                  {user?.email}
                </p>

                <div className="pt-2 flex items-center">
                  <button
                    type="button"
                    onClick={() => setMode('edit')}
                    data-testid="edit-profile-btn"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] shadow-md shadow-emerald-500/20"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>{t('profile.editProfileBtn')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Account & Free Fire Credentials Overview (Styled Clean Cards) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('profile.accountCredentials')}</h3>
              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> {t('profile.verifiedAccount')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Free Fire In-Game Name */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Gamepad2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{t('profile.freeFireName')}</span>
                </div>
                <p className="text-sm font-bold text-slate-100" data-testid="profile-view-ffName">
                  {user?.ffName || '—'}
                </p>
              </div>

              {/* Free Fire UID */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Gamepad2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{t('profile.freeFireUID')}</span>
                </div>
                <p className="text-sm font-mono font-bold text-slate-100" data-testid="profile-view-ffId">
                  {user?.ffId || '—'}
                </p>
              </div>

              {/* Mobile Number */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Phone className="h-3.5 w-3.5 text-blue-400" />
                  <span>{t('profile.mobileNumber')}</span>
                </div>
                <p className="text-sm font-mono font-bold text-slate-100" data-testid="profile-view-mobile">
                  {user?.mobile ? `+91 ${user.mobile}` : '—'}
                </p>
              </div>

              {/* UPI ID */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <CreditCard className="h-3.5 w-3.5 text-purple-400" />
                  <span>{t('profile.payoutUpiId')}</span>
                </div>
                <p className="text-sm font-mono font-bold text-slate-100" data-testid="profile-view-upiId">
                  {user?.upiId || '—'}
                </p>
              </div>

              {/* Date of Birth & 18+ Verified */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between gap-1.5 text-slate-400 text-xs mb-1">
                  <span className="flex items-center gap-1.5 shrink-0">
                    <Calendar className="h-3.5 w-3.5 text-amber-400" />
                    <span>{t('profile.dateOfBirth')}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 whitespace-nowrap shrink-0">
                    <ShieldCheck className="h-3 w-3" /> {t('profile.verified18')}
                  </span>
                </div>
                <p className="text-sm font-mono font-bold text-slate-100 whitespace-nowrap" data-testid="profile-view-dob">
                  {formatDateOfBirth(user?.dateOfBirth)}
                </p>
              </div>

              {/* Referral Code */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span className="flex items-center gap-2">
                    <Gift className="h-3.5 w-3.5 text-amber-400" />
                    <span>{t('profile.yourReferralCode')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    data-testid="copy-referral-btn"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{copiedReferral ? t('common.copied') : t('common.copy')}</span>
                  </button>
                </div>
                <p className="text-sm font-mono font-black text-emerald-400 tracking-wider">
                  {user?.referralCode}
                </p>
              </div>
            </div>

            {/* View Full Referral Dashboard Link */}
            <Link
              to="/referral"
              data-testid="view-referral-dashboard-link"
              className="mt-2 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-950/30 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-emerald-400" />
                <span>{t('profile.viewReferralDashboard')}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-emerald-400" />
            </Link>
          </div>

          {/* Download Android App Button (Permanent for logged-in users) */}
          {downloadUrl && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 shadow-sm" data-testid="profile-download-app-section">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Download className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-200">{t('profile.androidAppTitle')}</p>
                    <p className="text-[11px] text-slate-400">{t('profile.androidAppDesc')}</p>
                  </div>
                </div>
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="profile-download-app-btn"
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] shrink-0 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{t('profile.downloadAppBtn')}</span>
                </a>
              </div>
            </div>
          )}

          {/* Language Preference Section */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm" data-testid="profile-language-section">
            <div className="flex items-center gap-2.5 mb-3">
              <Globe className="h-4 w-4 text-emerald-400" />
              <div>
                <h3 className="text-xs font-bold text-slate-200">{t('profile.languagePreferenceTitle')}</h3>
                <p className="text-[11px] text-slate-400">{t('profile.languagePreferenceSubtitle')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3" data-testid="profile-language-options">
              <button
                type="button"
                data-testid="profile-lang-en"
                onClick={() => setLanguage('en', { syncServer: true })}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  language === 'en'
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-400'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span>English</span>
                {language === 'en' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              </button>
              <button
                type="button"
                data-testid="profile-lang-bn"
                onClick={() => setLanguage('bn', { syncServer: true })}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  language === 'bn'
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-400'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span>বাংলা</span>
                {language === 'bn' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              </button>
            </div>
          </div>

          {/* Customer Support Section */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
            <Link
              to="/support"
              data-testid="profile-support-link"
              className="flex items-center justify-between text-xs font-bold text-slate-200 hover:text-emerald-400 transition"
            >
              <span className="flex items-center gap-2.5">
                <Headphones className="h-4 w-4 text-emerald-400" />
                <span>{t('profile.needHelpSupport')}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </Link>
          </div>
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          MODE 2: EDIT MODE (Dedicated Edit Credentials Screen matching Image 3)
         ───────────────────────────────────────────────────────────────────────── */}
      {mode === 'edit' && (
        <div className="space-y-3" data-testid="edit-profile-view">
          {/* Edit Screen Header with Back Arrow */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMode('view')}
                data-testid="back-to-profile-btn"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                aria-label={t('referral.backToProfile')}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-xl font-black text-slate-100">{t('profile.editProfileBtn')}</h1>
                <p className="text-xs text-slate-400">{t('profile.editProfileDesc')}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMode('view')}
              className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors px-2 py-1"
            >
              {t('common.cancel')}
            </button>
          </div>

          {/* Avatar Photo Edit Section */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center shadow-sm">
            <div className="relative inline-block mx-auto mb-2">
              <div className="relative flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-500/50 shadow-lg bg-slate-950">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || 'User avatar'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 text-lg sm:text-xl font-bold text-slate-100">
                    {getInitials(user?.name)}
                  </div>
                )}
                {isUploadingPhoto && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                aria-label={t('profile.uploadPhoto')}
                className="absolute bottom-0 right-0 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-emerald-500 border-2 border-slate-900 text-slate-950 hover:bg-emerald-400 active:scale-95 transition-all shadow-md"
              >
                <Camera className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </button>
            </div>
            <p className="text-xs font-semibold text-slate-300">{t('profile.profilePhoto')}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{t('profile.photoFormatHelp')}</p>
          </div>

          {/* Non-Editable Details (Locked) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('profile.nonEditableDetails')}</h2>

            {/* Full Name (locked) */}
            <div>
              <label htmlFor="prof-name" className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  {t('profile.fullName')}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Lock className="h-3 w-3" /> {t('profile.locked')}
                </span>
              </label>
              <input
                id="prof-name"
                type="text"
                disabled
                value={user?.name || ''}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
              />
              <p className="mt-1 text-[11px] text-slate-400">{t('profile.nameLockedDesc')}</p>
            </div>

            {/* Email (locked) */}
            <div>
              <label htmlFor="prof-email" className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {t('profile.registeredEmail')}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Lock className="h-3 w-3" /> {t('profile.locked')}
                </span>
              </label>
              <input
                id="prof-email"
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
              />
              <p className="mt-1 text-[11px] text-slate-400">{t('profile.emailLockedDesc')}</p>
            </div>
          </div>

          {/* Editable Credentials Form */}
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('profile.editableCredentials')}</h2>
              <span className="text-[11px] text-slate-500">{t('profile.cooldown30Days')}</span>
            </div>

            {/* Mobile Number */}
            <div>
              <label htmlFor="prof-mobile" className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {t('profile.mobileNumber')}
                </span>
                {isMobileLocked && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-400">
                    <Clock className="h-3 w-3" /> {t('profile.cooldownActive')}
                  </span>
                )}
              </label>
              <input
                id="prof-mobile"
                type="tel"
                disabled={isMobileLocked || isSubmitting}
                value={form.mobile}
                onChange={(e) => handleFieldChange('mobile', e.target.value)}
                className={`w-full rounded-xl border bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                  fieldErrors.mobile ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                } disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-400`}
              />
              {isMobileLocked ? (
                <p className="mt-1 text-[11px] text-amber-400" data-testid="mobile-cooldown-msg">
                  {formatCooldownMessage(cooldowns?.mobileAvailableAt)}
                </p>
              ) : (
                fieldErrors.mobile && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.mobile}</p>
              )}
            </div>

            {/* Free Fire ID */}
            <div>
              <label htmlFor="prof-ffId" className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <Gamepad2 className="h-3.5 w-3.5 text-slate-400" />
                  {t('profile.freeFireIdUid')}
                </span>
                {isFfIdLocked && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-400">
                    <Clock className="h-3 w-3" /> {t('profile.cooldownActive')}
                  </span>
                )}
              </label>
              <input
                id="prof-ffId"
                type="text"
                disabled={isFfIdLocked || isSubmitting}
                value={form.ffId}
                onChange={(e) => handleFieldChange('ffId', e.target.value)}
                className={`w-full rounded-xl border bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                  fieldErrors.ffId ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                } disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-400`}
              />
              {isFfIdLocked ? (
                <p className="mt-1 text-[11px] text-amber-400" data-testid="ffId-cooldown-msg">
                  {formatCooldownMessage(cooldowns?.ffIdAvailableAt)}
                </p>
              ) : (
                fieldErrors.ffId && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.ffId}</p>
              )}
            </div>

            {/* Free Fire In-Game Name */}
            <div>
              <label htmlFor="prof-ffName" className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <Gamepad2 className="h-3.5 w-3.5 text-slate-400" />
                  {t('profile.freeFireInGameName')}
                </span>
                {isFfNameLocked && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-400">
                    <Clock className="h-3 w-3" /> {t('profile.cooldownActive')}
                  </span>
                )}
              </label>
              <input
                id="prof-ffName"
                type="text"
                disabled={isFfNameLocked || isSubmitting}
                value={form.ffName}
                onChange={(e) => handleFieldChange('ffName', e.target.value)}
                className={`w-full rounded-xl border bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                  fieldErrors.ffName ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                } disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-400`}
              />
              {isFfNameLocked ? (
                <p className="mt-1 text-[11px] text-amber-400" data-testid="ffName-cooldown-msg">
                  {formatCooldownMessage(cooldowns?.ffNameAvailableAt)}
                </p>
              ) : (
                fieldErrors.ffName && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.ffName}</p>
              )}
            </div>

            {/* UPI ID */}
            <div>
              <label htmlFor="prof-upiId" className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                  {t('profile.upiId')}
                </span>
                {isUpiLocked && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-400">
                    <Clock className="h-3 w-3" /> {t('profile.cooldownActive')}
                  </span>
                )}
              </label>
              <input
                id="prof-upiId"
                type="text"
                disabled={isUpiLocked || isSubmitting}
                value={form.upiId}
                onChange={(e) => handleFieldChange('upiId', e.target.value)}
                className={`w-full rounded-xl border bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                  fieldErrors.upiId ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                } disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-400`}
              />
              {isUpiLocked ? (
                <p className="mt-1 text-[11px] text-amber-400" data-testid="upiId-cooldown-msg">
                  {formatCooldownMessage(cooldowns?.upiIdAvailableAt)}
                </p>
              ) : (
                fieldErrors.upiId && <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.upiId}</p>
              )}
              <p className="mt-1.5 text-[11px] text-slate-400 leading-normal">
                {t('profile.upiNotice48h')}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="save-profile-btn"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 shadow-md shadow-emerald-500/20"
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? t('profile.savingProfileBtn') : t('profile.saveProfileBtn')}
              </button>
              <button
                type="button"
                onClick={() => setMode('view')}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-800 bg-slate-950/80 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
