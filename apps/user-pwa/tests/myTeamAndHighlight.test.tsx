/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatchDetailModal } from '../src/components/matches/MatchDetailModal.js';
import * as matchesApi from '../src/api/matches.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import * as InvitesContextModule from '../src/context/InvitesContext.js';

describe('My Team Box & Table Row Highlighting', () => {
  let queryClient: QueryClient;

  const baseMatch: matchesApi.MatchUserDto = {
    id: '101',
    gameMode: 'br',
    teamMode: 'solo',
    entryFee: '10.00',
    joinedPlayers: 1,
    maxPlayers: 48,
    status: 'upcoming',
    hasJoined: true,
    isInTeam: false,
    prizes: {
      killPrice: '5.00',
      positions: { '1': '40.00' },
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'u1', name: 'Sujoy', ffName: 'Gamer', ffId: '123548' } as any,
      wallets: { total: '100.00' } as any,
      refreshProfile: vi.fn(),
    });
    vi.spyOn(InvitesContextModule, 'useInvites').mockReturnValue({
      refetchInvites: vi.fn(),
    } as any);
  });

  it('renders "My Team" box for Solo with only the user name Gamer', () => {
    const soloMatch: matchesApi.MatchUserDto = {
      ...baseMatch,
      teamMode: 'solo',
      hasJoined: true,
      isInTeam: false,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={soloMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const teamBox = screen.getByTestId('my-team-section');
    expect(teamBox).toBeInTheDocument();
    expect(teamBox.textContent).toContain('Gamer');
    expect(teamBox.textContent).not.toContain('(Team Leader)');
    expect(screen.queryByTestId('team-changes-rule-note')).not.toBeInTheDocument();
  });

  it('renders "My Team" box for Duo with leader and Gamer', async () => {
    const duoMatch: matchesApi.MatchUserDto = {
      ...baseMatch,
      teamMode: 'duo',
      hasJoined: true,
      isInTeam: true,
      isTeamLeader: false,
    };

    vi.spyOn(matchesApi, 'fetchMyTeam').mockResolvedValue({
      id: 't1',
      name: 'Alpha',
      size: 2,
      status: 'confirmed',
      isLeader: false,
      replaceCount: 0,
      members: [
        {
          userId: 'u2',
          name: 'Rohit',
          ffName: 'kingrohit',
          ffId: '998877',
          isLeader: true,
          status: 'confirmed',
        },
        {
          userId: 'u1',
          name: 'Sujoy',
          ffName: 'Gamer',
          ffId: '123548',
          isLeader: false,
          status: 'confirmed',
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={duoMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const teamBox = screen.getByTestId('my-team-section');
      expect(screen.getByTestId('my-team-name-title').textContent).toBe('Alpha');
      expect(teamBox.textContent).toContain('1. kingrohit (Team Leader)');
      expect(teamBox.textContent).toContain('2. Gamer (You)');
    });
  });

  it('renders "My Team" box for Squad with leader and all squad members', async () => {
    const squadMatch: matchesApi.MatchUserDto = {
      ...baseMatch,
      teamMode: 'squad',
      hasJoined: true,
      isInTeam: true,
      isTeamLeader: false,
    };

    vi.spyOn(matchesApi, 'fetchMyTeam').mockResolvedValue({
      id: 't2',
      name: 'Omega',
      size: 4,
      status: 'confirmed',
      isLeader: false,
      replaceCount: 0,
      members: [
        {
          userId: 'u3',
          name: 'Kiko',
          ffName: 'kiko_speedo',
          ffId: '111111',
          isLeader: true,
          status: 'confirmed',
        },
        {
          userId: 'u1',
          name: 'Sujoy',
          ffName: 'Gamer',
          ffId: '123548',
          isLeader: false,
          status: 'confirmed',
        },
        {
          userId: 'u4',
          name: 'Riya',
          ffName: 'RiyaGamming',
          ffId: '222222',
          isLeader: false,
          status: 'confirmed',
        },
        {
          userId: 'u5',
          name: 'Soumik',
          ffName: 'IndSoumik',
          ffId: '333333',
          isLeader: false,
          status: 'confirmed',
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={squadMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const teamBox = screen.getByTestId('my-team-section');
      expect(screen.getByTestId('my-team-name-title').textContent).toBe('Omega');
      expect(teamBox.textContent).toContain('1. kiko_speedo (Team Leader)');
      expect(teamBox.textContent).toContain('2. Gamer (You)');
      expect(teamBox.textContent).toContain('3. RiyaGamming');
      expect(teamBox.textContent).toContain('4. IndSoumik');
    });
  });

  it('highlights the user team row in PLAYERS and REWARD sections', async () => {
    const completedDuoMatch: matchesApi.MatchUserDto = {
      ...baseMatch,
      teamMode: 'duo',
      status: 'completed',
      hasJoined: true,
      isInTeam: true,
      isTeamLeader: false,
    };

    vi.spyOn(matchesApi, 'fetchMatchPlayers').mockResolvedValue({
      count: 4,
      players: [
        {
          team: 1,
          position: 'A',
          name: 'Kingrohitt',
          teamName: 'Sujoy and Su...',
          kills: 1,
          matchPosition: 1,
          payout: '20.00',
          teamPayout: '40.00',
        },
        {
          team: 1,
          position: 'B',
          name: 'Gamer',
          teamName: 'Sujoy and Su...',
          kills: 1,
          matchPosition: 1,
          payout: '20.00',
          teamPayout: '40.00',
        },
        {
          team: 2,
          position: 'A',
          name: 'kingrohit',
          teamName: 'Dip and Riya',
          kills: 0,
          matchPosition: 2,
          payout: '0.00',
          teamPayout: '0.00',
        },
        {
          team: 2,
          position: 'B',
          name: 'Riya_Sh...',
          teamName: 'Dip and Riya',
          kills: 0,
          matchPosition: 2,
          payout: '0.00',
          teamPayout: '0.00',
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={completedDuoMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Switch to Players tab and verify highlighted row
    const playersTabBtn = screen.getByTestId('tab-players');
    fireEvent.click(playersTabBtn);

    await waitFor(() => {
      const highlightedRow = screen.getByTestId('my-team-players-row');
      expect(highlightedRow).toBeInTheDocument();
      expect(highlightedRow.textContent).toContain('Team: 1');
      expect(highlightedRow.textContent).toContain('Sujoy and Su...');
      expect(highlightedRow.textContent).toContain('My Team');
      expect(highlightedRow.textContent).toContain('Gamer');
      expect(highlightedRow.textContent).toContain('(You)');
    });

    // 2. Switch to Reward tab and verify highlighted row
    const rewardTabBtn = screen.getByTestId('tab-reward');
    fireEvent.click(rewardTabBtn);

    await waitFor(() => {
      const highlightedRewardRow = screen.getByTestId('my-team-reward-row');
      expect(highlightedRewardRow).toBeInTheDocument();
      expect(highlightedRewardRow.textContent).toContain('Team: 1');
      expect(highlightedRewardRow.textContent).toContain('Sujoy and Su...');
      expect(highlightedRewardRow.textContent).toContain('My Team');
      expect(highlightedRewardRow.textContent).toContain('Gamer');
      expect(highlightedRewardRow.textContent).toContain('(You)');
    });
  });
});
