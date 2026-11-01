import React, { useState } from 'react';
import { Smartphone, HelpCircle, X, Download } from 'lucide-react';
import { DOWNLOAD_APP_STRINGS } from '../../constants/downloadAppStrings.js';
import {
  isEligibleAndroidBrowser,
  dismissDownloadBanner,
  type DeviceDetectionOptions,
} from '../../utils/deviceDetection.js';
import { InstallationHelpModal } from './InstallationHelpModal.js';
import { useTranslation } from '../../i18n/LanguageContext.js';

export interface DownloadAppBannerProps {
  className?: string;
  detectionOptions?: DeviceDetectionOptions;
}

export const DownloadAppBanner: React.FC<DownloadAppBannerProps> = ({
  className = '',
  detectionOptions,
}) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(() => isEligibleAndroidBrowser(detectionOptions));
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  if (!isVisible) {
    return null;
  }

  const downloadUrl =
    detectionOptions && 'downloadUrl' in detectionOptions
      ? detectionOptions.downloadUrl
      : (import.meta.env.VITE_APP_DOWNLOAD_URL as string | undefined);

  if (!downloadUrl) {
    return null;
  }

  const handleDismiss = () => {
    dismissDownloadBanner();
    setIsVisible(false);
  };

  return (
    <>
      <div
        role="region"
        aria-label="App download banner"
        data-testid="download-app-banner"
        className={`relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900/95 p-3 sm:px-4 sm:py-3 shadow-lg ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
          {/* Left info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
              <Smartphone className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-100 tracking-tight">
                  {t('downloadApp.bannerTitle') || DOWNLOAD_APP_STRINGS.bannerTitle}
                </span>
                <button
                  type="button"
                  onClick={() => setIsHelpOpen(true)}
                  data-testid="install-help-btn"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400/90 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                >
                  <HelpCircle className="h-3 w-3" />
                  <span>{t('downloadApp.installHelpButton') || DOWNLOAD_APP_STRINGS.installHelpButton}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {t('downloadApp.bannerSubtitle') || DOWNLOAD_APP_STRINGS.bannerSubtitle}
              </p>
            </div>
          </div>

          {/* Right actions: Exactly "Download App" button + Dismiss button */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="download-app-btn"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/10 hover:bg-emerald-400 active:scale-[0.98] transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{t('downloadApp.downloadButton') || DOWNLOAD_APP_STRINGS.downloadButton}</span>
            </a>
            <button
              type="button"
              onClick={handleDismiss}
              data-testid="dismiss-banner-btn"
              aria-label={t('downloadApp.dismissAriaLabel') || DOWNLOAD_APP_STRINGS.dismissAriaLabel}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <InstallationHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </>
  );
};
