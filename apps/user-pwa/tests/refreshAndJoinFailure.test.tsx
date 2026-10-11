import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatchesList } from '../src/components/matches/MatchesList.js';
import { SoloJoinDialog } from '../src/components/matches/SoloJoinDialog.js';
import * as matchesApi from '../src/api/matches.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import { userMatchDetailResponseGuard, userMatchListResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 11: Refresh Button & Join Network Failure Handling', () => {
  let queryClient: QueryClient;

  const mockMatches = loadContractFixture(
    'GET_api_v1_matches.json',
    userMatchListResponseGuard,
    'GET /api/v1/matches'
  ).matches;

  const mockMatch = loadContractFixture(
    'GET_api_v1_matches_id__upcoming.json',
    userMatchDetailResponseGuard,
    'GET /api/v1/matches/:id'
  ).match;

  const refreshProfileSpy = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: '1' } as any,
      wallets: { total: '100.00' } as any,
      refreshProfile: refreshProfileSpy,
    });
    vi.clearAllMocks();
  });

  it('Requirement 11: renders visible refresh button and re-fetches matches on click', async () => {
    const fetchSpy = vi.spyOn(matchesApi, 'fetchMatches').mockResolvedValue(mockMatches);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchesList />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const refreshBtn = screen.getByTestId('refresh-matches-btn');
    expect(refreshBtn).toBeInTheDocument();

    await waitFor(() => {
      expect(refreshBtn).not.toBeDisabled();
    });

    fireEvent.click(refreshBtn);

    expect(fetchSpy).toHaveBeenCalledTimes(2); // once on mount, once on click
  });

  it('Requirement 11: join network failure or timeout never retries automatically, refetches match and balances, and directs user to check My Matches', async () => {
    const joinSpy = vi
      .spyOn(matchesApi, 'joinMatchSolo')
      .mockRejectedValueOnce(new TypeError('Failed to fetch')); // Network error

    const fetchMatchSpy = vi.spyOn(matchesApi, 'fetchMatch').mockResolvedValue(mockMatch);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SoloJoinDialog
            match={mockMatch}
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const confirmBtn = screen.getByTestId('confirm-join-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      // Never retries automatically: join called exactly once
      expect(joinSpy).toHaveBeenCalledTimes(1);

      // Refetches match & wallets
      expect(fetchMatchSpy).toHaveBeenCalledWith(mockMatch.id);
      expect(refreshProfileSpy).toHaveBeenCalled();

      // Tells user to check My Matches before trying again
      const errEl = screen.getByTestId('join-dialog-error');
      expect(errEl.textContent).toContain(
        'Network request failed. Please check "My Matches" before trying again.'
      );
    });
  });
});
