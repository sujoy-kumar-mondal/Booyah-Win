import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useTranslation } from '../i18n/LanguageContext.js';
import {
  formatIndianRupees,
  formatCompactRupees,
  getUserInitials,
  formatRelativeTime,
  formatMatchTimeBadge,
  formatGameMode,
} from '../utils/formatters.js';
import { fetchMatches, type MatchUserDto } from '../api/matches.js';
import { BannerCarousel } from '../components/common/BannerCarousel.js';
import { ImportantNoticeModal } from '../components/common/ImportantNoticeModal.js';
import {
  ChevronRight,
  Headphones,
  Bell,
  Users,
  User,
  Clock,
  MapPin,
  Trophy,
  Swords,
  CheckCircle2,
} from 'lucide-react';

export const Home: React.FC = () => {
  const { user, wallets } = useAuth();
  const { t, language, formatEnum } = useTranslation();
  const navigate = useNavigate();
  const [ongoingMatches, setOngoingMatches] = useState<MatchUserDto[]>([]);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetchMatches()
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setOngoingMatches(data);
        }
      })
      .catch(() => {
        // Defaults to match lobby CTA card on error
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute username: use name or email prefix or ffName
  const username =
    user?.name || user?.email?.split('@')[0] || user?.ffName || 'Player';

  // Compute avatar initials: e.g. "sujoy kumar mondal" -> "SKM"
  const avatarInitials = getUserInitials(user?.name);

  // Formatted compact balance for the pill (e.g. "5" or "145")
  const compactBalance = formatCompactRupees(wallets?.total || '0');

  return (
    <div className="space-y-4 sm:space-y-5" data-testid="home-screen">
      <ImportantNoticeModal
        isOpen={isNoticeOpen}
        onClose={() => setIsNoticeOpen(false)}
      />

      {/* ─────────────────────────────────────────────────────────────
          1. TOP BAR / PLAYER HEADER
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between py-1">
        {/* Left: Avatar + Username + Subtitle */}
        <div
          onClick={() => navigate('/profile')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          {/* Avatar with Esports ring */}
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-800 text-white font-extrabold shadow-md shadow-violet-500/20 ring-2 ring-violet-500/40 transition-transform group-hover:scale-105 active:scale-95 overflow-hidden">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || 'User Avatar'}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-black tracking-wider text-slate-100">
                {avatarInitials}
              </span>
            )}
          </div>

          {/* Username & App Subtitle */}
          <div>
            <h2 className="text-base font-black tracking-wide text-slate-100 group-hover:text-emerald-400 transition-colors leading-tight">
              {username}
            </h2>
            <p className="text-xs font-semibold text-indigo-400">Booyah Win</p>
          </div>
        </div>

        {/* Right: Wallet pill + Support Headphone + Bell */}
        <div className="flex items-center gap-2">
          {/* Wallet pill button */}
          <div
            onClick={() => navigate('/wallet?tab=add')}
            className="flex items-center gap-2 rounded-full border border-slate-800 bg-[#121320] pl-3 pr-1 py-1 text-xs font-bold text-slate-100 shadow-sm cursor-pointer hover:border-slate-700 transition active:scale-95"
          >
            <span className="font-extrabold text-sm text-slate-100">{compactBalance}</span>
            <span data-testid="total-balance" className="sr-only">
              {formatIndianRupees(wallets?.total || '0.00')}
            </span>
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white font-bold text-xs shadow-sm">
              +
            </div>
          </div>

          {/* Customer Support Headphones */}
          <button
            type="button"
            onClick={() => navigate('/support')}
            aria-label="Customer Support"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 bg-[#121320] text-slate-300 hover:text-white hover:border-slate-700 transition active:scale-95"
          >
            <Headphones className="h-4 w-4" />
          </button>

          {/* Notification Bell */}
          <button
            type="button"
            onClick={() => setIsNoticeOpen(true)}
            aria-label="Important Updates"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 bg-[#121320] text-slate-300 hover:text-white hover:border-slate-700 transition active:scale-95"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[#121320]" />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. IMPORTANT NOTICE TICKER ("HOT" BAR)
          ───────────────────────────────────────────────────────────── */}
      <div
        onClick={() => setIsNoticeOpen(true)}
        className="flex items-center justify-between rounded-full border border-slate-800/80 bg-[#121320] px-3.5 py-2 cursor-pointer shadow-md hover:border-slate-700 transition active:scale-[0.99]"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase text-white shadow-sm shrink-0">
            HOT
          </span>
          <span className="text-xs shrink-0">🔥🚨</span>
          <p className="text-xs font-semibold text-slate-200 truncate">
            {language === 'bn'
              ? 'স্কোয়াড ও CS ম্যাচে স্নাইপার নিষিদ্ধ সম্পর্কিত নোটিশ...'
              : 'Notification About Snipers Ban in Squad & CS...'}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 ml-1.5" />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. AUTO-SLIDING PROMOTIONAL CAROUSEL BANNER
          ───────────────────────────────────────────────────────────── */}
      <BannerCarousel />

      {/* ─────────────────────────────────────────────────────────────
          4. MATCHES SECTION HEADER
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-6 rounded-full bg-amber-400" />
          <div>
            <h3 className="text-base font-black tracking-wide text-slate-100 leading-tight">
              {language === 'bn' ? 'ম্যাচসমূহ' : 'Matches'}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              {language === 'bn' ? 'আসন্ন টুর্নামেন্ট' : 'Upcoming tournaments'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/matches')}
          data-testid="home-view-all-matches"
          className="flex items-center gap-1 rounded-full border border-slate-800 bg-[#121320] px-3.5 py-1.5 text-xs font-bold text-slate-200 hover:border-slate-700 hover:text-white transition active:scale-95"
        >
          <span>{language === 'bn' ? 'সব দেখুন' : 'View all'}</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. TOURNAMENT MATCH CARDS
          ───────────────────────────────────────────────────────────── */}
      {ongoingMatches.length > 0 ? (
        <div className="space-y-3.5">
          {ongoingMatches.slice(0, 5).map((match) => {
            const matchTime = (match as any).startTime || (match as any).scheduledAt;
            const firstPrize =
              match.prizes?.positions?.['1'] || match.prizes?.positions?.['1st'] || '0.00';
            const rawKillPrice = (match.prizes as any)?.perKill || match.prizes?.killPrice || '0';
            const compactPrize = formatCompactRupees(firstPrize);
            const compactPerKill = formatCompactRupees(rawKillPrice);
            const compactEntry = formatCompactRupees(match.entryFee);
            const relativeTime = formatRelativeTime(matchTime);
            const timeBadge = formatMatchTimeBadge(matchTime);

            // Capacity calculation
            const maxPlayers = match.maxPlayers || 48;
            const seatsTaken =
              (match as any).registeredCount ?? match.seatsTaken ?? match.joinedPlayers ?? 0;
            const seatsLeft = Math.max(0, maxPlayers - seatsTaken);
            const fillPercent = Math.min(100, Math.round((seatsTaken / maxPlayers) * 100));

            // Game Mode label (e.g. BATTLE ROYALE | DUO)
            const rawGame = formatGameMode(match.gameMode);
            const rawTeam = formatEnum('teamMode', match.teamMode);

            return (
              <div
                key={match.id}
                data-testid={`home-match-card-${match.id}`}
                onClick={() => navigate('/matches')}
                className="group relative overflow-hidden rounded-2xl border border-slate-800/90 bg-[#121320] p-4 text-left shadow-lg cursor-pointer transition-all duration-200 hover:border-slate-700 hover:bg-[#141626]"
              >
                {/* Top Row: Thumbnail + Title + Countdown + ID + Badges */}
                <div className="flex items-start gap-3">
                  {/* Mode Artwork Thumbnail */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-700/60 bg-gradient-to-br from-indigo-900 via-slate-900 to-amber-950/60 flex items-center justify-center shadow-inner">
                    <div className="text-amber-400 font-black text-xs text-center leading-none">
                      <Swords className="h-6 w-6 mx-auto mb-0.5 text-amber-400 drop-shadow" />
                      <span className="text-[9px] uppercase tracking-tighter text-slate-300">
                        FF MAX
                      </span>
                    </div>
                  </div>

                  {/* Title & Metadata */}
                  <div className="min-w-0 flex-1">
                    {/* Line 1: Title & Countdown */}
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-black tracking-wide text-slate-100 group-hover:text-violet-400 transition-colors truncate uppercase">
                        <span>{rawGame}</span>
                        <span className="mx-1 text-slate-500">|</span>
                        <span>{rawTeam}</span>
                      </h4>
                      {relativeTime && (
                        <span className="shrink-0 text-xs font-black text-amber-400">
                          {relativeTime}
                        </span>
                      )}
                    </div>

                    {/* Line 2: Match ID */}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs font-bold text-slate-200">
                        #{match.id}
                      </span>
                      {match.hasJoined && (
                        <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          <span className="sr-only">Registered</span>
                        </span>
                      )}
                    </div>

                    {/* Line 3: Badges Row */}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {/* Team Mode Badge */}
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-300 border border-slate-700/50">
                        {match.teamMode === 'solo' ? (
                          <User className="h-3 w-3 text-slate-400" />
                        ) : (
                          <Users className="h-3 w-3 text-slate-400" />
                        )}
                        <span>{rawTeam}</span>
                      </span>

                      {/* Time Badge */}
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-300 border border-slate-700/50">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>{timeBadge}</span>
                      </span>

                      {/* Map Badge */}
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-300 border border-slate-700/50">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        <span>{(match as any).map || 'Bermuda'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Middle Row: Prize Pool, Per kill, Entry, Join Button */}
                <div className="mt-3.5 flex items-center justify-between border-t border-slate-800/80 pt-3">
                  <div className="flex items-center gap-5 sm:gap-6 text-left">
                    {/* Prize Pool */}
                    <div>
                      <span className="flex items-center text-[10px] font-semibold text-slate-400">
                        Prize Pool <ChevronRight className="h-2.5 w-2.5 ml-0.5" />
                      </span>
                      <p className="text-base font-black text-amber-400 leading-tight">
                        {compactPrize}
                      </p>
                    </div>

                    {/* Per kill */}
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block">
                        Per kill
                      </span>
                      <p className="text-base font-black text-slate-100 leading-tight">
                        {compactPerKill}
                      </p>
                    </div>

                    {/* Entry */}
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block">
                        Entry
                      </span>
                      <p className="text-base font-black text-slate-100 leading-tight">
                        {compactEntry}
                      </p>
                      <span className="sr-only">{formatIndianRupees(match.entryFee)}</span>
                    </div>
                  </div>

                  {/* Join Action Button */}
                  <div>
                    {match.hasJoined ? (
                      <span className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/20 px-5 py-2 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{t('matches.joined')}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/matches');
                        }}
                        className="rounded-xl bg-violet-600 px-6 py-2 text-sm font-black text-white shadow-md shadow-violet-600/30 transition-all hover:bg-violet-500 active:scale-95"
                      >
                        Join
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Capacity Progress Bar & Left count */}
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-300"
                      style={{ width: `${fillPercent}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 shrink-0">
                    {seatsTaken}/{maxPlayers} · {seatsLeft} left
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State / Custom Match Lobby CTA */
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#121320] via-slate-900 to-slate-950 p-6 text-center shadow-lg">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner">
            <Trophy className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-100">Custom Match Lobby</h4>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            {t('home.liveRoomsDesc')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/matches')}
            data-testid="enter-matches-btn"
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-600/30 transition-all hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98]"
          >
            <Swords className="h-4 w-4" />
            <span>{t('home.enterMatchLobby')}</span>
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. FLOATING QUICK ACTION (CUSTOMER SUPPORT)
          ───────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => navigate('/support')}
        aria-label="Quick Customer Support"
        className="fixed bottom-20 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 transition-all active:scale-90 ring-4 ring-slate-950/40"
      >
        <Headphones className="h-6 w-6 stroke-[2.5]" />
      </button>
    </div>
  );
};
