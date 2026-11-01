import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Key,
  Flame,
  Gamepad2,
  ArrowDownLeft,
  ArrowUpRight,
  Megaphone,
  Trophy,
  Bell,
  BellOff,
  Ban,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useNotifications, NotificationItem } from '../hooks/useNotifications.js';
import { useTranslation } from '../i18n/LanguageContext.js';
import { subscribeToPushNotifications, isPushNotificationSupported } from '../utils/pushNotifications.js';

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const { notifications, markAllAsRead } = useNotifications();

  const [pushPermission, setPushPermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);

  // Automatically mark all as read upon opening the notifications screen
  useEffect(() => {
    markAllAsRead();
  }, [markAllAsRead]);

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

  const handleNotificationClick = (notif: NotificationItem) => {
    let url = notif.actionUrl?.trim();

    // Fallbacks if actionUrl is missing
    if (!url) {
      if (notif.type === 'announcement') {
        url = '/important-updates';
      } else if (notif.type === 'wallet_deposit' || notif.type === 'wallet_withdrawal') {
        url = '/wallet/history';
      } else if (
        notif.type === 'match_joined' ||
        notif.type === 'room_open' ||
        notif.type === 'room_live' ||
        notif.type === 'tournament' ||
        notif.type === 'reward' ||
        notif.type === 'match_cancelled'
      ) {
        url = '/matches';
      }
    }

    if (!url) return;

    // External URL handling (for admin broadcasts or custom updates)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      // Internal route navigation
      const cleanUrl = url.startsWith('/') ? url : `/${url}`;
      navigate(cleanUrl);
    }
  };

  const renderIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'room_open':
      case 'room_credential':
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-950/60 text-violet-400 border border-violet-500/30 shadow-sm shadow-violet-500/10">
            <Key className="h-4 w-4" />
          </div>
        );
      case 'room_live':
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-950/60 text-rose-400 border border-rose-500/30 shadow-sm shadow-rose-500/10 animate-pulse">
            <Flame className="h-4 w-4" />
          </div>
        );
      case 'match_joined':
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">
            <Gamepad2 className="h-4 w-4" />
          </div>
        );
      case 'wallet_deposit':
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">
            <ArrowDownLeft className="h-4 w-4" />
          </div>
        );
      case 'wallet_withdrawal':
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-950/60 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        );
      case 'announcement':
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-950/60 text-purple-300 border border-purple-500/30 shadow-sm shadow-purple-500/10">
            <Megaphone className="h-4 w-4" />
          </div>
        );
      case 'reward':
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/20">
            <Trophy className="h-5 w-5" />
          </div>
        );
      case 'match_cancelled':
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-950/60 text-rose-400 border border-rose-500/30 shadow-sm shadow-rose-500/10">
            <Ban className="h-4 w-4" />
          </div>
        );
      case 'alert':
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-950/60 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10">
            <AlertTriangle className="h-4 w-4" />
          </div>
        );
      case 'tournament':
      default:
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-950/60 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10">
            <Trophy className="h-4 w-4" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-4" data-testid="notifications-page">
      {/* Header */}
      <div className="flex items-center gap-3.5 pb-3 border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t('common.back')}
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-slate-900 transition active:scale-95"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold tracking-tight text-slate-100">{t('notifications.title')}</h1>
      </div>

      {/* Enable Push Notifications Banner if not granted */}
      {pushPermission !== 'granted' && isPushNotificationSupported() && (
        <div
          data-testid="enable-push-banner"
          className="rounded-2xl border border-violet-500/30 bg-violet-950/40 p-4 shadow-lg backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {language === 'bn' ? 'পুশ নোটিফিকেশন চালু করুন' : 'Enable Push Notifications'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {language === 'bn'
                  ? 'ডিপোজিট অ্যাপ্রুভাল, উইথড্রয়াল এবং রুম পাসওয়ার্ডের তাৎক্ষণিক আপডেট পান।'
                  : 'Get instant alerts when your deposits are approved, withdrawals are sent, or match rooms open.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={isSubscribingPush}
            data-testid="enable-push-btn"
            className="shrink-0 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 px-4 py-2 text-xs font-bold text-slate-950 transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50"
          >
            {isSubscribingPush ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{language === 'bn' ? 'চালু হচ্ছে...' : 'Enabling...'}</span>
              </>
            ) : (
              <span>{language === 'bn' ? 'নোটিফিকেশন চালু করুন' : 'Enable Notifications'}</span>
            )}
          </button>
        </div>
      )}

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
            <BellOff className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-200">{t('notifications.noNotifications')}</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              {t('notifications.allCaughtUp')}
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80">
          {notifications.slice(0, 25).map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className="py-4 flex items-start gap-3.5 transition rounded-xl px-2 cursor-pointer hover:bg-slate-900/40 active:bg-slate-900/60"
            >
              {/* Icon */}
              {renderIcon(notif.type)}

              {/* Content */}
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-100 leading-snug line-clamp-1">
                    {notif.title}
                  </h2>
                  <span className="text-xs text-slate-400 font-medium shrink-0 ml-1">
                    {notif.timestamp}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {notif.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
