import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserStatistics, type UserStatistics } from '../api/user.js';
import { fetchMatchHistory, type MatchHistoryItem } from '../api/matches.js';
import { formatISTDateTime } from '../utils/formatters.js';
import { useTranslation } from '../i18n/LanguageContext.js';
import {
  ArrowLeft,
  BarChart2,
  Trophy,
  Swords,
  IndianRupee,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const MyStatistics: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [stats, setStats] = useState<UserStatistics>({ played: 0, kills: 0, totalWinnings: '0.00' });
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [statsData, historyData] = await Promise.all([
          fetchUserStatistics(),
          fetchMatchHistory({ limit: 20 }).catch(() => ({ items: [] as MatchHistoryItem[], hasMore: false })),
        ]);
        if (isMounted) {
          if (statsData) setStats(statsData);
          if (historyData?.items) {
            // Filter completed/settled matches
            const completed = historyData.items.filter(
              (m) => m.matchStatus === 'completed' && !m.refundedAt
            );
            setMatches(completed);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to load statistics.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const winAmount = Math.floor(Number(stats.totalWinnings || '0'));
  const avgKills = stats.played > 0 ? (stats.kills / stats.played).toFixed(1) : '0.0';

  return (
    <div className="space-y-4 pb-6" data-testid="my-statistics-screen">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
        <button
          type="button"
          onClick={() => navigate('/account')}
          aria-label={t('account.cancel') || 'Back to Account'}
          data-testid="back-to-account-btn"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-violet-400" />
          <h1 className="text-lg font-bold text-slate-100">{t('myStatistics.title')}</h1>
        </div>
      </div>

      {isLoading && (
        <div
          data-testid="stats-loading"
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2"
        >
          <RefreshCw className="h-5 w-5 animate-spin text-violet-400" />
          <span>{t('myStatistics.loading')}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          data-testid="stats-error"
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* Main 3 High-Level Metrics */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* Matches Played */}
            <div
              data-testid="stats-box-played"
              className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-[#121422] p-4 text-center shadow"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 mb-1.5">
                <Trophy className="h-4 w-4" />
              </div>
              <span className="text-2xl font-black text-slate-100" data-testid="stats-played-val">
                {stats.played}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {t('account.statsPlayed') || 'Played'}
              </span>
            </div>

            {/* Total Kills */}
            <div
              data-testid="stats-box-kills"
              className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-[#121422] p-4 text-center shadow"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 mb-1.5">
                <Swords className="h-4 w-4" />
              </div>
              <span className="text-2xl font-black text-slate-100" data-testid="stats-kills-val">
                {stats.kills}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {t('account.statsKills') || 'Kills'}
              </span>
            </div>

            {/* Total Win */}
            <div
              data-testid="stats-box-win"
              className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-[#121422] p-4 text-center shadow"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 mb-1.5">
                <IndianRupee className="h-4 w-4" />
              </div>
              <span className="text-2xl font-black text-amber-400" data-testid="stats-win-val">
                ₹{winAmount}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {t('account.statsWin') || 'Win'}
              </span>
            </div>
          </div>

          {/* Secondary Performance Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span>{t('myStatistics.overallPerformance')}</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-3">
                <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                  {t('myStatistics.avgKillsPerMatch')}
                </span>
                <span className="font-bold text-slate-200 text-base mt-0.5 block font-mono" data-testid="stats-avg-kills">
                  {avgKills} / {t('myStatistics.perMatch') || 'match'}
                </span>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-3">
                <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                  {t('myStatistics.totalWinnings')}
                </span>
                <span className="font-bold text-emerald-400 text-base mt-0.5 block font-mono" data-testid="stats-total-rewards">
                  ₹{stats.totalWinnings}
                </span>
              </div>
            </div>
          </div>

          {/* Completed Matches Breakdown */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              {t('myStatistics.recentCompletedMatches')}
            </h3>

            {matches.length === 0 ? (
              <div
                data-testid="no-matches-played"
                className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center space-y-3"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-500 mx-auto">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">
                    {t('myStatistics.noCompletedMatches')}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    {t('myStatistics.noCompletedDesc')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/matches')}
                  data-testid="find-matches-btn"
                  className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 transition active:scale-95"
                >
                  {t('myStatistics.exploreMatches')}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5" data-testid="completed-matches-list">
                {matches.map((item) => (
                  <div
                    key={item.matchId}
                    data-testid={`stats-match-item-${item.matchId}`}
                    className="rounded-2xl border border-slate-800 bg-[#121422] p-3.5 space-y-2 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200 uppercase">
                          {item.gameMode.replace('_', ' ')} | {item.teamMode.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">#{item.matchId}</span>
                      </div>
                      <span className="text-xs font-black text-amber-400 font-mono">
                        +₹{item.payout}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/60 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">{t('matches.killsLabel') || 'Kills'}</span>
                        <span className="font-bold text-slate-200">{item.kills}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">
                          {t('leaderboard.rank') || 'Rank / Position'}
                        </span>
                        <span className="font-bold text-slate-200">{item.positionLabel || (item.position ? `#${item.position}` : '—')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">{t('history.date') || 'Date'}</span>
                        <span className="font-medium text-slate-400 text-[10px]">{formatISTDateTime(item.startTime)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
