import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatchDetailModal } from '../src/components/matches/MatchDetailModal.js';
import { SoloJoinDialog } from '../src/components/matches/SoloJoinDialog.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import * as matchesApi from '../src/api/matches.js';
import { ApiError } from '../src/api/client.js';
import { userMatchDetailResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 3: Join Button & Balance Validation', () => {
  let queryClient: QueryClient;

  const mockMatch = loadContractFixture(
    'GET_api_v1_matches_id__upcoming.json',
    userMatchDetailResponseGuard,
    'GET /api/v1/matches/:id'
  ).match;

  const authStateMock = {
    user: { id: '1', name: 'Player' } as any,
    wallets: { addMoney: '5.00', cashback: '0.00', winning: '5.00', total: '10.00' }, // Total Rs10.00 < Fee Rs20.00
    refreshProfile: vi.fn(),
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(authStateMock as any);
  });

  it('Requirement 3: Join button remains enabled unless match state forbids joining', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={mockMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const joinBtn = screen.getByTestId('join-match-btn');
    expect(joinBtn).toBeInTheDocument();
    expect(joinBtn).not.toBeDisabled();
  });

  it('Requirement 3: shows soft low-balance hint when total balance string is strictly below fee using integer paise', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={mockMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const hint = screen.getByTestId('soft-low-balance-hint');
    expect(hint).toBeInTheDocument();
    expect(hint.textContent).toContain('Your total wallet balance (Rs10.00) is below the entry fee');
  });

  it('Requirement 3: does not show soft low-balance hint when total balance meets or exceeds fee', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: '1' } as any,
      wallets: { addMoney: '20.00', cashback: '5.00', winning: '0.00', total: '25.00' }, // Rs25.00 >= Rs20.00
      refreshProfile: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={mockMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.queryByTestId('soft-low-balance-hint')).toBeNull();
  });

  it('Requirement 3: server LOW_BALANCE error displays friendly message and link to add money', async () => {
    vi.spyOn(matchesApi, 'joinMatchSolo').mockRejectedValueOnce(
      new ApiError('LOW_BALANCE', 'Insufficient balance')
    );

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
      const errorEl = screen.getByTestId('join-dialog-error');
      expect(errorEl.textContent).toContain('Insufficient wallet balance to join this match.');

      const addMoneyLink = screen.getByTestId('add-money-link');
      expect(addMoneyLink).toBeInTheDocument();
      expect(addMoneyLink.getAttribute('href')).toBe('/wallet?tab=add');
    });
  });

  it('updates Join Match button to Already Joined and increments seats when user joins match', async () => {
    const freshJoinedMatch = {
      ...mockMatch,
      hasJoined: true,
      joinedPlayers: mockMatch.joinedPlayers + 1,
    };

    vi.spyOn(matchesApi, 'joinMatchSolo').mockResolvedValueOnce({
      message: 'Successfully joined match!',
      matchId: mockMatch.id,
      joinedAt: '2026-10-12T12:00:00Z',
    });
    vi.spyOn(matchesApi, 'fetchMatch').mockResolvedValue(freshJoinedMatch);

    const onRefreshMatch = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={mockMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={onRefreshMatch}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Initially shows Join Match button
    const joinBtn = screen.getByTestId('join-match-btn');
    expect(joinBtn).toBeInTheDocument();
    expect(joinBtn.textContent).toContain('Join Match');

    // Click to open SoloJoinDialog
    fireEvent.click(joinBtn);

    // Confirm Join inside SoloJoinDialog
    const confirmBtn = screen.getByTestId('confirm-join-btn');
    expect(confirmBtn).toBeInTheDocument();
    fireEvent.click(confirmBtn);

    // Done button appears on success
    await waitFor(() => {
      expect(screen.getByTestId('close-success-btn')).toBeInTheDocument();
    });

    // Click Done to return to MatchDetailModal
    fireEvent.click(screen.getByTestId('close-success-btn'));

    // Now MatchDetailModal displays Already Joined
    await waitFor(() => {
      const alreadyJoinedBtn = screen.getByTestId('joined-status-btn');
      expect(alreadyJoinedBtn).toBeInTheDocument();
      expect(alreadyJoinedBtn.textContent).toContain('Already Joined');
      expect(onRefreshMatch).toHaveBeenCalled();
    });
  });
});

