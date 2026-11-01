import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Info,
  Trophy,
  ShieldCheck,
  Zap,
  Award,
  Headphones,
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.js';

export const AboutUs: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="space-y-4 pb-6" data-testid="about-us-screen">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
        <button
          type="button"
          onClick={() => navigate('/account')}
          aria-label={t('account.cancel') || 'Back to Account'}
          data-testid="back-to-account-btn"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-violet-400" />
          <h1 className="text-lg font-bold text-slate-100">{t('aboutUs.title')}</h1>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 via-slate-900 to-slate-950 p-6 text-center space-y-3 shadow-xl">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-400 border border-violet-500/30 mx-auto">
          <Trophy className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-100">BOOYAH WIN</h2>
          <p className="text-xs text-violet-300 font-semibold mt-0.5">
            {t('aboutUs.heroSubtitle')}
          </p>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
          {t('aboutUs.heroDesc')}
        </p>
      </div>

      {/* Core Values & Platform Pillars */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          {t('aboutUs.whyChooseUs')}
        </h3>

        {/* Pillar 1: Fair Play & Anti-Cheat */}
        <div className="rounded-2xl border border-slate-800 bg-[#121422] p-4 space-y-2">
          <div className="flex items-center gap-2.5 text-violet-400">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <h4 className="text-sm font-bold text-slate-100">{t('aboutUs.pillarAntiCheatTitle')}</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {t('aboutUs.pillarAntiCheatDesc')}
          </p>
        </div>

        {/* Pillar 2: 100% Skill-Based Gaming */}
        <div className="rounded-2xl border border-slate-800 bg-[#121422] p-4 space-y-2">
          <div className="flex items-center gap-2.5 text-emerald-400">
            <Award className="h-5 w-5 shrink-0" />
            <h4 className="text-sm font-bold text-slate-100">{t('aboutUs.pillarSkillTitle')}</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {t('aboutUs.pillarSkillDesc')}
          </p>
        </div>

        {/* Pillar 3: Instant & Secure Payouts */}
        <div className="rounded-2xl border border-slate-800 bg-[#121422] p-4 space-y-2">
          <div className="flex items-center gap-2.5 text-amber-400">
            <Zap className="h-5 w-5 shrink-0" />
            <h4 className="text-sm font-bold text-slate-100">{t('aboutUs.pillarPayoutTitle')}</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {t('aboutUs.pillarPayoutDesc')}
          </p>
        </div>

        {/* Pillar 4: Dedicated 24/7 Support */}
        <div className="rounded-2xl border border-slate-800 bg-[#121422] p-4 space-y-2">
          <div className="flex items-center gap-2.5 text-sky-400">
            <Headphones className="h-5 w-5 shrink-0" />
            <h4 className="text-sm font-bold text-slate-100">{t('aboutUs.pillarSupportTitle')}</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {t('aboutUs.pillarSupportDesc')}
          </p>
        </div>
      </div>

      {/* Compliance & Company Info Card */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-2 text-xs">
        <h4 className="font-bold text-slate-200">
          {t('aboutUs.legalNoticeTitle')}
        </h4>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          {t('aboutUs.legalNoticeDesc')}
        </p>
      </div>
    </div>
  );
};
