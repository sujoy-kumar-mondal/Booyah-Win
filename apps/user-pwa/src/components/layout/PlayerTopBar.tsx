import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useNotifications } from '../../hooks/useNotifications.js';
import { useTranslation } from '../../i18n/LanguageContext.js';
import { resolveImageUrl } from '../../utils/imageUrl.js';
import {
  formatIndianRupees,
  formatCompactRupees,
} from '../../utils/formatters.js';
import { Headphones, Bell } from 'lucide-react';

export const PlayerTopBar: React.FC = () => {
  const { t } = useTranslation();
  const { user, wallets } = useAuth();
  const navigate = useNavigate();
  const { hasUnread } = useNotifications();
  const [avatarError, setAvatarError] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
    setLogoError(false);
  }, [user?.avatarUrl]);

  // Compute username: prioritize user.name, then email prefix, then ffName
  const username =
    user?.name || user?.email?.split('@')[0] || user?.ffName || 'Player';

  // Formatted compact balance for the pill (e.g. "5" or "145")
  const compactBalance = formatCompactRupees(wallets?.total || '0');

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-slate-800/80 bg-[#0d0e17]/95 backdrop-blur-md px-4">
      <div className="mx-auto flex h-full max-w-md items-center justify-between gap-3">
        {/* Left: Avatar + Username + Full Name Logo */}
        <div
          onClick={() => navigate('/account')}
          className="flex items-center gap-2.5 cursor-pointer group min-w-0 flex-1 mr-1"
        >
          {/* Avatar with Esports ring */}
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-800 text-white font-extrabold shadow-md shadow-violet-500/20 ring-2 ring-violet-500/40 transition-transform group-hover:scale-105 active:scale-95 overflow-hidden">
            {user?.avatarUrl && !avatarError ? (
              <img
                src={resolveImageUrl(user.avatarUrl)}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : !logoError ? (
              <img
                src="/assets/logo_icon.png"
                alt=""
                className="h-full w-full object-contain p-1.5"
                data-testid="navbar-default-avatar"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="text-base font-black tracking-wider text-emerald-400">
                {username.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Username & Full Name Logo */}
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <h2
              className="text-sm font-black tracking-wide text-slate-100 group-hover:text-emerald-400 transition-colors leading-tight truncate whitespace-nowrap"
              title={username}
            >
              {username}
            </h2>
            <div className="flex items-center mt-0.5">
              <img
                src="/assets/logo_full.png"
                alt="Booyah Win"
                className="h-4 sm:h-[18px] w-auto object-contain"
                data-testid="navbar-brand-logo"
              />
            </div>
          </div>
        </div>

        {/* Right: Wallet pill + Support Headphone + Bell */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Wallet pill button */}
          <div
            onClick={() => navigate('/wallet/add')}
            className="flex shrink-0 items-center gap-2 rounded-full border border-slate-800 bg-[#121320] pl-3 pr-1 py-1 text-xs font-bold text-slate-100 shadow-sm cursor-pointer hover:border-slate-700 transition active:scale-95 whitespace-nowrap"
          >
            <span className="font-extrabold text-sm text-slate-100 whitespace-nowrap flex items-center">
              ₹&nbsp;{compactBalance}
            </span>
            <span data-testid="total-balance" className="sr-only">
              {formatIndianRupees(wallets?.total || '0.00')}
            </span>
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white font-bold text-xs shadow-sm">
              +
            </div>
          </div>

          {/* Customer Support Headphones */}
          <button
            type="button"
            onClick={() => navigate('/support')}
            aria-label={t('account.menuSupport') || 'Customer Support'}
            data-testid="header-support-btn"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-300 hover:text-white transition active:scale-95"
          >
            <Headphones className="h-5 w-5" />
          </button>

          {/* Notification Bell */}
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            aria-label={t('notifications.title') || 'Notifications'}
            data-testid="header-notifications-btn"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-300 hover:text-white transition active:scale-95"
          >
            <Bell className="h-5 w-5" />
            {hasUnread && (
              <span
                data-testid="notification-unread-dot"
                className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-slate-950"
              />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
