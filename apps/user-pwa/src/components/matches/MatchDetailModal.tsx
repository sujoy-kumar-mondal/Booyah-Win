import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Users,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertTriangle,
  AlertCircle,
  MapPin,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  fetchMatch,
  fetchMatchPlayers,
  fetchMyTeam,
  type MatchUserDto,
  type MatchPlayerItem,
  type MyTeamMember,
} from '../../api/matches.js';
import { fetchMatchRules, type MatchRulesDto } from '../../api/rules.js';
import {
  formatIndianRupees,
  isTotalBelowFee,
  formatGameMode,
  calculateMatchPrizePool,
  isMatchClosed,
  formatMatchId,
} from '../../utils/formatters.js';
import { useTranslation } from '../../i18n/LanguageContext.js';
import { resolveImageUrl } from '../../utils/imageUrl.js';
import { useAuth } from '../../context/AuthContext.js';
import { SoloJoinDialog } from './SoloJoinDialog.js';
import { TeamFormModal } from './TeamFormModal.js';
import { TeamManageModal } from './TeamManageModal.js';

export interface MatchDetailModalProps {
  match: MatchUserDto;
  isOpen: boolean;
  onClose: () => void;
  onRefreshMatch: () => void;
  isPage?: boolean;
}

function formatMatchDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day}/${month}/${year} at ${hours}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
}

