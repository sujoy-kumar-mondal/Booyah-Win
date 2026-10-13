import React, { useState, useEffect } from 'react';
import {
  RotateCw,
  Swords,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { fetchMatches, type MatchUserDto } from '../../api/matches.js';
import { formatIndianRupees, formatISTDateTime, formatGameMode } from '../../utils/formatters.js';
import { MatchDetailModal } from './MatchDetailModal.js';

export const MatchesList: React.FC = () => {
  const [matches, setMatches] = useState<MatchUserDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [gameModeFilter, setGameModeFilter] = useState<'all' | 'br' | 'cs'>('all');
  const [teamModeFilter, setTeamModeFilter] = useState<'all' | 'solo' | 'duo' | 'squad'>('all');

  // Selected Match for modal
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const selectedMatch = matches.find((m) => m.id === selectedMatchId) || null;

  const loadMatches = async (): Promise<MatchUserDto[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMatches();
      setMatches(data);
      return data;
    } catch (err: any) {
      setError(err?.message || 'Failed to load matches. Please tap refresh.');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  const handleRefreshClick = () => {
    loadMatches();
  };

  // Filter logic
  const filteredMatches = matches.filter((m) => {
    if (
      gameModeFilter === 'br' &&
      !m.gameMode.toLowerCase().includes('battle') &&
      m.gameMode.toLowerCase() !== 'br'
    ) {
      return false;
    }
    if (
      gameModeFilter === 'cs' &&
      !m.gameMode.toLowerCase().includes('clash') &&
      m.gameMode.toLowerCase() !== 'cs'
    ) {
      return false;
    }
    if (teamModeFilter !== 'all' && m.teamMode.toLowerCase() !== teamModeFilter) {
      return false;
    }
    return true;
  });

  return (
    <div data-testid="matches-list-container" className="space-y-4">
      {/* Top Controls: Visible Refresh Button & Filters (Requirement 11) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1 scrollbar-none">
          {/* Game Mode Filters */}
          <button
            type="button"
            data-testid="filter-game-all"
            onClick={() => setGameModeFilter('all')}
            className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
              gameModeFilter === 'all'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            All Games
          </button>
          <button
            type="button"
            data-testid="filter-game-br"
            onClick={() => setGameModeFilter('br')}
            className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
              gameModeFilter === 'br'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            Battle Royale
          </button>
          <button
            type="button"
            data-testid="filter-game-cs"
            onClick={() => setGameModeFilter('cs')}
            className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
              gameModeFilter === 'cs'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            Clash Squad
          </button>
        </div>

        {/* Visible Refresh Button (Requirement 11) */}
        <button
          type="button"
          data-testid="refresh-matches-btn"
          aria-label="Refresh matches"
          onClick={handleRefreshClick}
          disabled={isLoading}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Team Mode Filter pills */}
      <div className="flex items-center gap-1.5 text-xs">
        {(['all', 'solo', 'duo', 'squad'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            data-testid={`filter-team-${mode}`}
            onClick={() => setTeamModeFilter(mode)}
            className={`rounded-full border px-3 py-0.5 text-[11px] font-medium capitalize transition-colors ${
              teamModeFilter === mode
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-bold'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && matches.length === 0 && (
        <div data-testid="matches-loading" className="py-12 text-center text-xs text-slate-400">
          <RotateCw className="mx-auto h-6 w-6 animate-spin text-emerald-400" />
          <p className="mt-2 font-medium">Loading match rooms...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          data-testid="matches-error"
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300"
        >
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load matches</span>
          </div>
          <p className="mt-1 text-slate-300">{error}</p>
          <button
            type="button"
            data-testid="retry-matches-btn"
            onClick={loadMatches}
            className="mt-3 rounded-lg bg-slate-800 px-3 py-1 font-semibold text-slate-200 hover:bg-slate-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredMatches.length === 0 && (
        <div
          data-testid="matches-empty"
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400"
        >
          <Swords className="mx-auto h-8 w-8 text-slate-600" />
          <h4 className="mt-2 text-sm font-bold text-slate-300">No Matches Available</h4>
          <p className="mt-1">Check back later or adjust your filters above.</p>
        </div>
      )}

      {/* Match Cards List */}
      <div className="space-y-3">
        {filteredMatches.map((m) => {
          const isBR =
            m.gameMode.toLowerCase().includes('battle') || m.gameMode.toLowerCase() === 'br';
          const firstPlacePrize = m.prizes.positions['1'] || m.prizes.positions['1st'] || '0.00';

          return (
            <div
              key={m.id}
              data-testid={`match-card-${m.id}`}
              onClick={() => setSelectedMatchId(m.id)}
              className="group cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/90 p-4 transition-all hover:border-slate-700 hover:bg-slate-900 shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                      {formatGameMode(m.gameMode)}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                      {m.teamMode}
                    </span>
                    {m.hasJoined && (
                      <span
                        data-testid={`match-joined-badge-${m.id}`}
                        className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Joined
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatISTDateTime(m.startTime)}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Entry Fee</div>
                  <div
                    data-testid={`match-fee-${m.id}`}
                    className="text-base font-extrabold text-slate-100"
                  >
                    {formatIndianRupees(m.entryFee)}
                  </div>
                </div>
              </div>

              {/* Prizes & Seats summary */}
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-2.5 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400">1st Place Prize</span>
                  <div className="font-bold text-emerald-400">
                    {formatIndianRupees(firstPlacePrize)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400">Kill Price</span>
                  <div className="font-semibold text-slate-200">
                    {formatIndianRupees(m.prizes.killPrice)}
                  </div>
                </div>
              </div>

              {/* Requirement 10: Label seats in team modes as defined by API: seats reserved vs players joined */}
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span data-testid={`match-seats-${m.id}`} className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {m.teamMode.toLowerCase() === 'solo'
                    ? `${m.joinedPlayers} / ${m.maxPlayers} players joined`
                    : `${m.seatsTaken} seats reserved vs ${m.joinedPlayers} players joined`}
                </span>

                {isBR && (
                  <span className="text-[10px] text-emerald-400/90 font-medium">
                    minimum 2 kills to earn kill rewards
                  </span>
                )}
              </div>
            </div>
          );
        })}
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
    </div>
  );
};
