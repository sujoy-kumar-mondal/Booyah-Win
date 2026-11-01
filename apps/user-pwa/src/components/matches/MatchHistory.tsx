import React, { useState, useEffect } from 'react';
import {
  History,
  Swords,
  Clock,
  MapPin,
  AlertCircle,
  ChevronDown,
  Trophy,
  Medal,
  RotateCcw,
  Skull,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { fetchMatchHistory, type MatchHistoryItem } from '../../api/matches.js';
import { formatIndianRupees, formatMatchId } from '../../utils/formatters.js';
import { useTranslation } from '../../i18n/LanguageContext.js';

function formatCustomMatchDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // Convert to IST
    const istDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const day = istDate.getDate();
    const month = months[istDate.getMonth()];
    const year = istDate.getFullYear();
    let hours = istDate.getHours();
    const minutes = istDate.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
}

export const MatchHistory: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<MatchHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [gameModeFilter, setGameModeFilter] = useState<string>('all');
  const [teamModeFilter, setTeamModeFilter] = useState<string>('all');

  const loadHistory = async (reset = true) => {
    if (reset) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const res = await fetchMatchHistory({
        cursor: reset ? undefined : (nextCursor || undefined),
        limit: 20,
        gameMode: gameModeFilter !== 'all' ? gameModeFilter : undefined,
        teamMode: teamModeFilter !== 'all' ? teamModeFilter : undefined,
      });

      if (reset) {
        setItems(res.items);
      } else {
        setItems((prev) => [...prev, ...res.items]);
      }
      setNextCursor(res.nextCursor ?? null);
      setHasMore(res.hasMore);
    } catch (err: any) {
      setError(err?.message || t('matches.failedLoadHistory'));
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadHistory(true);
  }, [gameModeFilter, teamModeFilter]);

  const getStatusBadgeStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('booyah')) {
      return 'bg-gradient-to-r from-amber-500/25 to-yellow-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]';
    }
    if (s.includes('second') || s.includes('third') || s.match(/^\d+(st|nd|rd|th)/)) {
      return 'bg-gradient-to-r from-emerald-500/25 to-teal-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]';
    }
    if (s.includes('cancelled') || s.includes('refund')) {
      return 'bg-slate-800/80 text-slate-300 border-slate-700/80';
    }
    if (s.includes('pending')) {
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
    if (s.includes('lost')) {
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  const renderStatusIcon = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('booyah')) {
      return <Trophy className="h-3.5 w-3.5 text-amber-400" />;
    }
    if (s.includes('second') || s.includes('third') || s.match(/^\d+(st|nd|rd|th)/)) {
      return <Medal className="h-3.5 w-3.5 text-emerald-400" />;
    }
    if (s.includes('cancelled') || s.includes('refund')) {
      return <RotateCcw className="h-3.5 w-3.5 text-slate-400" />;
    }
    if (s.includes('pending')) {
      return <Clock className="h-3.5 w-3.5 text-blue-400" />;
    }
    if (s.includes('lost')) {
      return <Skull className="h-3.5 w-3.5 text-rose-400" />;
    }
    return null;
  };

  const renderResultBanner = (item: MatchHistoryItem) => {
    const s = item.displayStatus.toLowerCase();
    const payoutNum = Number(item.payout) || 0;

    if (payoutNum > 0) {
      return (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-300">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Prize Won: {formatIndianRupees(item.payout)}</span>
          </div>
          <span className="text-[10px] text-emerald-400/80 font-medium">Credited to Wallet</span>
        </div>
      );
    }

    if (s.includes('cancelled') || s.includes('refund')) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs font-semibold text-slate-300">
          <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
          <span>Match cancelled · Entry fee fully refunded</span>
        </div>
      );
    }

    if (s.includes('pending')) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-300">
          <Clock className="h-3.5 w-3.5 text-blue-400" />
          <span>Match ended · Results under verification</span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/30 border border-slate-800/60 text-xs text-slate-400">
        <span>Match Completed</span>
        <span className="text-[10px] text-slate-500">Rank: {item.positionLabel || item.displayStatus}</span>
      </div>
    );
  };

  return (
    <div data-testid="match-history-container" className="space-y-4">
      {/* Game Mode & Team Mode Dropdown Filters */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs py-1 scrollbar-none">
        {/* All Game Modes */}
        <div className="relative">
          <select
            data-testid="history-game-filter"
            value={gameModeFilter}
            onChange={(e) => setGameModeFilter(e.target.value)}
            className="appearance-none rounded-full border border-slate-800/90 bg-[#0c0e1a] pl-4 pr-8 py-2 font-bold text-slate-100 text-xs focus:border-purple-500 focus:outline-none transition-all shadow-sm cursor-pointer hover:border-slate-700"
          >
            <option value="all">{t('matches.allGameModes') || 'All Game Modes'}</option>
            <option value="battle_royale">Battle Royale</option>
            <option value="clash_squad">Clash Squad</option>
            <option value="lone_wolf">{t('enums.gameMode.lone_wolf') || 'Lone Wolf'}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        </div>

        {/* All Team Modes */}
        <div className="relative">
          <select
            data-testid="history-team-filter"
            value={teamModeFilter}
            onChange={(e) => setTeamModeFilter(e.target.value)}
            className="appearance-none rounded-full border border-slate-800/90 bg-[#0c0e1a] pl-4 pr-8 py-2 font-bold text-slate-100 text-xs focus:border-purple-500 focus:outline-none transition-all shadow-sm cursor-pointer hover:border-slate-700"
          >
            <option value="all">{t('matches.allTeamModes') || 'All Team Modes'}</option>
            <option value="solo">Solo</option>
            <option value="duo">Duo</option>
            <option value="squad">Squad</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && items.length === 0 && (
        <div data-testid="history-loading" className="py-12 text-center text-xs text-slate-400">
          <History className="mx-auto h-7 w-7 animate-spin text-purple-400" />
          <p className="mt-2.5 font-semibold text-slate-300">{t('matches.loadingHistory')}</p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          data-testid="history-error"
          className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadHistory(true)}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg font-bold transition-all text-xs"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && items.length === 0 && (
        <div
          data-testid="history-empty"
          className="rounded-3xl border border-slate-800/80 bg-[#0f111e]/80 p-10 text-center text-xs text-slate-400 shadow-xl"
        >
          <Swords className="mx-auto h-10 w-10 text-slate-600" />
          <h4 className="mt-3 text-sm font-black text-slate-200 tracking-tight">
            {t('matches.noMatchesPlayedTitle')}
          </h4>
          <p className="mt-1 text-slate-400 text-xs max-w-xs mx-auto">
            {t('matches.noHistoryDesc')}
          </p>
        </div>
      )}

      {/* Esports Cards List */}
      <div className="space-y-3.5">
        {items.map((item) => {
          const isCS = item.gameMode?.toLowerCase().includes('clash');
          const isLW = item.gameMode?.toLowerCase().includes('lone') || item.gameMode?.toLowerCase() === 'lw';
          const gameModeLabel = isLW ? 'LONE WOLF' : isCS ? 'CLASH SQUAD' : 'BATTLE ROYALE';
          const teamModeLabel = item.teamMode ? item.teamMode.toUpperCase() : 'SOLO';
          const cardTitle = `${gameModeLabel} | ${teamModeLabel}`;

          return (
            <div
              key={item.matchId}
              data-testid={`history-item-${item.matchId}`}
              className="rounded-3xl border border-slate-800/80 bg-[#0f111e]/90 p-4 shadow-xl backdrop-blur-sm relative overflow-hidden transition-all hover:border-slate-700/80 space-y-3"
            >
              {/* Header: FF MAX Golden Badge, Title, Match #ID, and Status Badge */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* FF MAX Golden Swords Badge */}
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30 text-amber-400 text-[10px] font-black tracking-wider uppercase">
                    <Swords className="h-3 w-3 text-amber-400" />
                    <span>FF MAX</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-black text-slate-100 uppercase tracking-wide">
                    {cardTitle}
                  </h3>

                  {/* Match ID */}
                  <span className="text-xs font-bold text-slate-500">{formatMatchId(item.matchId)}</span>
                </div>

                {/* Status Badge with Glowing Colors */}
                <span
                  data-testid={`history-status-badge-${item.matchId}`}
                  className={`rounded-full border px-3 py-1 text-xs font-black shadow-sm flex items-center gap-1.5 ${getStatusBadgeStyle(
                    item.displayStatus
                  )}`}
                >
                  {renderStatusIcon(item.displayStatus)}
                  <span>{item.displayStatus}</span>
                </span>
              </div>

              {/* Meta Tags Row: Mode: Regular | Date/Time in IST | Map: Bermuda */}
              <div className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-400 flex-wrap">
                <span className="rounded-md bg-slate-800/70 px-2 py-0.5 text-slate-300">
                  Mode: Regular
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  <span>{formatCustomMatchDate(item.startTime)}</span>
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  <span>{(item as any).mapName || (item as any).map || 'Bermuda'}</span>
                </span>
              </div>

              {/* 3-Column Stats Grid: Entry Fee | Kills | Prize Won */}
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#141726]/80 p-3 border border-slate-800/60 text-center">
                {/* Entry Fee */}
                <div className="flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {t('matches.entryFee')}
                  </span>
                  <span className="text-sm font-black text-slate-100 mt-0.5">
                    {formatIndianRupees(item.entryFee)}
                  </span>
                </div>

                {/* Kills */}
                <div className="flex flex-col items-center justify-center border-x border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {t('matches.kills')}
                  </span>
                  <span
                    data-testid={`history-kills-${item.matchId}`}
                    className="text-sm font-black text-slate-100 mt-0.5"
                  >
                    {item.kills ?? 0}
                  </span>
                </div>

                {/* Prize Won */}
                <div className="flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {t('matches.prizeWon')}
                  </span>
                  <span
                    data-testid={`history-prize-${item.matchId}`}
                    className={`text-sm font-black mt-0.5 ${
                      Number(item.payout) > 0
                        ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.35)] font-extrabold'
                        : 'text-slate-400'
                    }`}
                  >
                    {formatIndianRupees(item.payout)}
                  </span>
                </div>
              </div>

              {/* Bottom Result Summary Banner */}
              {renderResultBanner(item)}
            </div>
          );
        })}
      </div>

      {/* Cursor Pagination "Load More" */}
      {hasMore && (
        <div className="pt-2 text-center">
          <button
            type="button"
            data-testid="history-load-more-btn"
            onClick={() => loadHistory(false)}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-800 bg-[#0f111e] px-5 py-2.5 text-xs font-black text-slate-300 hover:text-white hover:border-slate-700 transition-all shadow-md disabled:opacity-50"
          >
            {isLoadingMore ? (
              <span>{t('common.loadingMore')}</span>
            ) : (
              <>
                <span>{t('common.loadMore')}</span>
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
