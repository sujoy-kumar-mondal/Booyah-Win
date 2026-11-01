import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatchesList } from '../src/components/matches/MatchesList.js';
import { MatchDetailModal } from '../src/components/matches/MatchDetailModal.js';
import * as matchesApi from '../src/api/matches.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import * as InvitesContextModule from '../src/context/InvitesContext.js';
import { isMatchClosed } from '../src/utils/formatters.js';

describe('Closed Matches (<= 10 Minutes Cutoff)', () => {
  let queryClient: QueryClient;

  const mockNearMatch: matchesApi.MatchUserDto = {
    id: '47',
    gameMode: 'battle_royale',
    teamMode: 'duo',
    entryFee: '10.00',
    prizes: {
      positions: { '1': '320.00' },
      killPrice: '5.00',
      minKillsForReward: 1,
    },
    joinedPlayers: 0,
    seatsTaken: 0,
    maxPlayers: 48,
    minPlayers: 2,
    startTime: new Date(Date.now() + 6 * 60 * 1000).toISOString(), // 6 minutes from now
    status: 'upcoming',
    hasJoined: false,
    isInTeam: false,
    isTeamLeader: false,
  };

  const mockFarMatch: matchesApi.MatchUserDto = {
    id: '48',
    gameMode: 'battle_royale',
    teamMode: 'solo',
    entryFee: '20.00',
    prizes: {
      positions: { '1': '500.00' },
      killPrice: '10.00',
      minKillsForReward: 1,
    },
    joinedPlayers: 5,
    seatsTaken: 5,
    maxPlayers: 48,
    minPlayers: 2,
    startTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 minutes from now
    status: 'upcoming',
    hasJoined: false,
    isInTeam: false,
    isTeamLeader: false,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: '1', name: 'Sujoy', ffId: '12345678' } as any,
      wallets: { total: '155.00' } as any,
      refreshProfile: vi.fn(),
    });
    vi.spyOn(InvitesContextModule, 'useInvites').mockReturnValue({
      refetchInvites: vi.fn(),
    } as any);
  });

  it('isMatchClosed returns true for <= 10m to start or live status', () => {
    expect(isMatchClosed(mockNearMatch)).toBe(true);
    expect(isMatchClosed(mockFarMatch)).toBe(false);
    expect(isMatchClosed({ status: 'live' })).toBe(true);
    expect(isMatchClosed({ status: 'completed' })).toBe(false);
  });

  it('filters closed match (<10m) out of Upcoming tab and includes it in Live tab', async () => {
    vi.spyOn(matchesApi, 'fetchMatches').mockResolvedValue([mockNearMatch, mockFarMatch]);

    // 1. Upcoming tab: only mockFarMatch is rendered
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchesList statusTab="upcoming" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('match-card-48')).toBeInTheDocument();
      expect(screen.queryByTestId('match-card-47')).not.toBeInTheDocument();
    });
    unmount();

    // 2. Live tab: mockNearMatch (closed match) is rendered
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchesList statusTab="live" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('match-card-47')).toBeInTheDocument();
      expect(screen.queryByTestId('match-card-48')).not.toBeInTheDocument();
    });
  });

  it('renders "Closed" action button on match card instead of "Join" and allows inspecting match', async () => {
    vi.spyOn(matchesApi, 'fetchMatches').mockResolvedValue([mockNearMatch]);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchesList statusTab="live" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('match-card-47')).toBeInTheDocument();
    });

    // Button text is Closed, not Join
    const closedBadge = screen.getByTestId('match-closed-badge-47');
    expect(closedBadge).toBeInTheDocument();
    expect(closedBadge.textContent).toBe('Closed');
    expect(screen.queryByTestId('match-join-btn-47')).not.toBeInTheDocument();

    // Clicking Closed opens the MatchDetailModal for inspection
    fireEvent.click(closedBadge);

    await waitFor(() => {
      expect(screen.getByTestId('match-detail-modal')).toBeInTheDocument();
      expect(screen.getByTestId('tab-rules')).toBeInTheDocument();
      expect(screen.getByTestId('tab-players')).toBeInTheDocument();
      expect(screen.getByTestId('tab-prize-pool')).toBeInTheDocument();
    });
  });

  it('disables bottom action button with "Closed" in MatchDetailModal when within 10 minutes', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={mockNearMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const closedBtn = screen.getByTestId('match-closed-btn');
    expect(closedBtn).toBeInTheDocument();
    expect(closedBtn).toBeDisabled();
    expect(closedBtn.textContent).toBe('Closed');
    expect(screen.queryByTestId('join-match-btn')).not.toBeInTheDocument();

    // Can still inspect tabs: Rules, Players, Prize Pool
    fireEvent.click(screen.getByTestId('tab-players'));
    expect(screen.getByTestId('players-tab-content')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-prize-pool'));
    expect(screen.getByTestId('prizes-tab-content')).toBeInTheDocument();
  });

  it('Completed section shows both completed and cancelled matches with their badges', async () => {
    const mockCompletedMatch: matchesApi.MatchUserDto = {
      ...mockFarMatch,
      id: '50',
      status: 'completed',
    };
    const mockCancelledMatch: matchesApi.MatchUserDto = {
      ...mockFarMatch,
      id: '51',
      status: 'cancelled',
    };

    vi.spyOn(matchesApi, 'fetchMatches').mockResolvedValue([
      mockCompletedMatch,
      mockCancelledMatch,
      mockNearMatch, // upcoming should be filtered out from completed tab
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchesList statusTab="completed" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('match-card-50')).toBeInTheDocument();
      expect(screen.getByTestId('match-card-51')).toBeInTheDocument();
      expect(screen.queryByTestId('match-card-47')).not.toBeInTheDocument();
    });

    // Check badges
    const completedBadge = screen.getByTestId('match-completed-badge-50');
    expect(completedBadge).toBeInTheDocument();
    expect(completedBadge.textContent).toBe('Completed');

    const cancelledBadge = screen.getByTestId('match-cancelled-badge-51');
    expect(cancelledBadge).toBeInTheDocument();
    expect(cancelledBadge.textContent).toBe('Cancelled');
  });

  it('renders players tab with 3-column table structure: Team number, Team name, and Numbered players', async () => {
    vi.spyOn(matchesApi, 'fetchMatchPlayers').mockResolvedValue({
      count: 4,
      players: [
        { team: 1, position: 'A', name: 'Kingrohitt', teamName: 'Thunder Strikers' },
        { team: 1, position: 'B', name: 'Gamer', teamName: 'Thunder Strikers' },
        { team: 2, position: 'A', name: 'kingrohit', teamName: null },
        { team: 2, position: 'B', name: 'Riya_Shooter', teamName: null },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={mockFarMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Click on Players tab
    const playersTabBtn = screen.getByTestId('tab-players');
    fireEvent.click(playersTabBtn);

    await waitFor(() => {
      // Team 1 row: Team: 1 | Thunder Strikers | 1. Kingrohitt, 2. Gamer
      expect(screen.getByText('Team: 1')).toBeInTheDocument();
      expect(screen.getByText('Thunder Strikers')).toBeInTheDocument();
      expect(screen.getByText('Kingrohitt')).toBeInTheDocument();
      expect(screen.getByText('Gamer')).toBeInTheDocument();

      // Team 2 row with fallback team name: Team: 2 | Team 2 | 1. kingrohit, 2. Riya_Shooter
      expect(screen.getByText('Team: 2')).toBeInTheDocument();
      expect(screen.getByText('Team 2')).toBeInTheDocument();
      expect(screen.getByText('kingrohit')).toBeInTheDocument();
      expect(screen.getByText('Riya_Shooter')).toBeInTheDocument();
    });
  });

  it('displays Completed text instead of Already Joined when user has joined a completed match', () => {
    const joinedCompletedMatch: matchesApi.MatchUserDto = {
      ...mockFarMatch,
      status: 'completed',
      hasJoined: true,
      isInTeam: true,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={joinedCompletedMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Completed button should be visible; Already Joined should not
    const completedBtn = screen.getByTestId('match-completed-btn');
    expect(completedBtn).toBeInTheDocument();
    expect(completedBtn.textContent).toBe('Completed');
    expect(screen.queryByTestId('joined-status-btn')).not.toBeInTheDocument();
  });

  it('renders REWARD tab for Duo/Squad with Position, Team number, teamname, Players & kills, and team total reward', async () => {
    vi.spyOn(matchesApi, 'fetchMatchPlayers').mockResolvedValue({
      count: 2,
      players: [
        {
          team: 1,
          position: 'A',
          name: 'Kingrohitt',
          teamName: 'Thunder Strikers',
          kills: 3,
          matchPosition: 1,
          payout: '320.00',
          teamPayout: '320.00',
        },
        {
          team: 1,
          position: 'B',
          name: 'Gamer',
          teamName: 'Thunder Strikers',
          kills: 1,
          matchPosition: 1,
          payout: '0.00',
          teamPayout: '320.00',
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={{ ...mockNearMatch, status: 'completed' }}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 4 tab buttons should exist
    expect(screen.getByTestId('tab-rules')).toBeInTheDocument();
    expect(screen.getByTestId('tab-players')).toBeInTheDocument();
    expect(screen.getByTestId('tab-prize-pool')).toBeInTheDocument();
    const rewardTabBtn = screen.getByTestId('tab-reward');
    expect(rewardTabBtn).toBeInTheDocument();

    fireEvent.click(rewardTabBtn);

    await waitFor(() => {
      expect(screen.getByTestId('reward-tab-content')).toBeInTheDocument();
      // Position column
      expect(screen.getByText('#1')).toBeInTheDocument();
      // Team number
      expect(screen.getByText('Team: 1')).toBeInTheDocument();
      // Team name
      expect(screen.getByText('Thunder Strikers')).toBeInTheDocument();
      // Players and kills
      expect(screen.getByText('Kingrohitt')).toBeInTheDocument();
      expect(screen.getByText('3 kills')).toBeInTheDocument();
      expect(screen.getByText('Gamer')).toBeInTheDocument();
      expect(screen.getByText('1 kills')).toBeInTheDocument();
      // Team total reward
      expect(screen.getByText('₹320.00')).toBeInTheDocument();
    });
  });

  it('renders REWARD tab for Solo with [position, name, kills, reward]', async () => {
    vi.spyOn(matchesApi, 'fetchMatchPlayers').mockResolvedValue({
      count: 2,
      players: [
        {
          team: 1,
          position: 'A',
          name: 'SoloMaster',
          teamName: null,
          kills: 6,
          matchPosition: 1,
          payout: '150.00',
          teamPayout: '150.00',
        },
        {
          team: 2,
          position: 'A',
          name: 'RunnerUp',
          teamName: null,
          kills: 2,
          matchPosition: 2,
          payout: '50.00',
          teamPayout: '50.00',
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={{ ...mockFarMatch, teamMode: 'solo', status: 'completed' }}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const rewardTabBtn = screen.getByTestId('tab-reward');
    fireEvent.click(rewardTabBtn);

    await waitFor(() => {
      expect(screen.getByText('SoloMaster')).toBeInTheDocument();
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('₹150.00')).toBeInTheDocument();

      expect(screen.getByText('RunnerUp')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('₹50.00')).toBeInTheDocument();
    });
  });

  it('shows cancellation reason in REWARD tab when match is cancelled', async () => {
    vi.spyOn(matchesApi, 'fetchMatchPlayers').mockResolvedValue({
      count: 0,
      players: [],
      cancelReason: 'Minimum player count not reached before match start time.',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={{
              ...mockFarMatch,
              status: 'cancelled',
              cancelReason: 'Minimum player count not reached before match start time.',
            }}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const rewardTabBtn = screen.getByTestId('tab-reward');
    fireEvent.click(rewardTabBtn);

    await waitFor(() => {
      const cancelReasonCard = screen.getByTestId('reward-tab-cancelled-reason');
      expect(cancelReasonCard).toBeInTheDocument();
      expect(cancelReasonCard.textContent).toContain('Minimum player count not reached before match start time.');
    });
  });

  it('does NOT show REWARD button in upcoming and live matches', () => {
    // 1. Upcoming match
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={{ ...mockFarMatch, status: 'upcoming' }}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('tab-rules')).toBeInTheDocument();
    expect(screen.getByTestId('tab-players')).toBeInTheDocument();
    expect(screen.getByTestId('tab-prize-pool')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-reward')).not.toBeInTheDocument();

    // 2. Live match
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={{ ...mockFarMatch, status: 'live' }}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('tab-rules')).toBeInTheDocument();
    expect(screen.getByTestId('tab-players')).toBeInTheDocument();
    expect(screen.getByTestId('tab-prize-pool')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-reward')).not.toBeInTheDocument();
  });

  it('displays match ID after the team mode in the banner heading', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={{ ...mockFarMatch, id: '99', gameMode: 'battle_royale', teamMode: 'duo' }}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Battle Royale | DUO | BW-MCH-99');
  });

  it('displays selected map name in the MatchDetailModal banner and MatchesList card', async () => {
    const customMapMatch: matchesApi.MatchUserDto = {
      ...mockFarMatch,
      id: '55',
      mapName: 'Purgatory',
      map: 'Purgatory',
    };

    // 1. In MatchDetailModal
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={customMapMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('match-map-name')).toHaveTextContent('Purgatory');
    unmount();

    // 2. In MatchesList
    vi.spyOn(matchesApi, 'fetchMatches').mockResolvedValue([customMapMatch]);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchesList statusTab="upcoming" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Purgatory')).toBeInTheDocument();
    });
  });
});

