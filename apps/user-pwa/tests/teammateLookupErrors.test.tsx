import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeamFormModal } from '../src/components/matches/TeamFormModal.js';
import { TeamManageModal } from '../src/components/matches/TeamManageModal.js';
import * as matchesApi from '../src/api/matches.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import * as InvitesContextModule from '../src/context/InvitesContext.js';
import { ApiError } from '../src/api/client.js';
import { userMatchDetailResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 7: Teammate Lookup Errors Privacy', () => {
  let queryClient: QueryClient;

  const mockMatch = loadContractFixture(
    'GET_api_v1_matches_id__upcoming.json',
    userMatchDetailResponseGuard,
    'GET /api/v1/matches/:id',
    (data) => {
      data.match.teamMode = 'duo';
    }
  ).match;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: '1' } as any,
      refreshProfile: vi.fn(),
    });
    vi.spyOn(InvitesContextModule, 'useInvites').mockReturnValue({
      refetchInvites: vi.fn(),
    } as any);
  });

  it('Requirement 7: displays friendly text for NOT_FOUND error without revealing extra user details', async () => {
    vi.spyOn(matchesApi, 'createTeam').mockRejectedValueOnce(
      new ApiError('NOT_FOUND', 'User with given Free Fire ID does not exist in system')
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TeamFormModal
            match={mockMatch}
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByTestId('member-ffid-input-0'), {
      target: { value: '99999999' },
    });
    fireEvent.click(screen.getByTestId('submit-team-btn'));

    await waitFor(() => {
      const err = screen.getByTestId('team-form-error');
      // Must use friendly text only, revealing NO system internal or user details
      expect(err.textContent).toBe('Player not found.');
    });
  });

  it('Requirement 7: displays friendly text for TEAM_INVALID error without extra wording', async () => {
    vi.spyOn(matchesApi, 'replaceTeamInvite').mockRejectedValueOnce(
      new ApiError('TEAM_INVALID', 'Validation failure details')
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TeamManageModal
            matchId={mockMatch.id}
            isOpen={true}
            mode="replace"
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByTestId('old-ffid-input'), { target: { value: '111111' } });
    fireEvent.change(screen.getByTestId('new-ffid-input'), { target: { value: '222222' } });
    fireEvent.click(screen.getByTestId('confirm-replace-btn'));

    await waitFor(() => {
      const err = screen.getByTestId('manage-modal-error');
      expect(err.textContent).toBe('Invalid team or member replacement.');
    });
  });
});
