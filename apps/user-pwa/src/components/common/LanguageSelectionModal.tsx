import React, { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/LanguageContext.js';
import { Globe, Check } from 'lucide-react';

export const LanguageSelectionModal: React.FC = () => {
  const { isFirstVisitModalOpen, setLanguage, language } = useTranslation();
  const englishBtnRef = useRef<HTMLButtonElement>(null);
  const bengaliBtnRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trapping and initial focus
  useEffect(() => {
    if (isFirstVisitModalOpen) {
      // Focus English button on open
      englishBtnRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        // Prevent dismissal via Escape
        if (e.key === 'Escape') {
          e.preventDefault();
          return;
        }

        // Trap focus between the two option buttons
        if (e.key === 'Tab') {
          const focusedElement = document.activeElement;
          if (e.shiftKey) {
            // Shift + Tab: if on english, cycle to bengali
            if (focusedElement === englishBtnRef.current) {
              e.preventDefault();
              bengaliBtnRef.current?.focus();
            }
          } else {
            // Tab: if on bengali, cycle to english
            if (focusedElement === bengaliBtnRef.current) {
              e.preventDefault();
              englishBtnRef.current?.focus();
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFirstVisitModalOpen]);

  if (!isFirstVisitModalOpen) {
    return null;
  }

  const handleSelect = async (lang: 'en' | 'bn') => {
    await setLanguage(lang);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      data-testid="language-selection-modal-backdrop"
      // Backdrop clicks intentionally do NOT dismiss
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-modal-title"
        aria-describedby="language-modal-description"
        className="w-full max-w-md bg-[#0F172A] border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
        data-testid="language-selection-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 mx-auto mb-4 text-emerald-400">
          <Globe className="w-6 h-6 animate-pulse" />
        </div>

        <h2
          id="language-modal-title"
          className="text-xl sm:text-2xl font-bold text-center text-white mb-1.5"
          data-testid="language-modal-title"
        >
          Choose your language
        </h2>
        <p className="text-base font-semibold text-center text-emerald-400 mb-3">
          আপনার পছন্দের ভাষা নির্বাচন করুন
        </p>

        <p
          id="language-modal-description"
          className="text-xs sm:text-sm text-center text-slate-400 mb-6 leading-relaxed"
        >
          Select the language you want to use throughout Booyah Win. You can change this anytime from your profile or footer.
        </p>

        {/* Two large options displayed in their own script */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" data-testid="language-options-group">
          <button
            ref={englishBtnRef}
            type="button"
            data-testid="select-lang-en"
            onClick={() => handleSelect('en')}
            className={`group relative flex flex-col items-center justify-center p-5 rounded-xl border text-center transition-all duration-200 outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
              language === 'en'
                ? 'bg-slate-800/90 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                : 'bg-slate-800/40 border-slate-700/80 hover:bg-slate-800/80 hover:border-slate-600 text-slate-200'
            }`}
          >
            <span className="text-xl font-bold tracking-wide">English</span>
            <span className="text-xs text-slate-400 mt-1">Default</span>
            {language === 'en' && (
              <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Check className="w-3.5 h-3.5" />
              </span>
            )}
          </button>

          <button
            ref={bengaliBtnRef}
            type="button"
            data-testid="select-lang-bn"
            onClick={() => handleSelect('bn')}
            className={`group relative flex flex-col items-center justify-center p-5 rounded-xl border text-center transition-all duration-200 outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
              language === 'bn'
                ? 'bg-slate-800/90 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                : 'bg-slate-800/40 border-slate-700/80 hover:bg-slate-800/80 hover:border-slate-600 text-slate-200'
            }`}
          >
            <span className="text-xl font-bold tracking-wide font-bengali">বাংলা</span>
            <span className="text-xs text-slate-400 mt-1">Bengali</span>
            {language === 'bn' && (
              <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Check className="w-3.5 h-3.5" />
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
