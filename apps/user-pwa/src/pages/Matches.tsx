import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Swords, Mail, History } from 'lucide-react';
import { MatchesList } from '../components/matches/MatchesList.js';
import { TeamInvites } from '../components/matches/TeamInvites.js';
import { MatchHistory } from '../components/matches/MatchHistory.js';
import { useInvites } from '../context/InvitesContext.js';
import { useAuth } from '../context/AuthContext.js';

export const Matches: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const isAuth = Boolean(auth.isAuthenticated ?? auth.user);
  const currentTab = searchParams.get('tab') || 'matches';

  let pendingCount = 0;
  try {
    const invitesCtx = useInvites();
    pendingCount = invitesCtx.pendingCount;
  } catch {
    // If rendered outside InvitesProvider
  }

  useEffect(() => {
    if ((currentTab === 'invites' || currentTab === 'history') && !isAuth) {
      navigate('/login', { replace: true });
    }
  }, [currentTab, isAuth, navigate]);

  const handleTabChange = (tab: 'matches' | 'invites' | 'history') => {
    if ((tab === 'invites' || tab === 'history') && !isAuth) {
      navigate('/login');
      return;
    }
    setSearchParams({ tab });
  };

  return (
    <div data-testid="matches-page" className="space-y-4">
      {/* Sub-tab Navigation with Deep Links (Requirement 8) */}
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
          <span>Matches</span>
        </button>

        <button
          type="button"
          data-testid="subtab-invites"
          onClick={() => handleTabChange('invites')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all relative ${
            currentTab === 'invites'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mail className="h-4 w-4" />
          <span>Invites</span>
          {pendingCount > 0 && (
            <span
              data-testid="subtab-invites-badge"
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                currentTab === 'invites'
                  ? 'bg-slate-950 text-emerald-400'
                  : 'bg-emerald-500 text-slate-950'
              }`}
            >
              {pendingCount}
            </span>
          )}
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
          <span>History</span>
        </button>
      </div>

      {/* Active Tab Content */}
      <div className="pt-1">
        {currentTab === 'matches' && <MatchesList />}
        {currentTab === 'invites' && <TeamInvites />}
        {currentTab === 'history' && <MatchHistory />}
      </div>
    </div>
  );
};
