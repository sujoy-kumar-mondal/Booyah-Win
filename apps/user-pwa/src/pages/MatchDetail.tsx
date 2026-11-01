import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { fetchMatch, fetchMatches, type MatchUserDto } from '../api/matches.js';
import { MatchDetailModal } from '../components/matches/MatchDetailModal.js';
import { useTranslation } from '../i18n/LanguageContext.js';

export const MatchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const stateMatch = (location.state as any)?.match as MatchUserDto | undefined;
  const initialMatch =
    stateMatch && String(stateMatch.id) === String(id) ? stateMatch : null;

  const [match, setMatch] = useState<MatchUserDto | null>(initialMatch);
  const [loading, setLoading] = useState(!initialMatch);
  const [error, setError] = useState<string | null>(null);

  const loadMatch = async () => {
    if (!id) return;
    try {
      const data = await fetchMatch(id);
      setMatch(data);
      setError(null);
    } catch {
      // Fallback for cancelled/completed match that may return 404 from active matches endpoint
      try {
        const completedMatches = await fetchMatches('completed');
        const found = completedMatches.find((m) => String(m.id) === String(id));
        if (found) {
          setMatch(found);
          setError(null);
          return;
        }
      } catch {
        // Fallback error
      }
      if (!match) {
        setError(t('matches.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatch();
  }, [id]);

  if (loading && !match) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400 text-xs">
        {t('common.loading')}
      </div>
    );
  }

  if (error && !match) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-sm font-semibold text-red-400">{error || t('matches.loadFailed')}</p>
        <button
          type="button"
          onClick={() => navigate('/matches')}
          className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
        >
          {t('common.back')}
        </button>
      </div>
    );
  }

  if (!match) return null;

  return (
    <MatchDetailModal
      match={match}
      isOpen={true}
      isPage={true}
      onClose={() => {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate('/matches');
        }
      }}
      onRefreshMatch={loadMatch}
    />
  );
};
