import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Share2,
  Send,
  MessageCircle,
} from 'lucide-react';
import {
  SharePayload,
  getWhatsAppShareUrl,
  getTelegramShareUrl,
  getFacebookShareUrl,
  getTwitterShareUrl,
} from '../../utils/share.js';
import { useTranslation } from '../../i18n/LanguageContext.js';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: SharePayload;
  referralCode: string;
  onNotify: (msg: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  payload,
  referralCode,
  onNotify,
}) => {
  const { t } = useTranslation();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(payload.url);
    setCopiedLink(true);
    onNotify(t('referral.linkCopied'));
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    onNotify(t('referral.codeCopied'));
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onNotify(t('referral.openingShare'));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="share-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        data-testid="share-modal-content"
        className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-100">{t('referral.shareWithFriends')}</h2>
              <p className="text-[10px] text-slate-400">{t('referral.earnTogether')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            data-testid="share-modal-close-btn"
            className="rounded-xl p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Code Box */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>{t('referral.yourCodeLabel')}</span>
            <button
              onClick={handleCopyCode}
              data-testid="share-modal-copy-code-btn"
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold"
            >
              {copiedCode ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>{copiedCode ? t('common.copied') : t('referral.copyCode')}</span>
            </button>
          </div>
          <div className="font-mono text-base font-black tracking-widest text-emerald-400 select-all">
            {referralCode}
          </div>
        </div>

        {/* Social Share Options */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {t('referral.shareDirectly')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {/* WhatsApp */}
            <button
              type="button"
              data-testid="share-whatsapp-btn"
              onClick={() => handleShareClick(getWhatsAppShareUrl(payload))}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 py-2.5 px-3 text-xs font-bold text-white transition active:scale-[0.98] shadow-md shadow-emerald-600/20"
            >
              <MessageCircle className="h-4 w-4 fill-white" />
              <span>WhatsApp</span>
            </button>

            {/* Telegram */}
            <button
              type="button"
              data-testid="share-telegram-btn"
              onClick={() => handleShareClick(getTelegramShareUrl(payload))}
              className="flex items-center justify-center gap-2 rounded-xl bg-sky-600/90 hover:bg-sky-500 py-2.5 px-3 text-xs font-bold text-white transition active:scale-[0.98] shadow-md shadow-sky-600/20"
            >
              <Send className="h-4 w-4" />
              <span>Telegram</span>
            </button>

            {/* Facebook */}
            <button
              type="button"
              data-testid="share-facebook-btn"
              onClick={() => handleShareClick(getFacebookShareUrl(payload))}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-700/80 hover:bg-blue-600 py-2.5 px-3 text-xs font-bold text-white transition active:scale-[0.98]"
            >
              <span className="font-black text-sm">f</span>
              <span>Facebook</span>
            </button>

            {/* X / Twitter */}
            <button
              type="button"
              data-testid="share-twitter-btn"
              onClick={() => handleShareClick(getTwitterShareUrl(payload))}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 px-3 text-xs font-bold text-slate-200 transition active:scale-[0.98]"
            >
              <span className="font-black text-sm">𝕏</span>
              <span>Twitter</span>
            </button>
          </div>
        </div>

        {/* Copy Full Link Button */}
        <button
          type="button"
          onClick={handleCopyLink}
          data-testid="share-modal-copy-link-btn"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 py-3 text-xs font-bold text-slate-200 transition hover:bg-slate-800 hover:text-white active:scale-[0.98]"
        >
          {copiedLink ? (
            <>
              <Check className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-400">{t('referral.linkCopied')}</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>{t('referral.copyReferralLink')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
