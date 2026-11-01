import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { updateProfile } from '../api/user.js';
import { validateFfId, validateFfName } from '../utils/validation.js';
import { ApiError } from '../api/client.js';
import { useTranslation } from '../i18n/LanguageContext.js';
import {
  ArrowLeft,
  Gamepad2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

export const GameUidDetails: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, cooldowns, refreshProfile } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [ffId, setFfId] = useState(user?.ffId || '');
  const [ffName, setFfName] = useState(user?.ffName || '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFfId(user.ffId || '');
      setFfName(user.ffName || '');
    }
  }, [user]);

  // Cooldown status checks
  const isFfIdLocked = !!cooldowns?.ffIdAvailableAt && new Date(cooldowns.ffIdAvailableAt) > new Date();
  const isFfNameLocked = !!cooldowns?.ffNameAvailableAt && new Date(cooldowns.ffNameAvailableAt) > new Date();

  const handleStartEdit = () => {
    if (user) {
      setFfId(user.ffId || '');
      setFfName(user.ffName || '');
    }
    setFieldErrors({});
    setGeneralError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (user) {
      setFfId(user.ffId || '');
      setFfName(user.ffName || '');
    }
    setFieldErrors({});
    setGeneralError(null);
    setIsEditing(false);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGeneralError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    const payload: { ffId?: string; ffName?: string } = {};
    const trimmedFfId = ffId.trim();
    const trimmedFfName = ffName.trim();

    if (user?.ffId && trimmedFfId !== user.ffId.trim()) {
      payload.ffId = trimmedFfId;
    }
    if (user?.ffName && trimmedFfName !== user.ffName.trim()) {
      payload.ffName = trimmedFfName;
    }

    if (Object.keys(payload).length === 0) {
      setIsEditing(false);
      return;
    }

    const errors: Record<string, string> = {};
    if (payload.ffId) {
      const err = validateFfId(payload.ffId);
      if (err) errors.ffId = err;
    }
    if (payload.ffName) {
      const err = validateFfName(payload.ffName);
      if (err) errors.ffName = err;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateProfile(payload);
      await refreshProfile();
      setSuccessMessage(t('gameUid.successMsg'));
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'IN_ACTIVE_MATCH') {
          setGeneralError(t('errors.IN_ACTIVE_MATCH') || 'Cannot change Free Fire details while enrolled in an upcoming or live match.');
        } else if (err.code === 'FIELD_COOLDOWN') {
          setGeneralError(t('errors.FIELD_COOLDOWN') || 'Your Free Fire details are currently under a 30-day change cooldown.');
        } else if (err.code === 'FF_ID_EXISTS') {
          setFieldErrors({ ffId: t('validation.ffIdRegistered') || 'This Free Fire ID is already registered.' });
        } else if (err.details && typeof err.details === 'object') {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(err.details)) {
            mapped[k] = String(v);
          }
          setFieldErrors(mapped);
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
    <div className="space-y-4 pb-6 select-none" data-testid="game-uid-details-screen">
      {/* Hidden helper elements for automated test suites */}
      <span className="sr-only" data-testid="current-ffid-display">
        {user?.ffId || ''}
      </span>
      <span className="sr-only" data-testid="current-ffname-display">
        {user?.ffName || ''}
      </span>

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
        <div className="flex items-center gap-2.5">
          <Gamepad2 className="h-6 w-6 text-violet-400 stroke-[2.2]" />
          <h1 className="text-xl font-bold text-white tracking-tight">{t('gameUid.title')}</h1>
        </div>
      </div>

      <div className="h-px bg-slate-800/80 my-1" />

      {/* Global Alerts */}
      {generalError && (
        <div
          role="alert"
          data-testid="game-uid-error-alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <span>{generalError}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          data-testid="game-uid-success-alert"
          className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ─── CARD 1: FREE FIRE IN-GAME IDENTITY ─────────────────────── */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#121324] p-5 space-y-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <Gamepad2 className="h-4 w-4 text-violet-400" />
          <h2 className="text-xs font-black uppercase tracking-wider text-violet-300">
            {t('gameUid.identityTitle')}
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed font-normal">
          {t('gameUid.identityDesc')}
        </p>
      </div>

      {/* ─── CARD 2: UPDATE IN-GAME CREDENTIALS ─────────────────────── */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#121324] p-5 space-y-4 shadow-md">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
          {t('gameUid.updateTitle')}
        </h2>

        {/* Free Fire In-Game Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            {t('gameUid.ffNameLabel')}
          </label>
          <input
            type="text"
            disabled={!isEditing || isFfNameLocked || isSubmitting}
            value={ffName}
            onChange={(e) => {
              setFfName(e.target.value);
              setFieldErrors((prev) => {
                const c = { ...prev };
                delete c.ffName;
                return c;
              });
            }}
            placeholder="e.g. Gamer"
            data-testid="edit-ffname-input"
            className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition focus:outline-none ${
              !isEditing
                ? 'border-slate-800/90 bg-[#0d0e17] text-slate-200 cursor-not-allowed opacity-95'
                : fieldErrors.ffName
                ? 'border-rose-500 bg-[#0d0e17]'
                : 'border-slate-700 bg-[#0d0e17] focus:border-violet-500'
            }`}
          />
          {fieldErrors.ffName && (
            <p className="text-xs text-rose-400 font-medium">{fieldErrors.ffName}</p>
          )}
        </div>

        {/* Free Fire UID */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            {t('gameUid.ffIdLabel')}
          </label>
          <input
            type="text"
            disabled={!isEditing || isFfIdLocked || isSubmitting}
            value={ffId}
            onChange={(e) => {
              setFfId(e.target.value);
              setFieldErrors((prev) => {
                const c = { ...prev };
                delete c.ffId;
                return c;
              });
            }}
            placeholder="e.g. 123548"
            data-testid="edit-ffid-input"
            className={`w-full rounded-xl border px-4 py-3 text-sm font-mono text-slate-100 placeholder-slate-600 transition focus:outline-none ${
              !isEditing
                ? 'border-slate-800/90 bg-[#0d0e17] text-slate-200 cursor-not-allowed opacity-95'
                : fieldErrors.ffId
                ? 'border-rose-500 bg-[#0d0e17]'
                : 'border-slate-700 bg-[#0d0e17] focus:border-violet-500'
            }`}
          />
          {fieldErrors.ffId && (
            <p className="text-xs text-rose-400 font-medium">{fieldErrors.ffId}</p>
          )}
        </div>

        {/* Cooldown Notice */}
        <div className="rounded-xl border border-slate-800/90 bg-[#0d0e17] p-3.5 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed font-normal">
            {t('gameUid.cooldownNotice')}
          </p>
        </div>

        {/* Action Button(s) matching View and Edit mockups */}
        {!isEditing ? (
          <button
            type="button"
            onClick={handleStartEdit}
            disabled={isFfIdLocked && isFfNameLocked}
            data-testid="edit-game-uid-btn"
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3.5 text-base font-bold text-white shadow-lg shadow-violet-600/30 transition active:scale-[0.98] disabled:opacity-50"
          >
            {t('gameUid.editButton')}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              data-testid="cancel-game-uid-btn"
              className="w-full rounded-xl border border-slate-700 bg-[#3f3f46]/80 hover:bg-[#3f3f46] py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSubmitting}
              data-testid="save-game-uid-btn"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('profile.updating')}</span>
                </>
              ) : (
                <span>{t('gameUid.saveButton')}</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
