import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatchesList } from '../src/components/matches/MatchesList.js';
import { MatchDetailModal } from '../src/components/matches/MatchDetailModal.js';
import { MatchHistory } from '../src/components/matches/MatchHistory.js';
import * as matchesApi from '../src/api/matches.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import {
  userMatchListResponseGuard,
  userMatchDetailResponseGuard,
  userMatchHistoryResponseGuard,
} from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 9: Strict Player Privacy Invariant', () => {
  let queryClient: QueryClient;

  // Sensitive opponent IDs and names that must NEVER be leaked or rendered
  const OPPONENT_NAME = 'SecretOpponent';
  const OPPONENT_USER_ID = '9999999';
  const OPPONENT_FF_ID = '777888999';

  const mockMatches = loadContractFixture(
    'GET_api_v1_matches.json',
    userMatchListResponseGuard,
    'GET /api/v1/matches'
  ).matches;

  const mockMatchDetail = loadContractFixture(
    'GET_api_v1_matches_id.json',
    userMatchDetailResponseGuard,
    'GET /api/v1/matches/:id'
  ).match;

  const mockHistory = loadContractFixture(
    'GET_api_v1_me_match-history.json',
    userMatchHistoryResponseGuard,
    'GET /api/v1/me/match-history'
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: '1', name: 'MyUser', ffId: '11223344' } as any,
      wallets: { total: '100.00' } as any,
      refreshProfile: vi.fn(),
    });
  });

  it('Requirement 9: verifies no other player name, ID or Free Fire ID is rendered on match browsing list', async () => {
    vi.spyOn(matchesApi, 'fetchMatches').mockResolvedValue(mockMatches);

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchesList />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const renderedText = container.textContent || '';
    expect(renderedText).not.toContain(OPPONENT_NAME);
    expect(renderedText).not.toContain(OPPONENT_USER_ID);
    expect(renderedText).not.toContain(OPPONENT_FF_ID);
  });

  it('Requirement 9: verifies match detail renders only own team info and never opponent player details', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={mockMatchDetail}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const renderedText = container.textContent || '';
    expect(renderedText).not.toContain(OPPONENT_NAME);
    expect(renderedText).not.toContain(OPPONENT_USER_ID);
    expect(renderedText).not.toContain(OPPONENT_FF_ID);
  });

  it('Requirement 9: verifies match history renders only user own records and no other player IDs', async () => {
    vi.spyOn(matchesApi, 'fetchMatchHistory').mockResolvedValue(mockHistory);

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchHistory />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const renderedText = container.textContent || '';
    expect(renderedText).not.toContain(OPPONENT_NAME);
    expect(renderedText).not.toContain(OPPONENT_USER_ID);
    expect(renderedText).not.toContain(OPPONENT_FF_ID);
  });
});
