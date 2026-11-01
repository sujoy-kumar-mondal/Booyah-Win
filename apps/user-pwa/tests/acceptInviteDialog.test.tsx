import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeamInvites } from '../src/components/matches/TeamInvites.js';
import * as InvitesContextModule from '../src/context/InvitesContext.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import * as matchesApi from '../src/api/matches.js';
import { userTeamInvitesResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 4: Team Invite Confirmation Dialog', () => {
  let queryClient: QueryClient;

  const mockInvites = loadContractFixture(
    'GET_api_v1_me_team-invites__pending.json',
    userTeamInvitesResponseGuard,
    'GET /api/v1/me/team-invites'
  ).invites;

  const mockInvite = mockInvites[0];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      refreshProfile: vi.fn(),
    } as any);
    vi.spyOn(InvitesContextModule, 'useInvites').mockReturnValue({
      invites: mockInvites,
      pendingCount: 1,
      isLoading: false,
      refetchInvites: vi.fn(),
    });
  });

  it('Requirement 4: clicking accept opens confirm dialog with exact fee and match start time', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TeamInvites />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const acceptBtn = screen.getByTestId(`accept-invite-btn-${mockInvite.id}`);
    fireEvent.click(acceptBtn);

    const dialog = screen.getByTestId('accept-confirm-dialog');
    expect(dialog).toBeInTheDocument();

    const feeEl = screen.getByTestId('dialog-exact-fee');
    expect(feeEl.textContent).toContain('Rs20.00');

    const timeEl = screen.getByTestId('dialog-start-time');
    expect(timeEl.textContent).toBeTruthy();
  });

  it('Requirement 4: confirm dialog has double-tap guard preventing duplicate submissions', async () => {
    let resolveAccept: any;
    const acceptPromise = new Promise<{ message: string }>((res) => {
      resolveAccept = res;
    });
    const acceptSpy = vi.spyOn(matchesApi, 'acceptTeamInvite').mockReturnValueOnce(acceptPromise);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TeamInvites />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const openBtn = screen.getByTestId(`accept-invite-btn-${mockInvite.id}`);
    fireEvent.click(openBtn);

    const confirmBtn = screen.getByTestId('confirm-accept-btn');
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn); // rapid second tap

    expect(acceptSpy).toHaveBeenCalledTimes(1);
    resolveAccept({ message: 'Invite accepted' });
  });

  it('Requirement 4: displays server result message after successful accept and refetches invites', async () => {
    const refetchSpy = vi.fn();
    vi.spyOn(InvitesContextModule, 'useInvites').mockReturnValue({
      invites: mockInvites,
      pendingCount: 1,
      isLoading: false,
      refetchInvites: refetchSpy,
    });

    vi.spyOn(matchesApi, 'acceptTeamInvite').mockResolvedValueOnce({
      message: 'Invite accepted successfully!',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TeamInvites />
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByTestId(`accept-invite-btn-${mockInvite.id}`));
    fireEvent.click(screen.getByTestId('confirm-accept-btn'));

    await waitFor(() => {
      const resultBanner = screen.getByTestId('invite-action-result-success');
      expect(resultBanner.textContent).toContain('Invite accepted successfully!');
      expect(refetchSpy).toHaveBeenCalled();
    });
  });
});
