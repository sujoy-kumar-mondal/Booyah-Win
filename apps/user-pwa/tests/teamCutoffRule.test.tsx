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
});
