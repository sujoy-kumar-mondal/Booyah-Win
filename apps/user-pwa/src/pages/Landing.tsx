import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  HelpCircle,
} from 'lucide-react';
import { fetchMatches, type MatchUserDto } from '../api/matches.js';
import { formatIndianRupees, formatISTDateTime, formatGameMode } from '../utils/formatters.js';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchUserDto[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetchMatches()
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setMatches(data.slice(0, 3));
        }
      })
      .catch(() => {
        // Fallback to static highlights
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6 pb-12" data-testid="landing-page">
      {/* ─── Hero Section ────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/60 via-slate-900 to-slate-950 p-6 text-center shadow-2xl">
        {/* Glow ambient circle */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 h-36 w-72 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

        {/* Top badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          <span>India’s #1 Free Fire Esports Platform</span>
        </div>

        {/* Main headline */}
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-100 sm:text-4xl leading-tight">
          Play Free Fire. <br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
            Win Real Cash.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-3 text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
          Compete in daily Battle Royale & Clash Squad matches. Entry fees starting at just ₹10 with instant UPI payouts directly to PhonePe & GPay.
        </p>

        {/* Action CTAs */}
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            type="button"
            data-testid="landing-register-btn"
            onClick={() => navigate('/register')}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 px-6 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-400 hover:to-teal-300 active:scale-[0.98]"
          >
            <span>Create Account & Play</span>
            <ArrowRight className="h-4 w-4 stroke-[3]" />
          </button>
          <button
            type="button"
            data-testid="landing-login-btn"
            onClick={() => navigate('/login')}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 py-3 px-6 text-sm font-bold text-slate-200 transition-all hover:bg-slate-800 hover:text-white active:scale-[0.98]"
          >
            <span>Login with OTP</span>
          </button>
        </div>

        {/* Quick Social Proof Badges */}
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-4 text-center">
          <div>
            <p className="text-base font-black text-emerald-400">100%</p>
            <p className="text-[10px] font-semibold text-slate-400">Fair Play</p>
          </div>
          <div>
            <p className="text-base font-black text-amber-400">₹10 Min</p>
            <p className="text-[10px] font-semibold text-slate-400">Low Entry</p>
          </div>
          <div>
            <p className="text-base font-black text-teal-400">Instant</p>
            <p className="text-[10px] font-semibold text-slate-400">UPI Payout</p>
          </div>
        </div>
      </section>

      {/* ─── Live Tournament Highlights ─────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Live Custom Rooms
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/matches')}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
          >
            <span>View All</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {matches.length > 0 ? (
          <div className="space-y-2.5">
            {matches.map((match) => {
              const firstPrize =
                match.prizes?.positions?.['1'] || match.prizes?.positions?.['1st'] || '0.00';
              return (
                <div
                  key={match.id}
                  onClick={() => navigate('/register')}
                  data-testid={`landing-match-card-${match.id}`}
                  className="group cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/90 p-4 transition-all hover:border-emerald-500/40 hover:bg-slate-900 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                          {formatGameMode(match.gameMode)}
                        </span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                          {match.teamMode}
                        </span>
                      </div>
                      <h3 className="mt-2 text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                        {(match as any).map || 'Bermuda'}
                      </h3>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        <span>{formatISTDateTime(match.startTime)}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-semibold text-slate-400">Entry Fee</p>
                      <p className="font-mono text-sm font-bold text-slate-100">
                        {formatIndianRupees(match.entryFee)}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-amber-400">
                        Prize: {formatIndianRupees(firstPrize)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center space-y-2">
            <Trophy className="h-8 w-8 text-amber-400 mx-auto" />
            <p className="text-xs font-bold text-slate-200">Daily Free Fire Rooms Active</p>
            <p className="text-[11px] text-slate-400">
              Solo, Duo, Squad Battle Royale & Clash Squad matches hosting round the clock.
            </p>
            <button
              type="button"
              onClick={() => navigate('/matches')}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300"
            >
              <span>Explore Matches Lobby</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* ─── Why Choose Booyah Win ──────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          Why Players Choose Booyah Win
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Instant UPI Cashout */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-1.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-100">Instant UPI Payouts</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Withdraw straight to your UPI ID without waiting days.
            </p>
          </div>

          {/* Strict Anti-Cheat */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-1.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-100">100% Anti-Cheat</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Mobile only, zero emulators or hack tolerance.
            </p>
          </div>

          {/* Weekly Leaderboard */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-1.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Trophy className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-100">Weekly Top 50</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Climb the ranks and win bonus weekly cash prizes.
            </p>
          </div>

          {/* Refer & Earn */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-1.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Gift className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-100">Refer & Earn ₹5</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Invite friends and get ₹5 cashback on their first match.
            </p>
          </div>
        </div>
      </section>

      {/* ─── How It Works (3 Steps) ─────────────────────────────── */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          How It Works in 3 Simple Steps
        </h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-black text-emerald-400 border border-emerald-500/30">
              1
            </span>
            <div>
              <h3 className="text-xs font-bold text-slate-100">Register with Your Free Fire UID</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Sign up in 30 seconds with email OTP and link your in-game Free Fire ID.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-black text-emerald-400 border border-emerald-500/30">
              2
            </span>
            <div>
              <h3 className="text-xs font-bold text-slate-100">Pick a Match & Get Room Password</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Choose Solo, Duo, or Squad. Room ID & password unlock 15 minutes before match start.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-black text-emerald-400 border border-emerald-500/30">
              3
            </span>
            <div>
              <h3 className="text-xs font-bold text-slate-100">Claim Booyah & Cash Out</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Prize money is credited automatically to your winning wallet. Withdraw anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Frequently Asked Questions ─────────────────────────── */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Frequently Asked Questions
          </h2>
        </div>
        <div className="space-y-2.5 text-xs text-slate-400 divide-y divide-slate-800/60">
          <div className="pt-2 first:pt-0">
            <p className="font-bold text-slate-200">How do I get the custom room credentials?</p>
            <p className="mt-1 text-[11px] leading-relaxed">
              Once you join a match, the Room ID and Password will appear in your match details screen 15 minutes before the match start time.
            </p>
          </div>
          <div className="pt-2">
            <p className="font-bold text-slate-200">How fast are withdrawals processed?</p>
            <p className="mt-1 text-[11px] leading-relaxed">
              Withdrawals to your verified UPI ID are processed directly and typically credit within minutes of staff approval.
            </p>
          </div>
          <div className="pt-2">
            <p className="font-bold text-slate-200">Can I play on PC or Emulator?</p>
            <p className="mt-1 text-[11px] leading-relaxed">
              No. Booyah Win strictly enforces mobile-only matchmaking to guarantee 100% competitive fairness for all participants.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Bottom CTA Banner ─────────────────────────────────── */}
      <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 p-5 text-center space-y-3">
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
          <span>Register Now & Get ₹5 Bonus</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    </div>
  );
};
