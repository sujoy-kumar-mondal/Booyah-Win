/**
 * Entry Tier Management Page (Admin Only)
 * Section 10 & 16.2
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  getAdminTiers,
  createAdminTier,
  updateAdminTier,
  deleteAdminTier,
  type EntryTierDto,
  type CreateTierInput,
} from '../api/admin.js';
import { formatIndianRupees } from '../utils/formatters.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import {
  Layers,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  PlusCircle,
  MinusCircle,
  CheckCircle,
} from 'lucide-react';

export const EntryTiers: React.FC = () => {
  const [tiers, setTiers] = useState<EntryTierDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [profitWarning, setProfitWarning] = useState<string | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<EntryTierDto | null>(null);
  const [deleteConfirmTier, setDeleteConfirmTier] = useState<EntryTierDto | null>(null);

  // Form state - uses exact field names of the real tier contract
  const [gameMode, setGameMode] = useState<'battle_royale' | 'clash_squad'>('battle_royale');
  const [teamMode, setTeamMode] = useState<'solo' | 'duo' | 'squad'>('solo');
  const [entryFee, setEntryFee] = useState('10.00');
  const [killPrice, setKillPrice] = useState('5.00');
  const [minKillsForReward, setMinKillsForReward] = useState<number>(2);
  const [maxPlayers, setMaxPlayers] = useState<number>(48);
  const [minPlayers, setMinPlayers] = useState<number>(24);
  const [positions, setPositions] = useState<Array<{ position: number; prize: string }>>([
    { position: 1, prize: '50.00' },
  ]);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  // Fetch list
  const fetchTiers = async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const data = await getAdminTiers();
      setTiers(data.tiers);
    } catch (err) {
      setListError(getFriendlyErrorMessage(err, 'tier'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTiers();
  }, []);

  // Sync mode rules
  useEffect(() => {
    if (gameMode === 'clash_squad') {
      setTeamMode('squad');
      setMaxPlayers(8);
      setMinPlayers(8);
      setKillPrice('0.00');
      setMinKillsForReward(0);
      setPositions([{ position: 1, prize: positions[0]?.prize || '75.00' }]);
    }
  }, [gameMode]);

  // Positions contiguous warning check
  const checkContiguousPositions = (posList: Array<{ position: number; prize: string }>): string | null => {
    const sorted = [...posList].sort((a, b) => a.position - b.position);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].position !== i + 1) {
        return `Positions must be contiguous 1..N with no gaps. Missing position ${i + 1}.`;
      }
    }
    return null;
  };

  const handleOpenCreate = () => {
    setEditingTier(null);
    setGameMode('battle_royale');
    setTeamMode('solo');
    setEntryFee('10.00');
    setKillPrice('5.00');
    setMinKillsForReward(2);
    setMaxPlayers(48);
    setMinPlayers(24);
    setPositions([
      { position: 1, prize: '50.00' },
      { position: 2, prize: '40.00' },
    ]);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tier: EntryTierDto) => {
    setEditingTier(tier);
    setGameMode(tier.gameMode);
    setTeamMode(tier.teamMode);
    setEntryFee(tier.entryFee);
    setKillPrice(tier.killPrice);
    setMinKillsForReward(tier.minKillsForReward);
    setMaxPlayers(tier.maxPlayers);
    setMinPlayers(tier.minPlayers);
    setPositions(tier.positions.map((p) => ({ position: p.position, prize: p.prize })));
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleAddPosition = () => {
    const nextPos = positions.length + 1;
    setPositions([...positions, { position: nextPos, prize: '10.00' }]);
  };

  const handleRemovePosition = (index: number) => {
    if (positions.length <= 1) return;
    const filtered = positions.filter((_, i) => i !== index);
    // Re-index contiguous 1..N
    const reindexed = filtered.map((p, idx) => ({ ...p, position: idx + 1 }));
    setPositions(reindexed);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || isSubmitting) return;

    // Validate positions
    const posWarning = checkContiguousPositions(positions);
    if (posWarning) {
      setFormError(posWarning);
      return;
    }

    setFormError(null);
    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const payload: CreateTierInput = {
        gameMode,
        teamMode,
        entryFee: entryFee.trim(),
        killPrice: gameMode === 'clash_squad' ? '0.00' : killPrice.trim(),
        minKillsForReward,
        maxPlayers,
        minPlayers,
        positions: positions.map((p) => ({ position: p.position, prize: p.prize.trim() })),
      };

      if (editingTier) {
        const res = await updateAdminTier(editingTier.id, payload);
        setIsModalOpen(false);
        setActionSuccess('Entry tier updated successfully.');
        if (res.warning) {
          setProfitWarning(res.warning);
        } else {
          setProfitWarning(null);
        }
      } else {
        const res = await createAdminTier(payload);
        setIsModalOpen(false);
        setActionSuccess('Entry tier created successfully.');
        if (res.warning) {
          setProfitWarning(res.warning);
        } else {
          setProfitWarning(null);
        }
      }

      fetchTiers();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setFormError(getFriendlyErrorMessage(err, 'tier'));
      if (err.status === 409) {
        fetchTiers();
      }
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteConfirmTier || submitLockRef.current || isSubmitting) return;

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      await deleteAdminTier(deleteConfirmTier.id);
      setDeleteConfirmTier(null);
      setActionSuccess('Entry tier deleted successfully.');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchTiers();
    } catch (err) {
      setListError(getFriendlyErrorMessage(err, 'tier'));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="entry-tiers-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Layers className="h-6 w-6 text-emerald-400" />
            Entry Tiers
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Define match templates, entry fees, prize pools, and game constraints.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchTiers}
            disabled={isLoading}
            data-testid="refresh-tiers-btn"
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            data-testid="create-tier-btn"
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10"
          >
            <Plus className="h-4 w-4" />
            Create Entry Tier
          </button>
        </div>
      </div>

      {/* Snapshot Disclaimer Banner */}
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5 text-xs text-sky-400 flex items-start gap-3">
        <Info className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
        <div>
          <p className="font-semibold text-sky-300">Rule Snapshot Guarantee</p>
          <p className="text-[11px] text-sky-400/80 mt-0.5">
            Editing or deleting an entry tier never changes existing or scheduled matches. When a match is created, the system snapshots tier settings permanently.
          </p>
        </div>
      </div>

      {profitWarning && (
        <div
          data-testid="profit-guard-banner"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-start gap-3"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-200">Profit Guard Warning</p>
            <p className="text-[11px] text-amber-300/90 mt-0.5">{profitWarning}</p>
          </div>
        </div>
      )}

      {actionSuccess && (
        <div
          data-testid="tier-action-success-banner"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2.5"
        >
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {listError && (
        <div
          data-testid="tier-list-error-banner"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-center gap-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{listError}</span>
        </div>
      )}

      {/* Tiers Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" data-testid="tiers-table">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Mode & Team</th>
                <th className="px-4 py-3">Entry Fee</th>
                <th className="px-4 py-3">Kill Price</th>
                <th className="px-4 py-3">Min Kills</th>
                <th className="px-4 py-3">Players (Min / Max)</th>
                <th className="px-4 py-3">Prizes Breakdown</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500" data-testid="tiers-loading-state">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-400" />
                    Loading entry tiers...
                  </td>
                </tr>
              ) : tiers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500" data-testid="tiers-empty-state">
                    No active entry tiers found.
                  </td>
                </tr>
              ) : (
                tiers.map((tier) => (
                  <tr key={tier.id} className="hover:bg-slate-800/20 transition-colors" data-testid={`tier-row-${tier.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-200 capitalize">
                        {tier.gameMode.replace('_', ' ')}
                      </div>
                      <div className="text-[11px] text-slate-400 capitalize">
                        {tier.teamMode}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">
                      {formatIndianRupees(tier.entryFee)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {tier.gameMode === 'clash_squad' ? '—' : formatIndianRupees(tier.killPrice)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {tier.gameMode === 'clash_squad' ? '—' : tier.minKillsForReward}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {tier.minPlayers} / {tier.maxPlayers}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div className="flex flex-wrap gap-1">
                        {tier.positions.map((pos) => (
                          <span
                            key={pos.position}
                            className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700"
                          >
                            #{pos.position}: {formatIndianRupees(pos.prize)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(tier)}
                          data-testid={`edit-tier-btn-${tier.id}`}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Edit Tier"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmTier(tier)}
                          data-testid={`delete-tier-btn-${tier.id}`}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Delete Tier"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Create / Edit Tier Modal ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto" data-testid="tier-modal">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-400" />
                {editingTier ? 'Edit Entry Tier' : 'Create New Entry Tier'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div
                data-testid="tier-form-error"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-400 flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3" data-testid="tier-form">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Game Mode</label>
                  <select
                    value={gameMode}
                    onChange={(e) => setGameMode(e.target.value as any)}
                    data-testid="tier-gameMode-select"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="battle_royale">Battle Royale</option>
                    <option value="clash_squad">Clash Squad</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Team Mode</label>
                  <select
                    value={teamMode}
                    disabled={gameMode === 'clash_squad'}
                    onChange={(e) => setTeamMode(e.target.value as any)}
                    data-testid="tier-teamMode-select"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="solo">Solo</option>
                    <option value="duo">Duo</option>
                    <option value="squad">Squad</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Entry Fee (Rupees)</label>
                  <input
                    type="text"
                    required
                    pattern="^\d+(\.\d{1,2})?$"
                    value={entryFee}
                    onChange={(e) => setEntryFee(e.target.value)}
                    data-testid="tier-entryFee-input"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Kill Price (Rupees)</label>
                  <input
                    type="text"
                    required
                    disabled={gameMode === 'clash_squad'}
                    pattern="^\d+(\.\d{1,2})?$"
                    value={killPrice}
                    onChange={(e) => setKillPrice(e.target.value)}
                    data-testid="tier-killPrice-input"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              {gameMode === 'battle_royale' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Min Kills Reward</label>
                    <input
                      type="number"
                      min={0}
                      value={minKillsForReward}
                      onChange={(e) => setMinKillsForReward(Number(e.target.value))}
                      data-testid="tier-minKillsForReward-input"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Min Players</label>
                    <input
                      type="number"
                      min={2}
                      value={minPlayers}
                      onChange={(e) => setMinPlayers(Number(e.target.value))}
                      data-testid="tier-minPlayers-input"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Max Players</label>
                    <input
                      type="number"
                      min={2}
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(Number(e.target.value))}
                      data-testid="tier-maxPlayers-input"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Positions List */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Position Prize Rewards (Contiguous 1..N)
                  </span>
                  {gameMode === 'battle_royale' && (
                    <button
                      type="button"
                      onClick={handleAddPosition}
                      data-testid="add-position-btn"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Add Position
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {positions.map((pos, idx) => (
                    <div key={pos.position} className="flex items-center gap-3 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                      <span className="text-xs font-mono font-bold text-slate-300 w-24">
                        Position #{pos.position}
                      </span>
                      <div className="flex-1">
                        <input
                          type="text"
                          required
                          pattern="^\d+(\.\d{1,2})?$"
                          value={pos.prize}
                          onChange={(e) => {
                            const updated = [...positions];
                            updated[idx].prize = e.target.value;
                            setPositions(updated);
                          }}
                          data-testid={`position-prize-input-${pos.position}`}
                          placeholder="Prize amount"
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      {gameMode === 'battle_royale' && positions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePosition(idx)}
                          data-testid={`remove-position-btn-${pos.position}`}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <MinusCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="submit-tier-btn"
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingTier ? 'Save Changes' : 'Create Tier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteConfirmTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" data-testid="delete-tier-modal">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Delete Entry Tier</h3>
                <p className="text-[11px] text-slate-400">Soft delete template</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to delete entry tier{' '}
              <span className="font-bold text-slate-100">
                #{deleteConfirmTier.id} ({deleteConfirmTier.gameMode.replace('_', ' ')} - {deleteConfirmTier.teamMode})
              </span>? Existing matches created from this tier will continue unaffected.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTier(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isSubmitting}
                data-testid="confirm-delete-tier-btn"
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Tier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
