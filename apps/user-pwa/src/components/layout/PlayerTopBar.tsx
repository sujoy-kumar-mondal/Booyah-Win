import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  formatIndianRupees,
  formatCompactRupees,
  getUserInitials,
} from '../../utils/formatters.js';
import { ImportantNoticeModal } from '../common/ImportantNoticeModal.js';
import { Headphones, Bell } from 'lucide-react';

export const PlayerTopBar: React.FC = () => {
  const { user, wallets } = useAuth();
  const navigate = useNavigate();
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);

  // Compute username: prioritize user.name, then email prefix, then ffName
  const username =
    user?.name || user?.email?.split('@')[0] || user?.ffName || 'Player';

  // Compute avatar initials: e.g. "sujoy kumar mondal" -> "SKM"
  const avatarInitials = getUserInitials(user?.name);

  // Formatted compact balance for the pill (e.g. "5" or "145")
  const compactBalance = formatCompactRupees(wallets?.total || '0');

  return (
    <>
      <ImportantNoticeModal
        isOpen={isNoticeOpen}
        onClose={() => setIsNoticeOpen(false)}
      />

      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0d0e17]/95 backdrop-blur-md px-4 py-2.5">
        <div className="mx-auto flex max-w-md items-center justify-between">
          {/* Left: Avatar + Username + Subtitle */}
          <div
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            {/* Avatar with Esports ring */}
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-800 text-white font-extrabold shadow-md shadow-violet-500/20 ring-2 ring-violet-500/40 transition-transform group-hover:scale-105 active:scale-95 overflow-hidden">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || 'User Avatar'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-black tracking-wider text-slate-100">
                  {avatarInitials}
                </span>
              )}
            </div>

            {/* Username & App Subtitle */}
            <div>
              <h2 className="text-sm font-black tracking-wide text-slate-100 group-hover:text-emerald-400 transition-colors leading-tight">
                {username}
              </h2>
              <p className="text-[11px] font-semibold text-indigo-400">Booyah Win</p>
            </div>
          </div>

          {/* Right: Wallet pill + Support Headphone + Bell */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Wallet pill button */}
            <div
              onClick={() => navigate('/wallet?tab=add')}
              className="flex items-center gap-2 rounded-full border border-slate-800 bg-[#121320] pl-3 pr-1 py-1 text-xs font-bold text-slate-100 shadow-sm cursor-pointer hover:border-slate-700 transition active:scale-95"
            >
              <span className="font-extrabold text-sm text-slate-100">{compactBalance}</span>
              <span data-testid="total-balance" className="sr-only">
                {formatIndianRupees(wallets?.total || '0.00')}
              </span>
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white font-bold text-xs shadow-sm">
                +
              </div>
            </div>

            {/* Customer Support Headphones */}
            <button
              type="button"
              onClick={() => navigate('/support')}
              aria-label="Customer Support"
              data-testid="header-support-btn"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:text-white transition active:scale-95"
            >
              <Headphones className="h-5 w-5" />
            </button>

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setIsNoticeOpen(true)}
              aria-label="Important Updates"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:text-white transition active:scale-95"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-slate-950" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
