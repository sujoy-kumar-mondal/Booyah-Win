import React, { useState, useEffect } from 'react';
import { History, Swords, Clock, AlertCircle, ChevronDown } from 'lucide-react';
import { fetchMatchHistory, type MatchHistoryItem } from '../../api/matches.js';
import { formatIndianRupees, formatISTDateTime, formatGameMode } from '../../utils/formatters.js';
import { useTranslation } from '../../i18n/LanguageContext.js';

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
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
    if (s.includes('second') || s.includes('third') || s.match(/^\d+(st|nd|rd|th)/)) {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
    if (s.includes('cancelled') || s.includes('refund')) {
      return 'bg-slate-700/50 text-slate-300 border-slate-600';
    }
    if (s.includes('pending')) {
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
    if (s.includes('lost')) {
      return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div data-testid="match-history-container" className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs py-1 scrollbar-none">
        <select
          data-testid="history-game-filter"
          value={gameModeFilter}
          onChange={(e) => setGameModeFilter(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-semibold text-slate-300 focus:border-emerald-500 focus:outline-none"
        >
          <option value="all">{t('matches.allGameModes')}</option>
          <option value="battle_royale">Battle Royale</option>
          <option value="clash_squad">Clash Squad</option>
        </select>

        <select
          data-testid="history-team-filter"
          value={teamModeFilter}
          onChange={(e) => setTeamModeFilter(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-semibold text-slate-300 focus:border-emerald-500 focus:outline-none"
        >
          <option value="all">{t('matches.allTeamModes')}</option>
          <option value="solo">Solo</option>
          <option value="duo">Duo</option>
          <option value="squad">Squad</option>
        </select>
      </div>

      {/* Loading */}
      {isLoading && items.length === 0 && (
        <div data-testid="history-loading" className="py-12 text-center text-xs text-slate-400">
          <History className="mx-auto h-6 w-6 animate-spin text-emerald-400" />
          <p className="mt-2 font-medium">{t('matches.loadingHistory')}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          data-testid="history-error"
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300"
        >
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="h-4 w-4" />
            <span>{t('matches.failedLoadHistory')}</span>
          </div>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && items.length === 0 && (
        <div
          data-testid="history-empty"
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400"
        >
          <Swords className="mx-auto h-8 w-8 text-slate-600" />
          <h4 className="mt-2 text-sm font-bold text-slate-300">{t('matches.noMatchesPlayedTitle')}</h4>
          <p className="mt-1">{t('matches.noHistoryDesc')}</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {items.map((item) => {
          const isBR =
            item.gameMode.toLowerCase().includes('battle') || item.gameMode.toLowerCase() === 'br';
          return (
            <div
              key={item.matchId}
              data-testid={`history-item-${item.matchId}`}
              className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-md space-y-2.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                      {formatGameMode(item.gameMode)}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                      {item.teamMode}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatISTDateTime(item.startTime)}</span>
                  </div>
                </div>

                {/* Status Badge with all possible server labels */}
                <span
                  data-testid={`history-status-badge-${item.matchId}`}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${getStatusBadgeStyle(
                    item.displayStatus
                  )}`}
                >
                  {item.displayStatus}
                </span>
              </div>

              {/* Stats & Amounts */}
              <div className="grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400">{t('matches.entryFee')}</span>
                  <div className="font-semibold text-slate-200">
                    {formatIndianRupees(item.entryFee)}
                  </div>
                </div>

                {isBR && item.kills !== undefined && (
                  <div>
                    <span className="text-[10px] text-slate-400">{t('matches.kills')}</span>
                    <div
                      data-testid={`history-kills-${item.matchId}`}
                      className="font-semibold text-slate-200"
                    >
                      {item.kills}
                    </div>
                  </div>
                )}

                <div className="text-right ml-auto">
                  <span className="text-[10px] text-slate-400">{t('matches.prizeWon')}</span>
                  <div
                    data-testid={`history-prize-${item.matchId}`}
                    className="font-bold text-emerald-400"
                  >
                    {formatIndianRupees(item.payout)}
                  </div>
                </div>
              </div>
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
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
