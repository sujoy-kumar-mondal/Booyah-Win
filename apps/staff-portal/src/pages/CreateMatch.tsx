/**
 * Create Match Page for Booyah Win Staff Portal
 *
 * Requirements & Changes:
 * - Game mode selection (BR or CS).
 * - Team mode selection (solo/duo/squad for BR; fixed to squad for CS).
 * - Entry tier dropdown filtered by mode and team mode from GET /staff/entry-tiers.
 * - Start time via date/time picker with fixed +05:30 offset (future only).
 * - Double-click guards on submit.
 * - Displays snapshot values card after creation.
 */

import React, { useState, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { getStaffEntryTiers, createStaffMatch } from '../api/matches.js';
import type { EntryTierDto, MatchStaffDto } from '../api/types.js';
import {
  formatIndianRupees,
  formatISTDate,
  buildISTIsoString,
  isFutureIST,
  getPositionLabel,
} from '../utils/formatters.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import {
  PlusCircle,
  Users,
  Swords,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';

export const CreateMatch: React.FC = () => {
  const navigate = useNavigate();

  // Form State
  const [gameMode, setGameMode] = useState<'battle_royale' | 'clash_squad'>('battle_royale');
  const [teamMode, setTeamMode] = useState<'solo' | 'duo' | 'squad'>('solo');
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');

  // UI state
  const [formError, setFormError] = useState<string | null>(null);
  const [createdMatch, setCreatedMatch] = useState<MatchStaffDto | null>(null);

  // Double click guard
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Entry Tiers
  const {
    data: tiersData,
    isLoading: tiersLoading,
    isError: tiersError,
    error: tiersFetchError,
  } = useQuery({
    queryKey: ['staff-entry-tiers'],
    queryFn: getStaffEntryTiers,
  });

  const allTiers: EntryTierDto[] = useMemo(() => {
    if (!tiersData) return [];
    if (Array.isArray(tiersData)) return tiersData;
    return tiersData.tiers || [];
  }, [tiersData]);

  // Filter tiers matching selected gameMode and effective teamMode
  const effectiveTeamMode = gameMode === 'clash_squad' ? 'squad' : teamMode;
  const filteredTiers = useMemo(() => {
    return allTiers.filter(
      (t) => t.gameMode === gameMode && t.teamMode === effectiveTeamMode
    );
  }, [allTiers, gameMode, effectiveTeamMode]);

  // Active selected tier object
  const activeTier = useMemo(() => {
    return filteredTiers.find((t) => t.id === selectedTierId) || null;
  }, [filteredTiers, selectedTierId]);

  // Handle Game Mode Change
  const handleGameModeChange = (mode: 'battle_royale' | 'clash_squad') => {
    setGameMode(mode);
    if (mode === 'clash_squad') {
      setTeamMode('squad');
    }
    setSelectedTierId('');
    setFormError(null);
  };

  // Handle Team Mode Change
  const handleTeamModeChange = (tm: 'solo' | 'duo' | 'squad') => {
    setTeamMode(tm);
    setSelectedTierId('');
    setFormError(null);
  };

  // Handle Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (!selectedTierId) {
      setFormError('Please select an entry tier');
      return;
    }

    if (!startDate || !startTime) {
      setFormError('Please select both start date and start time');
      return;
    }

    const isoString = buildISTIsoString(`${startDate}T${startTime}`);
    if (!isFutureIST(isoString)) {
      setFormError('Start time must be strictly in the future (IST)');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setFormError(null);

      const res = await createStaffMatch({
        tierId: selectedTierId,
        startTime: isoString,
      });

      setCreatedMatch(res.match);
    } catch (err) {
      setFormError(getFriendlyErrorMessage(err));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Reset form to create another match
  const handleResetForm = () => {
    setCreatedMatch(null);
    setSelectedTierId('');
    setStartDate('');
    setStartTime('');
    setFormError(null);
  };

  // If match was created successfully, display Snapshot Values Card
  if (createdMatch) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-6 text-emerald-100 flex items-start gap-4 shadow-xl">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-1">
              Match Created Successfully!
            </h2>
            <p className="text-sm text-emerald-300">
              Tournament scheduled and snapshot rules locked in. Players can now discover and join the match.
            </p>
          </div>
        </div>

        {/* Snapshot Summary Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg font-bold text-amber-400 bg-amber-400/10 px-3 py-1 rounded border border-amber-400/20">
                M{createdMatch.id}
              </span>
              <span className="text-xs uppercase tracking-wider font-bold px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {createdMatch.status}
              </span>
            </div>
            <span className="text-xs text-slate-400">
              Snapshot Tier ID: #{createdMatch.tierId}
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                Tournament Format
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-slate-500 block">Game Mode</span>
                  <span className="font-medium text-white capitalize">
                    {createdMatch.gameMode.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Team Mode</span>
                  <span className="font-medium text-white capitalize">
                    {createdMatch.teamMode}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Scheduled Start (IST)</span>
                  <span className="font-medium text-amber-300">
                    {formatISTDate(createdMatch.startTime)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Player Capacity</span>
                  <span className="font-medium text-white">
                    Min {createdMatch.minPlayers} / Max {createdMatch.maxPlayers}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                Prize & Economy Snapshot
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-slate-500 block">Entry Fee</span>
                  <span className="font-medium text-emerald-400 text-base">
                    {formatIndianRupees(createdMatch.entryFee)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Per Kill Reward</span>
                  <span className="font-medium text-emerald-400 text-base">
                    {formatIndianRupees(createdMatch.killPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Min Kills for Reward</span>
                  <span className="font-medium text-white">
                    {createdMatch.minKillsForReward} kills
                  </span>
                </div>
              </div>

              {/* Position Prizes List */}
              {createdMatch.positionPrizes && Object.keys(createdMatch.positionPrizes).length > 0 && (
                <div className="pt-2">
                  <span className="text-xs text-slate-500 block mb-1.5">Position Prizes</span>
                  <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                    {Object.entries(createdMatch.positionPrizes).map(([pos, prize]) => (
                      <div key={pos} className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">
                          {getPositionLabel(Number(pos))} Place
                        </span>
                        <span className="font-mono font-medium text-emerald-400">
                          {formatIndianRupees(prize)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex flex-wrap gap-4 justify-between items-center">
            <Link
              to="/matches"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Matches List
            </Link>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
              >
                Create Another Match
              </button>
              <button
                type="button"
                onClick={() => navigate(`/matches/${createdMatch.id}`)}
                className="px-5 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                View Match Detail
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Link to="/matches" className="hover:text-amber-400 transition-colors">
              Matches
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-200">Create New Match</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <PlusCircle className="w-6 h-6 text-amber-500" />
            Schedule New Match
          </h1>
        </div>
      </div>

      {formError && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-200 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl">
        {/* Game Mode */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-200 uppercase tracking-wider">
            1. Select Game Mode
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleGameModeChange('battle_royale')}
              className={`p-4 rounded-xl border text-left transition-all ${
                gameMode === 'battle_royale'
                  ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/50'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-base">Battle Royale</span>
                <Swords className={`w-5 h-5 ${gameMode === 'battle_royale' ? 'text-amber-400' : 'text-slate-500'}`} />
              </div>
              <p className="text-xs text-slate-400">
                Classic 48-player battle royale across Bermuda or Purgatory.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleGameModeChange('clash_squad')}
              className={`p-4 rounded-xl border text-left transition-all ${
                gameMode === 'clash_squad'
                  ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/50'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-base">Clash Squad</span>
                <Users className={`w-5 h-5 ${gameMode === 'clash_squad' ? 'text-amber-400' : 'text-slate-500'}`} />
              </div>
              <p className="text-xs text-slate-400">
                4v4 fast-paced team battle (8 players total, 2 squads).
              </p>
            </button>
          </div>
        </div>

        {/* Team Mode */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-200 uppercase tracking-wider">
            2. Team Mode
          </label>
          {gameMode === 'clash_squad' ? (
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-400 flex items-center justify-between">
              <span>Fixed squad size for Clash Squad: <strong>4v4 (Squad)</strong></span>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 font-semibold rounded text-[11px]">
                Squad Only
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {(['solo', 'duo', 'squad'] as const).map((tm) => (
                <button
                  key={tm}
                  type="button"
                  onClick={() => handleTeamModeChange(tm)}
                  className={`py-3 px-4 rounded-lg border text-center font-medium capitalize text-sm transition-all ${
                    teamMode === tm
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {tm}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Entry Tier Selection */}
        <div className="space-y-3">
          <label htmlFor="tier-select" className="block text-sm font-semibold text-slate-200 uppercase tracking-wider">
            3. Choose Entry Tier
          </label>

          {tiersLoading ? (
            <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-lg text-xs text-slate-400">
              Loading available tiers...
            </div>
          ) : tiersError ? (
            <div className="p-4 bg-red-950/30 border border-red-900 rounded-lg text-xs text-red-300">
              Failed to load tiers: {String(tiersFetchError)}
            </div>
          ) : filteredTiers.length === 0 ? (
            <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-lg text-xs text-amber-400/80">
              No active tiers configured for {gameMode.replace('_', ' ')} ({effectiveTeamMode}).
            </div>
          ) : (
            <select
              id="tier-select"
              value={selectedTierId}
              onChange={(e) => {
                setSelectedTierId(e.target.value);
                setFormError(null);
              }}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">-- Select Tier --</option>
              {filteredTiers.map((t) => (
                <option key={t.id} value={t.id}>
                  Tier #{t.id} - Entry: ₹{t.entryFee} | Kill: ₹{t.killPrice} | Seats: {t.minPlayers}-{t.maxPlayers}
                </option>
              ))}
            </select>
          )}

          {/* Active Tier Preview */}
          {activeTier && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                <span className="font-semibold text-slate-300">Tier #{activeTier.id} Snapshot Preview</span>
                <span className="text-amber-400 font-mono">
                  Min {activeTier.minPlayers} - Max {activeTier.maxPlayers} players
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block">Entry Fee</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {formatIndianRupees(activeTier.entryFee)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Per Kill Reward</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {formatIndianRupees(activeTier.killPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Reward Threshold</span>
                  <span className="font-bold text-slate-200 text-sm">
                    {activeTier.minKillsForReward} kills
                  </span>
                </div>
              </div>

              {activeTier.positions && activeTier.positions.length > 0 && (
                <div className="pt-2">
                  <span className="text-[11px] text-slate-500 block mb-1">Position Prizes:</span>
                  <div className="flex flex-wrap gap-2">
                    {activeTier.positions.map((p) => (
                      <span
                        key={p.position}
                        className="text-[11px] bg-slate-900 border border-slate-800 px-2.5 py-1 rounded text-slate-300"
                      >
                        {getPositionLabel(p.position)}: <strong className="text-emerald-400">{formatIndianRupees(p.prize)}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Start Time (IST) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-slate-200 uppercase tracking-wider">
              4. Scheduled Start Time (IST)
            </label>
            <span className="text-xs text-amber-400/90 font-mono">
              Fixed +05:30 offset
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-date" className="block text-xs text-slate-400 mb-1">
                Date (YYYY-MM-DD)
              </label>
              <div className="relative">
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setFormError(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="start-time" className="block text-xs text-slate-400 mb-1">
                Time (HH:MM - 24hr IST)
              </label>
              <div className="relative">
                <input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setFormError(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Note: Match schedule must be in the future. Room credentials can be published once the match reaches room_open state.
          </p>
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <Link
            to="/matches"
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting || !selectedTierId || !startDate || !startTime}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-amber-500/10"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                Schedule Match
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
