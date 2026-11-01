import React, { useState, useEffect, useRef } from 'react';
import { X, HelpCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.js';

export interface UtrHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UtrHelpModal: React.FC<UtrHelpModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'gpay' | 'phonepe' | 'other'>('gpay');
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Reset to first tab whenever opened
    setActiveTab('gpay');

    // Focus close button on open
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="utr-modal-title"
      data-testid="utr-help-modal"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <HelpCircle className="h-4 w-4" />
            </div>
            <div>
              <h3 id="utr-modal-title" className="text-sm font-bold text-slate-100">
                {t('wallet.utrModalTitle') || 'Where to Find UTR Number'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t('wallet.utrModalSubtitle') || '12-digit transaction reference number'}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            data-testid="utr-modal-close-btn"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Short Explanation Box */}
        <div className="rounded-xl bg-slate-800/60 p-3 border border-slate-800 text-xs text-slate-300 space-y-1">
          <p className="leading-relaxed">
            {t('wallet.utrExplanation') ||
              'After completing your UPI payment, your UPI app generates a 12-digit Unique Transaction Reference (UTR). Enter this number below to verify your deposit.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 gap-1 text-xs font-semibold">
          <button
            type="button"
            data-testid="utr-tab-gpay"
            onClick={() => setActiveTab('gpay')}
            className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
              activeTab === 'gpay'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('wallet.utrTabGpay') || 'Google Pay'}
          </button>
          <button
            type="button"
            data-testid="utr-tab-phonepe"
            onClick={() => setActiveTab('phonepe')}
            className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
              activeTab === 'phonepe'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('wallet.utrTabPhonepe') || 'PhonePe'}
          </button>
          <button
            type="button"
            data-testid="utr-tab-other"
            onClick={() => setActiveTab('other')}
            className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
              activeTab === 'other'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('wallet.utrTabOther') || 'Paytm / Others'}
          </button>
        </div>

        {/* Tab Content: Google Pay */}
        {activeTab === 'gpay' && (
          <div className="space-y-3" data-testid="utr-content-gpay">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center p-2">
              <img
                src="/assets/utr_example_gpay.jpg"
                alt="Google Pay UTR Example"
                className="max-h-64 w-auto object-contain rounded-lg select-none"
              />
            </div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>{t('wallet.utrGpayStep1') || 'Open the completed transaction receipt in Google Pay.'}</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  {t('wallet.utrGpayStep2') ||
                    'Locate the 12-digit UPI transaction ID in the red box (e.g. 613511592698).'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: PhonePe */}
        {activeTab === 'phonepe' && (
          <div className="space-y-3" data-testid="utr-content-phonepe">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center p-2">
              <img
                src="/assets/utr_example_phonepe.jpg"
                alt="PhonePe UTR Example"
                className="max-h-64 w-auto object-contain rounded-lg select-none"
              />
            </div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>{t('wallet.utrPhonepeStep1') || 'Open the completed transaction receipt in PhonePe.'}</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  {t('wallet.utrPhonepeStep2') ||
                    'Click on "Transfer Details" to reveal the 12-digit UTR in the red box (e.g. 959654454573).'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Paytm / Others */}
        {activeTab === 'other' && (
          <div className="space-y-3" data-testid="utr-content-other">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center p-2">
              <img
                src="/assets/utr_example_paytm.jpg"
                alt="Paytm UTR Example"
                className="max-h-64 w-auto object-contain rounded-lg select-none"
              />
            </div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>{t('wallet.utrPaytmStep1') || 'Open the completed transaction receipt in Paytm.'}</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  {t('wallet.utrPaytmStep2') ||
                    'Locate the 12-digit UPI Ref No in the red box (e.g. 318308043065).'}
                </p>
              </div>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed pt-1 border-t border-slate-800/60">
              {t('wallet.utrOtherDesc') ||
                'In Paytm, BHIM, Amazon Pay or mobile banking apps, look for "UPI Ref No.", "Ref No.", or "UPI Reference ID" (12 digits).'}
            </p>
          </div>
        )}

        {/* Bottom Got It Button */}
        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            data-testid="close-utr-help-btn"
            onClick={onClose}
            className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-[0.98] transition-all"
          >
            {t('wallet.utrGotIt') || 'Got It'}
          </button>
        </div>
      </div>
    </div>
  );
};
