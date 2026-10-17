import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Medal, Crown, AlertCircle, RefreshCw, LogIn, UserPlus, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { getWeeklyLeaderboard, getUserLeaderboardRank } from '../api/leaderboard.js';
import type { LeaderboardResponse, LeaderboardRankResponse, LeaderboardEntry } from '../api/types.js';
import { formatIndianRupees, formatWeekRange } from '../utils/formatters.js';
import { useTranslation } from '../i18n/LanguageContext.js';

export const Leaderboard: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();

  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [userRank, setUserRank] = useState<LeaderboardRankResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboardData = useCallback(async () => {
    try {
      const [boardRes, rankRes] = await Promise.all([
        getWeeklyLeaderboard(),
        isAuthenticated ? getUserLeaderboardRank().catch(() => null) : Promise.resolve(null),
      ]);
      setLeaderboard(boardRes);
      setUserRank(rankRes);
      setError(null);
    } catch (err: any) {
      setError(err?.message || t('leaderboard.loadError'));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    let lastFetchTime = Date.now();
    fetchLeaderboardData();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastFetchTime >= 60000) {
          lastFetchTime = now;
          fetchLeaderboardData();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        lastFetchTime = Date.now();
        fetchLeaderboardData();
      }
    }, 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [fetchLeaderboardData]);

  const top3 = leaderboard?.entries.slice(0, 3) || [];
  const restEntries = leaderboard?.entries.slice(3) || [];

  return (
    <div className="space-y-4 pb-16" data-testid="leaderboard-page">
      {/* Guest Header */}
      {!isAuthenticated && (
        <div
          data-testid="guest-header"
          className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 backdrop-blur-sm"
        >
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{t('leaderboard.guestTitle')}</p>
            <p className="text-[11px] text-slate-300">{t('leaderboard.guestSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="flex items-center gap-1 rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{t('leaderboard.loginBtn')}</span>
            </Link>
            <Link
              to="/register"
              className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{t('leaderboard.registerBtn')}</span>
            </Link>
          </div>
        </div>
      )}

      {/* Header & Reset Notice */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-100 tracking-tight flex items-center gap-1.5">
                {t('leaderboard.weeklyTitle')}
              </h1>
              <p className="text-xs text-amber-400/90 font-medium">
                {leaderboard ? formatWeekRange(leaderboard.weekStart, leaderboard.weekEnd) : t('leaderboard.loadingWeek')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              fetchLeaderboardData();
            }}
            disabled={loading}
            aria-label={t('leaderboard.refresh')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-2.5 flex items-start gap-2 text-[11px] text-slate-400">
          <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <p>
            {t('leaderboard.resetNotice')}
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              fetchLeaderboardData();
            }}
            className="rounded bg-rose-500/20 px-2 py-1 font-semibold hover:bg-rose-500/30 text-rose-200"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Top 3 Visual Hierarchy */}
      {loading && !leaderboard ? (
        <div className="space-y-3">
          <div className="h-28 rounded-2xl bg-slate-900/50 animate-pulse border border-slate-800" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 rounded-2xl bg-slate-900/50 animate-pulse border border-slate-800" />
            <div className="h-24 rounded-2xl bg-slate-900/50 animate-pulse border border-slate-800" />
          </div>
        </div>
      ) : top3.length > 0 ? (
        <div className="space-y-3">
          {/* 1st Place Champion Card (Gold) */}
          {top3[0] && (
            <div
              data-testid="rank-card-1"
              className="relative overflow-hidden rounded-2xl border-2 border-amber-400/60 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 p-4 shadow-lg shadow-amber-500/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 font-black text-xl shadow-md shadow-amber-500/30">
                    <Crown className="h-7 w-7 text-slate-950 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300 border border-amber-400/30">
                        {t('leaderboard.rank1Champion')}
                      </span>
                    </div>
                    <p className="text-base font-black text-slate-100 truncate max-w-[180px] mt-0.5">
                      {top3[0].name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{t('leaderboard.winningsLabel')}</p>
                  <p className="text-lg font-black text-amber-400 tracking-tight">
                    {formatIndianRupees(top3[0].winnings)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2nd & 3rd Place Cards (Bronze & Silver) */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* 2nd Place (Bronze) */}
            {top3[1] ? (
              <div
                data-testid="rank-card-2"
                className="rounded-xl border border-amber-700/40 bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-950 p-3 shadow"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-700 text-amber-100 font-black text-sm">
                    <Medal className="h-5 w-5" />
                  </div>
                  <span className="rounded bg-amber-900/60 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-200">
                    {t('leaderboard.rank2')}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-100 truncate">{top3[1].name}</p>
                <p className="text-sm font-black text-amber-300 mt-1">
                  {formatIndianRupees(top3[1].winnings)}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 p-3 text-center text-xs text-slate-500">
                {t('leaderboard.awaiting2nd')}
              </div>
            )}

            {/* 3rd Place (Silver) */}
            {top3[2] ? (
              <div
                data-testid="rank-card-3"
                className="rounded-xl border border-slate-300/40 bg-gradient-to-br from-slate-800/40 via-slate-900 to-slate-950 p-3 shadow"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-300 text-slate-950 font-black text-sm">
                    <Medal className="h-5 w-5" />
                  </div>
                  <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-200">
                    {t('leaderboard.rank3')}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-100 truncate">{top3[2].name}</p>
                <p className="text-sm font-black text-slate-200 mt-1">
                  {formatIndianRupees(top3[2].winnings)}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 p-3 text-center text-xs text-slate-500">
                {t('leaderboard.awaiting3rd')}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-8 text-center space-y-2">
          <Trophy className="h-10 w-10 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">{t('leaderboard.noWinnersTitle')}</p>
          <p className="text-xs text-slate-500">
            {t('leaderboard.noWinnersDesc')}
          </p>
        </div>
      )}

      {/* Ranks 4 to 50 List */}
      {restEntries.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 space-y-2">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            {t('leaderboard.topContenders')}
          </h2>
          <div className="divide-y divide-slate-800/60" data-testid="leaderboard-list">
            {restEntries.map((entry: LeaderboardEntry) => (
              <div
                key={entry.rank}
                data-testid={`leaderboard-row-${entry.rank}`}
                className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-800/30 rounded-lg transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-xs font-extrabold text-slate-400">
                    #{entry.rank}
                  </span>
                  <p className="text-xs font-semibold text-slate-200 truncate max-w-[180px]">
                    {entry.name}
                  </p>
                </div>
                <span className="text-xs font-black text-emerald-400">
                  {formatIndianRupees(entry.winnings)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky Bottom "My Rank" Bar (Logged In Only) */}
      {isAuthenticated && (
        <div
          data-testid="my-rank-bar"
          className="sticky bottom-16 z-20 rounded-xl border border-emerald-500/40 bg-slate-950/95 backdrop-blur-md p-3 shadow-xl shadow-slate-950/60"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Medal className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">{t('leaderboard.yourRankTitle')}</p>
                {userRank ? (
                  <p className="text-xs font-extrabold text-slate-100">
                    {t('leaderboard.rankN', { rank: userRank.rank })}
                  </p>
                ) : (
                  <p className="text-xs font-medium text-slate-400">
                    {t('leaderboard.unrankedDesc')}
                  </p>
                )}
              </div>
            </div>
            {userRank && (
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-medium">{t('leaderboard.yourWinnings')}</p>
                <p className="text-xs font-black text-emerald-400">
                  {formatIndianRupees(userRank.winnings)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
