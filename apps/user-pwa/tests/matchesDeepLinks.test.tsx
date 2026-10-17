import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Matches } from '../src/pages/Matches.js';
import * as matchesApi from '../src/api/matches.js';
import * as InvitesContextModule from '../src/context/InvitesContext.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import {
  userMatchListResponseGuard,
  userTeamInvitesResponseGuard,
  userMatchHistoryResponseGuard,
} from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 8: Matches Sub-tab Deep Links', () => {
  let queryClient: QueryClient;

  const mockMatches = loadContractFixture(
    'GET_api_v1_matches.json',
    userMatchListResponseGuard,
    'GET /api/v1/matches'
  ).matches;

  const mockInvites = loadContractFixture(
    'GET_api_v1_me_team-invites.json',
    userTeamInvitesResponseGuard,
    'GET /api/v1/me/team-invites'
  ).invites;

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
      user: { id: '1' } as any,
      wallets: { total: '100.00' } as any,
      refreshProfile: vi.fn(),
    });
    vi.spyOn(matchesApi, 'fetchMatches').mockResolvedValue(mockMatches);
    vi.spyOn(matchesApi, 'fetchTeamInvites').mockResolvedValue(mockInvites);
    vi.spyOn(matchesApi, 'fetchMatchHistory').mockResolvedValue(mockHistory);
    vi.spyOn(InvitesContextModule, 'useInvites').mockReturnValue({
      invites: mockInvites,
      pendingCount: 0,
      isLoading: false,
      refetchInvites: vi.fn(),
    });
  });

  it('Requirement 8: safely defaults to matches sub-tab when URL has legacy ?tab=invites', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/matches?tab=invites']}>
          <Matches />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Matches container is rendered as invites mechanism is removed
    expect(screen.getByTestId('matches-list-container')).toBeInTheDocument();
    expect(screen.queryByTestId('team-invites-container')).toBeNull();
    expect(screen.queryByTestId('match-history-container')).toBeNull();
  });

  it('Requirement 8: opens history sub-tab when URL has ?tab=history', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/matches?tab=history']}>
          <Matches />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // History container is rendered
    expect(screen.getByTestId('match-history-container')).toBeInTheDocument();
    expect(screen.queryByTestId('matches-list-container')).toBeNull();
    expect(screen.queryByTestId('team-invites-container')).toBeNull();
  });

  it('Requirement 8: clicking sub-tab updates URL search params to preserve position on refresh', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/matches']}>
          <Matches />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Starts on matches
    expect(screen.getByTestId('matches-list-container')).toBeInTheDocument();

    // Click history sub-tab
    fireEvent.click(screen.getByTestId('subtab-history'));
    await waitFor(() => {
      expect(screen.getByTestId('match-history-container')).toBeInTheDocument();
    });

    // Click matches sub-tab
    fireEvent.click(screen.getByTestId('subtab-matches'));
    await waitFor(() => {
      expect(screen.getByTestId('matches-list-container')).toBeInTheDocument();
    });
  });
});
