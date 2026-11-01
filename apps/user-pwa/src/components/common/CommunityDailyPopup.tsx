import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useTranslation } from '../../i18n/LanguageContext.js';
import { fetchCommunityLinks, type CommunityLinks } from '../../api/user.js';
import {
  X,
  MessageCircle,
  Instagram,
  Send,
  Youtube,
  Users,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

const DEFAULT_LINKS: CommunityLinks = {
  whatsapp: 'https://chat.whatsapp.com/demo',
  instagram: 'https://instagram.com/booyahwin',
  telegram: 'https://t.me/booyahwin',
  youtube: 'https://youtube.com/@booyahwin',
};

export function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const CommunityDailyPopup: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [links, setLinks] = useState<CommunityLinks>(DEFAULT_LINKS);
  const modalRef = useRef<HTMLDivElement>(null);

  // Check once-per-day logic whenever authenticated user changes
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setIsOpen(false);
      return;
    }

    try {
      const todayKey = getTodayDateKey();
      const storageKey = `bw_community_popup_${user.id}`;
      const lastShown = localStorage.getItem(storageKey);

      if (lastShown !== todayKey) {
        setIsOpen(true);
        localStorage.setItem(storageKey, todayKey);
      }
    } catch {
      // Ignore storage access errors (private browsing / disabled storage)
    }
  }, [isAuthenticated, user?.id]);

  // Load configured links from API
  useEffect(() => {
    let isMounted = true;
    async function loadLinks() {
      try {
        const data = await fetchCommunityLinks();
        if (isMounted && data) {
          setLinks({
            whatsapp: data.whatsapp || DEFAULT_LINKS.whatsapp,
            instagram: data.instagram || DEFAULT_LINKS.instagram,
            telegram: data.telegram || DEFAULT_LINKS.telegram,
            youtube: data.youtube || DEFAULT_LINKS.youtube,
          });
        }
      } catch {
        // Fallback to default links
      }
    }
    loadLinks();
    return () => {
      isMounted = false;
    };
  }, []);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleOpenChannel = (url?: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleNavigateToCommunity = () => {
    setIsOpen(false);
    navigate('/community');
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      data-testid="community-daily-popup-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        ref={modalRef}
        data-testid="community-daily-popup"
        className="relative w-full max-w-sm rounded-3xl border border-violet-500/30 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 p-5 shadow-2xl text-slate-100 overflow-hidden"
      >
        {/* Glow Accents */}
        <div className="absolute -top-16 -left-16 h-36 w-36 rounded-full bg-violet-600/25 blur-3xl pointer-events-none" />
        <div className="absolute -top-16 -right-16 h-36 w-36 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          data-testid="community-popup-close-btn"
          aria-label="Close community popup"
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95 z-10"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header with Badge & Icon */}
        <div className="space-y-2 relative z-0 pr-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
            <Sparkles className="h-3 w-3 text-violet-400" />
            <span>{t('communityPopup.badge') || 'Player Community'}</span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="text-base font-extrabold text-white tracking-tight">
              {t('communityPopup.title') || 'Join Our Official Community'}
            </h2>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
            {t('communityPopup.subtitle') ||
              'Connect with 50,000+ Free Fire players! Get instant match room credentials, schedule announcements, and daily giveaways.'}
          </p>
        </div>

        {/* Channels List */}
        <div className="space-y-2.5 pt-4">
          {/* WhatsApp Card */}
          <div
            data-testid="popup-channel-whatsapp"
            className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-slate-900/80 p-3 hover:border-emerald-500/40 transition-all shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-white truncate">WhatsApp</span>
                  <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                </div>
                <p className="text-[10px] text-slate-400 truncate">Room IDs & Password alerts</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenChannel(links.whatsapp)}
              data-testid="popup-join-whatsapp-btn"
              className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition active:scale-95 shadow-md shadow-emerald-600/20 shrink-0"
            >
              <span>{t('communityPopup.join') || 'Join'}</span>
              <ExternalLink className="h-3 w-3 opacity-80" />
            </button>
          </div>

          {/* Telegram Card */}
          <div
            data-testid="popup-channel-telegram"
            className="flex items-center justify-between gap-3 rounded-2xl border border-sky-500/20 bg-slate-900/80 p-3 hover:border-sky-500/40 transition-all shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <Send className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-white truncate">Telegram</span>
                  <ShieldCheck className="h-3 w-3 text-sky-400 shrink-0" />
                </div>
                <p className="text-[10px] text-slate-400 truncate">Match schedules & notices</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenChannel(links.telegram)}
              data-testid="popup-join-telegram-btn"
              className="flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500 transition active:scale-95 shadow-md shadow-sky-600/20 shrink-0"
            >
              <span>{t('communityPopup.join') || 'Join'}</span>
              <ExternalLink className="h-3 w-3 opacity-80" />
            </button>
          </div>

          {/* Instagram Card */}
          <div
            data-testid="popup-channel-instagram"
            className="flex items-center justify-between gap-3 rounded-2xl border border-pink-500/20 bg-slate-900/80 p-3 hover:border-pink-500/40 transition-all shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
                <Instagram className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-white truncate">Instagram</span>
                  <ShieldCheck className="h-3 w-3 text-pink-400 shrink-0" />
                </div>
                <p className="text-[10px] text-slate-400 truncate">Highlights & giveaways</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenChannel(links.instagram)}
              data-testid="popup-join-instagram-btn"
              className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:from-pink-500 hover:to-rose-500 transition active:scale-95 shadow-md shadow-pink-600/20 shrink-0"
            >
              <span>{t('communityPopup.follow') || 'Follow'}</span>
              <ExternalLink className="h-3 w-3 opacity-80" />
            </button>
          </div>

          {/* YouTube Card */}
          <div
            data-testid="popup-channel-youtube"
            className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-slate-900/80 p-3 hover:border-red-500/40 transition-all shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-500 border border-red-500/30">
                <Youtube className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-white truncate">YouTube</span>
                  <ShieldCheck className="h-3 w-3 text-red-400 shrink-0" />
                </div>
                <p className="text-[10px] text-slate-400 truncate">Streams & highlights</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenChannel(links.youtube || DEFAULT_LINKS.youtube!)}
              data-testid="popup-join-youtube-btn"
              className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:from-red-500 hover:to-rose-500 transition active:scale-95 shadow-md shadow-red-600/20 shrink-0"
            >
              <span>{t('communityPopup.subscribe') || 'Subscribe'}</span>
              <ExternalLink className="h-3 w-3 opacity-80" />
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 space-y-2">
          <button
            type="button"
            onClick={handleNavigateToCommunity}
            data-testid="popup-view-community-page-btn"
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-violet-500/40 bg-violet-600/20 py-2.5 text-xs font-bold text-violet-300 hover:bg-violet-600/30 hover:text-white transition active:scale-95"
          >
            <span>{t('communityPopup.viewAll') || 'View Community Page'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            data-testid="popup-dismiss-btn"
            className="w-full py-1 text-center text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            {t('communityPopup.maybeLater') || 'Maybe Later'}
          </button>
        </div>
      </div>
    </div>
  );
};

