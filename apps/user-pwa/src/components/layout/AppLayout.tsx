import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav.js';
import { SlowServerBanner } from '../common/SlowServerBanner.js';
import { Flame } from 'lucide-react';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SlowServerBanner />

      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Flame className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-base tracking-wider text-slate-100">
              BOOYAH<span className="text-emerald-400">WIN</span>
            </span>
          </div>
          <div className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
            PWA LIVE
          </div>
        </div>
      </header>

      {/* Main Content Area (bounded to max-w-md for mobile-first) */}
      <main className="mx-auto flex-1 w-full max-w-md px-4 py-4 pb-24">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
};
