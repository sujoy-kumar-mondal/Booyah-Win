import React, { useState, useEffect } from 'react';
import { Gift, Copy, Check, Share2, Users, Award, Wallet, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { getRules, getReferralSummary } from '../api/rules.js';
import type { RulesResponse, ReferralSummaryResponse } from '../api/types.js';
import { formatIndianRupees } from '../utils/formatters.js';
import { ShareButton } from '../components/referral/ShareButton.js';
import { buildReferralSharePayload, getWhatsAppShareUrl } from '../utils/share.js';

export const Referral: React.FC = () => {
  const { user } = useAuth();

  const [rules, setRules] = useState<RulesResponse | null>(null);
  const [summary, setSummary] = useState<ReferralSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [rulesRes, summaryRes] = await Promise.all([
          getRules().catch(() => null),
          getReferralSummary().catch(() => null),
        ]);
        if (isMounted) {
          setRules(rulesRes);
          setSummary(summaryRes);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const referralCode = summary?.referralCode || user?.referralCode || '';
  const rewardAmount = rules ? rules.referralReward.split('.')[0] : '5';

  const handleCopy = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    if (!referralCode) return;
    const payload = buildReferralSharePayload(referralCode);
    window.open(getWhatsAppShareUrl(payload), '_blank');
  };

  return (
    <div className="space-y-4 pb-12" data-testid="referral-page">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 p-5 shadow-lg shadow-emerald-500/5">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Gift className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-100 tracking-tight">Refer & Earn</h1>
            <p className="text-xs text-emerald-400 font-semibold">Instant Cashback Rewards</p>
          </div>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed mt-2" data-testid="referral-rule-notice">
          You get <span className="font-bold text-emerald-400">₹{rewardAmount} cashback</span> when
          your friend joins their first match or makes their first approved deposit.
        </p>
      </div>

      {/* Referral Code Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Referral Code</p>
        <div className="flex items-center gap-2">
          <div
            data-testid="referral-code-display"
            className="flex-1 rounded-xl bg-slate-950 border border-slate-700/80 px-4 py-3 text-center font-mono text-lg font-black tracking-widest text-emerald-400 select-all"
          >
            {referralCode || (loading ? 'Loading...' : 'N/A')}
          </div>
          <button
            onClick={handleCopy}
            disabled={!referralCode}
            data-testid="copy-referral-btn"
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-xs font-bold text-slate-100 hover:bg-slate-700 active:scale-95 transition disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-slate-300" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Primary Native Share / Social Modal Button */}
        <ShareButton
          referralCode={referralCode}
          buttonText="Share & Earn"
        />

        {/* Direct WhatsApp Action Button */}
        <button
          onClick={handleWhatsAppShare}
          disabled={!referralCode}
          data-testid="whatsapp-share-btn"
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 py-3 text-xs font-bold text-slate-200 transition active:scale-[0.98]"
        >
          <Share2 className="h-4 w-4 text-emerald-400 stroke-[2.5]" />
          <span>Share Directly on WhatsApp</span>
        </button>
      </div>

      {/* Performance Summary Cards */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Your Referral Activity
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          {/* Friends Joined */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-center space-y-1">
            <div className="flex justify-center text-slate-400">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-medium text-slate-400">Friends Joined</p>
            <p data-testid="referred-count" className="text-base font-black text-slate-100">
              {summary?.referredCount ?? (loading ? '...' : 0)}
            </p>
          </div>

          {/* Bonuses Unlocked */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-center space-y-1">
            <div className="flex justify-center text-amber-400">
              <Award className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-medium text-slate-400">Bonuses Unlocked</p>
            <p data-testid="bonus-earned-count" className="text-base font-black text-amber-400">
              {summary?.bonusEarnedCount ?? (loading ? '...' : 0)}
            </p>
          </div>

          {/* Total Bonus Cash */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-center space-y-1">
            <div className="flex justify-center text-emerald-400">
              <Wallet className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-medium text-slate-400">Total Earned</p>
            <p data-testid="total-bonus-earned" className="text-xs font-black text-emerald-400 truncate">
              {summary ? formatIndianRupees(summary.totalBonusEarned) : (loading ? '...' : 'Rs0.00')}
            </p>
          </div>
        </div>
      </div>

      {/* How it Works Guide */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>How It Works</span>
        </h3>
        <div className="space-y-2 text-xs text-slate-400">
          <div className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-emerald-400 border border-slate-700">
              1
            </span>
            <p>Send your unique referral code or link to your friends.</p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-emerald-400 border border-slate-700">
              2
            </span>
            <p>Your friend enters your code during registration.</p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-emerald-400 border border-slate-700">
              3
            </span>
            <p>
              When your friend deposits or joins their 1st match, you instantly get ₹{rewardAmount} cashback credited!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
