/**
 * Platform Settings Page (Admin Only)
 * Section 16.4
 *
 * Requirements:
 * - Constraint 6: Keep settings money values as strings, validate with a string regex,
 *   never use Number(). Min greater than max is a warning only.
 * - Constraint 10: After saving settings, refetch and show what the server stored.
 *   Show the QR with referrerpolicy="no-referrer" and refetch the signed URL when it expires.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  getAdminSettings,
  updateAdminSettings,
  uploadPaymentQr,
} from '../api/admin.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import {
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  QrCode,
  Upload,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Phone,
  IndianRupee,
} from 'lucide-react';

// Strict regex for rupee amounts with optional 1-2 decimal places
const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

// Converts string money (e.g. "10.00" or "50") to integer paise for comparison without Number()
function parseMoneyToPaise(val: string): number {
  if (!val || !MONEY_REGEX.test(val.trim())) return 0;
  const parts = val.trim().split('.');
  const whole = parseInt(parts[0] || '0', 10);
  const frac = parseInt((parts[1] || '').padEnd(2, '0').slice(0, 2), 10);
  return whole * 100 + frac;
}

export const Settings: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const saveLockRef = useRef(false);

  // Form state - money values strictly kept as strings
  const [minDeposit, setMinDeposit] = useState('10.00');
  const [maxDeposit, setMaxDeposit] = useState('5000.00');
  const [adminApprovalThreshold, setAdminApprovalThreshold] = useState('2000.00');
  const [supportName, setSupportName] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportHours, setSupportHours] = useState('10:00 AM - 10:00 PM IST');
  const [paymentUpiId, setPaymentUpiId] = useState('');
  const [paymentQrUrl, setPaymentQrUrl] = useState('');
  const [paymentQrKey, setPaymentQrKey] = useState('');

  // Local QR upload preview URL & cleanup ref
  const [localQrPreviewUrl, setLocalQrPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Feedback states
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Fetch settings from server
  const fetchSettings = async () => {
    setIsLoading(true);
    setFormError(null);
    try {
      const data = await getAdminSettings();
      const s = data.settings || {};
      if (s.min_deposit !== undefined) setMinDeposit(s.min_deposit);
      if (s.max_deposit !== undefined) setMaxDeposit(s.max_deposit);
      if (s.admin_approval_threshold !== undefined) setAdminApprovalThreshold(s.admin_approval_threshold);
      if (s.support_name !== undefined) setSupportName(s.support_name);
      if (s.support_phone !== undefined) setSupportPhone(s.support_phone);
      if (s.support_email !== undefined) setSupportEmail(s.support_email);
      if (s.support_hours !== undefined) setSupportHours(s.support_hours);
      if (s.payment_upi_id !== undefined) setPaymentUpiId(s.payment_upi_id);
      if (s.payment_qr_url !== undefined && s.payment_qr_url.trim()) {
        setPaymentQrUrl(s.payment_qr_url.trim());
      } else if (!s.payment_qr_key) {
        setPaymentQrUrl('');
      }
      if (s.payment_qr_key !== undefined) setPaymentQrKey(s.payment_qr_key);
    } catch (err) {
      setFormError(getFriendlyErrorMessage(err, 'settings'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();

    return () => {
      // Cleanup any active object URL
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  // Check min > max warning dynamically without Number()
  useEffect(() => {
    if (MONEY_REGEX.test(minDeposit.trim()) && MONEY_REGEX.test(maxDeposit.trim())) {
      const minPaise = parseMoneyToPaise(minDeposit);
      const maxPaise = parseMoneyToPaise(maxDeposit);
      if (minPaise > maxPaise) {
        setWarningMessage('Warning: Minimum deposit is currently greater than maximum deposit.');
      } else {
        setWarningMessage(null);
      }
    } else {
      setWarningMessage(null);
    }
  }, [minDeposit, maxDeposit]);

  // Handle Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLockRef.current || isSaving) return;

    setFormError(null);
    setSuccessMessage(null);

    // Constraint 6: Validate money values using regex, never use Number()
    if (!MONEY_REGEX.test(minDeposit.trim())) {
      setFormError('Minimum deposit must be a valid numeric amount (e.g. 10.00).');
      return;
    }
    if (!MONEY_REGEX.test(maxDeposit.trim())) {
      setFormError('Maximum deposit must be a valid numeric amount (e.g. 5000.00).');
      return;
    }
    if (!MONEY_REGEX.test(adminApprovalThreshold.trim())) {
      setFormError('Approval threshold must be a valid numeric amount (e.g. 2000.00).');
      return;
    }

    saveLockRef.current = true;
    setIsSaving(true);

    try {
      const payload: Record<string, string> = {
        min_deposit: minDeposit.trim(),
        max_deposit: maxDeposit.trim(),
        admin_approval_threshold: adminApprovalThreshold.trim(),
        support_name: supportName.trim(),
        support_phone: supportPhone.trim(),
        support_email: supportEmail.trim(),
        support_hours: supportHours.trim(),
        payment_upi_id: paymentUpiId.trim(),
      };

      await updateAdminSettings(payload);

      // Constraint 10: After saving settings, refetch and show what the server stored
      await fetchSettings();

      setSuccessMessage('Platform settings saved and verified with server.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setFormError(getFriendlyErrorMessage(err, 'settings'));
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  // Handle QR File Selection & Upload
  const handleQrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size <= 2MB
    if (file.size > 2 * 1024 * 1024) {
      setFormError('Payment QR code image must not exceed 2MB.');
      return;
    }

    // Revoke old object URL
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const newPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = newPreviewUrl;
    setLocalQrPreviewUrl(newPreviewUrl);

    setIsUploadingQr(true);
    setFormError(null);

    try {
      const res = await uploadPaymentQr(file);
      setPaymentQrKey(res.paymentQrKey);
      setPaymentQrUrl(res.qrUrl);
      setSuccessMessage('Payment QR code uploaded successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setFormError(getFriendlyErrorMessage(err, 'settings'));
    } finally {
      setIsUploadingQr(false);
      // Clean up object URL after upload attempt completes
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
        setLocalQrPreviewUrl(null);
      }
    }
  };

  // Constraint 10: If signed URL expires or fails to load, refetch from server
  const qrLoadRetryRef = useRef(0);
  const handleQrLoadError = () => {
    if (qrLoadRetryRef.current < 2) {
      qrLoadRetryRef.current += 1;
      fetchSettings();
    }
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <SettingsIcon className="h-6 w-6 text-emerald-400" />
            Platform Settings
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Configure financial thresholds, customer support channels, and payment QR configurations.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSettings}
          disabled={isLoading}
          data-testid="refresh-settings-btn"
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          Refetch from Server
        </button>
      </div>

      {successMessage && (
        <div
          data-testid="settings-success-banner"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2.5"
        >
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {warningMessage && (
        <div
          data-testid="settings-warning-banner"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center gap-2.5"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>{warningMessage}</span>
        </div>
      )}

      {formError && (
        <div
          data-testid="settings-error-banner"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-center gap-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{formError}</span>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-xs text-slate-500" data-testid="settings-loading-state">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
          Loading platform settings...
        </div>
      ) : (
        <form onSubmit={handleSaveSettings} className="space-y-6" data-testid="settings-form">
          {/* Financial Limits Section */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-emerald-400" />
              Deposit & Approval Thresholds
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Min Deposit (₹)
                </label>
                <input
                  type="text"
                  required
                  value={minDeposit}
                  onChange={(e) => setMinDeposit(e.target.value)}
                  placeholder="e.g. 10.00"
                  data-testid="settings-min-deposit-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Max Deposit (₹)
                </label>
                <input
                  type="text"
                  required
                  value={maxDeposit}
                  onChange={(e) => setMaxDeposit(e.target.value)}
                  placeholder="e.g. 5000.00"
                  data-testid="settings-max-deposit-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Auto Approval Threshold (₹)
                </label>
                <input
                  type="text"
                  required
                  value={adminApprovalThreshold}
                  onChange={(e) => setAdminApprovalThreshold(e.target.value)}
                  placeholder="e.g. 2000.00"
                  data-testid="settings-threshold-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Customer Support Info Section */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Phone className="h-4 w-4 text-emerald-400" />
              Customer Support Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Support Team Name</label>
                <input
                  type="text"
                  value={supportName}
                  onChange={(e) => setSupportName(e.target.value)}
                  placeholder="e.g. Booyah Support Team"
                  data-testid="settings-support-name-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Support Hours</label>
                <input
                  type="text"
                  value={supportHours}
                  onChange={(e) => setSupportHours(e.target.value)}
                  placeholder="e.g. 10:00 AM - 10:00 PM IST"
                  data-testid="settings-support-hours-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Support Phone / WhatsApp</label>
                <input
                  type="text"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  data-testid="settings-support-phone-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Support Email</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="e.g. support@booyah.win"
                  data-testid="settings-support-email-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Payment & QR Section */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <QrCode className="h-4 w-4 text-emerald-400" />
              Payment Gateway & QR Code
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Payment UPI ID
                  </label>
                  <input
                    type="text"
                    value={paymentUpiId}
                    onChange={(e) => setPaymentUpiId(e.target.value)}
                    placeholder="e.g. booyahwin@upi"
                    data-testid="settings-payment-upi-input"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Upload New Payment QR (Max 2MB)
                  </label>
                  <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 cursor-pointer hover:border-emerald-500 transition-colors">
                    <Upload className="h-4 w-4 text-slate-400" />
                    <span className="text-xs text-slate-300 font-medium">
                      {isUploadingQr ? 'Uploading QR image...' : 'Choose QR image file'}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleQrFileChange}
                      disabled={isUploadingQr}
                      data-testid="settings-qr-upload-input"
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* QR Image Preview */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Active Payment QR
                </span>
                {localQrPreviewUrl || paymentQrUrl ? (
                  <img
                    src={localQrPreviewUrl || paymentQrUrl}
                    alt="Payment QR Code"
                    referrerPolicy="no-referrer"
                    onError={handleQrLoadError}
                    data-testid="settings-qr-image"
                    className="h-44 w-44 rounded-lg object-contain bg-white p-2 border border-slate-800 shadow"
                  />
                ) : (
                  <div
                    data-testid="settings-no-qr-placeholder"
                    className="flex h-44 w-44 flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 text-slate-600 text-xs text-center p-4"
                  >
                    <QrCode className="h-10 w-10 mb-2 opacity-30" />
                    No payment QR uploaded
                  </div>
                )}
                {paymentQrKey && (
                  <span className="text-[10px] font-mono text-slate-500 truncate max-w-xs block">
                    Key: {paymentQrKey}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              data-testid="save-settings-btn"
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving Settings...' : 'Save & Verify Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
