import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { formatIndianRupees } from '../utils/formatters.js';
import { Wallet, PlusCircle, ArrowDownToLine, Trophy, Flame, ShieldAlert } from 'lucide-react';

export const Home: React.FC = () => {
  const { user, wallets } = useAuth();

  return (
    <div className="space-y-5" data-testid="home-screen">
      {/* Player Header Banner */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">{user?.name || 'Player'}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-mono text-emerald-400 font-semibold">{user?.ffName || 'Player'}</span>
              <span>•</span>
              <span className="font-mono">ID: {user?.ffId || '—'}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
            ACTIVE
          </span>
        </div>
      </div>

      {/* Main Total Balance Card */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 p-5 shadow-xl">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
          <span className="flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-emerald-400" />
            Total Usable Balance
          </span>
          <span className="text-[11px] text-emerald-400">100% Secure</span>
        </div>
        <div className="text-3xl font-black tracking-tight text-slate-100" data-testid="total-balance">
          {formatIndianRupees(wallets?.total || '0.00')}
        </div>

        {/* Quick Action Buttons (Placeholders for M9b) */}
        <div className="mt-4 grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98]"
          >
            <PlusCircle className="h-4 w-4" />
            Add Money (Soon)
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-bold text-slate-200 transition-all hover:bg-slate-700 active:scale-[0.98]"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Withdraw (Soon)
          </button>
        </div>
      </div>

      {/* Wallet Breakdown Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Add Money Wallet */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center shadow-md">
          <div className="text-[10px] font-semibold text-slate-400">Add Money</div>
          <div className="mt-1 font-mono text-sm font-bold text-slate-200" data-testid="wallet-add-money">
            {formatIndianRupees(wallets?.addMoney || '0.00')}
          </div>
        </div>

        {/* Cashback Wallet */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center shadow-md">
          <div className="text-[10px] font-semibold text-slate-400">Cashback</div>
          <div className="mt-1 font-mono text-sm font-bold text-amber-400" data-testid="wallet-cashback">
            {formatIndianRupees(wallets?.cashback || '0.00')}
          </div>
        </div>

        {/* Winning Wallet */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center shadow-md">
          <div className="text-[10px] font-semibold text-slate-400">Winning</div>
          <div className="mt-1 font-mono text-sm font-bold text-emerald-400" data-testid="wallet-winning">
            {formatIndianRupees(wallets?.winning || '0.00')}
          </div>
        </div>
      </div>

      {/* Matches Placeholder (Milestone 9b preview) */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
          <Trophy className="h-5 w-5 text-amber-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-200">Custom Match Lobby</h3>
        <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
          Battle Royale and Clash Squad rooms are unlocking in Milestone 9b. Get ready to compete and win!
        </p>
      </div>

      {/* Platform Fair Play Notice */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/30 p-3 text-xs text-slate-400">
        <ShieldAlert className="h-4 w-4 shrink-0 text-slate-500" />
        <span>Strict anti-cheat monitoring active across all rooms.</span>
      </div>
    </div>
  );
};
