import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { formatIndianRupees, formatISTDateTime, formatGameMode } from '../utils/formatters.js';
import { fetchMatches, type MatchUserDto } from '../api/matches.js';
import {
  Wallet,
  PlusCircle,
  ArrowDownToLine,
  Trophy,
  Flame,
  ShieldAlert,
  Swords,
  ChevronRight,
  Clock,
  CheckCircle2,
  Gift,
} from 'lucide-react';

export const Home: React.FC = () => {
  const { user, wallets } = useAuth();
  const navigate = useNavigate();
  const [ongoingMatches, setOngoingMatches] = useState<MatchUserDto[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetchMatches()
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setOngoingMatches(data);
        }
      })
      .catch(() => {
        // Ignored, defaults to lobby CTA card
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

        {/* Quick Action Buttons */}
        <div className="mt-4 grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/wallet?tab=add')}
            data-testid="home-add-money-btn"
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98]"
          >
            <PlusCircle className="h-4 w-4" />
            Add Money
          </button>
          <button
            type="button"
            onClick={() => navigate('/wallet?tab=withdraw')}
            data-testid="home-withdraw-btn"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-bold text-slate-200 transition-all hover:bg-slate-700 active:scale-[0.98]"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Withdraw
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

      {/* Quick Action Banner: Leaderboard & Referral */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => navigate('/leaderboard')}
          data-testid="home-nav-leaderboard"
          className="flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 to-slate-900 p-3 text-left transition hover:border-amber-500/40 active:scale-98"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-100">Leaderboard</p>
            <p className="text-[10px] text-amber-400 font-medium">Weekly Top 50</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/referral')}
          data-testid="home-nav-referral"
          className="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 to-slate-900 p-3 text-left transition hover:border-emerald-500/40 active:scale-98"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-100">Refer & Earn</p>
            <p className="text-[10px] text-emerald-400 font-medium">Cashback bonus</p>
          </div>
        </button>
      </div>

      {/* Ongoing Matches / Custom Match Lobby */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">Custom Match Lobby</h3>
          </div>
          <button
            type="button"
            onClick={() => navigate('/matches')}
            data-testid="home-view-all-matches"
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span>View All</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {ongoingMatches.length > 0 ? (
          <div className="space-y-2.5">
            {ongoingMatches.slice(0, 3).map((match) => {
              const firstPrize =
                match.prizes?.positions?.['1'] || match.prizes?.positions?.['1st'] || '0.00';
              return (
                <div
                  key={match.id}
                  onClick={() => navigate('/matches')}
                  data-testid={`home-match-card-${match.id}`}
                  className="group cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/90 p-4 transition-all hover:border-slate-700 hover:bg-slate-900 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                          {formatGameMode(match.gameMode)}
                        </span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                          {match.teamMode}
                        </span>
                        {match.hasJoined && (
                          <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            Joined
                          </span>
                        )}
                      </div>
                      <h4 className="mt-2 text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                        {(match as any).map || 'Bermuda'}
                      </h4>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          {formatISTDateTime(match.startTime)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-slate-400">Entry Fee</div>
                      <div className="font-mono text-sm font-bold text-slate-100">
                        {formatIndianRupees(match.entryFee)}
                      </div>
                      <div className="mt-1 text-[10px] font-semibold text-amber-400">
                        Prize: {formatIndianRupees(firstPrize)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950 p-5 text-center shadow-lg">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner">
              <Trophy className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-100">Live Custom Match Rooms</h4>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              Battle Royale & Clash Squad custom rooms are live! Join tournaments, compete with your squad, and win real cash prizes.
            </p>
            <button
              type="button"
              onClick={() => navigate('/matches')}
              data-testid="enter-matches-btn"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-md transition-all hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98]"
            >
              <Swords className="h-4 w-4" />
              Enter Match Lobby
            </button>
          </div>
        )}
      </div>

      {/* Platform Fair Play Notice */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/30 p-3 text-xs text-slate-400">
        <ShieldAlert className="h-4 w-4 shrink-0 text-slate-500" />
        <span>Strict anti-cheat monitoring active across all rooms.</span>
      </div>
    </div>
  );
};
