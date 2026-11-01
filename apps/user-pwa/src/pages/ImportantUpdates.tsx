import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Megaphone, ChevronRight, X, ExternalLink } from 'lucide-react';
import { fetchImportantUpdates } from '../api/updates.js';
import type { ImportantUpdateDto } from '@booyah/shared';
import { useTranslation } from '../i18n/LanguageContext.js';

export const INITIAL_ANNOUNCEMENTS: ImportantUpdateDto[] = [];

/**
 * Helper to render text with clickable links for URLs.
 */
function renderTextWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:text-emerald-300 underline font-semibold break-all inline-flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <span>{part}</span>
          <ExternalLink className="h-3 w-3 inline" />
        </a>
      );
    }
    return part;
  });
}

export const ImportantUpdates: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [announcements, setAnnouncements] = useState<ImportantUpdateDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<ImportantUpdateDto | null>(null);

  const getCategoryLabel = (category: string) => {
    const lower = category?.toLowerCase();
    if (lower === 'announcement') return t('updates.filterAnnouncement');
    if (lower === 'rule') return t('updates.filterRule');
    if (lower === 'alert') return t('updates.filterAlert');
    return category;
  };

  // Dynamically load active announcements from API
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    fetchImportantUpdates()
      .then((data) => {
        if (isMounted) {
          setAnnouncements(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAnnouncements([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleNavigate = (url: string) => {
    if (!url) return;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(url.startsWith('/') ? url : `/${url}`);
    }
  };

  return (
    <div className="space-y-4" data-testid="important-updates-page">
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
        <h1 className="text-xl font-bold tracking-tight text-slate-100">{t('updates.title')}</h1>
      </div>

      {/* Announcements List */}
      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-8 h-8 mx-auto rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400">Loading updates...</p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
            <Megaphone className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-200">{t('updates.noUpdatesFound')}</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              {t('updates.noUpdatesDesc')}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {announcements.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedAnnouncement(item)}
              className="flex items-center justify-between gap-3.5 p-4 rounded-2xl border border-slate-800/80 bg-[#121320] hover:border-slate-700 hover:bg-[#161726] transition cursor-pointer active:scale-[0.99] group shadow-sm"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                {/* Megaphone icon in purple rounded box */}
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1e1c3a] border border-violet-500/20 text-violet-400 group-hover:scale-105 transition-transform">
                  <Megaphone className="h-5 w-5" />
                </div>

                {/* Title & Category / Date */}
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-extrabold text-slate-100 leading-snug line-clamp-1 group-hover:text-emerald-400 transition-colors">
                    {item.title}
                  </h2>
                  <p className="text-[11px] font-semibold text-indigo-400 mt-1">
                    {getCategoryLabel(item.category)} · {item.dateDisplay}
                  </p>
                </div>
              </div>

              {/* Chevron Right */}
              <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Detailed Announcement Modal */}
      {selectedAnnouncement && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center animate-fade-in"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-5 text-left shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 line-clamp-1">
                    {selectedAnnouncement.title}
                  </h3>
                  <p className="text-[11px] font-semibold text-indigo-400 mt-0.5">
                    {getCategoryLabel(selectedAnnouncement.category)} · {selectedAnnouncement.dateDisplay}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                aria-label={t('common.close')}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-3.5 text-xs text-slate-300">
              <h4 className="font-bold text-sm text-slate-100">
                {selectedAnnouncement.heading}
              </h4>

              {selectedAnnouncement.points && selectedAnnouncement.points.length > 0 && (
                <div className="space-y-2.5">
                  {selectedAnnouncement.points.map((pt, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1"
                    >
                      <p className="font-bold text-emerald-400">{pt.label}</p>
                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        {renderTextWithLinks(pt.text)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {selectedAnnouncement.notice && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-300 leading-relaxed">
                  ⚠️ {renderTextWithLinks(selectedAnnouncement.notice)}
                </div>
              )}

              {/* Action Button for Link in Content */}
              {selectedAnnouncement.linkUrl && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleNavigate(selectedAnnouncement.linkUrl!)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 py-2.5 px-4 text-xs font-black text-slate-950 shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.98]"
                  >
                    <span>{selectedAnnouncement.linkText || t('updates.exploreMatches')}</span>
                    <ExternalLink className="h-3.5 w-3.5 stroke-[2.5]" />
                  </button>
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-xs font-bold text-white transition-all active:scale-[0.98] shadow-lg shadow-violet-600/25"
              >
                {t('updates.understand')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
