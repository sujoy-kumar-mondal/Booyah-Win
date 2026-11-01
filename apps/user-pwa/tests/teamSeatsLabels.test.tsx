import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatchesList } from '../src/components/matches/MatchesList.js';
import { MatchDetailModal } from '../src/components/matches/MatchDetailModal.js';
import * as matchesApi from '../src/api/matches.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import { userMatchDetailResponseGuard, userMatchListResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 10: Seats Labeling in Team Modes', () => {
  let queryClient: QueryClient;

  const mockDuoMatch = loadContractFixture(
    'GET_api_v1_matches_id__joined.json',
    userMatchDetailResponseGuard,
    'GET /api/v1/matches/:id',
    (data) => {
      data.match.teamMode = 'duo';
      data.match.seatsTaken = 4;
      data.match.joinedPlayers = 3;
      data.match.maxPlayers = 48;
    }
  ).match;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: '1' } as any,
      wallets: { total: '100.00' } as any,
      refreshProfile: vi.fn(),
    });
  });

  it('Requirement 10: labels seats in team modes as seats reserved vs players joined, not as roster', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={mockDuoMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const seatsLabel = screen.getByTestId('match-seats-label');
    expect(seatsLabel.textContent).toBe('4 seats reserved vs 3 players joined');
  });

  it('Requirement 10: labels seats in solo mode as players joined of max players', () => {
    const mockSoloMatch = {
      ...mockDuoMatch,
      teamMode: 'solo',
      joinedPlayers: 15,
      maxPlayers: 48,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={mockSoloMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const seatsLabel = screen.getByTestId('match-seats-label');
    expect(seatsLabel.textContent).toBe('15 / 48 players joined');
  });
});
