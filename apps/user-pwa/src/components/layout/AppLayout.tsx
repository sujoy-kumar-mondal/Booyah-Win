import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { BottomNav } from './BottomNav.js';
import { SlowServerBanner } from '../common/SlowServerBanner.js';
import { MaintenanceBanner } from '../common/MaintenanceBanner.js';
import { InAppNotificationToast } from '../common/InAppNotificationToast.js';
import { CommunityDailyPopup } from '../common/CommunityDailyPopup.js';
import { Headphones } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.js';
import { useAuth } from '../../context/AuthContext.js';

import { PlayerTopBar } from './PlayerTopBar.js';

export const AppLayout: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 pt-safe">
      <SlowServerBanner />
      {/* Priority 1: At first show maintenance banner when system is in maintenance */}
      <MaintenanceBanner />
      <InAppNotificationToast />
      <CommunityDailyPopup />

      {/* Persistent Top Header: Player Bar when authenticated, or Guest Header */}
      {isAuthenticated ? (
        <PlayerTopBar />
      ) : (
        <header className="sticky top-0 z-40 h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4">
          <div className="mx-auto flex h-full max-w-md items-center justify-between">
            <Link to="/" className="flex items-center gap-2" aria-label="Booyah Win Home">
              <img
                src="/assets/logo_full.png"
                alt="Booyah Win"
                className="h-8 w-auto object-contain"
              />
            </Link>

            <Link
              to="/support"
              data-testid="header-support-btn"
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-emerald-400 hover:border-emerald-500/30 transition-all active:scale-95"
              aria-label={t('common.support')}
            >
              <Headphones className="h-4 w-4 text-emerald-400" />
              <span>{t('common.support')}</span>
            </Link>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 px-4 pt-4 pb-24 mx-auto w-full max-w-md">
        <Outlet />
      </main>

      {/* Persistent Bottom Tab Bar */}
      <BottomNav />
    </div>
  );
};