function computeTotalPrize(m: MatchUserDto): number {
  return calculateMatchPrizePool(m);
}

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  match,
  isOpen,
  onClose,
  onRefreshMatch,
  isPage = false,
}) => {
  const { t, formatEnum } = useTranslation();
  const navigate = useNavigate();
  const auth = useAuth();
  const isAuth = Boolean(auth.isAuthenticated ?? auth.user);
  const wallets = auth.wallets;
  let queryClient: any = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // If rendered outside QueryClientProvider
  }

  const [currentMatch, setCurrentMatch] = useState<MatchUserDto>(match);
  const isSolo = (currentMatch?.teamMode || match.teamMode || '').toLowerCase() === 'solo';
  const isBR =
    (currentMatch?.gameMode || match.gameMode || '').toLowerCase().includes('battle') ||
    (currentMatch?.gameMode || match.gameMode || '').toLowerCase() === 'br';
  const [activeTab, setActiveTab] = useState<'rules' | 'players' | 'prize' | 'reward'>('rules');
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [rulesLang, setRulesLang] = useState<'en' | 'bn'>('en');
  const overlayRef = React.useRef<HTMLDivElement>(null);

  // Prevent background scrolling while modal is open (resolves double scrollbar)
  useEffect(() => {
    if (!isOpen || isPage) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isPage]);

  useEffect(() => {
    if (isPage) {
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        try {
          window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        } catch {
          // Fallback if scrollTo options not supported in test runner
        }
      }
    } else if (isOpen && overlayRef.current) {
      overlayRef.current.scrollTop = 0;
    }
  }, [isOpen, match.id, isPage]);

  // Async match rules (admin configured)
  const [matchRules, setMatchRules] = useState<MatchRulesDto>({
    imageUrl: '',
    rulesEn: '',
    rulesBn: '',
  });

  // Async joined players roster
  const [playersData, setPlayersData] = useState<MatchPlayerItem[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);

  useEffect(() => {
    setCurrentMatch((prev) => ({
      ...match,
      hasReplacedTeammate: prev?.hasReplacedTeammate || match.hasReplacedTeammate,
      canReplaceTeammate: (prev?.hasReplacedTeammate || match.hasReplacedTeammate) ? false : match.canReplaceTeammate,
    }));
  }, [match]);

  useEffect(() => {
    let isMounted = true;
    fetchMatchRules(currentMatch?.gameMode).then((rules) => {
      if (isMounted) setMatchRules(rules);
    });
    return () => {
      isMounted = false;
    };
  }, [currentMatch?.gameMode]);

  useEffect(() => {
    if (!isOpen || !currentMatch?.id) return;
    let isMounted = true;
    setIsLoadingPlayers(true);
    fetchMatchPlayers(currentMatch.id)
      .then((res) => {
        if (isMounted) {
          setPlayersData(res.players);
          if (res.cancelReason) setCancelReason(res.cancelReason);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingPlayers(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen, currentMatch.id]);

  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<'roomId' | 'roomPassword' | null>(null);

  // Sub-dialogs
  const [soloDialogOpen, setSoloDialogOpen] = useState(false);
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [teamManageMode, setTeamManageMode] = useState<'replace' | 'disband' | null>(null);
  const [myTeamMembers, setMyTeamMembers] = useState<MyTeamMember[]>([]);
  const [fullTeamMembers, setFullTeamMembers] = useState<MyTeamMember[]>([]);
  const [teamReplaceCount, setTeamReplaceCount] = useState<number>(0);
  const [myTeamName, setMyTeamName] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !currentMatch?.id) return;
    let isMounted = true;
    fetchMatch(currentMatch.id)
      .then((fresh) => {
        if (isMounted && fresh) {
          setCurrentMatch((prev) => ({
            ...fresh,
            hasReplacedTeammate: prev?.hasReplacedTeammate || fresh.hasReplacedTeammate,
            canReplaceTeammate: (prev?.hasReplacedTeammate || fresh.hasReplacedTeammate) ? false : fresh.canReplaceTeammate,
          }));
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isOpen, currentMatch?.id]);

  useEffect(() => {
    if (!isOpen || !currentMatch?.id || isSolo || (!currentMatch?.isInTeam && !currentMatch?.hasJoined)) return;
    let isMounted = true;
    fetchMyTeam(currentMatch.id)
      .then((team) => {
        if (!isMounted || !team) return;
        if (team.name) {
          setMyTeamName(team.name);
        }
        if (team.replaceCount !== undefined) {
          setTeamReplaceCount(Number(team.replaceCount || 0));
        }
        if (team.members) {
          setFullTeamMembers(team.members);
          const nonLeaderMembers = team.members.filter((m) => !m.isLeader);
          setMyTeamMembers(nonLeaderMembers);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isOpen, currentMatch?.id, currentMatch?.isInTeam, currentMatch?.hasJoined, isSolo]);

  const handleRefresh = async () => {
    try {
      const fresh = await fetchMatch(currentMatch.id);
      setCurrentMatch(fresh);
      const playersRes = await fetchMatchPlayers(currentMatch.id);
      setPlayersData(playersRes.players);
      if (!isSolo && (fresh.isInTeam || fresh.hasJoined)) {
        const team = await fetchMyTeam(currentMatch.id);
        if (team) {
          if (team.name) {
            setMyTeamName(team.name);
          }
          if (team.replaceCount !== undefined) {
            setTeamReplaceCount(Number(team.replaceCount || 0));
          }
          if (team.members) {
            setFullTeamMembers(team.members);
            setMyTeamMembers(team.members.filter((m) => !m.isLeader));
          }
        }
      }
    } catch {
      // Fallback
    }
    onRefreshMatch();
  };

  // Requirement 12: Ensure room password is NOT kept in query cache after leaving screen
  useEffect(() => {
    return () => {
      if (queryClient) {
        queryClient.removeQueries({ queryKey: ['match', currentMatch.id] });
      }
    };
  }, [currentMatch.id, queryClient]);

  if (!isOpen) return null;

  // Requirement 12: Clear "Copied" after 2.5 seconds
  const handleCopy = async (text: string | null | undefined, field: 'roomId' | 'roomPassword') => {
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedField(field);
      setTimeout(() => {
        setCopiedField(null);
      }, 2500);
    } catch {
      // Fallback
    }
  };

  const isClosed = isMatchClosed(currentMatch);
  const canJoinStatus = (currentMatch.status === 'upcoming' || currentMatch.status === 'room_open') && !isClosed;
  const isFull = currentMatch.joinedPlayers >= currentMatch.maxPlayers;
  const isJoined = currentMatch.hasJoined;
  const isMatchEnded = currentMatch.status === 'completed' || currentMatch.status === 'cancelled';

  useEffect(() => {
    if (!isMatchEnded && activeTab === 'reward') {
      setActiveTab('rules');
    }
  }, [isMatchEnded, activeTab]);

  const lowBalanceSoftHint = !isJoined && isTotalBelowFee(wallets?.total, currentMatch.entryFee);

  const showRoomCredentials =
    isJoined && (currentMatch.status === 'room_open' || currentMatch.status === 'live');

  const handleOpenJoinFlow = () => {
    if (!isAuth) {
      navigate('/login');
      return;
    }
    if (isSolo) {
      setSoloDialogOpen(true);
    } else {
      setTeamFormOpen(true);
    }
  };

  const totalPrize = computeTotalPrize(currentMatch);
  const killPrice = Math.round(Number(currentMatch.prizes?.killPrice) || 0);
  const entryFee = Math.round(Number(currentMatch.entryFee) || 0);
  const maxPlayers = currentMatch.maxPlayers || 48;
  const seatsTaken = currentMatch.seatsTaken || currentMatch.joinedPlayers || 0;
  const spotsLeft = Math.max(0, maxPlayers - seatsTaken);
  const progressPercent = Math.min(100, Math.max(0, (seatsTaken / maxPlayers) * 100));

  // Determine if a player name belongs to current logged-in user
  const isCurrentPlayerName = (playerName?: string | null): boolean => {
    if (!playerName || !auth.user) return false;
    const target = playerName.trim().toLowerCase();
    const userFf = (auth.user.ffName || '').trim().toLowerCase();
    const userName = (auth.user.name || '').trim().toLowerCase();
    const userUname = (auth.user.username || '').trim().toLowerCase();

    if (userFf && target === userFf) return true;
    if (userName && target === userName) return true;
    if (userUname && target === userUname) return true;

    // Check fullTeamMembers where userId === auth.user?.id
    const myMember = fullTeamMembers.find((m) => String(m.userId) === String(auth.user?.id));
    if (myMember) {
      if (myMember.ffName && target === myMember.ffName.trim().toLowerCase()) return true;
      if (myMember.name && target === myMember.name.trim().toLowerCase()) return true;
    }
    return false;
  };

  // Determine if a team in playersData belongs to the current user
  const isMyTeamCheck = (_teamNum: number, members: MatchPlayerItem[]): boolean => {
    if (!isJoined) return false;
    // 1. Check if any member in this team matches the current user
    if (members.some((m) => isCurrentPlayerName(m.name))) return true;
    // 2. Check if any member matches any member in fullTeamMembers
    if (fullTeamMembers.length > 0) {
      const memberNames = fullTeamMembers
        .map((m) => (m.ffName || m.name || '').trim().toLowerCase())
        .filter(Boolean);
      if (members.some((m) => memberNames.includes((m.name || '').trim().toLowerCase()))) {
        return true;
      }
    }
    return false;
  };

  // Get current user's team name for the "My Team" box
  const getMyTeamName = (): string | null => {
    if (isSolo) return null;
    if (myTeamName && myTeamName.trim() !== '') return myTeamName;
    if (playersData.length > 0) {
      const myPlayer =
        playersData.find((p) => isCurrentPlayerName(p.name)) ||
        (fullTeamMembers.length > 0
          ? playersData.find((p) =>
              fullTeamMembers.some(
                (m) =>
                  (m.ffName && p.name.toLowerCase() === m.ffName.trim().toLowerCase()) ||
                  (m.name && p.name.toLowerCase() === m.name.trim().toLowerCase())
              )
            )
          : undefined);
      if (myPlayer) {
        if (myPlayer.teamName && myPlayer.teamName.trim() !== '') return myPlayer.teamName;
        if (myPlayer.team != null) return `Team ${myPlayer.team}`;
      }
    }
    return null;
  };

  // Get the list of members to display in the "My Team" box
  const getMyTeamDisplayMembers = (): Array<{ name: string; isLeader: boolean }> => {
    if (isSolo) {
      const soloName = auth.user?.ffName || auth.user?.name || 'Gamer';
      return [{ name: soloName, isLeader: false }];
    }

    // Authoritative source: fullTeamMembers from fetchMyTeam
    if (fullTeamMembers.length > 0) {
      const sorted = [...fullTeamMembers].sort((a, b) => (b.isLeader ? 1 : 0) - (a.isLeader ? 1 : 0));
      return sorted.map((m) => ({
        name: m.ffName || m.name || 'Player',
        isLeader: Boolean(m.isLeader),
      }));
    }

    // Fallback to playersData if user is found in a team
    if (playersData.length > 0) {
      const myTeamNum = playersData.find((p) => isCurrentPlayerName(p.name))?.team;
      if (myTeamNum != null) {
        const teamPlayers = playersData.filter((p) => p.team === myTeamNum);
        if (teamPlayers.length > 0) {
          const sorted = [...teamPlayers].sort((a, _b) => {
            if (currentMatch.isTeamLeader) {
              return isCurrentPlayerName(a.name) ? -1 : 1;
            }
            return 0;
          });
          return sorted.map((p, idx) => ({
            name: p.name,
            isLeader: currentMatch.isTeamLeader ? isCurrentPlayerName(p.name) : idx === 0,
          }));
        }
      }
    }

    // Fallback before async team fetch resolves
    const myName = auth.user?.ffName || auth.user?.name || 'Gamer';
    return [{ name: myName, isLeader: Boolean(currentMatch.isTeamLeader) }];
  };

  const bannerImgSrc =
    matchRules.imageUrl && matchRules.imageUrl.trim() !== ''
      ? resolveImageUrl(matchRules.imageUrl)
      : '/assets/default_match_banner.jpg';

  const modalRoot =
    (typeof document !== 'undefined' && document.getElementById('modal-root')) ||
    (typeof document !== 'undefined' ? document.body : null);

  const pageInnerContent = (
    <>
      {/* Top Banner & Header */}
          <div className="relative w-full aspect-[16/10] min-h-[220px] bg-slate-900 overflow-hidden">
            <img
              src={bannerImgSrc}
              alt="Match Banner"
              className="w-full h-full object-cover object-center"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.endsWith('/assets/default_match_banner.jpg')) {
                  target.src = '/assets/default_match_banner.jpg';
                }
              }}
            />
            {/* Dark gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c16] via-transparent to-black/60 pointer-events-none" />

            {/* Back Button */}
            <div className="absolute top-3 left-3 z-10">
              <button
                type="button"
                data-testid="close-detail-modal-btn"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition active:scale-95 border border-white/10"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            </div>

            {/* Bottom Title inside banner */}
            <div className="absolute bottom-2 left-4 right-4 z-10">
              <h1 className="text-xl font-black uppercase tracking-tight text-white drop-shadow-md">
                {formatGameMode(currentMatch.gameMode)} | {currentMatch.teamMode.toUpperCase()} | {formatMatchId(currentMatch.id)}
              </h1>
              <div className="flex items-center gap-2 text-xs font-bold mt-0.5">
                <span
                  data-testid="match-start-time"
                  className="text-emerald-400 drop-shadow"
                >
                  {formatMatchDateTime(currentMatch.startTime)}
                </span>
                <span className="text-slate-400 drop-shadow">•</span>
                <span className="inline-flex items-center gap-1 text-slate-200 drop-shadow">
                  <MapPin className="h-3 w-3 text-amber-400 shrink-0" />
                  <span data-testid="match-map-name">{(currentMatch as any).mapName || (currentMatch as any).map || 'Bermuda'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Hidden seat label for test backward-compatibility */}
          <span data-testid="match-seats-label" className="sr-only">
            {currentMatch.teamMode.toLowerCase() === 'solo'
              ? t('matches.soloSeatStatus', {
                  joined: currentMatch.joinedPlayers,
                  max: currentMatch.maxPlayers,
                })
              : t('matches.teamSeatStatus', {
                  reserved: currentMatch.seatsTaken,
                  joined: currentMatch.joinedPlayers,
                })}
          </span>

          {/* Stats Grid (3 columns if killPrice > 0, 2 columns if killPrice is 0) */}
          <div className={`grid ${killPrice > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-2 px-4 pt-3 pb-2`}>
            {/* Total Prize */}
            <div className="rounded-xl bg-[#141728] border border-slate-800 p-2.5 text-center flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                {t('matches.totalPrize')}
              </span>
              <div className="mt-1 flex items-center justify-center gap-1">
                <span className="text-amber-400 text-sm font-black">₹</span>
                <span className="text-base font-black text-white">{totalPrize}</span>
              </div>
            </div>

            {/* Per Kill - only shown if killPrice > 0 */}
            {killPrice > 0 && (
              <div className="rounded-xl bg-[#141728] border border-slate-800 p-2.5 text-center flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                  {t('matches.killPrice')}
                </span>
                <div className="mt-1 flex items-center justify-center gap-1">
                  <span className="text-amber-400 text-sm font-black">₹</span>
                  <span data-testid="detail-kill-price" className="text-base font-black text-white">
                    {killPrice}
                  </span>
                </div>
              </div>
            )}

            {/* Entry Fee */}
            <div className="rounded-xl bg-[#141728] border border-slate-800 p-2.5 text-center flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                {t('matches.entryFee')}
              </span>
              <div className="mt-1 flex items-center justify-center gap-1">
                <span className="text-amber-400 text-sm font-black">₹</span>
                <span data-testid="detail-entry-fee" className="text-base font-black text-white">
                  {entryFee}
                </span>
              </div>
            </div>
          </div>

          {/* Joining Status Bar */}
          <div className="px-4 py-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1.5">
              <span>{t('matches.joiningStatus')}</span>
              <span className="text-slate-400">
                {t('matches.spotsLeft', { count: spotsLeft })}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Room Credentials Box (if joined & room is open or live) */}
          {showRoomCredentials && (
            <div
              data-testid="room-credentials-box"
              className="mx-4 my-2 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 p-3.5 text-xs space-y-2.5 shadow-lg"
            >
              <div className="font-bold text-emerald-400 flex items-center justify-between">
                <span>{t('matches.roomCredentials')}</span>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 uppercase">
                  {formatEnum('status', currentMatch.status)}
                </span>
              </div>

              <div className="flex items-center justify-between bg-black/60 p-2.5 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block">{t('matches.roomId')}</span>
                  <span
                    data-testid="room-id-value"
                    className="font-mono text-sm font-bold text-slate-100"
                  >
                    {currentMatch.roomId || t('matches.pending')}
                  </span>
                </div>
                {currentMatch.roomId && (
                  <button
                    type="button"
                    data-testid="copy-room-id-btn"
                    onClick={() => handleCopy(currentMatch.roomId, 'roomId')}
                    className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                  >
                    {copiedField === 'roomId' ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>{t('common.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>{t('common.copy')}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between bg-black/60 p-2.5 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block">
                    {t('matches.roomPassword')}
                  </span>
                  <span
                    data-testid="room-password-value"
                    className="font-mono text-sm font-bold text-slate-100"
                  >
                    {passwordRevealed
                      ? currentMatch.roomPassword || t('matches.pending')
                      : '••••••••'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {currentMatch.roomPassword && (
                    <>
                      <button
                        type="button"
                        data-testid="toggle-reveal-password-btn"
                        onClick={() => setPasswordRevealed(!passwordRevealed)}
                        className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
                        title={
                          passwordRevealed
                            ? t('matches.hidePassword')
                            : t('matches.revealPassword')
                        }
                      >
                        {passwordRevealed ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        data-testid="copy-room-password-btn"
                        onClick={() => handleCopy(currentMatch.roomPassword, 'roomPassword')}
                        className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        {copiedField === 'roomPassword' ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span>{t('common.copied')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>{t('common.copy')}</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* My Team Section (if user has joined the match) */}
          {isJoined && (
            <div
              data-testid="my-team-section"
              className="mx-4 my-2 rounded-2xl bg-[#141728] p-3.5 border border-slate-800 text-xs space-y-2.5"
            >
              <div className="flex justify-between items-center">
                <div className="font-bold text-slate-100 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-emerald-400" />
                  <span>{t('matches.myTeam')}</span>
                </div>
                {!isSolo && currentMatch.isTeamLeader != null && (
                  <span
                    data-testid="team-role-badge"
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      currentMatch.isTeamLeader
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-700/50 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {currentMatch.isTeamLeader
                      ? t('matches.teamLeader')
                      : t('matches.teamMember')}
                  </span>
                )}
              </div>

              {/* Team Name in golden color */}
              {(() => {
                const teamName = getMyTeamName();
                if (!teamName) return null;
                return (
                  <div
                    data-testid="my-team-name-title"
                    className="text-amber-400 font-bold text-sm tracking-wide pt-0.5"
                  >
                    {teamName}
                  </div>
                );
              })()}

              {/* Members List inside bordered box */}
              <div
                data-testid="my-team-members-list"
                className="space-y-2 p-2.5 rounded-xl border border-slate-800 bg-slate-900/60"
              >
                {getMyTeamDisplayMembers().map((m, idx) => {
                  const isCurrent = isCurrentPlayerName(m.name);
                  return (
                    <div
                      key={idx}
                      data-testid={`my-team-member-${idx}`}
                      className="flex items-center gap-2 text-sm font-semibold text-slate-100"
                    >
                      <span className="text-slate-400 font-bold text-xs">
                        {idx + 1}.{' '}
                      </span>
                      <span
                        className={`font-bold ${
                          isCurrent ? 'text-violet-200' : 'text-slate-100'
                        }`}
                      >
                        {m.name}
                      </span>
                      {m.isLeader && (
                        <>
                          {' '}
                          <span className="text-amber-400 font-bold text-xs">
                            (Team Leader)
                          </span>
                        </>
                      )}
                      {isCurrent && (
                        <>
                          {' '}
                          <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">
                            (You)
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {!isSolo && (
                <div
                  data-testid="team-changes-rule-note"
                  className="rounded-lg bg-slate-900/80 p-2 text-[11px] text-amber-300/90 border border-amber-500/10"
                >
                  {t('matches.teamChangesRuleNote')}
                </div>
              )}

              {!isSolo && (currentMatch.status === 'upcoming' || currentMatch.status === 'room_open') &&
                (currentMatch.isTeamLeader ? (
                  (currentMatch.hasReplacedTeammate || teamReplaceCount >= 1) ? (
                    <button
                      type="button"
                      disabled
                      data-testid="open-replace-teammate-btn"
                      className="w-full rounded-xl border border-slate-800 bg-slate-800/40 py-2 text-xs font-semibold text-slate-500 cursor-not-allowed"
                    >
                      {t('matches.teamChangesClosedReplaced')}
                    </button>
                  ) : (currentMatch.canReplaceTeammate === false || (currentMatch.startTime && new Date(currentMatch.startTime).getTime() - Date.now() <= 10 * 60 * 1000)) ? (
                    <button
                      type="button"
                      disabled
                      data-testid="open-replace-teammate-btn"
                      className="w-full rounded-xl border border-slate-800 bg-slate-800/40 py-2 text-xs font-semibold text-slate-500 cursor-not-allowed"
                    >
                      {t('matches.teamChangesClosedCutoff')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid="open-replace-teammate-btn"
                      onClick={() => {
                        if (myTeamMembers.length === 0) {
                          fetchMyTeam(currentMatch.id)
                            .then((team) => {
                              if (team?.name) {
                                setMyTeamName(team.name);
                              }
                              if (team?.members) {
                                setFullTeamMembers(team.members);
                                setMyTeamMembers(team.members.filter((m) => !m.isLeader));
                              }
                            })
                            .catch(() => {});
                        }
                        setTeamManageMode('replace');
                      }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                    >
                      {t('matches.replaceTeammate')}
                    </button>
                  )
                ) : (
                  <div
                    data-testid="member-no-replace-note"
                    className="rounded-lg bg-slate-900/60 p-2 text-[11px] text-slate-400 border border-slate-800 italic"
                  >
                    {t('matches.onlyLeaderCanChange')}
                  </div>
                ))}
            </div>
          )}

          {/* Soft Low Balance Warning */}
          {lowBalanceSoftHint && (
            <div
              data-testid="soft-low-balance-hint"
              className="mx-4 my-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300 flex items-start gap-2"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                {t('matches.softLowBalanceHint', {
                  balance: formatIndianRupees(wallets?.total),
                })}
              </span>
            </div>
          )}

          {/* View Tabs: RULES | PLAYERS | PRIZE POOL | (REWARD only for completed/cancelled) */}
          <div className={`grid ${isMatchEnded ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5 px-4 my-3`}>
            <button
              type="button"
              data-testid="tab-rules"
              onClick={() => setActiveTab('rules')}
              className={`py-2 rounded-xl text-xs font-black tracking-wide uppercase transition-all ${
                activeTab === 'rules'
                  ? 'bg-[#1b1f35] text-white border border-slate-700 shadow-md'
                  : 'bg-[#101221] text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {t('matches.tabRules')}
            </button>
            <button
              type="button"
              data-testid="tab-players"
              onClick={() => setActiveTab('players')}
              className={`py-2 rounded-xl text-xs font-black tracking-wide uppercase transition-all ${
                activeTab === 'players'
                  ? 'bg-[#1b1f35] text-white border border-slate-700 shadow-md'
                  : 'bg-[#101221] text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {t('matches.tabPlayers')}
            </button>
            <button
              type="button"
              data-testid="tab-prize-pool"
              onClick={() => setActiveTab('prize')}
              className={`py-2 rounded-xl text-xs font-black tracking-wide uppercase transition-all ${
                activeTab === 'prize'
                  ? 'bg-[#1b1f35] text-white border border-slate-700 shadow-md'
                  : 'bg-[#101221] text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {t('matches.tabPrizePool')}
            </button>
            {isMatchEnded && (
              <button
                type="button"
                data-testid="tab-reward"
                onClick={() => setActiveTab('reward')}
                className={`py-2 rounded-xl text-xs font-black tracking-wide uppercase transition-all ${
                  activeTab === 'reward'
                    ? 'bg-[#1b1f35] text-white border border-slate-700 shadow-md'
                    : 'bg-[#101221] text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {t('matches.tabReward')}
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 px-4">
            {/* 1. PLAYERS TAB */}
            {activeTab === 'players' && (
              <div data-testid="players-tab-content" className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="text-sm font-black text-white">
                    {t('matches.joinedPlayersCount', {
                      count: playersData.length || currentMatch.joinedPlayers,
                    })}
                  </span>
                </div>

                {isLoadingPlayers ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    {t('common.loading')}
                  </div>
                ) : playersData.length > 0 ? (
                  <div className="rounded-2xl bg-[#0c0e1a] border border-slate-800 overflow-hidden shadow-md divide-y divide-slate-800/80">
                    {(() => {
                      const teamMap = new Map<number, MatchPlayerItem[]>();
                      playersData.forEach((p) => {
                        const list = teamMap.get(p.team) || [];
                        list.push(p);
                        teamMap.set(p.team, list);
                      });

                      return Array.from(teamMap.entries()).map(([teamNum, members]) => {
                        const teamName = members[0]?.teamName || `Team ${teamNum}`;
                        const isMyTeam = isMyTeamCheck(teamNum, members);
                        return (
                          <div
                            key={teamNum}
                            data-testid={isMyTeam ? 'my-team-players-row' : undefined}
                            className={`flex items-stretch text-xs divide-x transition-colors ${
                              isMyTeam
                                ? 'divide-violet-500/30 bg-violet-950/40 border-l-4 border-l-violet-500 ring-1 ring-inset ring-violet-500/40 shadow-sm'
                                : 'divide-slate-800/80'
                            }`}
                          >
                            {/* Column 1: Team & Team Name */}
                            <div
                              className={`w-28 sm:w-36 shrink-0 flex flex-col items-center justify-center p-3 text-center min-w-0 ${
                                isMyTeam
                                  ? 'bg-violet-950/60 text-violet-300'
                                  : 'bg-[#111322] text-slate-200'
                              }`}
                            >
                              <span className="font-black tracking-wide text-xs whitespace-nowrap">
                                Team: {teamNum}
                              </span>
                              <span
                                className={`font-bold text-xs truncate max-w-full mt-0.5 ${
                                  isMyTeam ? 'text-amber-300' : 'text-amber-400'
                                }`}
                                title={teamName}
                              >
                                {teamName}
                              </span>
                              {isMyTeam && (
                                <span className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase bg-violet-500/20 text-violet-300 border border-violet-500/40 whitespace-nowrap">
                                  My Team
                                </span>
                              )}
                            </div>

                            {/* Column 3: Numbered Player Names */}
                            <div
                              className={`flex-1 p-3 space-y-1.5 min-w-0 ${
                                isMyTeam ? 'bg-violet-950/30' : 'bg-[#0e101c]'
                              }`}
                            >
                              {members.map((m, mIdx) => {
                                const isCurrent = isCurrentPlayerName(m.name);
                                return (
                                  <div key={mIdx} className="flex items-center gap-2 font-medium text-slate-200">
                                    <span
                                      className={`font-bold min-w-[16px] ${
                                        isMyTeam ? 'text-violet-400' : 'text-slate-400'
                                      }`}
                                    >
                                      {mIdx + 1}.
                                    </span>
                                    <span
                                      className={`font-bold truncate ${
                                        isCurrent ? 'text-violet-200' : 'text-slate-100'
                                      }`}
                                      title={m.name}
                                    >
                                      {m.name}
                                    </span>
                                    {isCurrent && (
                                      <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-1 py-0.5 rounded border border-violet-500/20">
                                        (You)
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-[#101221] border border-slate-800 p-6 text-center text-xs text-slate-400">
                    {t('matches.noPlayersJoinedYet')}
                  </div>
                )}
              </div>
            )}

            {/* 2. PRIZE POOL TAB */}
            {activeTab === 'prize' && (
              <div data-testid="prizes-tab-content" className="rounded-2xl bg-[#101221] border border-slate-800 p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-200">
                  {t('matches.prizeDistributionDetails')}
                </h3>

                <div className="space-y-3 text-xs font-semibold text-slate-200">
                  {currentMatch.prizes.positions &&
                  Object.keys(currentMatch.prizes.positions).length > 0 ? (
                    Object.entries(currentMatch.prizes.positions).map(([pos, amt]) => {
                      const placePrefix =
                        pos === '1'
                          ? '1st'
                          : pos === '2'
                          ? '2nd'
                          : pos === '3'
                          ? '3rd'
                          : `${pos}th`;
                      return (
                        <div
                          key={pos}
                          className="flex items-center justify-between pb-2 border-b border-slate-800/80"
                        >
                          <span className="font-bold text-slate-100">
                            {placePrefix} Place: ₹{amt}{killPrice > 0 ? ' + Kill Points' : ''}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <span className="font-bold text-slate-100">
                        1st Place: ₹40{killPrice > 0 ? ' + Kill Points' : ''}
                      </span>
                    </div>
                  )}

                  {killPrice > 0 && (
                    <div className="flex items-center justify-between pt-1 text-slate-400">
                      <span>Per Kill Bounty:</span>
                      <span className="font-bold text-emerald-400">
                        ₹{currentMatch.prizes.killPrice} per kill
                      </span>
                    </div>
                  )}
                </div>

                {killPrice > 0 && isBR && (
                  <div
                    data-testid="br-kill-rule-note"
                    className="rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-300 border border-emerald-500/20"
                  >
                    {t('matches.minKillsReward', {
                      count:
                        currentMatch.prizes?.minKillsForReward ??
                        (currentMatch as any).minKillsForReward ??
                        2,
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. RULES TAB (With Bangla/English Switcher & Crisp Contrast Card) */}
            {activeTab === 'rules' && (
              <div className="rounded-2xl bg-white shadow-xl overflow-hidden mb-6 text-slate-800">
                {/* Dark Blue Header with Title & Emerald Line */}
                <div className="bg-[#161a2e] px-4 pt-4 pb-3 text-center relative">
                  <h3 className="text-base font-black tracking-wide text-white">
                    {t('matches.rulesAndPolicies')}
                  </h3>
                  <div className="h-1 w-full bg-emerald-500 absolute bottom-0 left-0 right-0" />
                </div>

                <div className="p-4 space-y-4">
                  {/* Language Switcher: ENGLISH | বাংলা */}
                  <div className="text-center">
                    <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-2">
                      {rulesLang === 'bn'
                        ? 'ভাষা নির্বাচন করুন / SELECT LANGUAGE'
                        : 'SELECT LANGUAGE / ভাষা নির্বাচন করুন'}
                    </p>
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80 shadow-inner">
                      <button
                        type="button"
                        data-testid="rules-lang-en-btn"
                        onClick={() => setRulesLang('en')}
                        className={`px-6 py-1.5 rounded-lg text-xs font-black transition-all ${
                          rulesLang === 'en'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {t('matches.languageEnglish')}
                      </button>
                      <button
                        type="button"
                        data-testid="rules-lang-bn-btn"
                        onClick={() => setRulesLang('bn')}
                        className={`px-6 py-1.5 rounded-lg text-xs font-black transition-all ${
                          rulesLang === 'bn'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {t('matches.languageBangla')}
                      </button>
                    </div>
                  </div>

                  {/* Rules Content */}
                  {rulesLang === 'en' ? (
                    <div className="space-y-4 text-xs text-slate-800 leading-relaxed">
                      {matchRules.rulesEn && matchRules.rulesEn.trim() !== '' ? (
                        <div className="whitespace-pre-line text-slate-700 font-medium">
                          {matchRules.rulesEn}
                        </div>
                      ) : !isBR ? (
                        <>
                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              Instructions Before Joining
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed space-y-1.5">
                              <ol className="list-decimal pl-4 space-y-1">
                                <li>
                                  Enter your{' '}
                                  <span className="font-bold text-slate-900">FF MAX account name only</span> (no changes allowed)
                                </li>
                                <li>
                                  Match room ID and password will be sent <span className="font-bold text-slate-900">2-3 minutes</span> before the match
                                </li>
                                <li>Read Other Rules Carefully</li>
                                <li>
                                  <span className="font-bold text-slate-900">No Refunds</span> if player forgets to Join Match
                                </li>
                              </ol>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              Eligibility Rules
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ul className="list-disc pl-4 space-y-1">
                                <li>Only players with <span className="font-bold text-slate-900">Level 40+ ID</span></li>
                                <li>Headshot rate must be <span className="font-bold text-slate-900">below 70%</span> in CS career</li>
                                <li>Play only on Android, iOS, tablets, or phones (emulators are <span className="text-red-600 font-bold">not allowed</span>)</li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-emerald-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              Room Structure
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ul className="list-disc pl-4 space-y-1">
                                <li>Rounds : 7</li>
                                <li>Default Coins : 9950</li>
                                <li>Character Skill : Yes</li>
                                <li>Gun Attributes : Yes</li>
                                <li>All guns are Allowed Except Double Vector</li>
                                <li>Refund For Players Killed By Hackers</li>
                                <li>Emulators : No</li>
                                <li>Mode : Random Store</li>
                                <li>Chips are Allowed</li>
                                <li>Gloo Breaking is Allowed</li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-red-500 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              Prohibited Behaviour / Not Allowed
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ul className="list-disc pl-4 space-y-1">
                                <li>Aimbot</li>
                                <li>Heal Battle</li>
                                <li>Ryden & A124</li>
                                <li>No recoil</li>
                                <li>Hacking</li>
                                <li>Double Vector & Throwables (Grenades, Flash Freeze, etc.)</li>
                                <li>Zone Packing</li>
                                <li>Game modifying tools</li>
                                <li>Glitches & Bugs</li>
                                <li>Teaming up with opponents</li>
                                <li>Inviting players who are not registered</li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              Fair Play Rules
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <p>
                                Players may be asked to provide their Match Screen recording (HUD) within 2 days of the match. Failure to submit the recording when requested will result in an immediate ban of the Booyah Win account and rejection of any pending withdrawals.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              Some Important Tips
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ul className="list-disc pl-4 space-y-1">
                                <li>Blacklisted Game-ID's are not allowed to play and immediate ban will be issued if we got any report from Garena .</li>
                                <li>Note if there is any mistake in room structure then immediately report it to host or customer support for action/if not updated then lateron no actions will be taken.</li>
                                <li>If a player is found violating any of the rules, the prize will not be processed, and it may result in a ban.</li>
                                <li>Rules can be changed without any prior notice.</li>
                                <li>If you are killed by any hacker/team-up player, record evidence for a full refund.</li>
                                <li>Abusing any of the Player/Host will lead to an immediate ban.</li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              Raise Your Query
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed space-y-1">
                              <p>Raise issues with customer support within 2 hours of match end time</p>
                              <p className="text-slate-400 italic text-[11px]">Booyah Win reserves the right to modify prizes and rules.</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              Instructions Before Joining
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed space-y-2">
                              <ol className="list-decimal pl-4 space-y-1.5">
                                <li>
                                  Enter your{' '}
                                  <span className="font-bold text-slate-900">
                                    FF MAX account name only
                                  </span>{' '}
                                  (no changes allowed later).
                                </li>
                                <li>
                                  Match{' '}
                                  <span className="font-bold text-slate-900">
                                    Room ID and Password
                                  </span>{' '}
                                  will be sent 5-7 minutes before the match.
                                </li>
                                <li>
                                  Make sure <span className="text-red-600 font-black">NOT</span> to
                                  use <span className="font-bold text-slate-900">Double Vector & M79</span>.
                                </li>
                                <li>
                                  Make sure <span className="text-red-600 font-black">NOT</span> to
                                  use{' '}
                                  <span className="font-bold text-slate-900">
                                    Ryden [Makdi Character]
                                  </span>.
                                </li>
                                <li>
                                  If a player forgets to join the match,{' '}
                                  <span className="font-bold text-slate-900">no refunds</span> will
                                  be given. Please play responsibly.
                                </li>
                                <li>
                                  Please review the reward pool distribution carefully before
                                  joining. The displayed pool on the card may represent a total
                                  distribution or demo amount.
                                </li>
                                <li>
                                  In FF FULL MAP, FF FULL MAP 2 Matches,{' '}
                                  <span className="font-bold text-slate-900">
                                    Double Snipers are banned
                                  </span>. If found using a Sniper, no rewards will be processed.
                                </li>
                                <li>
                                  In ALL MODES{' '}
                                  <span className="font-bold text-slate-900">
                                    Horse [GHODA] is banned
                                  </span>. If found using Horse[GHODA], no rewards will be processed.
                                </li>
                                <li>
                                  In Survival Matches,{' '}
                                  <span className="font-bold text-slate-900">
                                    Snipers, Double Snipers are banned
                                  </span>. If found using a Sniper, no rewards will be processed.
                                </li>
                              </ol>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              Eligibility Rules
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ul className="list-disc pl-4 space-y-1.5">
                                <li>
                                  Only players with a{' '}
                                  <span className="font-bold text-slate-900">Level 40+ ID</span> are
                                  allowed.
                                </li>
                                <li>
                                  Headshot rate must be{' '}
                                  <span className="font-bold text-slate-900">&le; 70%</span> in BR
                                  career.
                                </li>
                                <li>
                                  Play only on Android, iOS, tablets, or phones (Emulators are{' '}
                                  <span className="text-red-600 font-bold">NOT allowed</span>).
                                </li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-red-500 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              Prohibited Behaviour / Not Allowed
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ul className="list-disc pl-4 space-y-1">
                                <li>Aimbot / Hacking / No Recoil</li>
                                <li>Ryden [Makdi Character]</li>
                                <li>Snipers in Survival Matches</li>
                                <li>Double Vector & M79</li>
                                <li>Game modifying tools (Config, Scripts, etc.)</li>
                                <li>Exploiting Glitches or Bugs</li>
                                <li>Teaming up with opponent players</li>
                                <li>Inviting unregistered players</li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              Fair Play Rules
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <p>
                                Players may be asked to provide their Match Screen Recording (HUD)
                                within 2 days. Failure to submit will result in an immediate ban of
                                the Booyah Win account and rejection of withdrawals.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              Important Guidelines
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ul className="list-disc pl-4 space-y-1.5">
                                <li>
                                  Blacklisted Game-IDs are not allowed. Any report from Garena will
                                  result in an immediate ban.
                                </li>
                                <li>
                                  If slots are not full, then the winning rewards may get changed
                                  as per the structure.
                                </li>
                                <li>
                                  If a player violates rules, rewards will not be processed, and it
                                  will lead to a permanent ban.
                                </li>
                                <li>
                                  If the room is full, keep a screenshot of the full room ready for
                                  a refund.
                                </li>
                                <li>
                                  If killed by a hacker/team-up player, record video evidence for a
                                  refund.
                                </li>
                                <li>Abusing any Player/Host will lead to an immediate ban.</li>
                                <li className="text-amber-600 font-semibold">
                                  Note: If we find any suspicious gameplay, the player can be asked
                                  for match screen recording. If not provided, the account will be
                                  suspended immediately.
                                </li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              Raise Your Query
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed space-y-1">
                              <p>
                                Raise issues with customer support within 2 hours of match end time.
                              </p>
                              <p className="text-slate-400 italic text-[11px]">
                                Booyah Win reserves the right to modify exciting rewards and rules.
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 text-xs text-slate-800 leading-relaxed">
                      {matchRules.rulesBn && matchRules.rulesBn.trim() !== '' ? (
                        <div className="whitespace-pre-line text-slate-700 font-medium">
                          {matchRules.rulesBn}
                        </div>
                      ) : !isBR ? (
                        <>
                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              যোগদানের পূর্বের নির্দেশাবলী :
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed space-y-1.5">
                              <ol className="list-decimal pl-4 space-y-1">
                                <li>
                                  শুধুমাত্র আপনার <span className="font-bold text-slate-900">FF MAX অ্যাকাউন্টের নাম</span> লিখুন (কোনো পরিবর্তন গ্রহণযোগ্য নয়)
                                </li>
                                <li>
                                  ম্যাচ শুরুর <span className="font-bold text-slate-900">২-৩ মিনিট</span> আগে ম্যাচ রুম আইডি এবং পাসওয়ার্ড পাঠানো হবে
                                </li>
                                <li>অন্যান্য নিয়মাবলী সতর্কতার সাথে পড়ুন</li>
                                <li>
                                  কোনো খেলোয়াড় ম্যাচে যোগ দিতে ভুলে গেলে <span className="font-bold text-slate-900">কোনো রিফান্ড দেওয়া হবে না</span>
                                </li>
                              </ol>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              যোগ্যতার নিয়মাবলী:
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ul className="list-disc pl-4 space-y-1">
                                <li>শুধুমাত্র <span className="font-bold text-slate-900">লেভেল ৪০+ (Level 40+)</span> আইডি অনুমোদিত</li>
                                <li>CS ক্যারিয়ারে হেডশট রেট অবশ্যই <span className="font-bold text-slate-900">৭০%-এর নিচে</span> হতে হবে</li>
                                <li>শুধুমাত্র Android, iOS, ট্যাবলেট বা ফোনে খেলুন (ইমুলেটর <span className="text-red-600 font-bold">সম্পূর্ণ নিষিদ্ধ</span>)</li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-emerald-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              রুমের কাঠামো:
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ul className="list-disc pl-4 space-y-1">
                                <li>রাউন্ড : ৭</li>
                                <li>ডিফল্ট কয়েন : ৯৯৫০</li>
                                <li>চরিত্রের দক্ষতা (Character Skill) : হ্যাঁ</li>
                                <li>বন্দুকের বৈশিষ্ট্য (Gun Attributes) : হ্যাঁ</li>
                                <li>Double Vector ছাড়া সব বন্দুক অনুমোদিত</li>
                                <li>হ্যাকারের হাতে নিহত খেলোয়াড়দের রিফান্ড দেওয়া হবে</li>
                                <li>ইমুলেটর : না</li>
                                <li>মোড : Random Store</li>
                                <li>চিপস (Chips) অনুমোদিত</li>
                                <li>গ্লু ওয়াল ভাঙা (Gloo Breaking) অনুমোদিত</li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-red-500 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              নিষিদ্ধ আচরণ / যা অনুমোদিত নয়:
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ul className="list-disc pl-4 space-y-1">
                                <li>Aimbot</li>
                                <li>Heal Battle</li>
                                <li>Ryden ও A124 চরিত্র</li>
                                <li>No recoil</li>
                                <li>হ্যাকিং</li>
                                <li>Double Vector ও Throwables (Grenades, Flash Freeze ইত্যাদি)</li>
                                <li>Zone Packing</li>
                                <li>গেম পরিবর্তনকারী টুলস</li>
                                <li>গ্লিচ (Glitches) ও বাগ (Bugs)</li>
                                <li>বিপক্ষ দলের সাথে টিম-আপ করা</li>
                                <li>অনিবন্ধিত খেলোয়াড়দের আমন্ত্রণ জানানো</li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              ন্যায্য খেলার নিয়ম:
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <p>
                                খেলোয়াড়দের ম্যাচের ২ দিনের মধ্যে তাদের ম্যাচ স্ক্রিন রেকর্ডিং (HUD) জমা দিতে বলা হতে পারে। অনুরোধের পর রেকর্ডিং জমা দিতে ব্যর্থ হলে Booyah Win অ্যাকাউন্ট অবিলম্বে ব্যান করা হবে এবং যেকোনো পেন্ডিং উইথড্রয়াল বাতিল করা হবে।
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              গুরুত্বপূর্ণ কিছু টিপস:
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ul className="list-disc pl-4 space-y-1">
                                <li>ব্ল্যাকলিস্টেড গেম-আইডি দিয়ে খেলা যাবে না এবং গেরিনা (Garena) থেকে কোনো রিপোর্ট পেলে তাৎক্ষণিক ব্যান করা হবে।</li>
                                <li>মনে রাখবেন রুমের কাঠামোতে কোনো ভুল থাকলে অবিলম্বে হোস্ট বা কাস্টমার সাপোর্টে জানান। আপডেট না জানালে পরবর্তীতে কোনো ব্যবস্থা নেওয়া হবে না।</li>
                                <li>কোনো খেলোয়াড় নিয়ম লঙ্ঘন করলে পুরস্কার প্রদান করা হবে না এবং অ্যাকাউন্ট ব্যান হতে পারে।</li>
                                <li>কোনো পূর্ব নোটিশ ছাড়াই নিয়ম পরিবর্তন করা হতে পারে।</li>
                                <li>হ্যাকার বা টিম-আপ খেলোয়াড়ের হাতে নিহত হলে পূর্ণ রিফান্ডের জন্য প্রমাণ রেকর্ড করুন।</li>
                                <li>কোনো খেলোয়াড় বা হোস্টের সাথে দুর্ব্যবহার করলে অবিলম্বে ব্যান করা হবে।</li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              আপনার অভিযোগ জানান:
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed space-y-1">
                              <p>ম্যাচ শেষ হওয়ার ২ ঘণ্টার মধ্যে কাস্টমার সাপোর্টে অভিযোগ জানান।</p>
                              <p className="text-slate-400 italic text-[11px]">Booyah Win যেকোনো পুরষ্কার এবং নিয়মাবলী পরিবর্তন করার অধিকার সংরক্ষণ করে।</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              যোগদানের পূর্বের নির্দেশাবলী
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ol className="list-decimal pl-4 space-y-1.5">
                                <li>
                                  শুধুমাত্র আপনার{' '}
                                  <span className="font-bold text-slate-900">
                                    FF MAX অ্যাকাউন্টের নাম
                                  </span>{' '}
                                  লিখুন (পরবর্তীতে কোনো পরিবর্তন করা যাবে না)।
                                </li>
                                <li>
                                  ম্যাচ শুরুর{' '}
                                  <span className="font-bold text-slate-900">৫-৭ মিনিট আগে</span>{' '}
                                  ম্যাচ রুম আইডি এবং পাসওয়ার্ড পাঠানো হবে।
                                </li>
                                <li>
                                  কোনো অবস্থাতেই{' '}
                                  <span className="text-red-600 font-black">
                                    Double Vector এবং M79
                                  </span>{' '}
                                  ব্যবহার করবেন না।
                                </li>
                                <li>
                                  কোনো অবস্থাতেই{' '}
                                  <span className="text-red-600 font-black">
                                    Ryden [মাকড়সা চরিত্র / Makdi Character]
                                  </span>{' '}
                                  ব্যবহার করবেন না।
                                </li>
                                <li>
                                  কোনো খেলোয়াড় যদি ম্যাচে যোগ দিতে ভুলে যান, তবে{' '}
                                  <span className="font-bold text-slate-900">
                                    কোনো রিফান্ড দেওয়া হবে না
                                  </span>
                                  । দয়া করে দায়িত্বের সাথে খেলুন।
                                </li>
                                <li>
                                  যোগদানের পূর্বে পুরষ্কার বিতরণের নিয়মাবলী সতর্কতার সাথে
                                  পর্যালোচনা করুন। কার্ডে প্রদর্শিত পুলটি মোট বণ্টন বা ডেমো পরিমাণ
                                  হতে পারে।
                                </li>
                                <li>
                                  FF FULL MAP এবং FF FULL MAP 2 ম্যাচে{' '}
                                  <span className="font-bold text-slate-900">
                                    Double Sniper সম্পূর্ণ নিষিদ্ধ
                                  </span>
                                  । Sniper ব্যবহার করলে কোনো পুরষ্কার দেওয়া হবে না।
                                </li>
                                <li>
                                  সমস্ত মোডে{' '}
                                  <span className="font-bold text-slate-900">
                                    ঘোড়া [Horse/GHODA] ব্যবহার সম্পূর্ণ নিষিদ্ধ
                                  </span>
                                  । ঘোড়া ব্যবহার করলে কোনো পুরষ্কার দেওয়া হবে না।
                                </li>
                                <li>
                                  Survival ম্যাচে{' '}
                                  <span className="font-bold text-slate-900">
                                    Sniper এবং Double Sniper সম্পূর্ণ নিষিদ্ধ
                                  </span>
                                  । Sniper ব্যবহার করলে কোনো পুরষ্কার দেওয়া হবে না।
                                </li>
                              </ol>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              যোগ্যতার নিয়মাবলী
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ul className="list-disc pl-4 space-y-1.5">
                                <li>
                                  শুধুমাত্র{' '}
                                  <span className="font-bold text-slate-900">
                                    লেভেল ৪০+ (Level 40+)
                                  </span>{' '}
                                  আইডি অনুমোদিত।
                                </li>
                                <li>
                                  BR ক্যারিয়ারে হেডশট রেট অবশ্যই{' '}
                                  <span className="font-bold text-slate-900">&le; ৭০%</span> হতে
                                  হবে।
                                </li>
                                <li>
                                  শুধুমাত্র Android, iOS, ট্যাবলেট বা ফোনে খেলুন (ইমুলেটর{' '}
                                  <span className="text-red-600 font-bold">সম্পূর্ণ নিষিদ্ধ</span>
                                  )।
                                </li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-red-500 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              নিষিদ্ধ আচরণ / যা অনুমোদিত নয়
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ul className="list-disc pl-4 space-y-1">
                                <li>Aimbot / হ্যাকিং / No Recoil</li>
                                <li>Ryden [মাকড়সা চরিত্র / Makdi Character]</li>
                                <li>Survival ম্যাচে Snipers</li>
                                <li>Double Vector ও M79</li>
                                <li>গেম পরিবর্তনকারী টুলস (Config, Scripts ইত্যাদি)</li>
                                <li>গ্লিচ (Glitches) বা বাগ (Bugs) অপব্যবহার করা</li>
                                <li>বিপক্ষ দলের খেলোয়াড়দের সাথে টিম-আপ (Teaming up) করা</li>
                                <li>অনিবন্ধিত খেলোয়াড়দের আমন্ত্রণ জানানো</li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              ন্যায্য খেলার নিয়ম
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <p>
                                খেলোয়াড়দের ২ দিনের মধ্যে তাদের ম্যাচ স্ক্রিন রেকর্ডিং (HUD) জমা
                                দিতে বলা হতে পারে। ব্যর্থ হলে তাৎক্ষণিকভাবে Booyah Win অ্যাকাউন্ট
                                নিষিদ্ধ করা হবে এবং টাকা তোলা (Withdrawals) বাতিল করা হবে।
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              গুরুত্বপূর্ণ নির্দেশিকা
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed">
                              <ul className="list-disc pl-4 space-y-1.5">
                                <li>
                                  ব্ল্যাকলিস্টেড গেম-আইডি অনুমোদিত নয়। গেরিনা (Garena) থেকে যেকোনো
                                  রিপোর্টের ক্ষেত্রে তাৎক্ষণিক ব্যান করা হবে।
                                </li>
                                <li>
                                  যদি স্লট পূর্ণ না হয়, তবে কাঠামো অনুযায়ী জয়ের পুরস্কার
                                  পরিবর্তিত হতে পারে।
                                </li>
                                <li>
                                  কোনো খেলোয়াড় নিয়ম লঙ্ঘন করলে, কোনো পুরস্কার দেওয়া হবে না এবং
                                  স্থায়ীভাবে অ্যাকাউন্ট ব্যান করা হবে।
                                </li>
                                <li>
                                  যদি কাস্টম রুম পূর্ণ থাকে, তবে রিফান্ডের জন্য পূর্ণ রুমের একটি
                                  স্ক্রিনশট প্রস্তুত রাখুন।
                                </li>
                                <li>
                                  হ্যাকার বা টিম-আপ খেলোয়াড়ের হাতে নিহত হলে, রিফান্ডের জন্য ভিডিও
                                  প্রমাণ রেকর্ড করুন।
                                </li>
                                <li>
                                  যেকোনো খেলোয়াড় বা হোস্টের সাথে দুর্ব্যবহার করলে তাৎক্ষণিকভাবে
                                  ব্যান করা হবে।
                                </li>
                                <li className="text-amber-600 font-semibold">
                                  দ্রষ্টব্য: কোনো সন্দেহজনক গেমপ্লে ধরা পড়লে, খেলোয়াড়ের কাছে ম্যাচ
                                  স্ক্রিন রেকর্ডিং চাওয়া হতে পারে। না দিলে অ্যাকাউন্ট অবিলম্বে
                                  স্থগিত করা হবে।
                                </li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="border-l-4 border-blue-600 pl-2.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                              প্রশ্ন বা অভিযোগ
                            </h4>
                            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-[11.5px] font-medium text-slate-700 leading-relaxed space-y-1">
                              <p>
                                ম্যাচ শেষ হওয়ার ২ ঘণ্টার মধ্যে কাস্টমার সাপোর্টে সমস্যা জানান।
                              </p>
                              <p className="text-slate-400 italic text-[11px]">
                                Booyah Win যেকোনো উত্তেজনাপূর্ণ পুরষ্কার এবং নিয়মাবলী পরিবর্তন বা
                                সংশোধন করার অধিকার সংরক্ষণ করে।
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. REWARD TAB (only for completed or cancelled matches) */}
            {isMatchEnded && activeTab === 'reward' && (
              <div data-testid="reward-tab-content" className="space-y-3">
                {/* Cancelled Notice & Reason */}
                {(currentMatch.status === 'cancelled' || cancelReason) && (
                  <div data-testid="reward-tab-cancelled-reason" className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wide">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{t('matches.matchCancelled')}</span>
                    </div>
                    <div className="text-xs text-slate-300 leading-relaxed bg-[#111322] p-3 rounded-xl border border-rose-500/20">
                      <span className="font-bold text-rose-300">{t('matches.cancelReasonLabel')}: </span>
                      {cancelReason || currentMatch.cancelReason || t('matches.defaultCancelReason')}
                    </div>
                  </div>
                )}

                {currentMatch.status === 'cancelled' ? (
                  <div className="rounded-2xl bg-[#101221] border border-slate-800 p-6 text-center text-xs text-slate-400">
                    {t('matches.matchWasCancelledRefunded')}
                  </div>
                ) : isLoadingPlayers ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    {t('common.loading')}
                  </div>
                ) : playersData.length > 0 ? (
                  currentMatch.teamMode === 'solo' ? (
                    /* Solo Mode: [position, name, kills, reward] */
                    <div className="rounded-2xl bg-[#0c0e1a] border border-slate-800 overflow-hidden shadow-md">
                      <div className="overflow-x-auto">
                        <div className="min-w-[340px]">
                          {/* Header */}
                          <div className="flex items-center text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 bg-[#16192e] py-2.5 divide-x divide-slate-800/80 border-b border-slate-800">
                            <div className="w-16 sm:w-20 shrink-0 text-center">{t('matches.colPosition')}</div>
                            <div className="flex-1 min-w-0 px-3">{t('matches.colPlayer')}</div>
                            <div className="w-16 sm:w-20 shrink-0 text-center">{t('matches.colKills')}</div>
                            <div className="w-20 sm:w-24 shrink-0 text-center">{t('matches.colReward')}</div>
                          </div>

                          {/* Rows */}
                          <div className="divide-y divide-slate-800/80">
                            {(() => {
                              const sortedSolo = [...playersData].sort((a, b) => {
                                const posA = a.matchPosition ?? 9999;
                                const posB = b.matchPosition ?? 9999;
                                return posA - posB;
                              });

                              return sortedSolo.map((p, idx) => {
                                const isMyRow = isCurrentPlayerName(p.name);
                                return (
                                  <div
                                    key={idx}
                                    data-testid={isMyRow ? 'my-team-reward-row' : undefined}
                                    className={`flex items-stretch text-xs divide-x transition-colors ${
                                      isMyRow
                                        ? 'divide-violet-500/30 bg-violet-950/40 border-l-4 border-l-violet-500 ring-1 ring-inset ring-violet-500/40 shadow-sm'
                                        : 'divide-slate-800/80'
                                    }`}
                                  >
                                    <div
                                      className={`w-16 sm:w-20 shrink-0 flex items-center justify-center p-3 font-black text-center ${
                                        isMyRow
                                          ? 'bg-violet-950/60 text-amber-300'
                                          : 'bg-[#111322] text-amber-400'
                                      }`}
                                    >
                                      {p.matchPosition != null ? `#${p.matchPosition}` : '-'}
                                    </div>
                                    <div
                                      className={`flex-1 min-w-0 p-3 font-bold truncate flex items-center gap-2 ${
                                        isMyRow
                                          ? 'bg-violet-950/30 text-violet-200'
                                          : 'bg-[#0e101c] text-slate-100'
                                      }`}
                                      title={p.name}
                                    >
                                      <span className="truncate">{p.name}</span>
                                      {isMyRow && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/40 shrink-0">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      className={`w-16 sm:w-20 shrink-0 flex items-center justify-center p-3 font-semibold text-center ${
                                        isMyRow
                                          ? 'bg-violet-950/50 text-slate-200'
                                          : 'bg-[#111322] text-slate-300'
                                      }`}
                                    >
                                      {p.kills ?? 0}
                                    </div>
                                    <div
                                      className={`w-20 sm:w-24 shrink-0 flex items-center justify-center p-3 font-black text-center ${
                                        isMyRow
                                          ? 'bg-violet-950/40 text-emerald-300'
                                          : 'bg-[#0e101c] text-emerald-400'
                                      }`}
                                    >
                                      ₹{p.payout ?? '0'}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Duo and Squad Mode: | Position | Team number | teamname | 1. Name | kills | reward | */
                    <div className="rounded-2xl bg-[#0c0e1a] border border-slate-800 overflow-hidden shadow-md">
                      <div className="overflow-x-auto">
                        <div className="min-w-[460px]">
                          {/* Header */}
                          <div className="flex items-center text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 bg-[#16192e] py-2.5 divide-x divide-slate-800/80 border-b border-slate-800">
                            <div className="w-14 sm:w-16 shrink-0 text-center">{t('matches.colPosition')}</div>
                            <div className="w-28 sm:w-36 shrink-0 text-center">{t('matches.colTeamNum')}</div>
                            <div className="flex-1 min-w-[150px] px-3">{t('matches.colPlayersKills')}</div>
                            <div className="w-16 sm:w-20 shrink-0 text-center">{t('matches.colReward')}</div>
                          </div>

                          {/* Rows */}
                          <div className="divide-y divide-slate-800/80">
                            {(() => {
                              const teamMap = new Map<number, MatchPlayerItem[]>();
                              playersData.forEach((p) => {
                                const list = teamMap.get(p.team) || [];
                                list.push(p);
                                teamMap.set(p.team, list);
                              });

                              const sortedTeams = Array.from(teamMap.entries()).sort(([, a], [, b]) => {
                                const posA = a[0]?.matchPosition ?? 9999;
                                const posB = b[0]?.matchPosition ?? 9999;
                                return posA - posB;
                              });

                              return sortedTeams.map(([teamNum, members]) => {
                                const teamName = members[0]?.teamName || `Team ${teamNum}`;
                                const matchPosition = members.find((m) => m.matchPosition != null)?.matchPosition;
                                const teamReward = members[0]?.teamPayout ?? '0';
                                const isMyTeam = isMyTeamCheck(teamNum, members);

                                return (
                                  <div
                                    key={teamNum}
                                    data-testid={isMyTeam ? 'my-team-reward-row' : undefined}
                                    className={`flex items-stretch text-xs divide-x transition-colors ${
                                      isMyTeam
                                        ? 'divide-violet-500/30 bg-violet-950/40 border-l-4 border-l-violet-500 ring-1 ring-inset ring-violet-500/40 shadow-sm'
                                        : 'divide-slate-800/80'
                                    }`}
                                  >
                                    {/* Position */}
                                    <div
                                      className={`w-14 sm:w-16 shrink-0 flex items-center justify-center p-2.5 sm:p-3 font-black text-sm text-center ${
                                        isMyTeam
                                          ? 'bg-violet-950/60 text-amber-300'
                                          : 'bg-[#111322] text-amber-400'
                                      }`}
                                    >
                                      {matchPosition != null ? `#${matchPosition}` : '-'}
                                    </div>

                                    {/* Team & Team Name */}
                                    <div
                                      className={`w-28 sm:w-36 shrink-0 flex flex-col items-center justify-center p-2.5 sm:p-3 text-center min-w-0 ${
                                        isMyTeam
                                          ? 'bg-violet-950/50 text-violet-300'
                                          : 'bg-[#0d0f1e] text-slate-200'
                                      }`}
                                    >
                                      <span className="font-black text-xs text-center whitespace-nowrap">
                                        Team: {teamNum}
                                      </span>
                                      <span
                                        className={`font-bold text-xs truncate max-w-full mt-0.5 ${
                                          isMyTeam ? 'text-amber-300' : 'text-amber-400'
                                        }`}
                                        title={teamName}
                                      >
                                        {teamName}
                                      </span>
                                      {isMyTeam && (
                                        <span className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase bg-violet-500/20 text-violet-300 border border-violet-500/40 whitespace-nowrap">
                                          My Team
                                        </span>
                                      )}
                                    </div>

                                    {/* Players & Kills */}
                                    <div
                                      className={`flex-1 min-w-[150px] p-2.5 sm:p-3 space-y-1.5 ${
                                        isMyTeam ? 'bg-violet-950/30' : 'bg-[#0e101c]'
                                      }`}
                                    >
                                      {members.map((m, mIdx) => {
                                        const isCurrent = isCurrentPlayerName(m.name);
                                        return (
                                          <div key={mIdx} className="flex items-center justify-between gap-1 text-xs">
                                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                                              <span
                                                className={`font-bold min-w-[14px] ${
                                                  isMyTeam ? 'text-violet-400' : 'text-slate-400'
                                                }`}
                                              >
                                                {mIdx + 1}.
                                              </span>
                                              <span
                                                className={`font-bold truncate ${
                                                  isCurrent ? 'text-violet-200' : 'text-slate-100'
                                                }`}
                                                title={m.name}
                                              >
                                                {m.name}
                                              </span>
                                              {isCurrent && (
                                                <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-1 py-0.5 rounded border border-violet-500/20 shrink-0">
                                                  (You)
                                                </span>
                                              )}
                                            </div>
                                            <span
                                              className={`text-[11px] font-semibold shrink-0 px-1.5 py-0.5 rounded border ${
                                                isMyTeam
                                                  ? 'bg-violet-900/40 text-violet-200 border-violet-500/40'
                                                  : 'bg-slate-800/80 text-slate-300 border-slate-700/60'
                                              }`}
                                            >
                                              {m.kills ?? 0} {t('matches.killsLabel')}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Team Total Reward */}
                                    <div
                                      className={`w-16 sm:w-20 shrink-0 flex items-center justify-center p-2.5 sm:p-3 font-black text-xs sm:text-sm text-center ${
                                        isMyTeam
                                          ? 'bg-violet-950/50 text-emerald-300'
                                          : 'bg-[#111322] text-emerald-400'
                                      }`}
                                    >
                                      ₹{teamReward}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl bg-[#101221] border border-slate-800 p-6 text-center text-xs text-slate-400">
                    {currentMatch.status === 'cancelled'
                      ? t('matches.matchWasCancelledRefunded')
                      : t('matches.rewardsPending')}
                  </div>
                )}
              </div>
            )}
          </div>
    </>
  );

  const bottomBar = (
    <div
      className={
        isPage
          ? 'fixed bottom-16 inset-x-0 max-w-md mx-auto w-full bg-[#0b0c16]/95 border-t border-slate-800/80 p-3.5 sm:p-4 flex justify-center shrink-0 z-30 backdrop-blur-md shadow-2xl'
          : 'w-full bg-[#0b0c16]/95 border-t border-slate-800/80 p-3.5 sm:p-4 flex justify-center shrink-0 z-30 backdrop-blur-md'
      }
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md">
        {currentMatch.status === 'completed' ? (
          <button
            type="button"
            data-testid="match-completed-btn"
            disabled
            className="w-full rounded-2xl bg-[#e0f2fe] border border-[#bae6fd] py-3.5 text-sm font-black text-[#0284c7] cursor-not-allowed"
          >
            {t('matches.completed')}
          </button>
        ) : currentMatch.status === 'cancelled' ? (
          <button
            type="button"
            data-testid="match-cancelled-btn"
            disabled
            className="w-full rounded-2xl bg-rose-500/10 border border-rose-500/30 py-3.5 text-sm font-black text-rose-400 cursor-not-allowed"
          >
            {t('matches.cancelled')}
          </button>
        ) : isJoined ? (
          <button
            type="button"
            data-testid="joined-status-btn"
            disabled
            className="w-full rounded-2xl bg-emerald-500/20 border border-emerald-500/30 py-3.5 text-sm font-black text-emerald-400 cursor-default"
          >
            {t('matches.alreadyJoinedBtn')}
          </button>
        ) : isClosed || !canJoinStatus ? (
          <button
            type="button"
            data-testid="match-closed-btn"
            disabled
            className="w-full rounded-2xl bg-slate-800/90 border border-slate-700/60 py-3.5 text-sm font-black text-slate-400 cursor-not-allowed"
          >
            {t('matches.closed')}
          </button>
        ) : isFull ? (
          <button
            type="button"
            data-testid="match-full-btn"
            disabled
            className="w-full rounded-2xl bg-slate-800 py-3.5 text-sm font-black text-slate-400 cursor-not-allowed"
          >
            {t('matches.matchFullBtn')}
          </button>
        ) : (
          <button
            type="button"
            data-testid="join-match-btn"
            onClick={handleOpenJoinFlow}
            className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-98 transition flex items-center justify-center gap-2"
          >
            <span className="flex items-center font-black">
              <span className="text-base mr-0.5">₹</span>
              <span>{entryFee}</span>
            </span>
            <span className="opacity-40 font-normal">|</span>
            <span className="uppercase">
              {isSolo
                ? t('matches.joinMatch')
                : t('matches.formTeamBtn', {
                    mode: currentMatch.teamMode.toUpperCase(),
                  })}
            </span>
          </button>
        )}
      </div>
    </div>
  );

  const subDialogs = (
    <>
      {/* Solo Join Dialog */}
      {soloDialogOpen && (
        <SoloJoinDialog
          match={currentMatch}
          isOpen={soloDialogOpen}
          onClose={() => {
            setSoloDialogOpen(false);
            handleRefresh();
          }}
          onSuccess={() => {
            handleRefresh();
          }}
        />
      )}

      {/* Team Form Modal */}
      {teamFormOpen && (
        <TeamFormModal
          match={currentMatch}
          isOpen={teamFormOpen}
          onClose={() => {
            setTeamFormOpen(false);
            handleRefresh();
          }}
          onSuccess={() => {
            handleRefresh();
          }}
        />
      )}

      {/* Team Manage Modal */}
      {teamManageMode && (
        <TeamManageModal
          matchId={currentMatch.id}
          isOpen={!!teamManageMode}
          mode={teamManageMode}
          initialTeammates={myTeamMembers}
          onClose={() => {
            setTeamManageMode(null);
            handleRefresh();
          }}
          onSuccess={() => {
            setCurrentMatch((prev) => ({
              ...prev,
              hasReplacedTeammate: true,
              canReplaceTeammate: false,
            }));
            setTeamReplaceCount(1);
            handleRefresh();
          }}
        />
      )}
    </>
  );

  if (isPage) {
    return (
      <div
        data-testid="match-detail-page"
        className="-mx-4 -mt-4 w-[calc(100%+2rem)] min-h-[calc(100vh-8rem)] bg-[#0b0c16] text-slate-100 flex flex-col relative pb-24 shadow-2xl sm:border-x sm:border-slate-800/60"
      >
        <div data-testid="match-detail-modal" className="w-full max-w-md mx-auto flex flex-col flex-1">
          {pageInnerContent}
        </div>
        {bottomBar}
        {subDialogs}
      </div>
    );
  }

  const modalContent = (
    <>
      <div
        data-testid="match-detail-modal-overlay"
        className="fixed inset-x-0 top-16 bottom-16 z-30 m-0 p-0 bg-[#090D16] flex flex-col items-center justify-between"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Scrollable Content Container */}
        <div
          ref={overlayRef}
          className="w-full flex-1 overflow-y-auto flex justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div
            data-testid="match-detail-modal"
            className="w-full max-w-md bg-[#0b0c16] text-slate-100 flex flex-col relative pb-8 shadow-2xl min-h-full sm:border-x sm:border-slate-800/60"
            onClick={(e) => e.stopPropagation()}
          >
            {pageInnerContent}
          </div>
        </div>

        {bottomBar}
      </div>

      {subDialogs}
    </>
  );

  return modalRoot ? createPortal(modalContent, modalRoot) : modalContent;
};
