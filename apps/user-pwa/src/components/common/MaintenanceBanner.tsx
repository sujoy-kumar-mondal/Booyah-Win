import React, { useState } from 'react';
import { useMaintenance } from '../../context/MaintenanceContext.js';
import { useTranslation } from '../../i18n/LanguageContext.js';
import { Wrench, Clock, RefreshCw } from 'lucide-react';

export function formatIstDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return (
      d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        numberingSystem: 'latn',
      }) + ' IST'
    );
  } catch {
    return isoString;
  }
}

export const MaintenanceBanner: React.FC = () => {
  const { enabled, message, until, refreshStatus } = useMaintenance();
  const { t } = useTranslation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!enabled) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshStatus();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div
      role="alert"
      data-testid="maintenance-banner"
      className="fixed inset-0 z-[9999] bg-[#0b0c16] text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto"
    >
      <div className="mx-auto max-w-md w-full flex flex-col items-center my-auto py-8">
        {/* Booyah Win Logo */}
        <div className="flex items-center justify-center mb-8">
          <img
            src="/assets/logo_full.png"
            alt="Booyah Win"
            className="h-10 sm:h-12 w-auto object-contain drop-shadow-[0_0_20px_rgba(245,158,11,0.25)]"
          />
        </div>

        {/* Glowing Wrench Icon Card */}
        <div className="relative mb-6">
          <div className="absolute -inset-3 rounded-3xl bg-amber-500/20 blur-xl"></div>
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500/20 via-amber-950/40 to-slate-900 border-2 border-amber-500/40 shadow-2xl text-amber-400">
            <Wrench className="h-12 w-12 animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-3">
          {t('maintenance.systemMaintenance') || 'System Maintenance'}
        </h1>

        {/* Message */}
        <p
          className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-sm mb-6 whitespace-pre-wrap"
          data-testid="maintenance-message"
        >
          {message}
        </p>

        {/* Expected Finish Card */}
        {until && (
          <div
            className="flex items-center gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-xs sm:text-sm font-semibold text-amber-300 mb-8 shadow-inner"
            data-testid="maintenance-until"
          >
            <Clock className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              {t('maintenance.expectedFinish') || 'Expected to finish'}: {formatIstDateTime(until)}
            </span>
          </div>
        )}

        {/* Check Status Button */}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          data-testid="maintenance-refresh-btn"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 active:scale-95 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Checking Status...' : 'Check Status'}</span>
        </button>

        <p className="mt-8 text-xs text-slate-500 max-w-xs">
          All tournament matchmaking and wallet balances are protected and paused. The app will automatically restore once maintenance concludes.
        </p>
      </div>
    </div>
  );
};
