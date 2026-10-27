import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav.js';
import { SlowServerBanner } from '../common/SlowServerBanner.js';
import { MaintenanceBanner } from '../common/MaintenanceBanner.js';
import { Flame, Headphones } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.js';
import { useAuth } from '../../context/AuthContext.js';

export const AppLayout: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const isHomeAndAuthenticated = location.pathname === '/' && isAuthenticated;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SlowServerBanner />
      <MaintenanceBanner />

      {/* Top Header (shown on non-home pages, or for guest users on landing) */}
      {!isHomeAndAuthenticated && (
        <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 py-3">
          <div className="mx-auto flex max-w-md items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Flame className="h-5 w-5" />
              </div>
              <span className="font-extrabold text-base tracking-wider text-slate-100">
                BOOYAH<span className="text-emerald-400">WIN</span>
              </span>
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

      {/* Main Content Area (bounded to max-w-md for mobile-first) */}
      <main className="mx-auto flex-1 w-full max-w-md px-4 py-4 pb-24">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
};
