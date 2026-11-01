import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCommunityLinks, type CommunityLinks } from '../api/user.js';
import { useTranslation } from '../i18n/LanguageContext.js';
import {
  ArrowLeft,
  Users,
  ExternalLink,
  MessageCircle,
  Instagram,
  Send,
  Youtube,
  ShieldCheck,
} from 'lucide-react';

const DEFAULT_LINKS: CommunityLinks = {
  whatsapp: 'https://chat.whatsapp.com/demo',
  instagram: 'https://instagram.com/booyahwin',
  telegram: 'https://t.me/booyahwin',
  youtube: 'https://youtube.com/@booyahwin',
};

export const Community: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [links, setLinks] = useState<CommunityLinks>(DEFAULT_LINKS);

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
        // Fallback to default demo links
      }
    }

    loadLinks();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenChannel = (url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4 pb-6" data-testid="community-screen">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
        <button
          type="button"
          onClick={() => navigate('/account')}
          aria-label={t('account.cancel') || 'Back to Account'}
          data-testid="back-to-account-btn"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-violet-400" />
          <h1 className="text-lg font-bold text-slate-100">{t('community.title')}</h1>
        </div>
      </div>

      {/* Banner Card */}
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-slate-900 to-slate-950 p-5 space-y-2 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600/30 text-violet-300">
            <Users className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-bold text-slate-100">{t('community.bannerTitle')}</h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {t('community.bannerDesc')}
        </p>
      </div>

      {/* Community Channels List */}
      <div className="space-y-3 pt-1">
        {/* WhatsApp Channel Card */}
        <div
          data-testid="community-card-whatsapp"
          className="rounded-2xl border border-emerald-500/20 bg-[#121422] p-4 space-y-3 shadow-md"
        >
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-slate-100 text-sm">{t('community.whatsappTitle')}</h3>
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {t('community.whatsappDesc')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOpenChannel(links.whatsapp)}
            data-testid="join-whatsapp-btn"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition active:scale-95 shadow-md shadow-emerald-600/20"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{t('community.joinWhatsapp')}</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </button>
        </div>

        {/* Instagram Channel Card */}
        <div
          data-testid="community-card-instagram"
          className="rounded-2xl border border-pink-500/20 bg-[#121422] p-4 space-y-3 shadow-md"
        >
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 text-pink-400 border border-pink-500/30">
              <Instagram className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-slate-100 text-sm">{t('community.instagramTitle')}</h3>
                <ShieldCheck className="h-4 w-4 text-pink-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {t('community.instagramDesc')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOpenChannel(links.instagram)}
            data-testid="join-instagram-btn"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 py-2.5 text-xs font-bold text-white hover:from-pink-500 hover:to-rose-500 transition active:scale-95 shadow-md shadow-pink-600/20"
          >
            <Instagram className="h-4 w-4" />
            <span>{t('community.followInstagram')}</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </button>
        </div>

        {/* Telegram Channel Card */}
        <div
          data-testid="community-card-telegram"
          className="rounded-2xl border border-sky-500/20 bg-[#121422] p-4 space-y-3 shadow-md"
        >
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Send className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-slate-100 text-sm">{t('community.telegramTitle')}</h3>
                <ShieldCheck className="h-4 w-4 text-sky-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {t('community.telegramDesc')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOpenChannel(links.telegram)}
            data-testid="join-telegram-btn"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 text-xs font-bold text-white hover:bg-sky-500 transition active:scale-95 shadow-md shadow-sky-600/20"
          >
            <Send className="h-4 w-4" />
            <span>{t('community.joinTelegram')}</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </button>
        </div>

        {/* YouTube Channel Card */}
        <div
          data-testid="community-card-youtube"
          className="rounded-2xl border border-red-500/20 bg-[#121422] p-4 space-y-3 shadow-md"
        >
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-500 border border-red-500/30">
              <Youtube className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-slate-100 text-sm">{t('community.youtubeTitle')}</h3>
                <ShieldCheck className="h-4 w-4 text-red-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {t('community.youtubeDesc')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOpenChannel(links.youtube || DEFAULT_LINKS.youtube!)}
            data-testid="join-youtube-btn"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-2.5 text-xs font-bold text-white hover:from-red-500 hover:to-rose-500 transition active:scale-95 shadow-md shadow-red-600/20"
          >
            <Youtube className="h-4 w-4" />
            <span>{t('community.subscribeYoutube')}</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </button>
        </div>
      </div>
    </div>
  );
};
