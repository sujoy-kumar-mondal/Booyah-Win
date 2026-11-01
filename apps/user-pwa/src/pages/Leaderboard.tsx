import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Crown,
  AlertCircle,
  LogIn,
  UserPlus,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import {
  getWeeklyLeaderboard,
  getUserLeaderboardRank,
  type LeaderboardPeriod,
} from '../api/leaderboard.js';
import type { LeaderboardResponse, LeaderboardRankResponse, LeaderboardEntry } from '../api/types.js';
import { formatIndianRupees } from '../utils/formatters.js';
import { useTranslation } from '../i18n/LanguageContext.js';
import { resolveImageUrl } from '../utils/imageUrl.js';

function formatCoinAmount(val: string | null | undefined): string {
  if (!val) return '0';
  const parts = val.split('.');
  return parts[0] || '0';
}

const RankAvatar: React.FC<{
  avatarUrl?: string | null;
  name: string;
  sizeClasses: string;
  borderClasses?: string;
  imgPadding?: string;
  testId?: string;
}> = ({ avatarUrl, name, sizeClasses, borderClasses = '', imgPadding = 'p-2', testId }) => {
  const [failed, setFailed] = useState(false);
  const showCustom = Boolean(avatarUrl && !failed);

  return (
    <div
      className={`relative flex ${sizeClasses} items-center justify-center rounded-full ${borderClasses} bg-gradient-to-b from-[#22243d] to-[#121323] shadow-lg overflow-hidden shrink-0`}
    >
      {showCustom ? (
        <img
          src={resolveImageUrl(avatarUrl)}
          alt={name}
          data-testid={testId || 'ranked-user-avatar'}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <img
          src="/assets/logo_icon.png"
          alt={name || 'Booyah Win'}
          data-testid={testId || 'ranked-default-avatar'}
          className={`h-full w-full object-contain ${imgPadding} bg-slate-900/90`}
        />
      )}
    </div>
  );
};

