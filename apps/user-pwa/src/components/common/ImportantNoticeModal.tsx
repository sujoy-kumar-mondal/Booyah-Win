import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Flame, Crosshair, Ban, Clock, Award } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.js';

export interface ImportantNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportantNoticeModal: React.FC<ImportantNoticeModalProps> = ({ isOpen, onClose }) => {
  const { language } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalRoot =
    (typeof document !== 'undefined' && document.getElementById('modal-root')) ||
    (typeof document !== 'undefined' ? document.body : null);

  if (!modalRoot) return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-modal-title"
      data-testid="important-notice-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/25">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                  HOT
                </span>
                <h3 id="notice-modal-title" className="text-sm font-bold text-slate-100">
                  {language === 'bn' ? 'জরুরি টুর্নামেন্ট নোটিশ' : 'Important Tournament Notice'}
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {language === 'bn'
                  ? 'ফেয়ার প্লে এবং টুর্নামেন্ট নিয়মাবলি'
                  : 'Fair Play & Weapon Restrictions'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notice"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notices List */}
        <div className="space-y-3 text-xs text-slate-300">
          {/* Sniper Ban */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 flex items-start gap-2.5">
            <Crosshair className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-bold text-rose-300">
                {language === 'bn' ? 'স্নাইপার ব্যবহারে নিষেধাজ্ঞা' : 'Snipers Strictly Banned in Squad & CS'}
              </p>
              <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                {language === 'bn'
                  ? 'ক্লাশ স্কোয়াড (CS) এবং স্কোয়াড ম্যাচে AWM, M82B, Kar98k ব্যবহার সম্পূর্ণ নিষিদ্ধ। কোনো খেলোয়াড় এই অস্ত্র ব্যবহার করলে কোনো প্রাইজ দেওয়া হবে না।'
                  : 'Snipers (AWM, M82B, Kar98k) are strictly forbidden in Clash Squad and Squad matches. Players caught using them will forfeit all prize winnings.'}
              </p>
            </div>
          </div>

          {/* Emulator Ban */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2.5">
            <Ban className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">
                {language === 'bn' ? 'পিসি এমুলেটর নিষিদ্ধ' : 'Mobile Only — No Emulators'}
              </p>
              <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                {language === 'bn'
                  ? 'সমস্ত টুর্নামেন্ট শুধুমাত্র মোবাইল ডিভাইসের জন্য। এমুলেটর বা হ্যাক ব্যবহারকারীকে স্থায়ীভাবে ব্যান করা হবে।'
                  : 'All tournaments are strictly mobile-only. PC emulator or modified client usage triggers immediate permanent platform ban.'}
              </p>
            </div>
          </div>

          {/* Punctuality */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex items-start gap-2.5">
            <Clock className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <p className="font-bold text-slate-200">
                {language === 'bn' ? 'রুম আইডি ও পাসওয়ার্ড' : 'Room Entry & Punctuality'}
              </p>
              <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                {language === 'bn'
                  ? 'ম্যাচ শুরুর ১৫ মিনিট আগে রুম ক্রেডেনশিয়ালস অ্যাপে দেখা যাবে। নির্ধারিত সময়ে রুমে উপস্থিত না হলে কোনো রিফান্ড প্রযোজ্য হবে না।'
                  : 'Room credentials unlock 15 minutes before match start. Please join the Free Fire custom room promptly.'}
              </p>
            </div>
          </div>

          {/* Results Verification */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex items-start gap-2.5">
            <Award className="h-4 w-4 shrink-0 text-violet-400 mt-0.5" />
            <div>
              <p className="font-bold text-slate-200">
                {language === 'bn' ? 'ফলাফল ও উইনিং মানি' : 'Winnings & Fast Payouts'}
              </p>
              <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                {language === 'bn'
                  ? 'ম্যাচ শেষ হওয়ার পর ফলাফল দ্রুত যাচাই করা হয় এবং তৎক্ষণাৎ আপনার ওয়ালেটে টাকা ক্রেডিট হয়।'
                  : 'Match results are verified promptly after tournament completion and winnings are credited to your wallet for instant UPI withdrawal.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white transition-all hover:bg-violet-500 active:scale-[0.98] shadow-lg shadow-violet-600/20"
          >
            {language === 'bn' ? 'বুঝেছি' : 'I Understand & Agree'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, modalRoot);
};
