import React from 'react';
import { useMaintenance } from '../../context/MaintenanceContext.js';
import { useTranslation } from '../../i18n/LanguageContext.js';
import { Wrench, Clock } from 'lucide-react';

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
  const { enabled, message, until } = useMaintenance();
  const { t } = useTranslation();

  if (!enabled) return null;

  return (
    <div
      role="alert"
      data-testid="maintenance-banner"
      className="bg-amber-500/10 border-b border-amber-500/30 text-amber-200 px-4 py-3 text-sm"
    >
      <div className="mx-auto max-w-md flex items-start gap-2.5">
        <Wrench className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-amber-300">{t('maintenance.systemMaintenance')}</p>
          <p className="text-xs text-amber-200/90 whitespace-pre-wrap leading-relaxed" data-testid="maintenance-message">
            {message}
          </p>
          {until && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400/80 pt-0.5" data-testid="maintenance-until">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{t('maintenance.expectedFinish')}: {formatIstDateTime(until)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