export const Leaderboard: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { t, language } = useTranslation();

  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [userRank, setUserRank] = useState<LeaderboardRankResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboardData = useCallback(
    async (p: LeaderboardPeriod = period) => {
      try {
        const [boardRes, rankRes] = await Promise.all([
          getWeeklyLeaderboard(p),
          isAuthenticated ? getUserLeaderboardRank(p).catch(() => null) : Promise.resolve(null),
        ]);
        setLeaderboard(boardRes);
        setUserRank(rankRes);
        setError(null);
      } catch (err: any) {
        setError(err?.message || t('leaderboard.loadError'));
      }
    },
    [isAuthenticated, period, t]
  );

  useEffect(() => {
    let lastFetchTime = Date.now();
    fetchLeaderboardData(period);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastFetchTime >= 60000) {
          lastFetchTime = now;
          fetchLeaderboardData(period);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        lastFetchTime = Date.now();
        fetchLeaderboardData(period);
      }
    }, 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [fetchLeaderboardData, period]);

  const top3 = leaderboard?.entries.slice(0, 3) || [];
  const restEntries = leaderboard?.entries.slice(3) || [];

  return (
    <div className="space-y-4 pb-20" data-testid="leaderboard-page">
      {/* Guest Header */}
      {!isAuthenticated && (
        <div
          data-testid="guest-header"
          className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 backdrop-blur-sm"
        >
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              {t('leaderboard.guestTitle')}
            </p>
            <p className="text-[11px] text-slate-300">{t('leaderboard.guestSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="flex items-center gap-1 rounded-xl bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{t('leaderboard.loginBtn')}</span>
            </Link>
            <Link
              to="/register"
              className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{t('leaderboard.registerBtn')}</span>
            </Link>
          </div>
        </div>
      )}

      {/* ─── 1. TAB SELECTOR (WEEKLY | MONTHLY | OVERALL) ─── */}
      <div className="flex items-center justify-between rounded-2xl bg-[#131525] p-1 border border-slate-800/80 shadow-inner max-w-sm mx-auto">
        <button
          type="button"
          onClick={() => {
            if (period !== 'weekly') {
              setPeriod('weekly');
            }
          }}
          className={`flex-1 rounded-xl py-2 px-2.5 text-xs font-black uppercase tracking-wider transition-all ${
            period === 'weekly'
              ? 'bg-[#20233a] text-white shadow-md border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {language === 'bn' ? 'সাপ্তাহিক' : 'WEEKLY'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (period !== 'monthly') {
              setPeriod('monthly');
            }
          }}
          className={`flex-1 rounded-xl py-2 px-2.5 text-xs font-black uppercase tracking-wider transition-all ${
            period === 'monthly'
              ? 'bg-[#20233a] text-white shadow-md border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {language === 'bn' ? 'মাসিক' : 'MONTHLY'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (period !== 'overall') {
              setPeriod('overall');
            }
          }}
          className={`flex-1 rounded-xl py-2 px-2.5 text-xs font-black uppercase tracking-wider transition-all ${
            period === 'overall'
              ? 'bg-[#20233a] text-white shadow-md border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {language === 'bn' ? 'সর্বকালীন' : 'OVERALL'}
        </button>
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
              fetchLeaderboardData(period);
            }}
            className="rounded bg-rose-500/20 px-2 py-1 font-semibold hover:bg-rose-500/30 text-rose-200"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* ─── 2. TOP 3 PODIUM DISPLAY ─── */}
      <div className="pt-2 pb-1">
        <div className="flex items-end justify-center gap-2.5 sm:gap-6">
          {/* Rank #2 (Left, Silver) */}
          <div
            className="flex flex-col items-center flex-1 max-w-[100px] text-center"
            data-testid="rank-card-2"
          >
            {top3[1] ? (
              <>
                <div className="relative mb-2">
                  <RankAvatar
                    avatarUrl={top3[1].avatarUrl}
                    name={top3[1].name}
                    sizeClasses="h-18 w-18 sm:h-20 sm:w-20"
                    borderClasses="border-[3.5px] border-slate-300 shadow-slate-300/10"
                    imgPadding="p-3"
                    testId="rank-card-2-avatar"
                  />
                  {/* #2 Badge */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-slate-950 font-black text-[11px] border-2 border-slate-900 shadow">
                    2
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-100 truncate w-full">{top3[1].name}</p>
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#1b1d2e] border border-slate-700/80 px-2.5 py-0.5 text-xs font-bold text-slate-200 shadow-sm">
                  <span className="text-amber-400 font-bold text-xs leading-none">₹</span>
                  <span>{formatCoinAmount(top3[1].winnings)}</span>
                </div>
                <span className="sr-only">{formatIndianRupees(top3[1].winnings)}</span>
                <span className="sr-only">{t('leaderboard.rank2')}</span>
              </>
            ) : (
              <div className="flex flex-col items-center opacity-40">
                <div className="h-18 w-18 sm:h-20 sm:w-20 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center">
                  <User className="h-8 w-8 text-slate-600" />
                </div>
                <p className="mt-2 text-[10px] text-slate-500 font-semibold">
                  {t('leaderboard.awaiting2nd')}
                </p>
              </div>
            )}
          </div>

          {/* Rank #1 (Center, Gold, Crown, Elevated) */}
          <div
            className="flex flex-col items-center flex-1 max-w-[120px] text-center -mt-3"
            data-testid="rank-card-1"
          >
            {top3[0] ? (
              <>
                {/* Crown Icon */}
                <div className="relative z-10 -mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-md shadow-amber-500/30">
                  <Crown className="h-4 w-4 fill-slate-950 stroke-[2.5]" />
                </div>
                <div className="relative mb-2">
                  <RankAvatar
                    avatarUrl={top3[0].avatarUrl}
                    name={top3[0].name}
                    sizeClasses="h-22 w-22 sm:h-24 sm:w-24"
                    borderClasses="border-4 border-yellow-400 shadow-xl shadow-yellow-500/20 ring-4 ring-yellow-400/10"
                    imgPadding="p-3.5"
                    testId="rank-card-1-avatar"
                  />
                  {/* #1 Badge */}
                  <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950 font-black text-xs border-2 border-slate-900 shadow-md">
                    1
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-black text-slate-100 truncate w-full">
                  {top3[0].name}
                </p>
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-400 text-slate-950 px-3 py-0.5 text-xs font-black shadow-md shadow-amber-400/25">
                  <span className="font-extrabold text-xs leading-none">₹</span>
                  <span>{formatCoinAmount(top3[0].winnings)}</span>
                </div>
                <span className="sr-only">{formatIndianRupees(top3[0].winnings)}</span>
                <span className="sr-only">{t('leaderboard.rank1Champion')}</span>
              </>
            ) : (
              <div className="flex flex-col items-center opacity-40">
                <div className="h-22 w-22 sm:h-24 sm:w-24 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center">
                  <Crown className="h-8 w-8 text-slate-600" />
                </div>
                <p className="mt-2 text-xs text-slate-500 font-semibold">
                  {t('leaderboard.noWinnersTitle')}
                </p>
              </div>
            )}
          </div>

          {/* Rank #3 (Right, Bronze) */}
          <div
            className="flex flex-col items-center flex-1 max-w-[100px] text-center"
            data-testid="rank-card-3"
          >
            {top3[2] ? (
              <>
                <div className="relative mb-2">
                  <RankAvatar
                    avatarUrl={top3[2].avatarUrl}
                    name={top3[2].name}
                    sizeClasses="h-18 w-18 sm:h-20 sm:w-20"
                    borderClasses="border-[3.5px] border-amber-600 shadow-amber-600/10"
                    imgPadding="p-3"
                    testId="rank-card-3-avatar"
                  />
                  {/* #3 Badge */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-amber-100 font-black text-[11px] border-2 border-slate-900 shadow">
                    3
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-100 truncate w-full">{top3[2].name}</p>
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#1b1d2e] border border-slate-700/80 px-2.5 py-0.5 text-xs font-bold text-slate-200 shadow-sm">
                  <span className="text-amber-400 font-bold text-xs leading-none">₹</span>
                  <span>{formatCoinAmount(top3[2].winnings)}</span>
                </div>
                <span className="sr-only">{formatIndianRupees(top3[2].winnings)}</span>
                <span className="sr-only">{t('leaderboard.rank3')}</span>
              </>
            ) : (
              <div className="flex flex-col items-center opacity-40">
                <div className="h-18 w-18 sm:h-20 sm:w-20 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center">
                  <User className="h-8 w-8 text-slate-600" />
                </div>
                <p className="mt-2 text-[10px] text-slate-500 font-semibold">
                  {t('leaderboard.awaiting3rd')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. LOWER RANKS (Rank 4 to 50 List) ─── */}
      <div className="rounded-3xl border border-slate-800/80 bg-[#0e101d] p-4 shadow-xl space-y-3">
        {/* Grabber handle */}
        <div className="h-1 w-10 rounded-full bg-slate-700/60 mx-auto" />

        {/* Table column headers */}
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
          <div className="flex items-center gap-4">
            <span className="w-7 text-left">{t('leaderboard.rankCol')}</span>
            <span>{t('leaderboard.playerCol')}</span>
          </div>
          <span>{t('leaderboard.prizeCol')}</span>
        </div>

        {restEntries.length > 0 ? (
          <div className="space-y-1 divide-y divide-slate-800/40" data-testid="leaderboard-list">
            {restEntries.map((entry: LeaderboardEntry) => (
              <div
                key={entry.rank}
                data-testid={`leaderboard-row-${entry.rank}`}
                className="flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-slate-800/40 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 text-xs font-black text-slate-400 shrink-0">
                    #{entry.rank}
                  </span>
                  <RankAvatar
                    avatarUrl={entry.avatarUrl}
                    name={entry.name}
                    sizeClasses="h-7 w-7"
                    borderClasses="border border-slate-700/60"
                    imgPadding="p-0.5"
                    testId={`leaderboard-avatar-${entry.rank}`}
                  />
                  <p className="text-xs font-bold text-slate-200 truncate">{entry.name}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 pl-2">
                  <span className="text-xs font-bold text-amber-400 leading-none">₹</span>
                  <span className="text-xs font-black text-amber-400">
                    {formatCoinAmount(entry.winnings)}
                  </span>
                  <span className="sr-only">{formatIndianRupees(entry.winnings)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500 font-medium">
            {top3.length === 0 ? t('leaderboard.noWinnersDesc') : t('leaderboard.topContenders')}
          </div>
        )}
      </div>

      {/* ─── 4. STICKY BOTTOM "YOUR RANK" BAR ─── */}
      {isAuthenticated && (
        <div
          data-testid="my-rank-bar"
          className="sticky bottom-16 z-20 rounded-2xl border border-amber-500/40 bg-[#0d0e1a]/95 backdrop-blur-md p-3 shadow-2xl flex items-center justify-between gap-3 ring-1 ring-amber-400/10"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-md">
              {userRank ? `#${userRank.rank}` : '-'}
            </div>
            <RankAvatar
              avatarUrl={userRank?.avatarUrl || user?.avatarUrl}
              name={user?.name || 'You'}
              sizeClasses="h-9 w-9"
              borderClasses="border border-amber-400/40"
              imgPadding="p-1.5"
              testId="my-rank-avatar"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                {t('leaderboard.yourRankTitle')}
              </p>
              <p className="text-xs font-bold text-slate-100 truncate">
                {user ? `You (${user.ffName || user.name})` : 'You'} ·{' '}
                {userRank ? (
                  <span>{t('leaderboard.rankN', { rank: userRank.rank })}</span>
                ) : (
                  <span className="text-slate-300 font-medium">{t('leaderboard.unrankedDesc')}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sm font-bold text-amber-400 leading-none">₹</span>
            <span className="text-sm font-black text-amber-400">
              {userRank ? formatCoinAmount(userRank.winnings) : '0'}
            </span>
            {userRank && (
              <span className="sr-only">{formatIndianRupees(userRank.winnings)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
