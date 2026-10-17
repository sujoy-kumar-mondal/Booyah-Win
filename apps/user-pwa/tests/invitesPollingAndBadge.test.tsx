import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvitesProvider, useInvites } from '../src/context/InvitesContext.js';
import { BottomNav } from '../src/components/layout/BottomNav.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import * as matchesApi from '../src/api/matches.js';
import { userTeamInvitesResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 5: Invites Polling & Badge Visibility Rules', () => {
  let queryClient: QueryClient;

  const pendingInvites = loadContractFixture(
    'GET_api_v1_me_team-invites__pending.json',
    userTeamInvitesResponseGuard,
    'GET /api/v1/me/team-invites'
  ).invites;

  const emptyInvites = loadContractFixture(
    'GET_api_v1_me_team-invites__empty.json',
    userTeamInvitesResponseGuard,
    'GET /api/v1/me/team-invites'
  ).invites;

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      token: 'test-token',
    } as any);

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('Requirement 5: does not show invite badge on BottomNav as invitation mechanism is removed', async () => {
    const fetchSpy = vi.spyOn(matchesApi, 'fetchTeamInvites').mockResolvedValueOnce(pendingInvites);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InvitesProvider>
            <BottomNav />
          </InvitesProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await Promise.resolve();
    });

    // Invitation mechanism removed from UI: no badge on matches
    expect(screen.queryByTestId('nav-badge-matches')).toBeNull();
  });

  it('Requirement 5: polls invite count every 60 seconds while tab is visible', async () => {
    const fetchSpy = vi.spyOn(matchesApi, 'fetchTeamInvites').mockResolvedValue(pendingInvites);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InvitesProvider>
            <BottomNav />
          </InvitesProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Allow initial fetch to complete
    await act(async () => {
      await Promise.resolve();
    });

    // Fast-forward 60s
    await act(async () => {
      vi.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Fast-forward another 60s
    await act(async () => {
      vi.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('Requirement 5: pauses invite polling when document visibility is hidden', async () => {
    const fetchSpy = vi.spyOn(matchesApi, 'fetchTeamInvites').mockResolvedValue(pendingInvites);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InvitesProvider>
            <BottomNav />
          </InvitesProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Set document hidden
    Object.defineProperty(document, 'visibilityState', { value: 'hidden' });

    // Advance 60s
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });

    // Should NOT have made any new requests while hidden
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('Requirement 5: pauses invite polling when browser is offline', async () => {
    const fetchSpy = vi.spyOn(matchesApi, 'fetchTeamInvites').mockResolvedValue(pendingInvites);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InvitesProvider>
            <BottomNav />
          </InvitesProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Set navigator offline
    Object.defineProperty(navigator, 'onLine', { value: false });

    // Advance 60s
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });

    // Should NOT have made any new requests while offline
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('Requirement 5: refetches invite count after relevant team actions', async () => {
    const fetchSpy = vi
      .spyOn(matchesApi, 'fetchTeamInvites')
      .mockResolvedValueOnce(pendingInvites)
      .mockResolvedValueOnce(emptyInvites);

    let testRefetch: any;
    const TestConsumer = () => {
      const { refetchInvites, pendingCount } = useInvites();
      testRefetch = refetchInvites;
      return <div data-testid="count">{pendingCount}</div>;
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InvitesProvider>
            <TestConsumer />
          </InvitesProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('count').textContent).toBe('1');

    // Trigger action refetch
    await act(async () => {
      await testRefetch();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('count').textContent).toBe('0');
  });
});
