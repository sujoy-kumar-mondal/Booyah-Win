/**
 * Add / Edit Result Page for Booyah Win Staff Portal
 * Accessible for LIVE matches.
 *
 * Requirements & Changes:
 * - Real team data only; never infer teams from order.
 * - Only active (refundedAt null) players in confirmed teams count for results.
 * - Flag incomplete confirmed teams (memberUserIds.length < size); cannot be used in results.
 * - Disbanded and forming teams shown but cannot be used in results.
 * - Duo/Squad: confirmed teams get one position selector shared by members; kills entered per player.
 * - Clash Squad: winning team dropdown lists only confirmed teams.
 * - Solo: per-player position and kills.
 * - Position selectors populated from snapshot position prizes.
 * - Screenshot upload: JPEG/PNG/WebP, <= 2MB, memory preview, referrerPolicy="no-referrer".
 * - Roster re-fetch check on open and pre-submit (shows "Roster changed" notice).
 * - Client checks: warnings are advisory; unsendable errors block submission.
 * - Resubmission support for rejected results.
 * - Admin auto-approve checkbox.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getStaffMatchDetail,
  submitStaffMatchResult,
  getStaffMatchResult,
} from '../api/matches.js';
import type {
  MatchDetailStaffDto,
  MatchTeamStaffDto,
  ResultEntryDto,
} from '../api/types.js';
import { useStaffAuth } from '../context/StaffAuthContext.js';
import {
  formatIndianRupees,
  getPositionLabel,
} from '../utils/formatters.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import {
  FileSpreadsheet,
  Upload,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Image as ImageIcon,
  Trophy,
  ShieldAlert,
  Info,
} from 'lucide-react';

export const AddResult: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { staff } = useStaffAuth();
  const isAdmin = staff?.role === 'admin';

  // Double click guard
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [killsMap, setKillsMap] = useState<Record<string, number>>({});
  const [positionsMap, setPositionsMap] = useState<Record<string, number | null>>({}); // Solo: userId -> pos, Team: teamId -> pos
  const [csWinningTeamId, setCsWinningTeamId] = useState<string>('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState<boolean>(false);

  // Roster check state
  const initialRosterSignatureRef = useRef<string>('');
  const [rosterChangedNotice, setRosterChangedNotice] = useState<boolean>(false);

  // Error & warning states
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch match details
  const {
    data: matchData,
    isLoading: matchLoading,
    isError: matchError,
    error: matchFetchError,
    refetch: refetchMatch,
  } = useQuery({
    queryKey: ['staff-match-detail', id],
    queryFn: () => getStaffMatchDetail(id!),
    enabled: Boolean(id),
  });

  const match: MatchDetailStaffDto | undefined = matchData?.match;

  // Check for existing/rejected result
  const { data: existingResult } = useQuery({
    queryKey: ['staff-match-result', id],
    queryFn: () => getStaffMatchResult(id!),
    enabled: Boolean(id),
    retry: false,
  });

  // Cleanup object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (screenshotPreview) {
        URL.revokeObjectURL(screenshotPreview);
      }
    };
  }, [screenshotPreview]);

  // Record initial roster signature
  useEffect(() => {
    if (match) {
      const activeIds = (match.players || [])
        .filter((p) => !p.refundedAt)
        .map((p) => p.userId)
        .sort()
        .join(',');
      initialRosterSignatureRef.current = activeIds;

      // Initialize default kills if not set
      setKillsMap((prev) => {
        const next = { ...prev };
        (match.players || []).forEach((p) => {
          if (!p.refundedAt && next[p.userId] === undefined) {
            next[p.userId] = 0;
          }
        });
        return next;
      });
    }
  }, [match]);

  // Load existing rejected result entries if present
  useEffect(() => {
    if (existingResult && existingResult.entries && existingResult.entries.length > 0 && match) {
      const newKills: Record<string, number> = {};
      const newPositions: Record<string, number | null> = {};

      existingResult.entries.forEach((e: ResultEntryDto) => {
        newKills[e.userId] = e.kills;
        if (match.teamMode === 'solo') {
          newPositions[e.userId] = e.position;
        } else {
          const player = (match.players || []).find((p) => p.userId === e.userId);
          if (player?.teamId) {
            newPositions[player.teamId] = e.position;
          }
        }
      });

      setKillsMap((prev) => ({ ...prev, ...newKills }));
      setPositionsMap((prev) => ({ ...prev, ...newPositions }));
    }
  }, [existingResult, match]);

  // Active Players & Teams
  const activePlayers = useMemo(() => {
    return (match?.players || []).filter((p) => !p.refundedAt);
  }, [match]);

  // Teams categorized
  const { confirmedTeams, incompleteTeams, nonConfirmedTeams } = useMemo(() => {
    const confirmed: MatchTeamStaffDto[] = [];
    const incomplete: MatchTeamStaffDto[] = [];
    const nonConfirmed: MatchTeamStaffDto[] = [];

    (match?.teams || []).forEach((t) => {
      if (t.status === 'confirmed') {
        if (t.memberUserIds.length < t.size) {
          incomplete.push(t);
        } else {
          confirmed.push(t);
        }
      } else {
        nonConfirmed.push(t);
      }
    });

    return {
      confirmedTeams: confirmed,
      incompleteTeams: incomplete,
      nonConfirmedTeams: nonConfirmed,
    };
  }, [match]);

  // Available positions from snapshot position prizes
  const availablePositions: number[] = useMemo(() => {
    if (!match?.positionPrizes) return [1, 2, 3];
    return Object.keys(match.positionPrizes)
      .map(Number)
      .sort((a, b) => a - b);
  }, [match]);

  // Handle File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview);
      setScreenshotPreview(null);
    }

    setScreenshotFile(file);
    const objectUrl = URL.createObjectURL(file);
    setScreenshotPreview(objectUrl);
    setSubmissionError(null);
  };

  React.useEffect(() => {
    return () => {
      if (screenshotPreview) {
        URL.revokeObjectURL(screenshotPreview);
      }
    };
  }, [screenshotPreview]);

  // ─── Client Validations (Unsendable vs Warnings) ───────────────────────────
  const { unsendableErrors, warnings } = useMemo(() => {
    const unsendable: string[] = [];
    const warns: string[] = [];

    // 1. Unsendable: Missing Screenshot
    if (!screenshotFile) {
      unsendable.push('Screenshot file is required.');
    } else {
      // 2. Unsendable: Bad File Type
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(screenshotFile.type)) {
        unsendable.push('Screenshot must be a JPEG, PNG, or WebP image.');
      }
      // 3. Unsendable: Over 2MB
      if (screenshotFile.size > 2 * 1024 * 1024) {
        unsendable.push('Screenshot file size exceeds 2 MB limit.');
      }
    }

    // 4. Unsendable: Negative kills
    for (const p of activePlayers) {
      const k = killsMap[p.userId];
      if (k === undefined || k < 0 || !Number.isInteger(k)) {
        unsendable.push(`Invalid kill count for player ${p.ffName || p.name} (must be integer ≥ 0).`);
        break;
      }
    }

    // 5. Clash Squad checks
    if (match?.gameMode === 'clash_squad') {
      if (!csWinningTeamId) {
        unsendable.push('Please select the winning confirmed team for Clash Squad.');
      } else {
        const winningTeam = confirmedTeams.find((t) => t.id === csWinningTeamId);
        if (!winningTeam) {
          unsendable.push('Selected winning team is not a valid confirmed team.');
        }
      }
    }

    // Warnings (advisory, do not block submit)
    let totalKills = 0;
    Object.values(killsMap).forEach((k) => (totalKills += Number(k) || 0));
    if (totalKills > activePlayers.length * 10 && activePlayers.length > 0) {
      warns.push(`Total entered kills (${totalKills}) seems unusually high for this match.`);
    }

    if (match?.gameMode === 'battle_royale') {
      const assignedPositions: number[] = [];
      if (match.teamMode === 'solo') {
        activePlayers.forEach((p) => {
          const pos = positionsMap[p.userId];
          if (pos) assignedPositions.push(pos);
        });
      } else {
        confirmedTeams.forEach((t) => {
          const pos = positionsMap[t.id];
          if (pos) assignedPositions.push(pos);
        });
      }

      // Check duplicates
      const dupes = assignedPositions.filter((item, index) => assignedPositions.indexOf(item) !== index);
      if (dupes.length > 0) {
        warns.push(`Multiple entries have been assigned position ${dupes.join(', ')}.`);
      }

      // Check 1st position assigned
      if (!assignedPositions.includes(1) && availablePositions.includes(1)) {
        warns.push('1st place (Booyah) position has not been assigned.');
      }
    }

    return { unsendableErrors: unsendable, warnings: warns };
  }, [
    screenshotFile,
    activePlayers,
    killsMap,
    positionsMap,
    match,
    csWinningTeamId,
    confirmedTeams,
    availablePositions,
  ]);

  // ─── Build Form Entries ───────────────────────────────────────────────────
  const buildResultEntries = (): ResultEntryDto[] => {
    if (!match) return [];

    if (match.gameMode === 'clash_squad') {
      // CS: winning team members get position 1, losing team members get position 2
      const entries: ResultEntryDto[] = [];
      confirmedTeams.forEach((team) => {
        const isWinner = team.id === csWinningTeamId;
        const position = isWinner ? 1 : 2;
        team.memberUserIds.forEach((uid) => {
          entries.push({
            userId: uid,
            kills: killsMap[uid] || 0,
            position,
          });
        });
      });
      return entries;
    }

    if (match.teamMode === 'solo') {
      return activePlayers.map((p) => ({
        userId: p.userId,
        kills: killsMap[p.userId] || 0,
        position: positionsMap[p.userId] || null,
      }));
    }

    // Duo or Squad: only players in confirmed teams count
    const entries: ResultEntryDto[] = [];
    confirmedTeams.forEach((team) => {
      const teamPosition = positionsMap[team.id] || null;
      team.memberUserIds.forEach((uid) => {
        entries.push({
          userId: uid,
          kills: killsMap[uid] || 0,
          position: teamPosition,
        });
      });
    });

    return entries;
  };

  // ─── Submit Handler ───────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || !match) return;

    if (unsendableErrors.length > 0) {
      setSubmissionError(unsendableErrors[0]);
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setSubmissionError(null);

      // Pre-submit check: re-fetch roster from server
      const freshRes = await getStaffMatchDetail(match.id);
      const freshActiveIds = (freshRes.match.players || [])
        .filter((p: any) => !p.refundedAt)
        .map((p: any) => p.userId)
        .sort()
        .join(',');

      if (freshActiveIds !== initialRosterSignatureRef.current) {
        setRosterChangedNotice(true);
        initialRosterSignatureRef.current = freshActiveIds;
        await refetchMatch();
        setSubmissionError(
          'Roster changed while entering results! Please review the updated active players list and resubmit.'
        );
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      // Build FormData payload
      const entries = buildResultEntries();
      if (entries.length === 0) {
        setSubmissionError('No eligible players or teams found for result submission.');
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData();
      formData.append('entries', JSON.stringify(entries));
      formData.append('screenshot', screenshotFile!);
      if (isAdmin && autoApprove) {
        formData.append('autoApprove', 'true');
      }

      const res = await submitStaffMatchResult(match.id, formData);

      setSuccessMessage(
        res.approved
          ? 'Match result submitted and auto-approved! Payouts disbursed.'
          : 'Match result submitted successfully and sent to admin approval queue.'
      );

      await queryClient.invalidateQueries({ queryKey: ['staff-match-detail', match.id] });
      await queryClient.invalidateQueries({ queryKey: ['staff-matches'] });

      setTimeout(() => {
        navigate(`/matches/${match.id}`);
      }, 1500);
    } catch (err: any) {
      setSubmissionError(getFriendlyErrorMessage(err, 'result'));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (matchLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading match roster & rules...</p>
      </div>
    );
  }

  if (matchError || !match) {
    return (
      <div className="max-w-xl mx-auto p-8 bg-red-950/40 border border-red-900 rounded-xl text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Match Not Found</h2>
        <p className="text-sm text-red-300">
          {getFriendlyErrorMessage(matchFetchError)}
        </p>
        <Link
          to="/matches"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Matches List
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Link to="/matches" className="hover:text-amber-400 transition-colors">
              Matches
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link to={`/matches/${match.id}`} className="hover:text-amber-400 transition-colors">
              M{match.id}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-200">Enter Results</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-amber-500" />
            Submit Match Result (BW-MAT-{match.id})
          </h1>
        </div>

        <span
          className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${
            match.status === 'live'
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {match.status}
        </span>
      </div>

      {/* Rejection Notice Banner for Resubmission */}
      {existingResult?.status === 'rejected' && (
        <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 text-amber-200 text-xs flex items-start gap-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block text-sm text-white font-semibold">
              Previous Result Rejected by Admin
            </strong>
            <p className="text-amber-300">
              Reason: <em>"{existingResult.rejectReason || 'No specific reason given'}"</em>
            </p>
            <p className="text-slate-400 text-[11px]">
              You can correct the scoreboard values, re-upload the verified screenshot, and resubmit for approval.
            </p>
          </div>
        </div>
      )}

      {/* Roster Changed Warning Banner */}
      {rosterChangedNotice && (
        <div className="bg-red-950/60 border border-red-800 rounded-xl p-4 text-red-200 text-xs flex items-start gap-3 shadow-xl animate-bounce">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <strong className="block text-sm text-white font-bold">
              Roster Changed Detected!
            </strong>
            <p>
              One or more players left or joined the match while you were editing. The roster has been reloaded below. Please review your entries and click Submit again.
            </p>
          </div>
        </div>
      )}

      {/* Submission Feedback */}
      {submissionError && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-200 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span>{submissionError}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-950/50 border border-emerald-800 rounded-xl p-4 text-emerald-200 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Submission Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Scoreboard Screenshot */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-500" />
              1. Official Scoreboard Screenshot
            </h2>
            <span className="text-xs text-slate-400">
              Required (Max 2 MB, JPEG / PNG / WebP)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <label
                htmlFor="screenshot-input"
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-700 hover:border-amber-500/80 rounded-xl cursor-pointer bg-slate-950/40 hover:bg-slate-950/70 transition-all text-center space-y-2"
              >
                <ImageIcon className="w-8 h-8 text-slate-500" />
                <span className="text-sm font-semibold text-slate-300">
                  {screenshotFile ? screenshotFile.name : 'Click to select screenshot'}
                </span>
                <span className="text-xs text-slate-500">
                  {screenshotFile
                    ? `${(screenshotFile.size / 1024).toFixed(1)} KB`
                    : 'In-game final match leaderboard'}
                </span>
                <input
                  id="screenshot-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-slate-500 mt-2">
                Processed strictly in-memory. Screenshot is stored encrypted and never cached on device storage.
              </p>
            </div>

            {/* Preview */}
            <div className="flex flex-col items-center justify-center bg-slate-950/60 border border-slate-800 rounded-xl p-4 min-h-[160px]">
              {screenshotPreview ? (
                <div className="space-y-2 text-center">
                  <img
                    src={screenshotPreview}
                    alt="Match scoreboard preview"
                    referrerPolicy="no-referrer"
                    className="max-h-48 max-w-full rounded-lg object-contain shadow border border-slate-800"
                  />
                  <span className="text-[11px] text-emerald-400 font-semibold block">
                    ✓ Valid image preview ready
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-500">
                  Screenshot preview will appear here
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Results Entry Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-0">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                2. Enter Match Positions & Kills
              </h2>
              <p className="text-xs text-slate-400">
                Mode: <strong className="text-white capitalize">{match.gameMode.replace('_', ' ')}</strong> (
                <span className="capitalize">{match.teamMode}</span>)
              </p>
            </div>

            <div className="text-right text-xs text-slate-400">
              <span>Per Kill: </span>
              <strong className="text-emerald-400">{formatIndianRupees(match.killPrice)}</strong>
            </div>
          </div>

          {/* CLASH SQUAD FORMAT */}
          {match.gameMode === 'clash_squad' ? (
            <div className="p-6 space-y-6">
              {/* Winning Team Selection */}
              <div className="max-w-md space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  Select Winning Team (Confirmed Squads Only)
                </label>
                {confirmedTeams.length === 0 ? (
                  <div className="p-3 bg-red-950/40 border border-red-900 rounded-lg text-xs text-red-300">
                    No confirmed teams available for Clash Squad! Cannot submit result.
                  </div>
                ) : (
                  <select
                    value={csWinningTeamId}
                    onChange={(e) => setCsWinningTeamId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">-- Choose Winning Team --</option>
                    {confirmedTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name || `Team #${team.id}`} ({team.memberUserIds.length} members)
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-slate-500">
                  Winning team will receive 1st place prize; runner-up receives 2nd place or per-kill only.
                </p>
              </div>

              {/* Per Player Kills for Clash Squad */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Player Kills Breakdown
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {confirmedTeams.map((team) => {
                    const isWinner = team.id === csWinningTeamId;
                    return (
                      <div
                        key={team.id}
                        className={`p-4 rounded-xl border space-y-3 ${
                          isWinner
                            ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                            : 'bg-slate-950/70 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm">
                            {team.name || `Team #${team.id}`}
                          </span>
                          {isWinner && (
                            <span className="text-[11px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded">
                              ★ WINNER (1st)
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          {team.memberUserIds.map((uid) => {
                            const player = activePlayers.find((p) => p.userId === uid);
                            return (
                              <div
                                key={uid}
                                className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 text-xs"
                              >
                                <div>
                                  <span className="font-semibold text-white block">
                                    {player?.ffName || player?.name || `User #${uid}`}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    FFID: {player?.ffId}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label htmlFor={`kills-cs-${uid}`} className="text-slate-400 text-[11px]">Kills:</label>
                                  <input
                                    id={`kills-cs-${uid}`}
                                    type="number"
                                    min="0"
                                    value={killsMap[uid] ?? 0}
                                    onChange={(e) =>
                                      setKillsMap({
                                        ...killsMap,
                                        [uid]: Math.max(0, parseInt(e.target.value) || 0),
                                      })
                                    }
                                    className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-white font-mono"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : match.teamMode === 'solo' ? (
            /* SOLO BATTLE ROYALE FORMAT */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-4">Free Fire ID</th>
                    <th className="py-3 px-4">Kills</th>
                    <th className="py-3 px-4">Final Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {activePlayers.map((player) => (
                    <tr key={player.userId} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white block">{player.name}</span>
                        <span className="text-[11px] text-amber-300 font-mono">{player.ffName}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {player.ffId}
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="0"
                          value={killsMap[player.userId] ?? 0}
                          onChange={(e) =>
                            setKillsMap({
                              ...killsMap,
                              [player.userId]: Math.max(0, parseInt(e.target.value) || 0),
                            })
                          }
                          className="w-20 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-white font-mono text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={positionsMap[player.userId] ?? ''}
                          onChange={(e) =>
                            setPositionsMap({
                              ...positionsMap,
                              [player.userId]: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-white text-xs focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="">-- No Position Prize --</option>
                          {availablePositions.map((pos) => (
                            <option key={pos} value={pos}>
                              {getPositionLabel(pos)} Place ({formatIndianRupees(match.positionPrizes?.[pos] || '0')})
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* DUO & SQUAD BATTLE ROYALE FORMAT */
            <div className="p-6 space-y-6">
              {/* Confirmed Teams with Shared Position */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Confirmed Teams ({confirmedTeams.length})
                </h3>

                {confirmedTeams.length === 0 ? (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-500 text-center">
                    No confirmed teams ready for result submission.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {confirmedTeams.map((team) => (
                      <div
                        key={team.id}
                        className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">
                              {team.name || `Team #${team.id}`}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              ({team.memberUserIds.length}/{team.size} members)
                            </span>
                          </div>

                          {/* Team Shared Position Selector */}
                          <div className="flex items-center gap-2">
                            <label htmlFor={`pos-team-${team.id}`} className="text-xs text-slate-400 font-semibold">
                              Team Position:
                            </label>
                            <select
                              id={`pos-team-${team.id}`}
                              value={positionsMap[team.id] ?? ''}
                              onChange={(e) =>
                                setPositionsMap({
                                  ...positionsMap,
                                  [team.id]: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white text-xs focus:ring-1 focus:ring-amber-500"
                            >
                              <option value="">-- No Position Prize --</option>
                              {availablePositions.map((pos) => (
                                <option key={pos} value={pos}>
                                  {getPositionLabel(pos)} Place ({formatIndianRupees(match.positionPrizes?.[pos] || '0')})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Per-Player Kills Inside Team */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          {team.memberUserIds.map((uid) => {
                            const player = activePlayers.find((p) => p.userId === uid);
                            return (
                              <div
                                key={uid}
                                className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between"
                              >
                                <div className="space-y-0.5">
                                  <span className="font-medium text-white text-xs block truncate max-w-[120px]">
                                    {player?.ffName || player?.name || `User #${uid}`}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono block">
                                    FFID: {player?.ffId}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <label htmlFor={`kills-member-${uid}`} className="text-[10px] text-slate-400">Kills:</label>
                                  <input
                                    id={`kills-member-${uid}`}
                                    type="number"
                                    min="0"
                                    value={killsMap[uid] ?? 0}
                                    onChange={(e) =>
                                      setKillsMap({
                                        ...killsMap,
                                        [uid]: Math.max(0, parseInt(e.target.value) || 0),
                                      })
                                    }
                                    className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right text-white font-mono text-xs"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Incomplete / Forming / Disbanded Teams Notices */}
              {(incompleteTeams.length > 0 || nonConfirmedTeams.length > 0) && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Ineligible Teams (Cannot be awarded prizes)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {incompleteTeams.map((team) => (
                      <div
                        key={team.id}
                        className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg text-xs flex items-center justify-between"
                      >
                        <div>
                          <strong className="text-amber-300 block">{team.name || `Team #${team.id}`}</strong>
                          <span className="text-[11px] text-slate-400">
                            Incomplete: {team.memberUserIds.length}/{team.size} active members
                          </span>
                        </div>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-semibold">
                          Excluded
                        </span>
                      </div>
                    ))}

                    {nonConfirmedTeams.map((team) => (
                      <div
                        key={team.id}
                        className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-xs flex items-center justify-between opacity-60"
                      >
                        <div>
                          <strong className="text-slate-300 block">{team.name || `Team #${team.id}`}</strong>
                          <span className="text-[11px] text-slate-500 capitalize">
                            Status: {team.status}
                          </span>
                        </div>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-semibold capitalize">
                          {team.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Warnings Banner (Non-blocking) */}
        {warnings.length > 0 && (
          <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4 text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Info className="w-4 h-4 shrink-0" />
              <span>Advisory Notices:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Admin Auto-Approve Checkbox */}
        {isAdmin && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
            <input
              id="auto-approve-toggle"
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-950"
            />
            <label htmlFor="auto-approve-toggle" className="text-xs text-slate-300 cursor-pointer">
              <strong className="text-white block">Auto-approve result & disburse payouts immediately</strong>
              Skip admin approval queue. Winners' winning balances will be credited instantly upon submission.
            </label>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <Link
            to={`/matches/${match.id}`}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel and Return
          </Link>

          <button
            type="submit"
            disabled={isSubmitting || unsendableErrors.length > 0}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-amber-500/10"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Submitting Result...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                Submit Match Result
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
