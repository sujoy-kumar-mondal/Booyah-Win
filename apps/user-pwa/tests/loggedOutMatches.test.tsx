import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Matches } from '../src/pages/Matches.js';
import * as matchesApi from '../src/api/matches.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import * as InvitesContextModule from '../src/context/InvitesContext.js';

describe('Logged-out Matches View & Join Redirect', () => {
  let queryClient: QueryClient;

  const sampleMatch: matchesApi.MatchUserDto = {
    id: '101',
    gameMode: 'battle_royale',
    teamMode: 'solo',
    entryFee: '20.00',
    prizes: {
      positions: { '1': '100.00' },
      killPrice: '5.00',
      minKillsForReward: 2,
    },
    joinedPlayers: 5,
    seatsTaken: 5,
    maxPlayers: 48,
    minPlayers: 10,
    startTime: new Date(Date.now() + 3600000).toISOString(),
    status: 'upcoming',
    hasJoined: false,
    isInTeam: false,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(matchesApi, 'fetchMatches').mockResolvedValue([sampleMatch]);
    vi.spyOn(matchesApi, 'fetchMatch').mockResolvedValue(sampleMatch);
    vi.spyOn(InvitesContextModule, 'useInvites').mockReturnValue({
      invites: [],
      pendingCount: 0,
      isLoading: false,
      refetchInvites: vi.fn(),
    });
  });

  it('renders match list for logged-out users without showing session expired error', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      wallets: null,
      refreshProfile: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/matches']}>
          <Matches />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByTestId('match-card-101')).toBeInTheDocument();
    expect(screen.queryByText(/Your session has expired/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('match-fee-101')).toBeInTheDocument();
  });

  it('redirects logged-out user to /login when clicking Join Match', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      wallets: null,
      refreshProfile: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/matches']}>
          <Routes>
            <Route path="/matches" element={<Matches />} />
            <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Open match detail modal
    const card = await screen.findByTestId('match-card-101');
    fireEvent.click(card);

    // Click join match button
    const joinBtn = await screen.findByTestId('join-match-btn');
    expect(joinBtn).toHaveTextContent(/Join Match/i);
    fireEvent.click(joinBtn);

    // Should redirect to /login
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });
});
