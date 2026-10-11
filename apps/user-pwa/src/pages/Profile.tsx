import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { updateProfile } from '../api/user.js';
import { formatCooldownMessage } from '../utils/formatters.js';
import { validateMobile, validateFfId, validateFfName, validateUpiId } from '../utils/validation.js';
import { ApiError } from '../api/client.js';
import type { UpdateProfilePayload } from '../api/types.js';
import {
  User,
  Mail,
  Phone,
  Gamepad2,
  CreditCard,
  Calendar,
  Share2,
  Lock,
  LogOut,
  Save,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Clock,
} from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, cooldowns, refreshProfile, logout } = useAuth();

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
  const [copiedReferral, setCopiedReferral] = useState(false);

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
      setGeneralError('No changes detected.');
      return;
    }

    // Validate changed fields
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
      setSuccessMessage('Profile updated successfully!');
    } catch (err: any) {
      if (err instanceof ApiError) {
        // Show server errors next to the field they belong to
        if (err.code === 'MOBILE_EXISTS') {
          setFieldErrors((prev) => ({ ...prev, mobile: 'This mobile number is already in use.' }));
        } else if (err.code === 'FF_ID_EXISTS') {
          setFieldErrors((prev) => ({ ...prev, ffId: 'This Free Fire ID is already registered.' }));
        } else if (err.code === 'UPI_EXISTS') {
          setFieldErrors((prev) => ({ ...prev, upiId: 'This UPI ID is already registered to another account.' }));
        } else if (err.code === 'IN_ACTIVE_MATCH') {
          const matchMsg = 'Cannot change Free Fire details while enrolled in an upcoming or live match.';
          setFieldErrors((prev) => ({
            ...prev,
            ffId: payload.ffId ? matchMsg : prev.ffId,
            ffName: payload.ffName ? matchMsg : prev.ffName,
          }));
        } else if (err.code === 'FIELD_COOLDOWN') {
          setGeneralError('One or more fields are currently under a 30-day cooldown.');
        } else if (err.details && typeof err.details === 'object') {
          // Map backend validation error details if present
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

  return (
    <div className="space-y-6" data-testid="profile-screen">
      {/* Profile Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-black text-slate-100">Player Profile</h1>
          <p className="text-xs text-slate-400">Manage account information & Free Fire credentials</p>
        </div>
        <button
          onClick={logout}
          data-testid="logout-button"
          className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-400 transition-all hover:bg-rose-500/20 active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>

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

      {/* Locked / Read-Only Fields Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Non-Editable Details</h2>

        {/* Name (Locked) */}
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Full Name
            </span>
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Lock className="h-3 w-3" /> Locked
            </span>
          </div>
          <input
            type="text"
            readOnly
            disabled
            value={user?.name || ''}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
          />
          <p className="mt-1 text-[11px] text-slate-500">Name cannot be changed after registration.</p>
        </div>

        {/* Email (Locked) */}
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Registered Email
            </span>
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Lock className="h-3 w-3" /> Locked
            </span>
          </div>
          <input
            type="text"
            readOnly
            disabled
            value={user?.email || ''}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
          />
          <p className="mt-1 text-[11px] text-slate-500">Email is permanently linked to your account.</p>
        </div>

        {/* Date of Birth (Locked) */}
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Date of Birth
            </span>
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Lock className="h-3 w-3" /> 18+ Verified
            </span>
          </div>
          <input
            type="text"
            readOnly
            disabled
            value={user?.dateOfBirth ? user.dateOfBirth.split('T')[0] : ''}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
          />
        </div>

        {/* Referral Code */}
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Share2 className="h-3.5 w-3.5" />
              Your Referral Code
            </span>
            <span className="text-[11px] text-emerald-400">Earn Cashback</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={user?.referralCode || ''}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-sm font-bold text-emerald-400 select-all"
            />
            <button
              type="button"
              onClick={handleCopyReferral}
              className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700"
            >
              <Copy className="h-4 w-4" />
              {copiedReferral ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* Editable Fields Section (Subject to 30-Day Cooldown) */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Editable Credentials</h2>
          <span className="text-[11px] text-slate-400">Cooldown: 30 days per change</span>
        </div>

        {/* Mobile */}
        <div>
          <label htmlFor="prof-mobile" className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              Mobile Number
            </span>
            {isMobileLocked && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400">
                <Clock className="h-3 w-3" /> Cooldown Active
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
              Free Fire ID (UID)
            </span>
            {isFfIdLocked && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400">
                <Clock className="h-3 w-3" /> Cooldown Active
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

        {/* Free Fire IGN */}
        <div>
          <label htmlFor="prof-ffName" className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
            <span className="flex items-center gap-1.5">
              <Gamepad2 className="h-3.5 w-3.5 text-slate-400" />
              Free Fire In-Game Name
            </span>
            {isFfNameLocked && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400">
                <Clock className="h-3 w-3" /> Cooldown Active
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
              UPI ID
            </span>
            {isUpiLocked && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400">
                <Clock className="h-3 w-3" /> Cooldown Active
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
            Note: Changing your UPI ID will pause withdrawals for 48 hours for account security.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSubmitting ? 'Saving Changes...' : 'Save Profile Changes'}
        </button>
      </form>
    </div>
  );
};
