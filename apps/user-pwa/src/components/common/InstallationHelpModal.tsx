import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  Settings,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { DOWNLOAD_APP_STRINGS } from '../../constants/downloadAppStrings.js';
import { useTranslation } from '../../i18n/LanguageContext.js';

export interface InstallationHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallationHelpModal: React.FC<InstallationHelpModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const topCloseButtonRef = useRef<HTMLButtonElement>(null);
  const bottomCloseButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const rootEl = typeof document !== 'undefined' ? document.getElementById('root') : null;
    if (rootEl) {
      rootEl.setAttribute('inert', '');
    }

    // Guarantee the scroll position starts at top: 0
    if (overlayRef.current) {
      overlayRef.current.scrollTop = 0;
    }

    // Focus top close button with preventScroll: true to avoid any automatic jumping/scrolling
    const timer = setTimeout(() => {
      if (overlayRef.current) {
        overlayRef.current.scrollTop = 0;
      }
      topCloseButtonRef.current?.focus({ preventScroll: true });
    }, 30);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      if (rootEl) {
        rootEl.removeAttribute('inert');
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalRoot =
    (typeof document !== 'undefined' && document.getElementById('modal-root')) ||
    (typeof document !== 'undefined' ? document.body : null);

  if (!modalRoot) return null;

  const content = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="installation-help-title"
      data-testid="installation-help-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Wrapper ensures content starts at top on mobile without negative coordinate clipping */}
      <div className="min-h-full flex items-start sm:items-center justify-center py-2 sm:py-6">
        <div
          className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 text-left shadow-2xl space-y-4 sm:space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3 sm:pb-4">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2
                  id="installation-help-title"
                  data-testid="installation-help-title"
                  className="text-base sm:text-lg font-bold text-slate-100 leading-tight"
                >
                  {t('downloadApp.dialogTitle') || DOWNLOAD_APP_STRINGS.dialogTitle}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  {t('downloadApp.dialogSubtitle') || DOWNLOAD_APP_STRINGS.dialogSubtitle}
                </p>
              </div>
            </div>
            <button
              ref={topCloseButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close installation help"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Steps */}
          <div className="space-y-3 sm:space-y-3.5">
            {/* Step 1 */}
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 sm:p-3.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                <Download className="h-4 w-4" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-sm font-semibold text-emerald-300">
                  {t('downloadApp.step1Title') || DOWNLOAD_APP_STRINGS.step1Title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('downloadApp.step1Desc') || DOWNLOAD_APP_STRINGS.step1Desc}
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:p-3.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20">
                <Settings className="h-4 w-4" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-200">
                  {t('downloadApp.step2Title') || DOWNLOAD_APP_STRINGS.step2Title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t('downloadApp.step2Desc') || DOWNLOAD_APP_STRINGS.step2Desc}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 sm:p-3.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-sm font-semibold text-amber-300">
                  {t('downloadApp.step3Title') || DOWNLOAD_APP_STRINGS.step3Title}
                </h3>
                <p className="text-xs text-slate-300/90 leading-relaxed">
                  {t('downloadApp.step3Desc') || DOWNLOAD_APP_STRINGS.step3Desc}
                </p>
              </div>
            </div>
          </div>

          {/* Official Source Warning */}
          <div className="flex items-start gap-2.5 sm:gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 sm:p-3.5 text-xs text-rose-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-semibold text-rose-300">
                {t('downloadApp.safetyWarningTitle') || DOWNLOAD_APP_STRINGS.safetyWarningTitle}
              </p>
              <p className="text-rose-200/90 leading-relaxed text-[11px] sm:text-xs">
                {t('downloadApp.safetyWarningDesc') || DOWNLOAD_APP_STRINGS.safetyWarningDesc}
              </p>
            </div>
          </div>

          {/* Close Action */}
          <div className="pt-1 sm:pt-2">
            <button
              ref={bottomCloseButtonRef}
              type="button"
              onClick={onClose}
              data-testid="installation-help-close-btn"
              className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98] shadow-lg shadow-emerald-500/10"
            >
              {t('downloadApp.closeDialog') || DOWNLOAD_APP_STRINGS.closeDialog}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, modalRoot);
};
