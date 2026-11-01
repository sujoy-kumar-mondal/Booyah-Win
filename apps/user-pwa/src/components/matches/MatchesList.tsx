import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCw,
  Swords,
  Clock,
  User,
  Users,
  MapPin,
  ChevronRight,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { fetchMatches, type MatchUserDto } from '../../api/matches.js';
import { useTranslation } from '../../i18n/LanguageContext.js';
import { calculateMatchPrizePool, isMatchClosed, formatMatchId } from '../../utils/formatters.js';
import { MatchDetailModal } from './MatchDetailModal.js';

interface MatchesListProps {
  statusTab?: 'upcoming' | 'live' | 'my_matches' | 'completed';
}

function formatCustomMatchDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // Convert to IST
    const istDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const day = istDate.getDate();
    const month = months[istDate.getMonth()];
    let hours = istDate.getHours();
    const minutes = istDate.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day} ${month} ${hours}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
}

function formatRelativeCountdown(dateStr: string, status?: string): string {
  if (status === 'live') return 'Live';
  if (status === 'completed') return 'Ended';
  if (status === 'cancelled') return 'Cancelled';
  try {
    const diffMs = new Date(dateStr).getTime() - Date.now();
    if (diffMs <= 0) return 'Live';
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `in ${Math.max(1, diffMin)}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `in ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `in ${diffDays}d`;
  } catch {
    return 'Upcoming';
  }
}

function computePrizePool(m: MatchUserDto): number {
  return calculateMatchPrizePool(m);
}

