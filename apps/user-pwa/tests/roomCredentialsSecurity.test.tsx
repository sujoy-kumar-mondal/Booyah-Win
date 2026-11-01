import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatchDetailModal } from '../src/components/matches/MatchDetailModal.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import { userMatchDetailResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 12: Room Credentials Security & Cache Eviction', () => {
  let queryClient: QueryClient;

  const mockJoinedLiveMatch = loadContractFixture(
    'GET_api_v1_matches_id__joined.json',
    userMatchDetailResponseGuard,
    'GET /api/v1/matches/:id',
    (data) => {
      data.match.status = 'room_open';
      data.match.hasJoined = true;
      data.match.roomId = '123456';
      data.match.roomPassword = 'SuperSecretPassword';
    }
  ).match;

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: '1' } as any,
      wallets: { total: '100.00' } as any,
      refreshProfile: vi.fn(),
    });

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('Requirement 12: copied state displays Copied! and clears back after a few seconds', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={mockJoinedLiveMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const copyBtn = screen.getByTestId('copy-room-id-btn');
    expect(copyBtn.textContent).toContain('Copy');

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(copyBtn.textContent).toContain('Copied!');

    // Fast forward 2.5 seconds (a few seconds)
    await act(async () => {
      vi.advanceTimersByTime(2500);
    });

    // Cleared back to Copy
    expect(copyBtn.textContent).toContain('Copy');
  });

  it('Requirement 12: room password is not kept in query cache after leaving screen', () => {
    // Prime query cache with match details including password
    queryClient.setQueryData(['match', mockJoinedLiveMatch.id], mockJoinedLiveMatch);
    expect(queryClient.getQueryData(['match', mockJoinedLiveMatch.id])).toBeDefined();

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={mockJoinedLiveMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Unmount modal (leaving screen)
    unmount();

    // Query cache must have evicted the match query so password is not stored
    const cachedData = queryClient.getQueryData(['match', mockJoinedLiveMatch.id]);
    expect(cachedData).toBeUndefined();
  });

  it('Requirement 12: room credentials are masked by default and reveal toggle works', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={mockJoinedLiveMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const passEl = screen.getByTestId('room-password-value');
    expect(passEl.textContent).toBe('••••••••');

    const revealBtn = screen.getByTestId('toggle-reveal-password-btn');
    fireEvent.click(revealBtn);

    expect(passEl.textContent).toBe('SuperSecretPassword');

    // Click again to hide
    fireEvent.click(revealBtn);
    expect(passEl.textContent).toBe('••••••••');
  });

  it('Requirement 12: room password is never logged to console', () => {
    const logSpy = vi.spyOn(console, 'log');
    const infoSpy = vi.spyOn(console, 'info');

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={mockJoinedLiveMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('SuperSecretPassword'));
    expect(infoSpy).not.toHaveBeenCalledWith(expect.stringContaining('SuperSecretPassword'));
  });
});
