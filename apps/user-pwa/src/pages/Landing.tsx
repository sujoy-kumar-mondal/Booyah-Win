import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Swords,
  Trophy,
  ShieldCheck,
  Zap,
  Gift,
  ArrowRight,
  Clock,
  ChevronRight,
  Sparkles,
  Globe,
  FileText,
  Shield,
  X,
  User,
  Users,
  MapPin,
  Headphones,
} from 'lucide-react';
import { fetchMatches, type MatchUserDto } from '../api/matches.js';
import { fetchImportantUpdates } from '../api/updates.js';
import type { ImportantUpdateDto } from '@booyah/shared';
import {
  formatIndianRupees,
  formatCompactRupees,
  formatRelativeTime,
  formatMatchTimeBadge,
  formatGameMode,
  calculateMatchPrizePool,
  formatMatchId,
} from '../utils/formatters.js';
import { DownloadAppBanner } from '../components/common/DownloadAppBanner.js';
import { BannerCarousel } from '../components/common/BannerCarousel.js';
import { useTranslation } from '../i18n/LanguageContext.js';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage, formatEnum } = useTranslation();
  const [matches, setMatches] = useState<MatchUserDto[]>([]);
  const [hotUpdate, setHotUpdate] = useState<ImportantUpdateDto | null>(null);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetchMatches('upcoming')
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setMatches(data.slice(0, 5));
        }
      })
      .catch(() => {
        // Fallback to empty matches
      });

    fetchImportantUpdates()
      .then((updates) => {
        if (isMounted && Array.isArray(updates) && updates.length > 0) {
          setHotUpdate(updates[0]);
        } else if (isMounted) {
          setHotUpdate(null);
        }
      })
      .catch(() => {
        if (isMounted) setHotUpdate(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-5 pb-12" data-testid="landing-page">
      <DownloadAppBanner />

      {/* ─────────────────────────────────────────────────────────────
          1. IMPORTANT NOTICE TICKER ("HOT" BAR)
          ───────────────────────────────────────────────────────────── */}
      {hotUpdate && (
        <div
          onClick={() => navigate('/important-updates')}
          data-testid="landing-hot-ticker"
          className="flex items-center justify-between rounded-full border border-slate-800/80 bg-[#121320] px-3.5 py-2 cursor-pointer shadow-md hover:border-slate-700 transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase text-white shadow-sm shrink-0">
              HOT
            </span>
            <span className="text-xs shrink-0">🔥🚨</span>
            <p className="text-xs font-semibold text-slate-200 truncate">
              {hotUpdate.title}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 ml-1.5" />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION
          ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-[#131527] via-[#101221] to-[#0c0e1a] px-4 py-3.5 sm:px-5 sm:py-4 text-center shadow-2xl">
        {/* Glow ambient background circles */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 h-32 w-72 rounded-full bg-violet-600/15 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-0 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

        {/* Top badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-300 shadow-sm">
          <Sparkles className="h-3 w-3 text-amber-300" />
          <span>India’s #1 Free Fire Esports Platform</span>
        </div>

        {/* Main headline */}
        <h1 className="mt-2 text-xl font-black tracking-tight text-slate-100 sm:text-2xl leading-snug max-w-sm mx-auto">
          {t('landing.heroTitle')}
        </h1>

        {/* Subtitle */}
        <p className="mt-1 text-[11px] text-slate-300 leading-relaxed max-w-xs mx-auto">
          {t('landing.heroSubtitle')}
        </p>

        {/* Action CTAs */}
        <div className="mt-3 flex flex-row items-center justify-center gap-2 max-w-xs mx-auto">
          <button
            type="button"
            data-testid="landing-register-btn"
            onClick={() => navigate('/register')}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-2 px-3 text-xs font-black text-slate-950 shadow-md shadow-emerald-500/20 transition-all hover:from-emerald-400 hover:to-teal-300 active:scale-[0.98]"
          >
            <span>{t('landing.registerNow')}</span>
            <ArrowRight className="h-3.5 w-3.5 stroke-[3]" />
          </button>
          <button
            type="button"
            data-testid="landing-login-btn"
            onClick={() => navigate('/login')}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 py-2 px-3 text-xs font-bold text-slate-200 transition-all hover:bg-slate-800 hover:text-white active:scale-[0.98]"
          >
            <span>{t('landing.loginWithOtp')}</span>
          </button>
        </div>

        {/* Quick Social Proof Badges */}
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-2.5 text-center">
          <div>
            <p className="text-xs sm:text-sm font-black text-emerald-400">100%</p>
            <p className="text-[9.5px] font-semibold text-slate-400">{t('landing.fairPlayTitle')}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-black text-amber-400">Rs5 Min</p>
            <p className="text-[9.5px] font-semibold text-slate-400">{t('matches.entryFee')}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-black text-teal-400">Instant</p>
            <p className="text-[9.5px] font-semibold text-slate-400">UPI Payout</p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. AUTO-SLIDING PROMOTIONAL CAROUSEL BANNER
          ───────────────────────────────────────────────────────────── */}
      <BannerCarousel />

      {/* ─────────────────────────────────────────────────────────────
          4. MATCHES SECTION (HOME-STYLE)
          ───────────────────────────────────────────────────────────── */}
      <section className="space-y-3.5">
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
            data-testid="landing-view-all-matches"
            className="flex items-center gap-1 rounded-full border border-slate-800 bg-[#121320] px-3.5 py-1.5 text-xs font-bold text-slate-200 hover:border-slate-700 hover:text-white transition active:scale-95"
          >
            <span>{language === 'bn' ? 'সব দেখুন' : 'View all'}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {matches.length > 0 ? (
          <div className="space-y-3.5">
            {matches.map((match) => {
              const matchTime = (match as any).startTime || (match as any).scheduledAt;
              const totalPrize = calculateMatchPrizePool(match as any);
              const rawKillPrice = (match.prizes as any)?.perKill || match.prizes?.killPrice || '0';
              const compactPerKill = formatCompactRupees(rawKillPrice);
              const compactEntry = formatCompactRupees(match.entryFee);
              const matchStatus = (match as any).status;
              const relativeTime = formatRelativeTime(matchTime, matchStatus);
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
                  data-testid={`landing-match-card-${match.id}`}
                  onClick={() => navigate('/register')}
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
                          {formatMatchId(match.id)}
                        </span>
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
                          <span>{(match as any).mapName || (match as any).map || 'Bermuda'}</span>
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
                          ₹{totalPrize}
                        </p>
                      </div>

                      {/* Per kill */}
                      {Number(rawKillPrice) > 0 && (
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block">
                            Per kill
                          </span>
                          <p className="text-base font-black text-slate-100 leading-tight">
                            ₹{compactPerKill}
                          </p>
                        </div>
                      )}

                      {/* Entry */}
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 block">
                          Entry
                        </span>
                        <p className="text-base font-black text-slate-100 leading-tight">
                          ₹{compactEntry}
                        </p>
                        <span className="sr-only">{formatIndianRupees(match.entryFee)}</span>
                      </div>
                    </div>

                    {/* Join Action Button */}
                    <div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/register');
                        }}
                        className="rounded-xl bg-violet-600 px-6 py-2 text-sm font-black text-white shadow-md shadow-violet-600/30 transition-all hover:bg-violet-500 active:scale-95"
                      >
                        {t('matches.join') || 'Join'}
                      </button>
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
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. WHY CHOOSE BOOYAH WIN
          ───────────────────────────────────────────────────────────── */}
      <section className="space-y-3 pt-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          {t('landing.whyChooseUs')}
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Instant UPI Cashout */}
          <div className="rounded-2xl border border-slate-800 bg-[#121320] p-4 space-y-1.5 shadow-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-100">{t('landing.instantWithdrawalsTitle')}</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {t('landing.instantWithdrawalsDesc')}
            </p>
          </div>

          {/* Strict Anti-Cheat */}
          <div className="rounded-2xl border border-slate-800 bg-[#121320] p-4 space-y-1.5 shadow-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-100">{t('landing.fairPlayTitle')}</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {t('landing.fairPlayDesc')}
            </p>
          </div>

          {/* Weekly Leaderboard */}
          <div className="rounded-2xl border border-slate-800 bg-[#121320] p-4 space-y-1.5 shadow-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Trophy className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-100">{t('leaderboard.weeklyTab')}</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {t('leaderboard.subtitle')}
            </p>
          </div>

          {/* Refer & Earn */}
          <div className="rounded-2xl border border-slate-800 bg-[#121320] p-4 space-y-1.5 shadow-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Gift className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-100">{t('referral.title')}</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {t('referral.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. HOW IT WORKS (3 STEPS)
          ───────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#121320] p-5 space-y-4 shadow-lg">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          {t('landing.howItWorksTitle')}
        </h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-black text-emerald-400 border border-emerald-500/30">
              1
            </span>
            <div>
              <h3 className="text-xs font-bold text-slate-100">{t('landing.step1Title')}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t('landing.step1Desc')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-black text-emerald-400 border border-emerald-500/30">
              2
            </span>
            <div>
              <h3 className="text-xs font-bold text-slate-100">{t('landing.step2Title')}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t('landing.step2Desc')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-black text-emerald-400 border border-emerald-500/30">
              3
            </span>
            <div>
              <h3 className="text-xs font-bold text-slate-100">{t('landing.step3Title')}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t('landing.step3Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. BOTTOM CTA BANNER
          ───────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-[#121320] to-[#0c0e1a] p-5 text-center space-y-3 shadow-lg">
        <h2 className="text-base font-black text-slate-100">
          Ready to Claim Your Next <span className="text-emerald-400">Booyah?</span>
        </h2>
        <p className="text-xs text-slate-300 max-w-xs mx-auto">
          Join thousands of Free Fire players winning real money daily.
        </p>
        <button
          type="button"
          onClick={() => navigate('/register')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-xs font-black text-slate-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
        >
          <span>{t('landing.registerNow')}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. FLOATING QUICK ACTION (CUSTOMER SUPPORT)
          ───────────────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed bottom-20 left-6 right-0 z-40 mx-auto w-full max-w-md px-4 flex justify-start">
        <button
          type="button"
          onClick={() => navigate('/support')}
          aria-label="Help & Support"
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 active:scale-90 transition-all ring-4 ring-slate-950/40"
        >
          <Headphones className="h-6 w-6 stroke-[2.5]" />
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          9. LANDING PAGE FOOTER WITH LANGUAGE SWITCHER & POLICIES
          ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/80 pt-6 pb-2 text-center space-y-4" data-testid="landing-footer">
        {/* Brand Logo in Footer */}
        <div className="flex justify-center mb-2">
          <img
            src="/assets/logo_full.png"
            alt="Booyah Win"
            className="h-10 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
          />
        </div>
        {/* Language Switcher */}
        <div className="inline-flex items-center justify-center gap-2 p-1 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm" data-testid="landing-language-selector">
          <Globe className="w-4 h-4 text-emerald-400 ml-2" />
          <span className="text-xs text-slate-400 pr-1">{t('common.language')}:</span>
          <button
            type="button"
            data-testid="landing-lang-en"
            onClick={() => setLanguage('en')}
            className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
              language === 'en'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            English
          </button>
          <button
            type="button"
            data-testid="landing-lang-bn"
            onClick={() => setLanguage('bn')}
            className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
              language === 'bn'
                ? 'bg-emerald-500 text-slate-950 shadow-sm font-bengali'
                : 'text-slate-400 hover:text-slate-200 font-bengali'
            }`}
          >
            বাংলা
          </button>
        </div>

        {/* Legal & Policy Links */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
          <button
            type="button"
            data-testid="landing-terms-btn"
            onClick={() => setTermsModalOpen(true)}
            className="hover:text-emerald-400 transition underline underline-offset-2"
          >
            {t('landing.footerTerms')}
          </button>
          <span>•</span>
          <button
            type="button"
            data-testid="landing-privacy-btn"
            onClick={() => setPrivacyModalOpen(true)}
            className="hover:text-emerald-400 transition underline underline-offset-2"
          >
            {t('landing.footerPrivacy')}
          </button>
          <span>•</span>
          <Link
            to="/support"
            className="hover:text-emerald-400 transition underline underline-offset-2"
          >
            {t('landing.footerSupport')}
          </Link>
        </div>

        <p className="text-[11px] text-slate-500">
          {t('landing.footerCopyright')}
        </p>
      </footer>

      {/* Terms of Service Modal */}
      {termsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          data-testid="terms-modal"
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <FileText className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-100">{t('terms.modalTitle')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setTermsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {t('terms.modalPlaceholder')}
            </p>
            <div className="mt-6 text-right">
              <button
                type="button"
                onClick={() => setTermsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {privacyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          data-testid="privacy-modal"
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <Shield className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-100">{t('privacy.modalTitle')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPrivacyModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {t('privacy.modalPlaceholder')}
            </p>
            <div className="mt-6 text-right">
              <button
                type="button"
                onClick={() => setPrivacyModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
