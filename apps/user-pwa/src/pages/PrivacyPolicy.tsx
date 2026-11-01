import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Lock,
  ShieldCheck,
  FileText,
  UserCheck,
  CreditCard,
  EyeOff,
  Headphones,
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.js';

export const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="space-y-4 pb-6" data-testid="privacy-policy-screen">
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
          <Lock className="h-5 w-5 text-violet-400" />
          <h1 className="text-lg font-bold text-slate-100">{t('privacyPolicy.title')}</h1>
        </div>
      </div>

      {/* Intro Card */}
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 via-slate-900 to-slate-950 p-5 space-y-2 shadow-lg">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
          <h2 className="text-sm font-bold text-slate-100">{t('privacyPolicy.heroTitle')}</h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {t('privacyPolicy.lastUpdated')}
        </p>
      </div>

      {/* Policy Sections */}
      <div className="space-y-3 text-xs">
        {/* Section 1 */}
        <div className="rounded-2xl border border-slate-800 bg-[#121422] p-4 space-y-2">
          <div className="flex items-center gap-2 text-violet-400 font-bold">
            <UserCheck className="h-4 w-4" />
            <h3 className="text-slate-100 font-bold">{t('privacyPolicy.sec1Title')}</h3>
          </div>
          <p className="text-slate-400 leading-relaxed">
            {t('privacyPolicy.sec1Desc')}
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
            <li><strong className="text-slate-300">{t('privacyPolicy.sec1AccountDetailsLabel')}</strong> {t('privacyPolicy.sec1AccountDetailsText')}</li>
            <li><strong className="text-slate-300">{t('privacyPolicy.sec1GameInfoLabel')}</strong> {t('privacyPolicy.sec1GameInfoText')}</li>
            <li><strong className="text-slate-300">{t('privacyPolicy.sec1FinancialInfoLabel')}</strong> {t('privacyPolicy.sec1FinancialInfoText')}</li>
            <li><strong className="text-slate-300">{t('privacyPolicy.sec1SecurityInfoLabel')}</strong> {t('privacyPolicy.sec1SecurityInfoText')}</li>
          </ul>
        </div>

        {/* Section 2 */}
        <div className="rounded-2xl border border-slate-800 bg-[#121422] p-4 space-y-2">
          <div className="flex items-center gap-2 text-violet-400 font-bold">
            <FileText className="h-4 w-4" />
            <h3 className="text-slate-100 font-bold">{t('privacyPolicy.sec2Title')}</h3>
          </div>
          <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
            <li>{t('privacyPolicy.sec2Item1')}</li>
            <li>{t('privacyPolicy.sec2Item2')}</li>
            <li>{t('privacyPolicy.sec2Item3')}</li>
            <li>{t('privacyPolicy.sec2Item4')}</li>
          </ul>
        </div>

        {/* Section 3 */}
        <div className="rounded-2xl border border-slate-800 bg-[#121422] p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <EyeOff className="h-4 w-4" />
            <h3 className="text-slate-100 font-bold">{t('privacyPolicy.sec3Title')}</h3>
          </div>
          <p className="text-slate-400 leading-relaxed">
            {t('privacyPolicy.sec3Desc')}
          </p>
        </div>

        {/* Section 4 */}
        <div className="rounded-2xl border border-slate-800 bg-[#121422] p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <CreditCard className="h-4 w-4" />
            <h3 className="text-slate-100 font-bold">{t('privacyPolicy.sec4Title')}</h3>
          </div>
          <p className="text-slate-400 leading-relaxed">
            {t('privacyPolicy.sec4Desc')}
          </p>
        </div>

        {/* Section 5 */}
        <div className="rounded-2xl border border-slate-800 bg-[#121422] p-4 space-y-2">
          <div className="flex items-center gap-2 text-sky-400 font-bold">
            <ShieldCheck className="h-4 w-4" />
            <h3 className="text-slate-100 font-bold">
              {t('privacyPolicy.sec5Title')}
            </h3>
          </div>
          <p className="text-slate-400 leading-relaxed">
            {t('privacyPolicy.sec5Desc')}
          </p>
        </div>

        {/* Contact Support Link */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-2">
          <h4 className="font-bold text-slate-200">
            {t('privacyPolicy.questionsTitle')}
          </h4>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            {t('privacyPolicy.questionsDesc')}
          </p>
          <Link
            to="/support"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-400 hover:text-violet-300 transition"
          >
            <Headphones className="h-3.5 w-3.5" />
            <span>{t('privacyPolicy.contactSupportLink')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
