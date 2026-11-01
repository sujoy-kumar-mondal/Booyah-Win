import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeamFormModal } from '../src/components/matches/TeamFormModal.js';
import { TeamManageModal } from '../src/components/matches/TeamManageModal.js';
import { MatchDetailModal } from '../src/components/matches/MatchDetailModal.js';
import * as matchesApi from '../src/api/matches.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import * as InvitesContextModule from '../src/context/InvitesContext.js';
import { ApiError } from '../src/api/client.js';
import { userMatchDetailResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 6: Team Cutoff Rule & Server Decision', () => {
  let queryClient: QueryClient;

  const mockDuoMatch = loadContractFixture(
    'GET_api_v1_matches_id__joined.json',
    userMatchDetailResponseGuard,
    'GET /api/v1/matches/:id'
  ).match;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: '1', name: 'Leader', ffId: '12345678' } as any,
      wallets: { total: '100.00' } as any,
      refreshProfile: vi.fn(),
    });
    vi.spyOn(InvitesContextModule, 'useInvites').mockReturnValue({
      refetchInvites: vi.fn(),
    } as any);
  });

  it('Requirement 6: displays cutoff as a rule ("team changes close 10 minutes before the start")', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TeamFormModal
            match={mockDuoMatch}
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const ruleEl = screen.getByTestId('team-cutoff-rule');
    expect(ruleEl.textContent).toContain(
      'Notice: Team changes close 10 minutes before the start'
    );
  });

  it('Requirement 6: keeps team action buttons clickable and allows server MATCH_NOT_JOINABLE to decide', async () => {
    vi.spyOn(matchesApi, 'replaceTeamInvite').mockRejectedValueOnce(
      new ApiError('MATCH_NOT_JOINABLE', 'Match is closed')
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TeamManageModal
            matchId={mockDuoMatch.id}
            isOpen={true}
            mode="replace"
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Rule is visible
    expect(screen.getByTestId('team-manage-cutoff-rule').textContent).toContain(
      'Rule: Team changes close 10 minutes before the start'
    );

    // Fill form and click Replace button (stays clickable despite device clock)
    fireEvent.change(screen.getByTestId('old-ffid-input'), { target: { value: '111111' } });
    fireEvent.change(screen.getByTestId('new-ffid-input'), { target: { value: '222222' } });

    const replaceBtn = screen.getByTestId('confirm-replace-btn');
    expect(replaceBtn).not.toBeDisabled();
    fireEvent.click(replaceBtn);

    await waitFor(() => {
      const errorEl = screen.getByTestId('manage-modal-error');
      expect(errorEl.textContent).toContain('Registration for this match is closed (10-minute cutoff reached).');
    });
  });

  it('Requirement: displays Total Team Fee as Rs50.00 (single fee) for Clash Squad squad team', () => {
    const mockCsMatch = {
      ...mockDuoMatch,
      gameMode: 'clash_squad',
      teamMode: 'squad',
      entryFee: '50.00',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TeamFormModal
            match={mockCsMatch}
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Shows Team Entry Fee Rs50.00 and Total Team Fee Rs50.00 (not Rs200.00)
    expect(screen.getByText('Team Entry Fee')).toBeInTheDocument();
    expect(screen.getByText('Total Team Fee')).toBeInTheDocument();
    const teamFeeAmounts = screen.getAllByText('Rs50.00');
    expect(teamFeeAmounts.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Rs200.00')).not.toBeInTheDocument();
  });

  it('Requirement: only team leader sees Replace Teammate button; member sees note', () => {
    // 1. Leader renders Replace Teammate button
    const leaderMatch = {
      ...mockDuoMatch,
      status: 'upcoming',
      hasJoined: true,
      isInTeam: true,
      isTeamLeader: true,
    };

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={leaderMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('team-role-badge').textContent).toBe('Team Leader');
    expect(screen.getByTestId('open-replace-teammate-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('member-no-replace-note')).not.toBeInTheDocument();
    unmount();

    // 2. Member does NOT render Replace Teammate button
    const memberMatch = {
      ...mockDuoMatch,
      status: 'upcoming',
      hasJoined: true,
      isInTeam: true,
      isTeamLeader: false,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={memberMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('team-role-badge').textContent).toBe('Team Member');
    expect(screen.queryByTestId('open-replace-teammate-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('member-no-replace-note')).toBeInTheDocument();
    expect(screen.getByTestId('member-no-replace-note').textContent).toBe('Only team leader can change teammate.');
  });

  it('Requirement: team changes close if replaced once or within 10 minutes cutoff', () => {
    // 1. Leader renders disabled button when teammate was already replaced once
    const alreadyReplacedMatch = {
      ...mockDuoMatch,
      status: 'upcoming',
      hasJoined: true,
      isInTeam: true,
      isTeamLeader: true,
      hasReplacedTeammate: true,
      canReplaceTeammate: false,
    };

    const { unmount: unmount1 } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={alreadyReplacedMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const replacedBtn = screen.getByTestId('open-replace-teammate-btn');
    expect(replacedBtn).toBeDisabled();
    expect(replacedBtn.textContent).toBe('Team changes closed (Already changed)');
    expect(screen.getByTestId('team-changes-rule-note').textContent).toContain(
      'Team changes close 10 minutes before the start and also if one time changed'
    );
    unmount1();

    // 2. Leader renders disabled button when within 10 minutes of start
    const nearStartMatch = {
      ...mockDuoMatch,
      status: 'upcoming',
      startTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      hasJoined: true,
      isInTeam: true,
      isTeamLeader: true,
      hasReplacedTeammate: false,
      canReplaceTeammate: false,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={nearStartMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const cutoffBtn = screen.getByTestId('open-replace-teammate-btn');
    expect(cutoffBtn).toBeDisabled();
    expect(cutoffBtn.textContent).toBe('Team changes closed (10m before start)');
  });

  it('Requirement: disables Replace Teammate button if team replaceCount >= 1 when match detail opens', async () => {
    vi.spyOn(matchesApi, 'fetchMyTeam').mockResolvedValueOnce({
      id: '1',
      name: 'Alpha Team',
      size: 4,
      status: 'confirmed',
      isLeader: true,
      replaceCount: 1,
      members: [],
    });

    const matchWithNoReplacedFlag = {
      ...mockDuoMatch,
      status: 'upcoming',
      hasJoined: true,
      isInTeam: true,
      isTeamLeader: true,
      hasReplacedTeammate: false,
      canReplaceTeammate: true,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={matchWithNoReplacedFlag}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const replacedBtn = screen.getByTestId('open-replace-teammate-btn');
      expect(replacedBtn).toBeDisabled();
      expect(replacedBtn.textContent).toBe('Team changes closed (Already changed)');
    });
  });

  it('Requirement: checkbox with player in-game name selects teammate to replace and enables corresponding input form', async () => {
    vi.spyOn(matchesApi, 'fetchMyTeam').mockResolvedValue({
      id: '1',
      name: 'Alpha Team',
      size: 4,
      status: 'confirmed',
      isLeader: true,
      replaceCount: 0,
      members: [
        { userId: '1', name: 'Leader User', ffName: 'Leader_Pro', ffId: '111111', isLeader: true, status: 'confirmed' },
        { userId: '2', name: 'Rohan User', ffName: 'Rohan_Pro', ffId: '222222', isLeader: false, status: 'confirmed' },
        { userId: '3', name: 'Rohit User', ffName: 'Kingrohit', ffId: '333333', isLeader: false, status: 'confirmed' },
      ],
    });

    const replaceSpy = vi.spyOn(matchesApi, 'replaceTeamInvite').mockResolvedValue({ message: 'OK' } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TeamManageModal
            matchId={mockDuoMatch.id}
            isOpen={true}
            mode="replace"
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Leader is excluded from teammate replacement list
    expect(screen.queryByText('Leader_Pro')).not.toBeInTheDocument();

    // Teammates Rohan_Pro and Kingrohit are rendered
    await waitFor(() => {
      expect(screen.getByText('Rohan_Pro')).toBeInTheDocument();
      expect(screen.getByText('Kingrohit')).toBeInTheDocument();
    });

    const checkboxRohan = screen.getByTestId('teammate-checkbox-222222') as HTMLInputElement;
    const checkboxRohit = screen.getByTestId('teammate-checkbox-333333') as HTMLInputElement;

    // By default first teammate Rohan_Pro is checked
    expect(checkboxRohan.checked).toBe(true);
    expect(checkboxRohit.checked).toBe(false);

    // Click Kingrohit checkbox to select Kingrohit as well (multiple teammates can be replaced at a time)
    fireEvent.click(checkboxRohit);
    expect(checkboxRohit.checked).toBe(true);
    expect(checkboxRohan.checked).toBe(true);

    // Both Kingrohit and Rohan's input forms are now enabled
    const rohitInput = screen.getByTestId('new-ffid-input-333333') as HTMLInputElement;
    const rohanInput = screen.getByTestId('new-ffid-input') as HTMLInputElement;
    expect(rohitInput).not.toBeDisabled();
    expect(rohanInput).not.toBeDisabled();

    // Mock lookup teammate responses
    vi.spyOn(matchesApi, 'lookupTeammate')
      .mockResolvedValueOnce({
        exists: true,
        ffId: '999999',
        ffName: 'Kabir_Gamer',
        name: 'Kabir',
      })
      .mockResolvedValueOnce({
        exists: true,
        ffId: '888888',
        ffName: 'Aryan_Pro',
        name: 'Aryan',
      });

    // Enter new UIDs into enabled forms for both teammates
    fireEvent.change(rohitInput, { target: { value: '999999' } });
    fireEvent.change(rohanInput, { target: { value: '888888' } });

    // Right-side badge renders verified player name without "matches.verifiedPlayer" label
    await waitFor(() => {
      const badges = screen.getAllByTestId('new-member-ffname-badge');
      expect(badges.length).toBeGreaterThanOrEqual(1);
      const text = badges.map((b) => b.textContent).join(' ');
      expect(text).toContain('Kabir_Gamer');
    });
    expect(screen.queryByText(/verifiedPlayer/i)).not.toBeInTheDocument();

    // Submit replace
    fireEvent.click(screen.getByTestId('confirm-replace-btn'));

    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalledWith(mockDuoMatch.id, {
        oldFfId: '222222',
        newFfId: '888888',
        replacements: [
          { oldFfId: '222222', newFfId: '888888' },
          { oldFfId: '333333', newFfId: '999999' },
        ],
      });
    });
  });
});
