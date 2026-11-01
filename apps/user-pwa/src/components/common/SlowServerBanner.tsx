import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useTranslation } from '../../i18n/LanguageContext.js';
import { RefreshCw } from 'lucide-react';

export const SlowServerBanner: React.FC = () => {
  const { slowServerNotice } = useAuth();
  const { t } = useTranslation();

  if (!slowServerNotice) return null;

  return (
    <div
      role="status"
      data-testid="slow-server-banner"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500/90 px-4 py-2 text-xs font-semibold text-slate-950 shadow-md backdrop-blur-sm"
    >
      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      <span>{t('common.slowServer')}</span>
    </div>
  );
};
