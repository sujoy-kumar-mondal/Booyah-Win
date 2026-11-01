import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { updateProfile, uploadAvatar } from '../api/user.js';
import { pickNativeImage, CameraSource } from '../utils/nativeCamera.js';
import { Capacitor } from '@capacitor/core';
import { resolveImageUrl } from '../utils/imageUrl.js';
import { formatCooldownMessage, formatDateOfBirth, formatUserId } from '../utils/formatters.js';
import { validateName, validateMobile, validateUpiId } from '../utils/validation.js';
import { ApiError } from '../api/client.js';
import type { UpdateProfilePayload } from '../api/types.js';
import { useTranslation } from '../i18n/LanguageContext.js';
import {
  ArrowLeft,
  Camera,
  Edit3,
  Loader2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  X,
} from 'lucide-react';

export const MyProfile: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, cooldowns, refreshProfile } = useAuth();

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const [form, setForm] = useState({
    name: user?.name || '',
    mobile: user?.mobile ? (user.mobile.startsWith('+91') ? user.mobile : `+91 ${user.mobile}`) : '',
    upiId: user?.upiId || '',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarUrl]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        mobile: user.mobile ? (user.mobile.startsWith('+91') ? user.mobile : `+91 ${user.mobile}`) : '',
        upiId: user.upiId || '',
      });
    }
  }, [user]);

  // Cooldown status checks (30 days)
  const isNameLocked = !!cooldowns?.nameAvailableAt && new Date(cooldowns.nameAvailableAt) > new Date();
  const isMobileLocked = !!cooldowns?.mobileAvailableAt && new Date(cooldowns.mobileAvailableAt) > new Date();
  const isUpiLocked = !!cooldowns?.upiIdAvailableAt && new Date(cooldowns.upiIdAvailableAt) > new Date();

  const handleFieldChange = (field: 'name' | 'mobile' | 'upiId', val: string) => {
    setForm((prev) => ({ ...prev, [field]: val }));
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
    setGeneralError(null);
  };

  const handleStartEdit = () => {
    if (user) {
      setForm({
        name: user.name || '',
        mobile: user.mobile ? (user.mobile.startsWith('+91') ? user.mobile : `+91 ${user.mobile}`) : '',
        upiId: user.upiId || '',
      });
    }
    setFieldErrors({});
    setGeneralError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (user) {
      setForm({
        name: user.name || '',
        mobile: user.mobile ? (user.mobile.startsWith('+91') ? user.mobile : `+91 ${user.mobile}`) : '',
        upiId: user.upiId || '',
      });
    }
    setFieldErrors({});
    setGeneralError(null);
    setIsEditing(false);
  };

  const processAvatarFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setGeneralError(t('profile.photoMax2Mb'));
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setGeneralError(t('profile.photoValidFormat'));
      return;
    }

    setGeneralError(null);
    setIsUploadingPhoto(true);

    try {
      await uploadAvatar(file);
      await refreshProfile();
      setSuccessMessage(t('profile.photoSuccess'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setGeneralError(err instanceof ApiError ? err.message : t('profile.updateFailed'));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleTriggerAvatar = () => {
    if (isUploadingPhoto) return;
    setShowAvatarModal(true);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await processAvatarFile(file);
  };

  const handleSave = async () => {
    setGeneralError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    const payload: UpdateProfilePayload = {};
    const trimmedName = form.name.trim();
    // Normalize mobile: remove leading "+91" and any whitespace/dashes
    const rawMobile = form.mobile.replace(/^\+91\s*/, '').replace(/\s+/g, '').trim();
    const trimmedUpi = form.upiId.trim();

    if (user?.name && trimmedName !== user.name.trim()) {
      payload.name = trimmedName;
    }
    if (user?.mobile && rawMobile !== user.mobile.trim()) {
      payload.mobile = rawMobile;
    }
    if (user?.upiId && trimmedUpi.toLowerCase() !== user.upiId.trim().toLowerCase()) {
      payload.upiId = trimmedUpi;
    }

    if (Object.keys(payload).length === 0) {
      setIsEditing(false);
      return;
    }

    // Client-side validation for changed fields
    const errors: Record<string, string> = {};
    if (payload.name) {
      const err = validateName(payload.name);
      if (err) errors.name = err;
    }
    if (payload.mobile) {
      const err = validateMobile(payload.mobile);
      if (err) errors.mobile = err;
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
      setSuccessMessage(t('profile.credentialsSuccess'));
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'MOBILE_EXISTS') {
          setFieldErrors((prev) => ({ ...prev, mobile: t('validation.mobileRegistered') || 'Mobile number already registered' }));
        } else if (err.code === 'UPI_EXISTS') {
          setFieldErrors((prev) => ({ ...prev, upiId: t('validation.upiExists') || 'UPI ID already in use' }));
        } else if (err.code === 'FIELD_COOLDOWN') {
          setGeneralError(t('profile.cooldownError'));
        } else if (err.details && typeof err.details === 'object') {
          const mappedDetails: Record<string, string> = {};
          for (const [k, v] of Object.entries(err.details)) {
            mappedDetails[k] = String(v);
          }
          setFieldErrors((prev) => ({ ...prev, ...mappedDetails }));
        } else {
          setGeneralError(err.message || t('profile.updateFailed'));
        }
      } else {
        setGeneralError(t('profile.updateFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-6" data-testid="profile-screen">
      {/* Hidden File Input for Avatar Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoSelect}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        data-testid="avatar-file-input"
      />

      {/* Top Header with Back Arrow Button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/account')}
          aria-label={t('common.back')}
          data-testid="back-to-account-btn"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#121324] text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95 shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-100">{t('profile.title')}</h1>
      </div>

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

      {/* Profile Overview Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-[#121324] p-5 shadow-lg">
        <div className="flex items-center gap-4">
          {/* Avatar with purple ring & Camera upload button */}
          <div className="relative shrink-0">
            <div className="h-20 w-20 rounded-full border-2 border-violet-500/80 bg-slate-900 p-0.5 shadow-md flex items-center justify-center overflow-hidden">
              {user?.avatarUrl && !avatarError ? (
                <img
                  src={resolveImageUrl(user.avatarUrl)}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                  data-testid="user-avatar-img"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center rounded-full bg-violet-600/30 p-2.5"
                  data-testid="user-avatar-fallback"
                >
                  <img
                    src="/assets/logo_icon.png"
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleTriggerAvatar}
              disabled={isUploadingPhoto}
              data-testid="upload-avatar-btn"
              title={t('profile.changePhoto')}
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white shadow-md hover:bg-violet-500 transition active:scale-95 disabled:opacity-50 ring-2 ring-[#121324]"
            >
              {isUploadingPhoto ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* User Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2
                className="text-base font-black text-slate-100 truncate uppercase"
                data-testid="profile-user-name"
              >
                {user?.name || 'Player'}
              </h2>
              <span title={t('profile.verifiedAccount')}>
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              </span>
            </div>

            <p
              className="text-xs text-slate-400 truncate mt-1"
              data-testid="profile-user-email"
            >
              {user?.email || ''}
            </p>

            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span
                className="inline-block rounded-lg bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 text-xs font-semibold text-violet-400 font-mono"
                data-testid="profile-user-username"
              >
                @{user?.username || user?.referralCode || 'player'}
              </span>
              {user?.id && (
                <span
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-xs font-semibold text-slate-300 font-mono"
                  data-testid="profile-user-uid"
                >
                  <span className="text-slate-400">UID:</span>
                  <span className="text-emerald-400 font-bold">{formatUserId(user.id)}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION: ACCOUNT CREDENTIALS ──────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#121324] p-4 space-y-3 shadow-sm">
        {/* Section Header with Actions */}
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">
            {t('profile.credentialsTitle')}
          </h2>

          {isEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
                data-testid="cancel-edit-btn"
                className="rounded-xl border border-slate-700 bg-[#3f3f46]/90 hover:bg-[#52525b] px-3.5 py-1.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50"
              >
                {t('profile.cancelBtn')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting}
                data-testid="save-profile-btn"
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-bold text-white shadow-md transition active:scale-95 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>{t('profile.saveBtn')}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartEdit}
              data-testid="edit-profile-btn"
              className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-600/20 px-3.5 py-1.5 text-xs font-bold text-violet-300 hover:bg-violet-600/30 transition active:scale-95"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{t('profile.editBtn')}</span>
            </button>
          )}
        </div>

        {/* 4 Stacked Cards */}
        <div className="space-y-3 pt-1">
          {/* 1. NAME */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0c0d18] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('profile.fullNameLabel')}
              </span>
              {isNameLocked && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400">
                  <Clock className="h-3 w-3" />
                  {formatCooldownMessage(cooldowns?.nameAvailableAt)}
                </span>
              )}
            </div>

            {isEditing ? (
              <div>
                <input
                  type="text"
                  id="prof-name"
                  value={form.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  disabled={isNameLocked || isSubmitting}
                  data-testid="profile-input-name"
                  className={`w-full rounded-xl border bg-slate-950/80 px-3.5 py-2.5 text-sm font-semibold text-slate-100 placeholder-slate-500 focus:outline-none transition ${
                    fieldErrors.name
                      ? 'border-rose-500/80 focus:border-rose-500'
                      : 'border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  placeholder="Enter full name"
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-[11px] font-medium text-rose-400">{fieldErrors.name}</p>
                )}
              </div>
            ) : (
              <div
                className="text-sm font-bold text-slate-100"
                data-testid="profile-view-name"
              >
                {user?.name || '—'}
              </div>
            )}
          </div>

          {/* 2. MOBILE NUMBER */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0c0d18] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('profile.mobileLabel')}
              </span>
              {isMobileLocked && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400">
                  <Clock className="h-3 w-3" />
                  {formatCooldownMessage(cooldowns?.mobileAvailableAt)}
                </span>
              )}
            </div>

            {isEditing ? (
              <div>
                <input
                  type="text"
                  id="prof-mobile"
                  value={form.mobile}
                  onChange={(e) => handleFieldChange('mobile', e.target.value)}
                  disabled={isMobileLocked || isSubmitting}
                  data-testid="profile-input-mobile"
                  className={`w-full rounded-xl border bg-slate-950/80 px-3.5 py-2.5 text-sm font-semibold text-slate-100 placeholder-slate-500 focus:outline-none transition ${
                    fieldErrors.mobile
                      ? 'border-rose-500/80 focus:border-rose-500'
                      : 'border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  placeholder="+91 9876543210"
                />
                {fieldErrors.mobile && (
                  <p className="mt-1 text-[11px] font-medium text-rose-400">{fieldErrors.mobile}</p>
                )}
              </div>
            ) : (
              <div
                className="text-sm font-bold text-slate-100"
                data-testid="profile-view-mobile"
              >
                {user?.mobile ? (user.mobile.startsWith('+91') ? user.mobile : `+91 ${user.mobile}`) : '—'}
              </div>
            )}
          </div>

          {/* 3. PAYOUT UPI ID */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0c0d18] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('profile.upiLabel')}
              </span>
              {isUpiLocked && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400">
                  <Clock className="h-3 w-3" />
                  {formatCooldownMessage(cooldowns?.upiIdAvailableAt)}
                </span>
              )}
            </div>

            {isEditing ? (
              <div>
                <input
                  type="text"
                  id="prof-upiId"
                  value={form.upiId}
                  onChange={(e) => handleFieldChange('upiId', e.target.value)}
                  disabled={isUpiLocked || isSubmitting}
                  data-testid="profile-input-upiId"
                  className={`w-full rounded-xl border bg-slate-950/80 px-3.5 py-2.5 text-sm font-semibold text-slate-100 font-mono placeholder-slate-500 focus:outline-none transition ${
                    fieldErrors.upiId
                      ? 'border-rose-500/80 focus:border-rose-500'
                      : 'border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  placeholder="username@bank"
                />
                {fieldErrors.upiId && (
                  <p className="mt-1 text-[11px] font-medium text-rose-400">{fieldErrors.upiId}</p>
                )}
              </div>
            ) : (
              <div
                className="text-sm font-bold text-slate-100 font-mono"
                data-testid="profile-view-upiId"
              >
                {user?.upiId || '—'}
              </div>
            )}

            {/* 24-hour withdrawal lock information on UPI ID change */}
            <div
              className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300"
              data-testid="upi-withdrawal-lock-notice"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
              <span>{t('profile.upiNotice48h')}</span>
            </div>
          </div>

          {/* 4. DATE OF BIRTH */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0c0d18] p-3.5 space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t('profile.dobLabel')}
            </span>
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-bold text-slate-100"
                data-testid="profile-view-dob"
              >
                {user?.dateOfBirth ? formatDateOfBirth(user.dateOfBirth) : '—'}
              </span>
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                {t('profile.verified18')}
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Sleek Dark-Themed Avatar Selection Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-[#121320] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Camera className="h-5 w-5 text-violet-400" />
                {t('profile.changePhoto') || 'Change Profile Photo'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* Option 1: Choose from Gallery / Photos */}
              <button
                type="button"
                onClick={async () => {
                  setShowAvatarModal(false);
                  if (Capacitor.isNativePlatform()) {
                    const file = await pickNativeImage({ source: CameraSource.Photos, fileNamePrefix: 'avatar', quality: 85 });
                    if (file) await processAvatarFile(file);
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-violet-950/40 border border-slate-800 hover:border-violet-600/50 text-slate-200 font-semibold transition group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 group-hover:scale-105 transition">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-100">Choose from Gallery</p>
                  <p className="text-[11px] text-slate-400">Select an existing photo from device</p>
                </div>
              </button>

              {/* Option 2: Take Photo with Camera (native only) */}
              {Capacitor.isNativePlatform() && (
                <button
                  type="button"
                  onClick={async () => {
                    setShowAvatarModal(false);
                    const file = await pickNativeImage({ source: CameraSource.Camera, fileNamePrefix: 'avatar', quality: 85 });
                    if (file) await processAvatarFile(file);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-violet-950/40 border border-slate-800 hover:border-violet-600/50 text-slate-200 font-semibold transition group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400 group-hover:scale-105 transition">
                    <Camera className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-100">Take Photo</p>
                    <p className="text-[11px] text-slate-400">Capture a new picture using camera</p>
                  </div>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAvatarModal(false)}
              className="w-full py-3 rounded-xl border border-slate-800 bg-slate-900/50 text-xs font-bold text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