export const MatchesList: React.FC<MatchesListProps> = ({ statusTab = 'upcoming' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchUserDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Secondary Filters: Game Mode & Team Mode
  const [gameModeFilter, setGameModeFilter] = useState<'all' | 'battle_royale' | 'clash_squad' | 'lone_wolf'>('all');
  const [teamModeFilter, setTeamModeFilter] = useState<'all' | 'solo' | 'duo' | 'squad'>('all');

  // Selected Match for modal
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const selectedMatch = matches.find((m) => m.id === selectedMatchId) || null;

  const handleOpenMatch = (matchToOpen: MatchUserDto) => {
    navigate(`/matches/${matchToOpen.id}`, { state: { match: matchToOpen } });
    setSelectedMatchId(matchToOpen.id);
  };

  const loadMatches = useCallback(async (): Promise<MatchUserDto[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMatches(statusTab);
      setMatches(data);
      return data;
    } catch (err: any) {
      setError(err?.message || 'Failed to load matches. Please refresh.');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [statusTab]);

  useEffect(() => {
    loadMatches();
  }, [statusTab]);

  const handleRefreshClick = () => {
    loadMatches();
  };

  // Filter logic: Filter by status tab, game mode, and team mode
  const filteredMatches = matches.filter((m) => {
    const isClosed = isMatchClosed(m);

    // Status tab filter
    if (statusTab === 'upcoming') {
      if (m.status !== 'upcoming' && m.status !== 'room_open') {
        return false;
      }
      if (isClosed) {
        return false;
      }
    }
    if (statusTab === 'live') {
      if (m.status === 'completed' || m.status === 'cancelled') {
        return false;
      }
      if (m.status !== 'live' && !isClosed) {
        return false;
      }
    }
    if (statusTab === 'completed' && m.status !== 'completed' && m.status !== 'cancelled') {
      return false;
    }
    if (statusTab === 'my_matches' && (!m.hasJoined || m.status === 'completed' || m.status === 'cancelled')) {
      return false;
    }

    // Game mode filter
    if (gameModeFilter !== 'all') {
      const g = (m.gameMode || '').toLowerCase();
      if (gameModeFilter === 'battle_royale' && !g.includes('battle') && g !== 'br') {
        return false;
      }
      if (gameModeFilter === 'clash_squad' && !g.includes('clash') && g !== 'cs') {
        return false;
      }
      if (gameModeFilter === 'lone_wolf' && !g.includes('lone') && g !== 'lw') {
        return false;
      }
    }

    // Team mode filter
    if (teamModeFilter !== 'all' && (m.teamMode || '').toLowerCase() !== teamModeFilter) {
      return false;
    }

    return true;
  });

  return (
    <>
      <div
        data-testid={statusTab === 'completed' ? 'match-history-container' : 'matches-list-container'}
        className="space-y-3.5"
      >
      {/* Secondary Controls: Game Mode & Team Mode Dropdowns + Refresh Button */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none py-1">
        <div className="flex items-center gap-2">
          {/* All Game Modes */}
          <div className="relative">
            <select
              data-testid="matches-game-filter"
              value={gameModeFilter}
              onChange={(e) => setGameModeFilter(e.target.value as any)}
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
              data-testid="matches-team-filter"
              value={teamModeFilter}
              onChange={(e) => setTeamModeFilter(e.target.value as any)}
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

        {/* Compact Refresh Button */}
        <button
          type="button"
          data-testid="refresh-matches-btn"
          aria-label={t('matches.refresh')}
          onClick={handleRefreshClick}
          disabled={isLoading}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-[#101221] text-slate-400 hover:text-slate-200 transition disabled:opacity-50"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Loading state */}
      {isLoading && matches.length === 0 && (
        <div data-testid="matches-loading" className="py-16 text-center text-xs text-slate-400">
          <RotateCw className="mx-auto h-7 w-7 animate-spin text-violet-400" />
          <p className="mt-3 font-semibold">{t('matches.loadingMatches')}</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          data-testid="matches-error"
          className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300"
        >
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="h-4 w-4" />
            <span>{t('matches.loadFailed')}</span>
          </div>
          <p className="mt-1 text-slate-300">{error}</p>
          <button
            type="button"
            data-testid="retry-matches-btn"
            onClick={loadMatches}
            disabled={isLoading}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-1.5 font-semibold text-slate-200 hover:bg-slate-700 active:scale-95 disabled:opacity-50 transition shadow-sm"
          >
            {isLoading && <RotateCw className="h-3.5 w-3.5 animate-spin" />}
            <span>{t('matches.tryAgain') || t('common.retry') || 'Try Again'}</span>
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredMatches.length === 0 && (
        <div
          data-testid="matches-empty"
          className="rounded-2xl border border-slate-800 bg-[#101221]/60 p-12 text-center text-xs text-slate-400"
        >
          <Swords className="mx-auto h-10 w-10 text-slate-600" />
          <h4 className="mt-3 text-sm font-bold text-slate-200">
            {statusTab === 'my_matches' ? (t('matches.noJoinedMatches') || 'No Joined Matches') : t('matches.noMatchesAvailable')}
          </h4>
          <p className="mt-1 text-slate-500">
            {statusTab === 'my_matches'
              ? (t('matches.noJoinedMatchesDesc') || "You haven't joined any matches yet. Browse Upcoming matches to join and compete!")
              : t('matches.adjustFilters')}
          </p>
        </div>
      )}

      {/* Match Cards List */}
      <div className="space-y-3.5">
        {filteredMatches.map((m) => {
          const gameModeTitle = m.gameMode === 'lone_wolf' ? 'LONE WOLF' : m.gameMode === 'clash_squad' ? 'CLASH SQUAD' : 'BATTLE ROYALE';
          const teamModeTitle = m.teamMode.toUpperCase();
          const countdown = formatRelativeCountdown(m.startTime, m.status);
          const formattedDate = formatCustomMatchDate(m.startTime);
          const totalPrize = computePrizePool(m);
          const killPrice = Math.round(Number(m.prizes?.killPrice) || 0);
          const entryFee = Math.round(Number(m.entryFee) || 0);
          const seatsLeft = Math.max(0, (m.maxPlayers || 48) - m.seatsTaken);
          const isClosed = isMatchClosed(m);
          const progressPercent = Math.min(100, Math.max(0, (m.seatsTaken / (m.maxPlayers || 1)) * 100));

          return (
            <div
              key={m.id}
              data-testid={`match-card-${m.id}`}
              onClick={() => handleOpenMatch(m)}
              className="cursor-pointer rounded-2xl border border-slate-800/80 bg-[#101221] p-4 transition-all hover:border-slate-700 shadow-md shadow-black/20"
            >
              {/* Header row: Badge + Title + Countdown + Subtitle + Tags */}
              <div className="flex items-start gap-3">
                {/* Left Badge: Golden Crossed Swords + FF MAX */}
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-b from-[#1b1c31] to-[#121422] border border-violet-500/20 text-center shadow-inner">
                  <Swords className="h-5 w-5 text-amber-400" />
                  <span className="text-[7px] font-black text-indigo-300 tracking-tighter uppercase leading-none mt-0.5">
                    FF MAX
                  </span>
                </div>

                {/* Title & Metadata */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-slate-100 uppercase tracking-wide truncate">
                      {gameModeTitle} | {teamModeTitle}
                    </h3>
                    {m.status !== 'completed' && m.status !== 'cancelled' && countdown && (
                      <span className="text-xs font-bold text-amber-400 shrink-0">
                        {countdown}
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-bold text-slate-400 mt-0.5">
                    {formatMatchId(m.id)}
                  </p>

                  {/* Tags: Team Mode, Date Time, Map */}
                  <div className="flex items-center gap-1.5 mt-2 overflow-x-auto scrollbar-none">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#181a2e] border border-slate-800 text-[10px] font-semibold text-slate-300 shrink-0">
                      {m.teamMode.toLowerCase() === 'solo' ? (
                        <User className="h-3 w-3" />
                      ) : (
                        <Users className="h-3 w-3" />
                      )}
                      <span className="capitalize">{m.teamMode}</span>
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#181a2e] border border-slate-800 text-[10px] font-semibold text-slate-300 shrink-0">
                      <Clock className="h-3 w-3" />
                      <span>{formattedDate}</span>
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#181a2e] border border-slate-800 text-[10px] font-semibold text-slate-300 shrink-0">
                      <MapPin className="h-3 w-3" />
                      <span>{(m as any).mapName || (m as any).map || 'Bermuda'}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats & Join Button */}
              <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-6">
                  {/* Prize Pool */}
                  <div>
                    <div className="text-[11px] font-medium text-slate-400 flex items-center gap-0.5">
                      <span>{t('matches.prizePool') || 'Prize Pool'}</span>
                      <ChevronRight className="h-3 w-3 text-slate-500" />
                    </div>
                    <div className="text-base font-black text-amber-400 mt-0.5">
                      ₹{totalPrize}
                    </div>
                  </div>

                  {/* Per kill */}
                  {killPrice > 0 && (
                    <div>
                      <div className="text-[11px] font-medium text-slate-400">
                        {t('matches.perKill') || 'Per kill'}
                      </div>
                      <div className="text-base font-black text-slate-100 mt-0.5">
                        ₹{killPrice}
                      </div>
                    </div>
                  )}

                  {/* Entry */}
                  <div>
                    <div className="text-[11px] font-medium text-slate-400">
                      {t('matches.entry') || 'Entry'}
                    </div>
                    <div
                      data-testid={`match-fee-${m.id}`}
                      className="text-base font-black text-slate-100 mt-0.5"
                    >
                      ₹{entryFee}
                    </div>
                  </div>
                </div>

                {/* Join / Status Action Button */}
                <div>
                  {m.status === 'completed' ? (
                    <button
                      type="button"
                      data-testid={`match-completed-badge-${m.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenMatch(m);
                      }}
                      className="px-5 py-2 rounded-2xl bg-[#e0f2fe] hover:bg-[#bae6fd] text-[#0284c7] font-black text-xs shadow-sm transition active:scale-95"
                    >
                      {t('matches.completed')}
                    </button>
                  ) : m.status === 'cancelled' ? (
                    <button
                      type="button"
                      data-testid={`match-cancelled-badge-${m.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenMatch(m);
                      }}
                      className="px-5 py-2 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-black text-xs shadow-sm transition active:scale-95"
                    >
                      {t('matches.cancelled')}
                    </button>
                  ) : m.hasJoined ? (
                    <button
                      type="button"
                      data-testid={`match-joined-badge-${m.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenMatch(m);
                      }}
                      className="px-5 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black text-xs transition active:scale-95"
                    >
                      {t('matches.joined') || 'Joined'}
                    </button>
                  ) : isClosed ? (
                    <button
                      type="button"
                      data-testid={`match-closed-badge-${m.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenMatch(m);
                      }}
                      className="px-5 py-2 rounded-xl bg-slate-800/90 border border-slate-700/60 text-slate-400 hover:text-slate-200 font-bold text-xs transition active:scale-95"
                    >
                      {t('matches.closed')}
                    </button>
                  ) : m.seatsTaken >= m.maxPlayers ? (
                    <button
                      type="button"
                      disabled
                      className="px-5 py-2 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs"
                    >
                      {t('matches.full') || 'Full'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenMatch(m);
                      }}
                      className="px-6 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs shadow-md shadow-violet-600/30 transition active:scale-95"
                    >
                      {t('matches.join') || 'Join'}
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar & Seat Indicator */}
              <div className="pt-2">
                <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-600 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div
                  data-testid={`match-seats-${m.id}`}
                  className="flex justify-end mt-1 text-[11px] font-medium text-slate-400"
                >
                  <span>
                    {m.status === 'completed'
                      ? `${m.seatsTaken}/${m.maxPlayers}`
                      : `${m.seatsTaken}/${m.maxPlayers} · ${seatsLeft} left`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      </div>

      {/* Match Detail Modal */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          isOpen={!!selectedMatch}
          onClose={() => setSelectedMatchId(null)}
          onRefreshMatch={async () => {
            await loadMatches();
          }}
        />
      )}
    </>
  );
};
