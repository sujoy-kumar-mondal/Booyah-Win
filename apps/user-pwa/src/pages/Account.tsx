import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { fetchUserStatistics, type UserStatistics } from '../api/user.js';
import { formatAccountHeaderName, formatUserId } from '../utils/formatters.js';
import { useTranslation } from '../i18n/LanguageContext.js';
import {
  User,
  BarChart2,
  Users,
  Headphones,
  Info,
  Lock,
  Share2,
  Power,
  ChevronRight,
  AlertTriangle,
  Download,
  Globe,
  CheckCircle2,
  UserPlus,
  LogIn,
  Bell,
  Loader2,
} from 'lucide-react';
import { subscribeToPushNotifications, isPushNotificationSupported } from '../utils/pushNotifications.js';
import { resolveImageUrl } from '../utils/imageUrl.js';

export const Account: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useTranslation();
  const { isAuthenticated, user, logout } = useAuth();
  const downloadUrl = (import.meta.env.VITE_APP_DOWNLOAD_URL || '/Booyah_Win.apk').trim() || '/Booyah_Win.apk';
  const [stats, setStats] = useState<UserStatistics>({ played: 0, kills: 0, totalWinnings: '0.00' });
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [pushPermission, setPushPermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarUrl]);

  const handleEnablePush = async () => {
    setIsSubscribingPush(true);
    try {
      const success = await subscribeToPushNotifications();
      if (success) {
        setPushPermission('granted');
      } else if (typeof Notification !== 'undefined') {
        setPushPermission(Notification.permission);
      }
    } finally {
      setIsSubscribingPush(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      try {
        const data = await fetchUserStatistics();
        if (isMounted && data) {
          setStats(data);
        }
      } catch {
        // Fallback or guest
      }
    }
    loadStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const winAmount = Math.floor(Number(stats.totalWinnings || '0'));

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 pb-6 select-none" data-testid="account-screen" data-auth="guest">
        {/* ─── Profile Header (Guest) ──────────────────────────────────── */}
        <div className="flex flex-col items-center pt-2">
          <div className="relative">
            <div className="h-24 w-24 rounded-full border-2 border-violet-500/40 bg-slate-900 p-3 shadow-lg shadow-violet-500/10 flex items-center justify-center overflow-hidden">
              <img
                src="/assets/logo_icon.png"
                alt="Booyah Win"
                className="h-full w-full object-contain"
                data-testid="account-guest-avatar"
              />
            </div>
          </div>

          <h1
            className="mt-3 text-2xl font-black tracking-tight text-white text-center"
            data-testid="account-guest-title"
          >
            {t('account.guestTitle')}
          </h1>
          <p
            className="text-xs font-medium text-slate-400 mt-1 max-w-xs text-center leading-relaxed"
            data-testid="account-guest-subtitle"
          >
            {t('account.guestSubtitle')}
          </p>

          {/* Create Account and Login buttons */}
          <div className="mt-5 grid grid-cols-2 gap-3 w-full">
            <button
              type="button"
              onClick={() => navigate('/register')}
              data-testid="account-guest-register-btn"
              className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 px-3 text-xs sm:text-sm font-black text-slate-950 shadow-md shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-300 transition-all active:scale-[0.98] cursor-pointer"
            >
              <UserPlus className="h-4 w-4 stroke-[2.5]" />
              <span>{t('account.createAccountBtn')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              data-testid="account-guest-login-btn"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 hover:border-slate-600 py-3 px-3 text-xs sm:text-sm font-bold text-slate-200 transition-all active:scale-[0.98] cursor-pointer"
            >
              <LogIn className="h-4 w-4 stroke-[2.5]" />
              <span>{t('account.loginBtn')}</span>
            </button>
          </div>
        </div>

        {/* ─── SECTION: COMMUNITY & SUPPORT ────────────────────────────── */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <span className="h-4 w-1 rounded-full bg-violet-600 inline-block" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">
              {t('account.secCommunitySupport')}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-[#121324] overflow-hidden divide-y divide-slate-800/60 shadow-md">
            {/* Join Community */}
            <button
              type="button"
              onClick={() => navigate('/community')}
              data-testid="menu-join-community-btn"
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-slate-300">
                  <Users className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-slate-100">{t('account.menuJoinCommunity')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>

            {/* Customer Support */}
            <button
              type="button"
              onClick={() => navigate('/support')}
              data-testid="menu-customer-support-btn"
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-slate-300">
                  <Headphones className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-slate-100">{t('account.menuSupport')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* ─── SECTION: ABOUT & LEGAL ───────────────────────────────────── */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <span className="h-4 w-1 rounded-full bg-violet-600 inline-block" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">
              {t('account.secAboutLegal')}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-[#121324] overflow-hidden divide-y divide-slate-800/60 shadow-md">
            {/* About Us */}
            <button
              type="button"
              onClick={() => navigate('/about')}
              data-testid="menu-about-us-btn"
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-slate-300">
                  <Info className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-slate-100">{t('account.menuAboutUs')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>

            {/* Privacy Policy */}
            <button
              type="button"
              onClick={() => navigate('/privacy')}
              data-testid="menu-privacy-policy-btn"
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-slate-300">
                  <Lock className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-slate-100">{t('account.menuPrivacyPolicy')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>

            {/* Download App */}
            <div data-testid="profile-download-app-section">
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                download="Booyah_Win.apk"
                data-testid="profile-download-app-btn"
                className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-emerald-400">
                    <Download className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-bold text-slate-100">{t('account.menuDownloadApp')}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </a>
            </div>
          </div>
        </div>

        {/* ─── SECTION: LANGUAGE PREFERENCE ──────────────────────────────── */}
        <div
          className="rounded-2xl border border-slate-800/90 bg-[#121324] p-4 shadow-md space-y-3"
          data-testid="profile-language-section"
        >
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                {t('profile.languagePreferenceTitle')}
              </h3>
              <p className="text-xs text-slate-400">
                {t('profile.languagePreferenceSubtitle')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3" data-testid="profile-language-options">
            <button
              type="button"
              data-testid="profile-lang-en"
              onClick={() => setLanguage('en', { syncServer: false })}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                  : 'bg-[#18192c] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <span>English</span>
              {language === 'en' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            </button>
            <button
              type="button"
              data-testid="profile-lang-bn"
              onClick={() => setLanguage('bn', { syncServer: false })}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                language === 'bn'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                  : 'bg-[#18192c] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <span>বাংলা</span>
              {language === 'bn' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            </button>
          </div>
        </div>

        {/* ─── Floating Help & Support Button ────────────────────────────── */}
        <div className="pointer-events-none fixed bottom-20 left-6 right-0 z-40 mx-auto w-full max-w-md px-4 flex justify-start">
          <button
            type="button"
            onClick={() => navigate('/support')}
            aria-label={t('account.menuSupport') || 'Help & Support'}
            data-testid="floating-support-btn"
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 active:scale-90 transition-all ring-4 ring-slate-950/40"
          >
            <Headphones className="h-6 w-6 stroke-[2.5]" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 select-none" data-testid="account-screen">
      {/* ─── Profile Header ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center pt-2">
        <div className="relative">
          <div className="h-28 w-28 rounded-full border-2 border-violet-500/50 bg-slate-900 p-1 shadow-lg shadow-violet-500/10 flex items-center justify-center overflow-hidden">
            {user?.avatarUrl && !avatarError ? (
              <img
                src={resolveImageUrl(user.avatarUrl)}
                alt=""
                className="h-full w-full rounded-full object-cover"
                data-testid="account-avatar-img"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-violet-600/40 to-slate-900 p-4"
                data-testid="account-avatar-fallback"
              >
                <img
                  src="/assets/logo_icon.png"
                  alt=""
                  className="h-full w-full object-contain"
                />
              </div>
            )}
          </div>
          {/* Online green dot */}
          <span
            className="absolute bottom-1 right-2 h-4 w-4 rounded-full border-2 border-[#0d0e17] bg-[#10b981]"
            title="Online"
            data-testid="online-indicator"
          />
        </div>

        <h1
          className="mt-3 max-w-[90%] sm:max-w-sm truncate whitespace-nowrap text-2xl font-bold tracking-tight text-white text-center"
          data-testid="account-user-name"
          title={user?.name || 'Player'}
        >
          {formatAccountHeaderName(user?.name)}
        </h1>
        <p className="text-sm font-medium text-slate-400 mt-1 max-w-[90%] truncate whitespace-nowrap text-center" data-testid="account-user-username">
          @{user?.username || user?.referralCode || 'player'}
        </p>
        {user?.id && (
          <div className="mt-1 flex items-center gap-1.5 font-mono text-xs text-slate-400">
            <span>UID:</span>
            <span className="font-bold text-violet-400" data-testid="account-user-uid">
              {formatUserId(user.id)}
            </span>
          </div>
        )}

        {/* ─── Horizontal Stats Card ───────────────────────────────────── */}
        <div
          data-testid="account-stats-card"
          className="mt-5 w-full rounded-2xl border border-slate-800/90 bg-[#121324] py-5 px-3 shadow-xl relative overflow-hidden"
        >
          {/* Top subtle violet accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-violet-600" />

          <div className="grid grid-cols-3 divide-x divide-slate-800/80 items-center text-center">
            {/* PLAYED */}
            <div className="flex flex-col items-center justify-center px-1">
              <span className="text-3xl font-extrabold tracking-tight text-white" data-testid="stat-played">
                {stats.played}
              </span>
              <span className="text-[11px] font-bold text-slate-400 tracking-wider mt-1.5 uppercase">
                {t('account.statsPlayed')}
              </span>
            </div>

            {/* KILLS */}
            <div className="flex flex-col items-center justify-center px-1">
              <span className="text-3xl font-extrabold tracking-tight text-white" data-testid="stat-kills">
                {stats.kills}
              </span>
              <span className="text-[11px] font-bold text-slate-400 tracking-wider mt-1.5 uppercase">
                {t('account.statsKills')}
              </span>
            </div>

            {/* WIN */}
            <div className="flex flex-col items-center justify-center px-1">
              <span className="text-3xl font-extrabold tracking-tight text-[#ffaa00]" data-testid="stat-win">
                ₹{winAmount}
              </span>
              <span className="text-[11px] font-bold text-slate-400 tracking-wider mt-1.5 uppercase">
                {t('account.statsWin')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION: ACCOUNT SETTINGS ─────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 px-1">
          <span className="h-4 w-1 rounded-full bg-violet-600 inline-block" />
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">
            {t('account.secAccountSettings')}
          </h2>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-[#121324] overflow-hidden divide-y divide-slate-800/60 shadow-md">
          {/* My Profile */}
          <button
            type="button"
            onClick={() => navigate('/account/profile')}
            data-testid="menu-my-profile-btn"
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-slate-300">
                <User className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-slate-100">{t('account.menuMyProfile')}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>

          {/* Game UID Details */}
          <button
            type="button"
            onClick={() => navigate('/account/game-uid')}
            data-testid="menu-game-uid-btn"
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-slate-300">
                <User className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-slate-100">{t('account.menuGameUid')}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>

          {/* My Statistics */}
          <button
            type="button"
            onClick={() => navigate('/account/statistics')}
            data-testid="menu-my-statistics-btn"
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-slate-300">
                <BarChart2 className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-slate-100">{t('account.menuMyStatistics')}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* ─── SECTION: COMMUNITY & SUPPORT ──────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 px-1">
          <span className="h-4 w-1 rounded-full bg-violet-600 inline-block" />
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">
            {t('account.secCommunitySupport')}
          </h2>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-[#121324] overflow-hidden divide-y divide-slate-800/60 shadow-md">
          {/* Join Community */}
          <button
            type="button"
            onClick={() => navigate('/community')}
            data-testid="menu-join-community-btn"
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-slate-300">
                <Users className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-slate-100">{t('account.menuJoinCommunity')}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>

          {/* Customer Support */}
          <button
            type="button"
            onClick={() => navigate('/support')}
            data-testid="menu-customer-support-btn"
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-slate-300">
                <Headphones className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-slate-100">{t('account.menuSupport')}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* ─── SECTION: MORE ─────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 px-1">
          <span className="h-4 w-1 rounded-full bg-violet-600 inline-block" />
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">
            {t('account.secAboutLegal')}
          </h2>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-[#121324] overflow-hidden divide-y divide-slate-800/60 shadow-md">
          {/* About Us */}
          <button
            type="button"
            onClick={() => navigate('/about')}
            data-testid="menu-about-us-btn"
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-slate-300">
                <Info className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-slate-100">{t('account.menuAboutUs')}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>

          {/* Privacy Policy */}
          <button
            type="button"
            onClick={() => navigate('/privacy')}
            data-testid="menu-privacy-policy-btn"
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-slate-300">
                <Lock className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-slate-100">{t('account.menuPrivacyPolicy')}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>

          {/* Refer App */}
          <button
            type="button"
            onClick={() => navigate('/referral')}
            data-testid="menu-share-app-btn"
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-slate-300">
                <Share2 className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-slate-100">{t('account.menuShareRefer')}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>

          {/* Download App */}
          <div data-testid="profile-download-app-section">
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              download="Booyah_Win.apk"
              data-testid="profile-download-app-btn"
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-emerald-400">
                  <Download className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-slate-100">{t('account.menuDownloadApp')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </a>
          </div>

          {/* Push Notifications */}
          {isPushNotificationSupported() && (
            <div
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition"
              data-testid="menu-notifications-btn"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-violet-400">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-100 block">
                    {language === 'bn' ? 'পুশ নোটিফিকেশন' : 'Push Notifications'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {pushPermission === 'granted'
                      ? (language === 'bn' ? 'চালু আছে' : 'Active and enabled')
                      : (language === 'bn' ? 'বন্ধ আছে' : 'Not active')}
                  </span>
                </div>
              </div>
              {pushPermission === 'granted' ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{language === 'bn' ? 'সক্রিয়' : 'Enabled'}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={isSubscribingPush}
                  data-testid="account-enable-push-btn"
                  className="rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 px-3 py-1.5 text-xs font-bold text-slate-950 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubscribingPush ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{language === 'bn' ? 'চালু হচ্ছে...' : 'Enabling...'}</span>
                    </>
                  ) : (
                    <span>{language === 'bn' ? 'চালু করুন' : 'Enable'}</span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Logout */}
          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            data-testid="menu-logout-btn"
            className="w-full flex items-center justify-between p-3.5 hover:bg-rose-500/10 active:bg-rose-500/20 transition text-left group"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18192c] text-slate-300 group-hover:text-rose-400 transition-colors">
                <Power className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-slate-100 group-hover:text-rose-300 transition-colors">
                {t('account.menuLogout')}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* ─── SECTION: LANGUAGE PREFERENCE ──────────────────────────────── */}
      <div
        className="rounded-2xl border border-slate-800/90 bg-[#121324] p-4 shadow-md space-y-3"
        data-testid="profile-language-section"
      >
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              {t('profile.languagePreferenceTitle')}
            </h3>
            <p className="text-xs text-slate-400">
              {t('profile.languagePreferenceSubtitle')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3" data-testid="profile-language-options">
          <button
            type="button"
            data-testid="profile-lang-en"
            onClick={() => setLanguage('en', { syncServer: true })}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
              language === 'en'
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                : 'bg-[#18192c] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            <span>English</span>
            {language === 'en' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          </button>
          <button
            type="button"
            data-testid="profile-lang-bn"
            onClick={() => setLanguage('bn', { syncServer: true })}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
              language === 'bn'
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                : 'bg-[#18192c] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            <span>বাংলা</span>
            {language === 'bn' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* ─── Floating Help & Support Button (matches mockup) ─────────── */}
      <div className="pointer-events-none fixed bottom-20 left-0 right-0 z-40 mx-auto w-full max-w-md px-4 flex justify-start">
        <button
          type="button"
          onClick={() => navigate('/support')}
          aria-label={t('account.menuSupport') || 'Help & Support'}
          data-testid="floating-support-btn"
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 active:scale-90 transition-all ring-4 ring-slate-950/40"
        >
          <Headphones className="h-6 w-6 stroke-[2.5]" />
        </button>
      </div>

      {/* ─── Logout Confirmation Modal ─────────────────────────────────── */}
      {showLogoutModal && (
        <div
          data-testid="logout-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">{t('account.logoutModalTitle')}</h3>
                <p className="text-xs text-slate-400">{t('account.logoutModalDesc')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                data-testid="cancel-logout-btn"
                className="rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition active:scale-95"
              >
                {t('account.cancel') || t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                data-testid="confirm-logout-btn"
                className="rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition active:scale-95"
              >
                {t('account.menuLogout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
