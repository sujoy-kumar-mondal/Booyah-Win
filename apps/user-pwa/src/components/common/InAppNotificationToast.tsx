import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Key,
  Flame,
  Megaphone,
  Trophy,
  Bell,
  X,
  ExternalLink,
} from 'lucide-react';
import type { NotificationItemDto } from '@booyah/shared';

export const InAppNotificationToast: React.FC = () => {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState<NotificationItemDto | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleInApp = (event: Event) => {
      const customEvent = event as CustomEvent<NotificationItemDto>;
      if (customEvent.detail) {
        setActiveItem(customEvent.detail);
        setIsVisible(true);
      }
    };

    window.addEventListener('bw_inapp_notification', handleInApp);
    return () => {
      window.removeEventListener('bw_inapp_notification', handleInApp);
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 7000);
    return () => clearTimeout(timer);
  }, [isVisible, activeItem]);

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!activeItem) return;
    setIsVisible(false);

    let url = activeItem.actionUrl?.trim();
    if (!url) {
      if (activeItem.type === 'wallet_deposit' || activeItem.type === 'wallet_withdrawal') {
        url = '/wallet/history';
      } else if (activeItem.type === 'announcement') {
        url = '/important-updates';
      } else {
        url = '/notifications';
      }
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      const clean = url.startsWith('/') ? url : `/${url}`;
      navigate(clean);
    }
  }, [activeItem, navigate]);

  if (!isVisible || !activeItem) {
    return null;
  }

  const renderIcon = () => {
    switch (activeItem.type) {
      case 'wallet_deposit':
        return (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <ArrowDownLeft className="h-5 w-5" />
          </div>
        );
      case 'wallet_withdrawal':
        return (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <ArrowUpRight className="h-5 w-5" />
          </div>
        );
      case 'room_open':
      case 'room_credential':
        return (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
            <Key className="h-5 w-5" />
          </div>
        );
      case 'room_live':
        return (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
            <Flame className="h-5 w-5" />
          </div>
        );
      case 'reward':
        return (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Trophy className="h-5 w-5" />
          </div>
        );
      case 'announcement':
        return (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Megaphone className="h-5 w-5" />
          </div>
        );
      default:
        return (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
            <Bell className="h-5 w-5" />
          </div>
        );
    }
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      onClick={handleClick}
      data-testid="inapp-notification-toast"
      className="fixed top-3 left-4 right-4 z-50 mx-auto max-w-md cursor-pointer animate-in fade-in slide-in-from-top-4 duration-300"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-violet-500/40 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 transition-all hover:bg-slate-900 hover:border-violet-500/60 active:scale-[0.99]">
        {renderIcon()}

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-white tracking-wide truncate">
              {activeItem.title}
            </p>
            <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider shrink-0 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              New
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
            {activeItem.message}
          </p>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300">
            <span>View Details</span>
            <ExternalLink className="h-3 w-3" />
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          data-testid="dismiss-toast-btn"
          className="shrink-0 -mr-1 -mt-1 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};
