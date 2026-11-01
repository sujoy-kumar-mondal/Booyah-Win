/**
 * Platform Settings Page (Admin Only)
 * Section 16.4 & 16.5
 *
 * Requirements:
 * - Constraint 6: Keep settings money values as strings, validate with a string regex,
 *   never use Number(). Min greater than max is a warning only.
 * - Constraint 10: After saving settings, refetch and show what the server stored.
 *   Show the QR with referrerpolicy="no-referrer" and refetch the signed URL when it expires.
 * - Maintenance Mode: Toggle, message (max 300, plain text, no control chars),
 *   maintenance_until with fixed +05:30 offset, past time warning, and confirmation modal.
 * - Per-Box Dedicated Save Buttons & Top-of-Box Error/Success Alerts:
 *   Each box card has its own dedicated Save Changes button and independently handles
 *   validation and saving. Any validation error appears at the top of that specific box.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  getAdminSettings,
  updateAdminSettings,
  uploadPaymentQr,
  uploadMatchBanner,
  deleteMatchBanner,
} from '../api/admin.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import {
  buildISTIsoString,
  isFutureIST,
  formatISTDate,
} from '../utils/formatters.js';
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
  ShieldAlert,
  FileText,
  Trash2,
  Users,
  Share2,
  Lock,
} from 'lucide-react';

const DEFAULT_INVITATION_TEXT = `Hey, Download Booyah Win - Play Free Fire Tournaments & Win Money\nJoin tournaments, show your skills and win real cash prizes!`;

// Strict regex for rupee amounts with optional 1-2 decimal places
const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;
const CONTROL_CHAR_REGEX = /[\x00-\x1F\x7F]/;
const PERCENT_REGEX = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

// Converts string money (e.g. "10.00" or "50") to integer paise for comparison without Number()
function parseMoneyToPaise(val: string): number {
  if (!val || !MONEY_REGEX.test(val.trim())) return 0;
  const parts = val.trim().split('.');
  const whole = parseInt(parts[0] || '0', 10);
  const frac = parseInt((parts[1] || '').padEnd(2, '0').slice(0, 2), 10);
  return whole * 100 + frac;
}

export function validateCashbackPercent(val: string): string | null {
  const trimmed = val.trim();
  if (!PERCENT_REGEX.test(trimmed)) {
    return 'Cashback percentage must be a number between 0 and 100 with at most 2 decimal places.';
  }
  const parts = trimmed.split('.');
  const whole = parseInt(parts[0] || '0', 10);
  let frac = 0;
  if (parts.length > 1) {
    frac = parseInt((parts[1] || '').padEnd(2, '0').slice(0, 2), 10);
  }
  const bp = whole * 100 + frac;
  if (bp < 0 || bp > 10000) {
    return 'Cashback percentage must be between 0 and 100.';
  }
  return null;
}

export const Settings: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [savingBox, setSavingBox] = useState<string | null>(null);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const saveLockRef = useRef(false);

  // Per-box error & success state
  const [boxErrors, setBoxErrors] = useState<Record<string, string | null>>({});
  const [boxSuccess, setBoxSuccess] = useState<Record<string, string | null>>({});

  // Form state - money values strictly kept as strings
  const [minDeposit, setMinDeposit] = useState('10.00');
  const [maxDeposit, setMaxDeposit] = useState('5000.00');
  const [minWithdrawal, setMinWithdrawal] = useState('50.00');
  const [maxWithdrawal, setMaxWithdrawal] = useState('10000.00');
  const [adminApprovalThreshold, setAdminApprovalThreshold] = useState('2000.00');
  const [joiningReward, setJoiningReward] = useState('0.00');
  const [referralReward, setReferralReward] = useState('5.00');
  const [supportName, setSupportName] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportHours, setSupportHours] = useState('10:00 AM - 10:00 PM IST');
  const [communityWhatsapp, setCommunityWhatsapp] = useState('');
  const [communityInstagram, setCommunityInstagram] = useState('');
  const [communityTelegram, setCommunityTelegram] = useState('');
  const [communityYoutube, setCommunityYoutube] = useState('');
  const [paymentUpiId, setPaymentUpiId] = useState('');
  const [paymentQrUrl, setPaymentQrUrl] = useState('');
  const [paymentQrKey, setPaymentQrKey] = useState('');

  // Cashback entry fee cap state
  const [cashbackMaxPercent, setCashbackMaxPercent] = useState('5');
  const [initialCashbackMaxPercent, setInitialCashbackMaxPercent] = useState('5');
  const [showCashbackModal, setShowCashbackModal] = useState(false);

  // Maintenance mode state
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [initialMaintenanceEnabled, setInitialMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    'Under scheduled maintenance. Please check back shortly.'
  );
  const [maintenanceUntil, setMaintenanceUntil] = useState('');
  const [maintenanceDate, setMaintenanceDate] = useState('');
  const [maintenanceTime, setMaintenanceTime] = useState('');
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);

  // Local QR upload preview URL & cleanup ref
  const [localQrPreviewUrl, setLocalQrPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Tournament match rules and banner state
  const [matchRulesImageUrl, setMatchRulesImageUrl] = useState('');
  const [matchRulesCsImageUrl, setMatchRulesCsImageUrl] = useState('');
  const [matchRulesLwImageUrl, setMatchRulesLwImageUrl] = useState('');
  const [matchRulesEn, setMatchRulesEn] = useState('');
  const [matchRulesBn, setMatchRulesBn] = useState('');
  const [matchRulesCsEn, setMatchRulesCsEn] = useState('');
  const [matchRulesCsBn, setMatchRulesCsBn] = useState('');
  const [matchRulesLwEn, setMatchRulesLwEn] = useState('');
  const [matchRulesLwBn, setMatchRulesLwBn] = useState('');
  const [rulesModeTab, setRulesModeTab] = useState<'battle_royale' | 'clash_squad' | 'lone_wolf'>('battle_royale');
  const [bannerModeTab, setBannerModeTab] = useState<'battle_royale' | 'clash_squad' | 'lone_wolf'>('battle_royale');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [localBannerPreviewUrl, setLocalBannerPreviewUrl] = useState<string | null>(null);
  const [localCsBannerPreviewUrl, setLocalCsBannerPreviewUrl] = useState<string | null>(null);
  const [localLwBannerPreviewUrl, setLocalLwBannerPreviewUrl] = useState<string | null>(null);
  const [bannerLoadFailed, setBannerLoadFailed] = useState(false);
  const bannerPreviewRef = useRef<string | null>(null);
  const csBannerPreviewRef = useRef<string | null>(null);
  const lwBannerPreviewRef = useRef<string | null>(null);

  // Referral invitation text state
  const [invitationText, setInvitationText] = useState(DEFAULT_INVITATION_TEXT);

  // Warning state for thresholds
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Fetch settings from server
  const fetchSettings = async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const data = await getAdminSettings();
      const s = data.settings || {};
      if (s.min_deposit !== undefined) setMinDeposit(s.min_deposit);
      if (s.max_deposit !== undefined) setMaxDeposit(s.max_deposit);
      if (s.min_withdrawal !== undefined) setMinWithdrawal(s.min_withdrawal);
      if (s.max_withdrawal !== undefined) setMaxWithdrawal(s.max_withdrawal);
      if (s.admin_approval_threshold !== undefined) setAdminApprovalThreshold(s.admin_approval_threshold);
      if (s.joining_reward !== undefined) setJoiningReward(s.joining_reward || '0.00');
      if (s.referral_reward !== undefined) setReferralReward(s.referral_reward || '5.00');
      if (s.support_name !== undefined) setSupportName(s.support_name);
      if (s.support_phone !== undefined) setSupportPhone(s.support_phone);
      if (s.support_email !== undefined) setSupportEmail(s.support_email);
      if (s.support_hours !== undefined) setSupportHours(s.support_hours);
      if (s.community_whatsapp !== undefined) setCommunityWhatsapp(s.community_whatsapp);
      if (s.community_instagram !== undefined) setCommunityInstagram(s.community_instagram);
      if (s.community_telegram !== undefined) setCommunityTelegram(s.community_telegram);
      if (s.community_youtube !== undefined) setCommunityYoutube(s.community_youtube);
      if (s.payment_upi_id !== undefined) setPaymentUpiId(s.payment_upi_id);
      if (s.payment_qr_url !== undefined && s.payment_qr_url.trim()) {
        setPaymentQrUrl(s.payment_qr_url.trim());
      } else if (!s.payment_qr_key) {
        setPaymentQrUrl('');
      }
      if (s.payment_qr_key !== undefined) setPaymentQrKey(s.payment_qr_key);

      // Maintenance settings
      if (s.maintenance_enabled !== undefined) {
        const isEnabled = s.maintenance_enabled === 'true';
        setMaintenanceEnabled(isEnabled);
        setInitialMaintenanceEnabled(isEnabled);
      }
      if (s.maintenance_message !== undefined) {
        setMaintenanceMessage(s.maintenance_message);
      }
      if (s.maintenance_until !== undefined) {
        setMaintenanceUntil(s.maintenance_until || '');
        if (s.maintenance_until && s.maintenance_until.includes('T')) {
          const parts = s.maintenance_until.split('T');
          setMaintenanceDate(parts[0] || '');
          const tPart = parts[1] || '';
          const tClean = tPart.split('+')[0].split('-')[0].split('Z')[0];
          setMaintenanceTime(tClean ? tClean.slice(0, 5) : '');
        }
      }
      if (s.cashback_max_percent !== undefined) {
        setCashbackMaxPercent(s.cashback_max_percent || '5');
        setInitialCashbackMaxPercent(s.cashback_max_percent || '5');
      }
      if (s.match_rules_image_url !== undefined) {
        setMatchRulesImageUrl(s.match_rules_image_url || '');
      }
      if (s.match_rules_cs_image_url !== undefined) {
        setMatchRulesCsImageUrl(s.match_rules_cs_image_url || '');
      }
      if (s.match_rules_lw_image_url !== undefined) {
        setMatchRulesLwImageUrl(s.match_rules_lw_image_url || '');
      }
      if (s.match_rules_en !== undefined) {
        setMatchRulesEn(s.match_rules_en || '');
      }
      if (s.match_rules_bn !== undefined) {
        setMatchRulesBn(s.match_rules_bn || '');
      }
      if (s.match_rules_cs_en !== undefined) {
        setMatchRulesCsEn(s.match_rules_cs_en || '');
      }
      if (s.match_rules_cs_bn !== undefined) {
        setMatchRulesCsBn(s.match_rules_cs_bn || '');
      }
      if (s.match_rules_lw_en !== undefined) {
        setMatchRulesLwEn(s.match_rules_lw_en || '');
      }
      if (s.match_rules_lw_bn !== undefined) {
        setMatchRulesLwBn(s.match_rules_lw_bn || '');
      }
      if (s.invitation_text !== undefined) {
        setInvitationText(s.invitation_text || DEFAULT_INVITATION_TEXT);
      }
    } catch (err) {
      setPageError(getFriendlyErrorMessage(err, 'settings'));
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
      if (bannerPreviewRef.current) {
        URL.revokeObjectURL(bannerPreviewRef.current);
      }
      if (csBannerPreviewRef.current) {
        URL.revokeObjectURL(csBannerPreviewRef.current);
      }
      if (lwBannerPreviewRef.current) {
        URL.revokeObjectURL(lwBannerPreviewRef.current);
      }
    };
  }, []);

  // Check min > max warning dynamically without Number()
  useEffect(() => {
    const warnings: string[] = [];
    if (MONEY_REGEX.test(minDeposit.trim()) && MONEY_REGEX.test(maxDeposit.trim())) {
      const minPaise = parseMoneyToPaise(minDeposit);
      const maxPaise = parseMoneyToPaise(maxDeposit);
      if (minPaise > maxPaise) {
        warnings.push('Warning: Minimum deposit is currently greater than maximum deposit.');
      }
    }
    if (MONEY_REGEX.test(minWithdrawal.trim()) && MONEY_REGEX.test(maxWithdrawal.trim())) {
      const minWPaise = parseMoneyToPaise(minWithdrawal);
      const maxWPaise = parseMoneyToPaise(maxWithdrawal);
      if (minWPaise > maxWPaise) {
        warnings.push('Warning: Minimum withdrawal is currently greater than maximum withdrawal.');
      }
    }
    setWarningMessage(warnings.length > 0 ? warnings.join(' ') : null);
  }, [minDeposit, maxDeposit, minWithdrawal, maxWithdrawal]);

  useEffect(() => {
    setBannerLoadFailed(false);
  }, [bannerModeTab, localBannerPreviewUrl, matchRulesImageUrl, localCsBannerPreviewUrl, matchRulesCsImageUrl]);

  const handleDateOrTimeChange = (newDate: string, newTime: string) => {
    setMaintenanceDate(newDate);
    setMaintenanceTime(newTime);
    if (newDate && newTime) {
      const iso = buildISTIsoString(newDate, newTime);
      setMaintenanceUntil(iso);
    } else if (!newDate && !newTime) {
      setMaintenanceUntil('');
    }
  };

  const isPastTime = maintenanceUntil ? !isFutureIST(maintenanceUntil) : false;

  // Generic executor to save a single box's settings
  const executeSaveBox = async (
    boxKey: string,
    payload: Record<string, string>,
    successMsg: string
  ) => {
    if (saveLockRef.current || savingBox) return;

    saveLockRef.current = true;
    setSavingBox(boxKey);
    setBoxErrors((prev) => ({ ...prev, [boxKey]: null }));
    setBoxSuccess((prev) => ({ ...prev, [boxKey]: null }));

    try {
      await updateAdminSettings(payload);

      // Constraint 10: After saving settings, refetch and show what the server stored
      await fetchSettings();

      setBoxSuccess((prev) => ({ ...prev, [boxKey]: successMsg }));
      setTimeout(() => {
        setBoxSuccess((prev) => ({ ...prev, [boxKey]: null }));
      }, 5000);
    } catch (err) {
      setBoxErrors((prev) => ({
        ...prev,
        [boxKey]: getFriendlyErrorMessage(err, 'settings'),
      }));
    } finally {
      saveLockRef.current = false;
      setSavingBox(null);
    }
  };

  // --- Handlers for Individual Box Saving ---

  // Box 1: Deposit & Approval Thresholds
  const handleSaveThresholds = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (saveLockRef.current || savingBox) return;

    setBoxErrors((prev) => ({ ...prev, thresholds: null }));

    // Constraint 6: Validate money values using regex, never use Number()
    if (!MONEY_REGEX.test(minDeposit.trim())) {
      setBoxErrors((prev) => ({
        ...prev,
        thresholds: 'Minimum deposit must be a valid numeric amount (e.g. 10.00).',
      }));
      return;
    }
    if (!MONEY_REGEX.test(maxDeposit.trim())) {
      setBoxErrors((prev) => ({
        ...prev,
        thresholds: 'Maximum deposit must be a valid numeric amount (e.g. 5000.00).',
      }));
      return;
    }
    if (!MONEY_REGEX.test(minWithdrawal.trim())) {
      setBoxErrors((prev) => ({
        ...prev,
        thresholds: 'Minimum withdrawal must be a valid numeric amount (e.g. 50.00).',
      }));
      return;
    }
    if (!MONEY_REGEX.test(maxWithdrawal.trim())) {
      setBoxErrors((prev) => ({
        ...prev,
        thresholds: 'Maximum withdrawal must be a valid numeric amount (e.g. 10000.00).',
      }));
      return;
    }
    if (!MONEY_REGEX.test(joiningReward.trim())) {
      setBoxErrors((prev) => ({
        ...prev,
        thresholds: 'Joining reward must be a valid numeric amount (e.g. 0.00 or 10.00).',
      }));
      return;
    }
    if (!MONEY_REGEX.test(referralReward.trim())) {
      setBoxErrors((prev) => ({
        ...prev,
        thresholds: 'Referral bonus must be a valid numeric amount (e.g. 5.00 or 0.00).',
      }));
      return;
    }

    const cashbackError = validateCashbackPercent(cashbackMaxPercent);
    if (cashbackError) {
      setBoxErrors((prev) => ({ ...prev, thresholds: cashbackError }));
      return;
    }

    // Modal required if cashback percent changed
    if (cashbackMaxPercent.trim() !== initialCashbackMaxPercent.trim()) {
      setShowCashbackModal(true);
      return;
    }

    await executeSaveBox(
      'thresholds',
      {
        min_deposit: minDeposit.trim(),
        max_deposit: maxDeposit.trim(),
        min_withdrawal: minWithdrawal.trim(),
        max_withdrawal: maxWithdrawal.trim(),
        joining_reward: joiningReward.trim(),
        referral_reward: referralReward.trim(),
        cashback_max_percent: cashbackMaxPercent.trim(),
      },
      'Deposit and approval thresholds saved and verified with server.'
    );
  };

  // Box 2: Customer Support Details
  const handleSaveSupport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (saveLockRef.current || savingBox) return;

    setBoxErrors((prev) => ({ ...prev, support: null }));

    if (supportPhone.trim() && !/^[6-9]\d{9}$/.test(supportPhone.trim())) {
      setBoxErrors((prev) => ({
        ...prev,
        support: 'Support phone must be a 10-digit Indian mobile number.',
      }));
      return;
    }
    if (supportEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail.trim())) {
      setBoxErrors((prev) => ({
        ...prev,
        support: 'Support email must be a valid email address.',
      }));
      return;
    }
    if (supportName.trim().length > 60) {
      setBoxErrors((prev) => ({
        ...prev,
        support: 'Support team name must not exceed 60 characters.',
      }));
      return;
    }
    if (supportHours.trim().length > 100) {
      setBoxErrors((prev) => ({
        ...prev,
        support: 'Support hours must not exceed 100 characters.',
      }));
      return;
    }

    await executeSaveBox(
      'support',
      {
        support_name: supportName.trim(),
        support_hours: supportHours.trim(),
        support_phone: supportPhone.trim(),
        support_email: supportEmail.trim(),
      },
      'Customer support details saved and verified with server.'
    );
  };

  // Box 3: Official Community Links
  const handleSaveCommunity = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (saveLockRef.current || savingBox) return;

    setBoxErrors((prev) => ({ ...prev, community: null }));

    const urlRegex = /^https?:\/\/.+/i;
    if (communityWhatsapp.trim() && !urlRegex.test(communityWhatsapp.trim())) {
      setBoxErrors((prev) => ({
        ...prev,
        community: 'WhatsApp community link must be a valid URL (starting with http:// or https://).',
      }));
      return;
    }
    if (communityInstagram.trim() && !urlRegex.test(communityInstagram.trim())) {
      setBoxErrors((prev) => ({
        ...prev,
        community: 'Instagram link must be a valid URL (starting with http:// or https://).',
      }));
      return;
    }
    if (communityTelegram.trim() && !urlRegex.test(communityTelegram.trim())) {
      setBoxErrors((prev) => ({
        ...prev,
        community: 'Telegram link must be a valid URL (starting with http:// or https://).',
      }));
      return;
    }
    if (communityYoutube.trim() && !urlRegex.test(communityYoutube.trim())) {
      setBoxErrors((prev) => ({
        ...prev,
        community: 'YouTube link must be a valid URL (starting with http:// or https://).',
      }));
      return;
    }

    await executeSaveBox(
      'community',
      {
        community_whatsapp: communityWhatsapp.trim(),
        community_instagram: communityInstagram.trim(),
        community_telegram: communityTelegram.trim(),
        community_youtube: communityYoutube.trim(),
      },
      'Community links saved and verified with server.'
    );
  };

  // Box 4: Payment Gateway & QR Code
  const handleSavePayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (saveLockRef.current || savingBox) return;

    setBoxErrors((prev) => ({ ...prev, payment: null }));

    if (
      paymentUpiId.trim() &&
      !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(paymentUpiId.trim())
    ) {
      setBoxErrors((prev) => ({
        ...prev,
        payment: 'Payment UPI ID must be a valid UPI format (e.g. name@bank or name@upi).',
      }));
      return;
    }

    await executeSaveBox(
      'payment',
      {
        payment_upi_id: paymentUpiId.trim(),
      },
      'Payment details saved and verified with server.'
    );
  };

  // Box 5: Maintenance Mode
  const handleSaveMaintenance = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (saveLockRef.current || savingBox) return;

    setBoxErrors((prev) => ({ ...prev, maintenance: null }));

    if (CONTROL_CHAR_REGEX.test(maintenanceMessage)) {
      setBoxErrors((prev) => ({
        ...prev,
        maintenance: 'Maintenance message cannot contain control characters.',
      }));
      return;
    }
    if (maintenanceMessage.length > 300) {
      setBoxErrors((prev) => ({
        ...prev,
        maintenance: 'Maintenance message must be at most 300 characters.',
      }));
      return;
    }

    if (maintenanceEnabled !== initialMaintenanceEnabled) {
      setShowMaintenanceModal(true);
      return;
    }

    await executeSaveBox(
      'maintenance',
      {
        maintenance_enabled: maintenanceEnabled ? 'true' : 'false',
        maintenance_message: maintenanceMessage.trim(),
        maintenance_until: maintenanceUntil.trim(),
      },
      'Maintenance mode settings saved and verified with server.'
    );
  };

  // Box 6: Tournament Match Rules & Banner Settings
  const handleSaveMatchRules = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (saveLockRef.current || savingBox) return;

    setBoxErrors((prev) => ({ ...prev, match_rules: null }));

    await executeSaveBox(
      'match_rules',
      {
        match_rules_image_url: matchRulesImageUrl.trim(),
        match_rules_cs_image_url: matchRulesCsImageUrl.trim(),
        match_rules_lw_image_url: matchRulesLwImageUrl.trim(),
        match_rules_en: matchRulesEn.trim(),
        match_rules_bn: matchRulesBn.trim(),
        match_rules_cs_en: matchRulesCsEn.trim(),
        match_rules_cs_bn: matchRulesCsBn.trim(),
        match_rules_lw_en: matchRulesLwEn.trim(),
        match_rules_lw_bn: matchRulesLwBn.trim(),
      },
      'Tournament match rules saved and verified with server.'
    );
  };

  // Box 7: Referral Invitation Message
  const handleSaveInvitation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (saveLockRef.current || savingBox) return;

    setBoxErrors((prev) => ({ ...prev, invitation: null }));
    setBoxSuccess((prev) => ({ ...prev, invitation: null }));

    const textToSave = invitationText.trim();
    if (textToSave.length > 500) {
      setBoxErrors((prev) => ({
        ...prev,
        invitation: 'Invitation message must not exceed 500 characters.',
      }));
      return;
    }

    if (!/^[^\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]*$/.test(textToSave)) {
      setBoxErrors((prev) => ({
        ...prev,
        invitation: 'Invitation message contains invalid control characters.',
      }));
      return;
    }

    await executeSaveBox(
      'invitation',
      {
        invitation_text: textToSave,
      },
      'Referral invitation message saved and verified with server.'
    );
  };

  // Handle QR File Selection & Upload
  const handleQrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setBoxErrors((prev) => ({
        ...prev,
        payment: 'Payment QR code image must not exceed 2MB.',
      }));
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const newPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = newPreviewUrl;
    setLocalQrPreviewUrl(newPreviewUrl);

    setIsUploadingQr(true);
    setBoxErrors((prev) => ({ ...prev, payment: null }));

    try {
      const res = await uploadPaymentQr(file);
      setPaymentQrKey(res.paymentQrKey);
      setPaymentQrUrl(res.qrUrl);
      setBoxSuccess((prev) => ({
        ...prev,
        payment: 'Payment QR code uploaded successfully.',
      }));
      setTimeout(() => {
        setBoxSuccess((prev) => ({ ...prev, payment: null }));
      }, 4000);
    } catch (err) {
      setBoxErrors((prev) => ({
        ...prev,
        payment: getFriendlyErrorMessage(err, 'settings'),
      }));
    } finally {
      setIsUploadingQr(false);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
        setLocalQrPreviewUrl(null);
      }
    }
  };

  // Handle Tournament Match Banner File Selection & Upload
  const handleMatchBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setBoxErrors((prev) => ({
        ...prev,
        match_rules: 'Tournament banner image must not exceed 2MB.',
      }));
      return;
    }

    const isCs = bannerModeTab === 'clash_squad';
    const isLw = bannerModeTab === 'lone_wolf';
    if (isLw) {
      if (lwBannerPreviewRef.current) {
        URL.revokeObjectURL(lwBannerPreviewRef.current);
      }
      const newPreviewUrl = URL.createObjectURL(file);
      lwBannerPreviewRef.current = newPreviewUrl;
      setLocalLwBannerPreviewUrl(newPreviewUrl);
    } else if (isCs) {
      if (csBannerPreviewRef.current) {
        URL.revokeObjectURL(csBannerPreviewRef.current);
      }
      const newPreviewUrl = URL.createObjectURL(file);
      csBannerPreviewRef.current = newPreviewUrl;
      setLocalCsBannerPreviewUrl(newPreviewUrl);
    } else {
      if (bannerPreviewRef.current) {
        URL.revokeObjectURL(bannerPreviewRef.current);
      }
      const newPreviewUrl = URL.createObjectURL(file);
      bannerPreviewRef.current = newPreviewUrl;
      setLocalBannerPreviewUrl(newPreviewUrl);
    }

    setIsUploadingBanner(true);
    setBoxErrors((prev) => ({ ...prev, match_rules: null }));

    try {
      const res = await uploadMatchBanner(file, bannerModeTab);
      if (isLw) {
        setMatchRulesLwImageUrl(res.matchRulesImageUrl);
        setBoxSuccess((prev) => ({
          ...prev,
          match_rules: 'Lone Wolf match banner uploaded successfully.',
        }));
      } else if (isCs) {
        setMatchRulesCsImageUrl(res.matchRulesImageUrl);
        setBoxSuccess((prev) => ({
          ...prev,
          match_rules: 'Clash Squad match banner uploaded successfully.',
        }));
      } else {
        setMatchRulesImageUrl(res.matchRulesImageUrl);
        setBoxSuccess((prev) => ({
          ...prev,
          match_rules: 'Battle Royale match banner uploaded successfully.',
        }));
      }
      setTimeout(() => {
        setBoxSuccess((prev) => ({ ...prev, match_rules: null }));
      }, 4000);
    } catch (err) {
      setBoxErrors((prev) => ({
        ...prev,
        match_rules: getFriendlyErrorMessage(err, 'settings'),
      }));
    } finally {
      setIsUploadingBanner(false);
      e.target.value = '';
    }
  };

  const handleResetMatchBanner = async () => {
    setIsUploadingBanner(true);
    setBoxErrors((prev) => ({ ...prev, match_rules: null }));
    const isCs = bannerModeTab === 'clash_squad';
    const isLw = bannerModeTab === 'lone_wolf';
    try {
      await deleteMatchBanner(bannerModeTab);
      if (isLw) {
        if (lwBannerPreviewRef.current) {
          URL.revokeObjectURL(lwBannerPreviewRef.current);
          lwBannerPreviewRef.current = null;
        }
        setLocalLwBannerPreviewUrl(null);
        setMatchRulesLwImageUrl('');
        setBoxSuccess((prev) => ({
          ...prev,
          match_rules: 'Lone Wolf match banner reset to default graphic.',
        }));
      } else if (isCs) {
        if (csBannerPreviewRef.current) {
          URL.revokeObjectURL(csBannerPreviewRef.current);
          csBannerPreviewRef.current = null;
        }
        setLocalCsBannerPreviewUrl(null);
        setMatchRulesCsImageUrl('');
        setBoxSuccess((prev) => ({
          ...prev,
          match_rules: 'Clash Squad match banner reset to default graphic.',
        }));
      } else {
        if (bannerPreviewRef.current) {
          URL.revokeObjectURL(bannerPreviewRef.current);
          bannerPreviewRef.current = null;
        }
        setLocalBannerPreviewUrl(null);
        setMatchRulesImageUrl('');
        setBoxSuccess((prev) => ({
          ...prev,
          match_rules: 'Battle Royale match banner reset to default graphic.',
        }));
      }
      setTimeout(() => {
        setBoxSuccess((prev) => ({ ...prev, match_rules: null }));
      }, 4000);
    } catch (err) {
      setBoxErrors((prev) => ({
        ...prev,
        match_rules: getFriendlyErrorMessage(err, 'settings'),
      }));
    } finally {
      setIsUploadingBanner(false);
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
            Configure financial thresholds, customer support channels, payment QR, and system maintenance.
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

      {pageError && (
        <div
          data-testid="settings-page-error"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-center gap-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{pageError}</span>
        </div>
      )}

      {isLoading ? (
        <div
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-xs text-slate-500"
          data-testid="settings-loading-state"
        >
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
          Loading platform settings...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Box 1: Deposit & Approval Thresholds */}
          <form
            onSubmit={handleSaveThresholds}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4"
            data-testid="thresholds-card"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-emerald-400" />
                Deposit & Approval Thresholds
              </h2>
            </div>

            {/* Error / Success / Warning at top of Box 1 */}
            {boxErrors.thresholds && (
              <div
                data-testid="thresholds-error-banner"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-center gap-2.5"
              >
                <span data-testid="settings-error-banner" className="sr-only">error</span>
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{boxErrors.thresholds}</span>
              </div>
            )}

            {boxSuccess.thresholds && (
              <div
                data-testid="thresholds-success-banner"
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2.5"
              >
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{boxSuccess.thresholds}</span>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Min Deposit (₹)
                </label>
                <input
                  type="text"
                  required
                  value={minDeposit}
                  onChange={(e) => {
                    setMinDeposit(e.target.value);
                    if (boxErrors.thresholds) setBoxErrors((p) => ({ ...p, thresholds: null }));
                  }}
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
                  onChange={(e) => {
                    setMaxDeposit(e.target.value);
                    if (boxErrors.thresholds) setBoxErrors((p) => ({ ...p, thresholds: null }));
                  }}
                  placeholder="e.g. 5000.00"
                  data-testid="settings-max-deposit-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Min Withdrawal (₹)
                </label>
                <input
                  type="text"
                  required
                  value={minWithdrawal}
                  onChange={(e) => {
                    setMinWithdrawal(e.target.value);
                    if (boxErrors.thresholds) setBoxErrors((p) => ({ ...p, thresholds: null }));
                  }}
                  placeholder="e.g. 50.00"
                  data-testid="settings-min-withdrawal-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Max Withdrawal (₹)
                </label>
                <input
                  type="text"
                  required
                  value={maxWithdrawal}
                  onChange={(e) => {
                    setMaxWithdrawal(e.target.value);
                    if (boxErrors.thresholds) setBoxErrors((p) => ({ ...p, thresholds: null }));
                  }}
                  placeholder="e.g. 10000.00"
                  data-testid="settings-max-withdrawal-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Joining Reward (₹)
                </label>
                <input
                  type="text"
                  required
                  value={joiningReward}
                  onChange={(e) => {
                    setJoiningReward(e.target.value);
                    if (boxErrors.thresholds) setBoxErrors((p) => ({ ...p, thresholds: null }));
                  }}
                  placeholder="e.g. 0.00 or 5.00"
                  data-testid="settings-joining-reward-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Bonus credited to player's deposit wallet immediately upon successful registration (set 0 to disable).
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Referral Bonus (₹)
                </label>
                <input
                  type="text"
                  required
                  value={referralReward}
                  onChange={(e) => {
                    setReferralReward(e.target.value);
                    if (boxErrors.thresholds) setBoxErrors((p) => ({ ...p, thresholds: null }));
                  }}
                  placeholder="e.g. 5.00 or 10.00"
                  data-testid="settings-referral-reward-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Bonus credited to referrer's cashback wallet upon player's first successful deposit (set 0 to disable).
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Auto Approval Threshold (₹)
                </label>
                <input
                  type="text"
                  disabled
                  value={adminApprovalThreshold}
                  onChange={(e) => setAdminApprovalThreshold(e.target.value)}
                  placeholder="e.g. 2000.00"
                  data-testid="settings-threshold-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400 font-mono cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Two-step approval active: all requests require staff review and admin approval.
                </span>
              </div>
            </div>

            {/* Cashback Wallet Entry Fee Cap */}
            <div className="border-t border-slate-800/80 pt-4 space-y-2">
              <div className="max-w-md">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Cashback Entry Fee Cap (%)
                </label>
                <input
                  type="text"
                  required
                  value={cashbackMaxPercent}
                  onChange={(e) => {
                    setCashbackMaxPercent(e.target.value);
                    if (boxErrors.thresholds) setBoxErrors((p) => ({ ...p, thresholds: null }));
                  }}
                  placeholder="e.g. 5 or 12.50"
                  data-testid="settings-cashback-percent-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-amber-400/90 mt-1 block">
                  Note: Raising the percentage costs the business more cashback, as players can cover a larger share of entry fees using promotional rewards.
                </span>
                {validateCashbackPercent(cashbackMaxPercent) && (
                  <span
                    data-testid="settings-cashback-warning"
                    className="text-[10px] text-rose-400 mt-1 block font-medium"
                  >
                    {validateCashbackPercent(cashbackMaxPercent)}
                  </span>
                )}
              </div>
            </div>

            {/* Dedicated Save Button for Box 1 */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-800/60">
              <button
                type="submit"
                disabled={savingBox === 'thresholds'}
                data-testid="save-thresholds-btn"
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10 disabled:opacity-50"
              >
                {savingBox === 'thresholds' ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Box 2: Customer Support Details */}
          <form
            onSubmit={handleSaveSupport}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4"
            data-testid="support-card"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-400" />
                Customer Support Details
              </h2>
            </div>

            {/* Error / Success at top of Box 2 */}
            {boxErrors.support && (
              <div
                data-testid="support-error-banner"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-center gap-2.5"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{boxErrors.support}</span>
              </div>
            )}

            {boxSuccess.support && (
              <div
                data-testid="support-success-banner"
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2.5"
              >
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{boxSuccess.support}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Support Team Name</label>
                <input
                  type="text"
                  value={supportName}
                  onChange={(e) => {
                    setSupportName(e.target.value);
                    if (boxErrors.support) setBoxErrors((p) => ({ ...p, support: null }));
                  }}
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
                  onChange={(e) => {
                    setSupportHours(e.target.value);
                    if (boxErrors.support) setBoxErrors((p) => ({ ...p, support: null }));
                  }}
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
                  onChange={(e) => {
                    setSupportPhone(e.target.value);
                    if (boxErrors.support) setBoxErrors((p) => ({ ...p, support: null }));
                  }}
                  placeholder="e.g. 9876543210"
                  data-testid="settings-support-phone-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Support Email</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => {
                    setSupportEmail(e.target.value);
                    if (boxErrors.support) setBoxErrors((p) => ({ ...p, support: null }));
                  }}
                  placeholder="e.g. support@booyah.win"
                  data-testid="settings-support-email-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Dedicated Save Button for Box 2 */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-800/60">
              <button
                type="submit"
                disabled={savingBox === 'support'}
                data-testid="save-support-btn"
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10 disabled:opacity-50"
              >
                {savingBox === 'support' ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Box 3: Official Community Links */}
          <form
            onSubmit={handleSaveCommunity}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4"
            data-testid="community-card"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                Official Community Links (Player Account Screen)
              </h2>
            </div>

            {/* Error / Success at top of Box 3 */}
            {boxErrors.community && (
              <div
                data-testid="community-error-banner"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-center gap-2.5"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{boxErrors.community}</span>
              </div>
            )}

            {boxSuccess.community && (
              <div
                data-testid="community-success-banner"
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2.5"
              >
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{boxSuccess.community}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">WhatsApp Community Link</label>
                <input
                  type="text"
                  value={communityWhatsapp}
                  onChange={(e) => {
                    setCommunityWhatsapp(e.target.value);
                    if (boxErrors.community) setBoxErrors((p) => ({ ...p, community: null }));
                  }}
                  placeholder="https://chat.whatsapp.com/demo"
                  data-testid="settings-community-whatsapp-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Instagram Channel Link</label>
                <input
                  type="text"
                  value={communityInstagram}
                  onChange={(e) => {
                    setCommunityInstagram(e.target.value);
                    if (boxErrors.community) setBoxErrors((p) => ({ ...p, community: null }));
                  }}
                  placeholder="https://instagram.com/booyahwin"
                  data-testid="settings-community-instagram-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Telegram Channel Link</label>
                <input
                  type="text"
                  value={communityTelegram}
                  onChange={(e) => {
                    setCommunityTelegram(e.target.value);
                    if (boxErrors.community) setBoxErrors((p) => ({ ...p, community: null }));
                  }}
                  placeholder="https://t.me/booyahwin"
                  data-testid="settings-community-telegram-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">YouTube Channel Link</label>
                <input
                  type="text"
                  value={communityYoutube}
                  onChange={(e) => {
                    setCommunityYoutube(e.target.value);
                    if (boxErrors.community) setBoxErrors((p) => ({ ...p, community: null }));
                  }}
                  placeholder="https://youtube.com/@booyahwin"
                  data-testid="settings-community-youtube-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Dedicated Save Button for Box 3 */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-800/60">
              <button
                type="submit"
                disabled={savingBox === 'community'}
                data-testid="save-community-btn"
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10 disabled:opacity-50"
              >
                {savingBox === 'community' ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Box 4: Payment Gateway & QR Code */}
          <form
            onSubmit={handleSavePayment}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4"
            data-testid="payment-card"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <QrCode className="h-4 w-4 text-emerald-400" />
                Payment Gateway & QR Code
              </h2>
            </div>

            {/* Error / Success at top of Box 4 */}
            {boxErrors.payment && (
              <div
                data-testid="payment-error-banner"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-center gap-2.5"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{boxErrors.payment}</span>
              </div>
            )}

            {boxSuccess.payment && (
              <div
                data-testid="payment-success-banner"
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2.5"
              >
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{boxSuccess.payment}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Payment UPI ID
                  </label>
                  <input
                    type="text"
                    value={paymentUpiId}
                    onChange={(e) => {
                      setPaymentUpiId(e.target.value);
                      if (boxErrors.payment) setBoxErrors((p) => ({ ...p, payment: null }));
                    }}
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

            {/* Dedicated Save Button for Box 4 */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-800/60">
              <button
                type="submit"
                disabled={savingBox === 'payment'}
                data-testid="save-payment-btn"
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10 disabled:opacity-50"
              >
                {savingBox === 'payment' ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Box 5: Maintenance Mode */}
          <form
            onSubmit={handleSaveMaintenance}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4"
            data-testid="settings-maintenance-card"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
                System Maintenance Mode
              </h2>
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenanceEnabled}
                    onChange={(e) => {
                      setMaintenanceEnabled(e.target.checked);
                      if (boxErrors.maintenance) setBoxErrors((p) => ({ ...p, maintenance: null }));
                    }}
                    data-testid="settings-maintenance-toggle"
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  <span className="ml-2.5 text-xs font-semibold text-slate-300">
                    {maintenanceEnabled ? (
                      <span className="text-amber-400 font-bold">Maintenance Active</span>
                    ) : (
                      <span className="text-slate-400">Normal Operations</span>
                    )}
                  </span>
                </label>
              </div>
            </div>

            {/* Error / Success at top of Box 5 */}
            {boxErrors.maintenance && (
              <div
                data-testid="maintenance-error-banner"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-center gap-2.5"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{boxErrors.maintenance}</span>
              </div>
            )}

            {boxSuccess.maintenance && (
              <div
                data-testid="maintenance-success-banner"
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2.5"
              >
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{boxSuccess.maintenance}</span>
              </div>
            )}

            <p className="text-xs text-slate-400">
              When maintenance is enabled, mutating user requests (joining matches, deposits, withdrawals, profile updates) are blocked with 503 Maintenance Mode. Login, registration, OTP, reads, and staff portal continue normally.
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Maintenance Announcement Message (Max 300 chars, plain text only)
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {maintenanceMessage.length}/300
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={maintenanceMessage}
                  onChange={(e) => {
                    setMaintenanceMessage(e.target.value);
                    if (boxErrors.maintenance) setBoxErrors((p) => ({ ...p, maintenance: null }));
                  }}
                  placeholder="Under scheduled maintenance. Please check back shortly."
                  data-testid="settings-maintenance-message-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Message Safe Plain Text Preview */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  User Banner Preview (Rendered as Plain Text)
                </span>
                <div
                  data-testid="settings-maintenance-preview"
                  className="text-xs text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-sans break-words"
                >
                  {maintenanceMessage || 'No announcement message specified'}
                </div>
              </div>

              {/* Maintenance Until (Datetime Picker) */}
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-slate-300">
                  Estimated Completion Time (Indian Standard Time, +05:30)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">End Date</label>
                    <input
                      type="date"
                      value={maintenanceDate}
                      onChange={(e) => handleDateOrTimeChange(e.target.value, maintenanceTime || '18:00')}
                      data-testid="settings-maintenance-date-input"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">End Time (IST)</label>
                    <input
                      type="time"
                      value={maintenanceTime}
                      onChange={(e) => handleDateOrTimeChange(maintenanceDate, e.target.value)}
                      data-testid="settings-maintenance-time-input"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {isPastTime && (
                  <div
                    data-testid="settings-maintenance-past-warning"
                    className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300 flex items-center gap-2"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>Warning: The selected maintenance end time is in the past.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dedicated Save Button for Box 5 */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-800/60">
              <button
                type="submit"
                disabled={savingBox === 'maintenance'}
                data-testid="save-maintenance-btn"
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/10 disabled:opacity-50"
              >
                {savingBox === 'maintenance' ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Box 6: Tournament Match Rules & Banner Settings */}
          <form
            onSubmit={handleSaveMatchRules}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4"
            data-testid="settings-match-rules-card"
          >
            <div className="pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                Tournament Match Rules & Banner Settings
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                Customize the top banner image and the bilingual rules displayed on the player Match Detail page.
              </p>
            </div>

            {/* Error / Success at top of Box 6 */}
            {boxErrors.match_rules && (
              <div
                data-testid="match-rules-error-banner"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-center gap-2.5"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{boxErrors.match_rules}</span>
              </div>
            )}

            {boxSuccess.match_rules && (
              <div
                data-testid="match-rules-success-banner"
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2.5"
              >
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{boxSuccess.match_rules}</span>
              </div>
            )}

            <div className="space-y-3">
              {/* Game Mode Selector for Match Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300">Banner Mode:</span>
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setBannerModeTab('battle_royale')}
                      data-testid="banner-tab-battle-royale"
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                        bannerModeTab === 'battle_royale'
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Battle Royale
                    </button>
                    <button
                      type="button"
                      onClick={() => setBannerModeTab('clash_squad')}
                      data-testid="banner-tab-clash-squad"
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                        bannerModeTab === 'clash_squad'
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Clash Squad
                    </button>
                    <button
                      type="button"
                      onClick={() => setBannerModeTab('lone_wolf')}
                      data-testid="banner-tab-lone-wolf"
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                        bannerModeTab === 'lone_wolf'
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Lone Wolf
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {((bannerModeTab === 'lone_wolf'
                    ? (localLwBannerPreviewUrl || matchRulesLwImageUrl)
                    : bannerModeTab === 'clash_squad'
                    ? (localCsBannerPreviewUrl || matchRulesCsImageUrl)
                    : (localBannerPreviewUrl || matchRulesImageUrl))) ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      <CheckCircle className="h-3 w-3" /> Custom Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                      Default Graphic
                    </span>
                  )}
                </div>
              </div>

              {/* Banner Upload & Preview Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl items-start">
                {/* Upload Action Card */}
                <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200">
                      Upload {bannerModeTab === 'lone_wolf' ? 'Lone Wolf' : bannerModeTab === 'clash_squad' ? 'Clash Squad' : 'Battle Royale'} Banner
                    </label>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Upload custom 16:10 banner for match detail screens in Player PWA.
                    </p>
                  </div>

                  <label className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 cursor-pointer hover:border-emerald-500 hover:bg-slate-900/70 transition-all text-center">
                    <Upload className="h-5 w-5 text-emerald-400" />
                    <span className="text-xs text-slate-200 font-semibold">
                      {isUploadingBanner
                        ? 'Uploading...'
                        : bannerModeTab === 'lone_wolf'
                        ? 'Choose Lone Wolf Banner'
                        : bannerModeTab === 'clash_squad'
                        ? 'Choose Clash Squad Banner'
                        : 'Choose Battle Royale Banner'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      16:10 ratio · PNG, JPG, WebP up to 2 MB
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleMatchBannerFileChange}
                      disabled={isUploadingBanner}
                      data-testid="settings-match-banner-upload-input"
                      className="hidden"
                    />
                  </label>

                  {/* If custom banner is active for the current mode, offer reset button */}
                  {((bannerModeTab === 'battle_royale' && (localBannerPreviewUrl || matchRulesImageUrl)) ||
                    (bannerModeTab === 'clash_squad' && (localCsBannerPreviewUrl || matchRulesCsImageUrl)) ||
                    (bannerModeTab === 'lone_wolf' && (localLwBannerPreviewUrl || matchRulesLwImageUrl))) && (
                    <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        Custom active
                      </span>
                      <button
                        type="button"
                        onClick={handleResetMatchBanner}
                        disabled={isUploadingBanner}
                        data-testid="settings-match-banner-reset-btn"
                        className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/20 transition active:scale-95 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Reset to Default</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Banner Live Preview */}
                <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {bannerModeTab === 'lone_wolf' ? 'Lone Wolf' : bannerModeTab === 'clash_squad' ? 'Clash Squad' : 'Battle Royale'} Preview (16:10)
                    </span>
                    {((bannerModeTab === 'lone_wolf'
                      ? (localLwBannerPreviewUrl || matchRulesLwImageUrl)
                      : bannerModeTab === 'clash_squad'
                      ? (localCsBannerPreviewUrl || matchRulesCsImageUrl)
                      : (localBannerPreviewUrl || matchRulesImageUrl))) ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                        <CheckCircle className="h-2.5 w-2.5" /> Custom
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
                        Default Graphic
                      </span>
                    )}
                  </div>

                  <div className="relative w-full aspect-[16/10] rounded-lg overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                    {!bannerLoadFailed ? (
                      <img
                        src={
                          (bannerModeTab === 'lone_wolf'
                            ? (localLwBannerPreviewUrl || matchRulesLwImageUrl)
                            : bannerModeTab === 'clash_squad'
                            ? (localCsBannerPreviewUrl || matchRulesCsImageUrl)
                            : (localBannerPreviewUrl || matchRulesImageUrl)) || '/assets/default_match_banner.jpg'
                        }
                        alt={bannerModeTab === 'lone_wolf' ? 'Lone Wolf Match Banner Preview' : bannerModeTab === 'clash_squad' ? 'Clash Squad Match Banner Preview' : 'Battle Royale Match Banner Preview'}
                        data-testid="settings-match-banner-preview-img"
                        className="w-full h-full object-cover object-center"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.endsWith('/assets/default_match_banner.jpg')) {
                            target.src = '/assets/default_match_banner.jpg';
                          } else {
                            setBannerLoadFailed(true);
                          }
                        }}
                      />
                    ) : (
                      <div
                        data-testid="settings-match-banner-preview-img"
                        className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-500/20 via-slate-900 to-emerald-500/20 p-2 text-center select-none"
                      >
                        <span className="text-amber-400 font-black tracking-wider text-xs uppercase drop-shadow">
                          FREE FIRE TOURNAMENT
                        </span>
                        <span className="text-[9px] text-slate-400 tracking-widest uppercase mt-0.5">
                          {bannerModeTab === 'lone_wolf' ? 'LONE WOLF' : bannerModeTab === 'clash_squad' ? 'CLASH SQUAD' : 'BATTLE ROYALE'}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                    <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white text-[10px] font-bold drop-shadow">
                      <span>{bannerModeTab === 'lone_wolf' ? 'LONE WOLF | DUO / SOLO' : bannerModeTab === 'clash_squad' ? 'CLASH SQUAD | 4V4' : 'BATTLE ROYALE | DUO'}</span>
                      <span className="text-emerald-400 text-[9px]">LIVE PREVIEW</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Game Mode Rules Selector Tabs */}
              <div className="border-t border-slate-800/80 pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      Game Mode Rules & Policies
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Configure dedicated rules for Battle Royale and Clash Squad in both English and Bangla.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setRulesModeTab('battle_royale')}
                      data-testid="rules-tab-battle-royale"
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        rulesModeTab === 'battle_royale'
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Battle Royale
                    </button>
                    <button
                      type="button"
                      onClick={() => setRulesModeTab('clash_squad')}
                      data-testid="rules-tab-clash-squad"
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        rulesModeTab === 'clash_squad'
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Clash Squad
                    </button>
                    <button
                      type="button"
                      onClick={() => setRulesModeTab('lone_wolf')}
                      data-testid="rules-tab-lone-wolf"
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        rulesModeTab === 'lone_wolf'
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Lone Wolf
                    </button>
                  </div>
                </div>

                {rulesModeTab === 'battle_royale' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Battle Royale Rules & Policies (ENGLISH)
                      </label>
                      <textarea
                        rows={12}
                        value={matchRulesEn}
                        onChange={(e) => {
                          setMatchRulesEn(e.target.value);
                          if (boxErrors.match_rules) setBoxErrors((p) => ({ ...p, match_rules: null }));
                        }}
                        placeholder="Instructions, eligibility, banned weapons, fair play rules..."
                        data-testid="settings-match-rules-en-input"
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Battle Royale Rules & Policies (বাংলা)
                      </label>
                      <textarea
                        rows={12}
                        value={matchRulesBn}
                        onChange={(e) => {
                          setMatchRulesBn(e.target.value);
                          if (boxErrors.match_rules) setBoxErrors((p) => ({ ...p, match_rules: null }));
                        }}
                        placeholder="যোগদানের পূর্বের নির্দেশাবলী, নিয়মাবলী..."
                        data-testid="settings-match-rules-bn-input"
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none leading-relaxed"
                      />
                    </div>
                  </div>
                ) : rulesModeTab === 'clash_squad' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Clash Squad Rules & Policies (ENGLISH)
                      </label>
                      <textarea
                        rows={12}
                        value={matchRulesCsEn}
                        onChange={(e) => {
                          setMatchRulesCsEn(e.target.value);
                          if (boxErrors.match_rules) setBoxErrors((p) => ({ ...p, match_rules: null }));
                        }}
                        placeholder="Instructions, eligibility, room structure, prohibited behaviour..."
                        data-testid="settings-match-rules-cs-en-input"
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Clash Squad Rules & Policies (বাংলা)
                      </label>
                      <textarea
                        rows={12}
                        value={matchRulesCsBn}
                        onChange={(e) => {
                          setMatchRulesCsBn(e.target.value);
                          if (boxErrors.match_rules) setBoxErrors((p) => ({ ...p, match_rules: null }));
                        }}
                        placeholder="যোগদানের পূর্বের নির্দেশাবলী, রুমের কাঠামো..."
                        data-testid="settings-match-rules-cs-bn-input"
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none leading-relaxed"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Lone Wolf Rules & Policies (ENGLISH)
                      </label>
                      <textarea
                        rows={12}
                        value={matchRulesLwEn}
                        onChange={(e) => {
                          setMatchRulesLwEn(e.target.value);
                          if (boxErrors.match_rules) setBoxErrors((p) => ({ ...p, match_rules: null }));
                        }}
                        placeholder="Instructions, eligibility, room structure (9 rounds), prohibited behaviour..."
                        data-testid="settings-match-rules-lw-en-input"
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Lone Wolf Rules & Policies (বাংলা)
                      </label>
                      <textarea
                        rows={12}
                        value={matchRulesLwBn}
                        onChange={(e) => {
                          setMatchRulesLwBn(e.target.value);
                          if (boxErrors.match_rules) setBoxErrors((p) => ({ ...p, match_rules: null }));
                        }}
                        placeholder="যোগদানের পূর্বের নির্দেশাবলী, রুমের কাঠামো (৯ রাউন্ড)..."
                        data-testid="settings-match-rules-lw-bn-input"
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none leading-relaxed"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dedicated Save Button for Box 6 */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-800/60">
              <button
                type="submit"
                disabled={savingBox === 'match_rules'}
                data-testid="save-match-rules-btn"
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10 disabled:opacity-50"
              >
                {savingBox === 'match_rules' ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Box 7: Referral Invitation Message */}
          <form
            onSubmit={handleSaveInvitation}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4"
            data-testid="invitation-card"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Share2 className="h-4 w-4 text-emerald-400" />
                Referral Invitation Message
              </h2>
            </div>

            {/* Error / Success at top of Box 7 */}
            {boxErrors.invitation && (
              <div
                data-testid="invitation-error-banner"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-center gap-2.5"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{boxErrors.invitation}</span>
              </div>
            )}

            {boxSuccess.invitation && (
              <div
                data-testid="invitation-success-banner"
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2.5"
              >
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{boxSuccess.invitation}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Editable Headline & Intro Text */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="settings-invitation-text-input"
                    className="text-xs font-semibold text-slate-300"
                  >
                    Customizable Invitation Header
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {invitationText.length}/500
                  </span>
                </div>
                <textarea
                  id="settings-invitation-text-input"
                  data-testid="settings-invitation-text-input"
                  rows={4}
                  value={invitationText}
                  onChange={(e) => setInvitationText(e.target.value)}
                  placeholder="Hey, Download Booyah Win - Play Free Fire Tournaments & Win Money&#10;Join tournaments, show your skills and win real cash prizes!"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none font-sans leading-relaxed"
                />
                <p className="text-[11px] text-slate-400">
                  This header text is sent when players share their referral invitation on WhatsApp or other apps.
                </p>
              </div>

              {/* Fixed Read-Only Bottom Content */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Lock className="h-3.5 w-3.5 text-amber-400" />
                    Fixed Appended Content (Non-editable)
                  </span>
                  <span className="rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                    System Locked
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  The player&apos;s username and active website URL are automatically detected and appended below the invitation header and cannot be edited.
                </p>
                <pre
                  data-testid="invitation-fixed-content"
                  className="rounded-lg bg-slate-900 border border-slate-800/80 p-2.5 text-[11px] font-mono text-emerald-400 whitespace-pre-wrap select-none leading-relaxed"
                >
{`Use my referral code: <username> and make your booyah into money.
Download Link: https://<websiteUrl>/refer/<username>`}
                </pre>
              </div>

              {/* Live Preview Card */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Live Preview (As Recipient Sees It)
                </div>
                <div
                  data-testid="invitation-preview-card"
                  className="rounded-lg bg-slate-900/90 border border-emerald-500/20 p-3 text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed shadow-inner"
                >
{`${invitationText.trim() || DEFAULT_INVITATION_TEXT}
Use my referral code: PLAYER99 and make your booyah into money.
Download Link: https://<websiteUrl>/refer/PLAYER99`}
                </div>
              </div>
            </div>

            {/* Dedicated Save Button for Box 7 */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-800/60">
              <button
                type="submit"
                disabled={savingBox === 'invitation'}
                data-testid="save-invitation-btn"
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10 disabled:opacity-50"
              >
                {savingBox === 'invitation' ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Modal before Saving Maintenance Mode Toggle Change */}
      {showMaintenanceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          data-testid="maintenance-confirm-modal"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  {maintenanceEnabled ? 'Enable Maintenance Mode' : 'Disable Maintenance Mode'}
                </h3>
                <p className="text-[11px] text-slate-400">Confirm platform status change</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              {maintenanceEnabled
                ? 'Are you sure you want to turn ON Maintenance Mode? All player mutating actions (joining matches, deposits, withdrawals) will be blocked immediately.'
                : 'Are you sure you want to turn OFF Maintenance Mode and restore normal player operations?'}
            </p>

            {maintenanceEnabled && (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Announcement Message (Plain Text)
                </div>
                <div
                  className="text-slate-200 font-mono text-[11px] bg-slate-900 p-2 rounded border border-slate-800 break-words"
                  data-testid="modal-maintenance-message"
                >
                  {maintenanceMessage}
                </div>
                {maintenanceUntil && (
                  <div className="text-[11px] text-slate-400 pt-1">
                    Estimated completion:{' '}
                    <span className="text-slate-200 font-medium">{formatISTDate(maintenanceUntil)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowMaintenanceModal(false)}
                data-testid="maintenance-cancel-modal-btn"
                className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowMaintenanceModal(false);
                  await executeSaveBox(
                    'maintenance',
                    {
                      maintenance_enabled: maintenanceEnabled ? 'true' : 'false',
                      maintenance_message: maintenanceMessage.trim(),
                      maintenance_until: maintenanceUntil.trim(),
                    },
                    'Maintenance mode settings saved and verified with server.'
                  );
                }}
                data-testid="maintenance-confirm-save-btn"
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors"
              >
                {maintenanceEnabled ? 'Confirm & Enable' : 'Confirm & Disable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal before Saving Cashback Percentage Change */}
      {showCashbackModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          data-testid="cashback-confirm-modal"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  Confirm Cashback Cap Change
                </h3>
                <p className="text-[11px] text-slate-400">Review business cost impact</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center text-slate-400">
                <span>Previous Cap:</span>
                <span className="text-slate-200 font-bold" data-testid="modal-old-cashback-cap">
                  {initialCashbackMaxPercent}%
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400 border-t border-slate-800 pt-1.5">
                <span>New Cap:</span>
                <span className="text-emerald-400 font-bold" data-testid="modal-new-cashback-cap">
                  {cashbackMaxPercent.trim()}%
                </span>
              </div>
            </div>

            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 leading-relaxed">
              <strong>Notice:</strong> Raising the cashback percentage costs the business more cashback, as players can cover a larger share of entry fees using promotional rewards.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCashbackModal(false)}
                data-testid="cancel-cashback-save-btn"
                className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowCashbackModal(false);
                  await executeSaveBox(
                    'thresholds',
                    {
                      min_deposit: minDeposit.trim(),
                      max_deposit: maxDeposit.trim(),
                      min_withdrawal: minWithdrawal.trim(),
                      max_withdrawal: maxWithdrawal.trim(),
                      joining_reward: joiningReward.trim(),
                      referral_reward: referralReward.trim(),
                      cashback_max_percent: cashbackMaxPercent.trim(),
                    },
                    'Deposit and approval thresholds saved and verified with server.'
                  );
                }}
                data-testid="confirm-cashback-save-btn"
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10"
              >
                Confirm & Save Cap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
