import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { MatchesList } from '../components/matches/MatchesList.js';
import { useTranslation } from '../i18n/LanguageContext.js';

export type MatchTab = 'upcoming' | 'live' | 'my_matches' | 'completed';

export const Matches: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get('tab') || 'upcoming';
  const currentTab: MatchTab =
    rawTab === 'my_matches' || rawTab === 'my-matches' || rawTab === 'joined'
      ? 'my_matches'
      : rawTab === 'history' || rawTab === 'completed'
      ? 'completed'
      : rawTab === 'live'
      ? 'live'
      : 'upcoming';

  const handleTabChange = (tab: MatchTab) => {
    const tabParam = tab === 'completed' ? 'history' : tab === 'my_matches' ? 'my-matches' : tab;
    setSearchParams({ tab: tabParam });
  };

  return (
    <div data-testid="matches-page" className="space-y-4">
      {/* Title */}
      <h1 className="text-2xl font-black tracking-tight text-slate-100">{t('nav.matches')}</h1>

      {/* Primary Status Segmented Navigation (Upcoming | Live | My Matches | Completed) */}
      <div
        data-testid="matches-sub-tabs"
        className="grid grid-cols-4 rounded-2xl bg-[#0f111e] p-1 border border-slate-800/80 gap-0.5"
      >
        <button
          type="button"
          data-testid="subtab-matches"
          onClick={() => handleTabChange('upcoming')}
          className={`py-2.5 text-[11px] sm:text-xs font-extrabold rounded-xl transition-all px-1 text-center truncate ${
            currentTab === 'upcoming'
              ? 'bg-[#1b1d2e] text-slate-100 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('matches.tabUpcoming') || 'Upcoming'}
        </button>

        <button
          type="button"
          data-testid="subtab-live"
          onClick={() => handleTabChange('live')}
          className={`py-2.5 text-[11px] sm:text-xs font-extrabold rounded-xl transition-all px-1 text-center truncate ${
            currentTab === 'live'
              ? 'bg-[#1b1d2e] text-slate-100 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('matches.tabLive') || 'Live'}
        </button>

        <button
          type="button"
          data-testid="subtab-my-matches"
          onClick={() => handleTabChange('my_matches')}
          className={`py-2.5 text-[11px] sm:text-xs font-extrabold rounded-xl transition-all px-1 text-center truncate ${
            currentTab === 'my_matches'
              ? 'bg-[#1b1d2e] text-slate-100 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('matches.tabMyMatches') || 'My Matches'}
        </button>

        <button
          type="button"
          data-testid="subtab-history"
          onClick={() => handleTabChange('completed')}
          className={`py-2.5 text-[11px] sm:text-xs font-extrabold rounded-xl transition-all px-1 text-center truncate ${
            currentTab === 'completed'
              ? 'bg-[#1b1d2e] text-slate-100 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('matches.tabCompleted') || 'Completed'}
        </button>
      </div>

      {/* Active Tab Content: Upcoming, Live, My Matches, and Completed tournament matches */}
      <div className="pt-1">
        <MatchesList statusTab={currentTab} />
      </div>
    </div>
  );
};
