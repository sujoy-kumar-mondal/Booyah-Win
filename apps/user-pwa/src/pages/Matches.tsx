import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Swords, History } from 'lucide-react';
import { MatchesList } from '../components/matches/MatchesList.js';
import { MatchHistory } from '../components/matches/MatchHistory.js';
import { useAuth } from '../context/AuthContext.js';
import { useTranslation } from '../i18n/LanguageContext.js';

export const Matches: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const isAuth = Boolean(auth.isAuthenticated ?? auth.user);
  const rawTab = searchParams.get('tab');
  const currentTab: 'matches' | 'history' = rawTab === 'history' ? 'history' : 'matches';

  useEffect(() => {
    if (currentTab === 'history' && !isAuth) {
      navigate('/login', { replace: true });
    }
  }, [currentTab, isAuth, navigate]);

  const handleTabChange = (tab: 'matches' | 'history') => {
    if (tab === 'history' && !isAuth) {
      navigate('/login');
      return;
    }
    setSearchParams({ tab });
  };

  return (
    <div data-testid="matches-page" className="space-y-4">
      {/* Sub-tab Navigation (Matches | History) */}
      <div
        data-testid="matches-sub-tabs"
        className="flex items-center rounded-2xl bg-slate-900/80 p-1 border border-slate-800"
      >
        <button
          type="button"
          data-testid="subtab-matches"
          onClick={() => handleTabChange('matches')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
            currentTab === 'matches'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Swords className="h-4 w-4" />
          <span>{t('matches.tabMatches')}</span>
        </button>

        <button
          type="button"
          data-testid="subtab-history"
          onClick={() => handleTabChange('history')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
            currentTab === 'history'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="h-4 w-4" />
          <span>{t('matches.tabHistory')}</span>
        </button>
      </div>

      {/* Active Tab Content */}
      <div className="pt-1">
        {currentTab === 'matches' && <MatchesList />}
        {currentTab === 'history' && <MatchHistory />}
      </div>
    </div>
  );
};
