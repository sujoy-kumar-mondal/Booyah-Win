import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Leaderboard } from '../src/pages/Leaderboard.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import * as leaderboardApi from '../src/api/leaderboard.js';
import * as userApi from '../src/api/user.js';
import { setStoredToken, clearStoredToken } from '../src/api/client.js';
import { leaderboardResponseGuard, leaderboardRankResponseGuard, getMeGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 6, 7, 8, 9: Leaderboard UI & Polling', () => {
  const getLeaderboardFixture = (mutate?: (data: any) => void) =>
    loadContractFixture(
      'GET_api_v1_leaderboard__populated.json',
      leaderboardResponseGuard,
      'GET /api/v1/leaderboard',
      (data) => {
        data.weekStart = '2026-10-11T18:30:00.000Z'; // Monday 00:00 IST
        data.weekEnd = '2026-10-18T18:29:59.000Z';   // Sunday 23:59 IST
        data.entries = [
          { rank: 1, name: 'ChampionPlayer', winnings: '1500.00' },
          { rank: 2, name: 'SilverSniper', winnings: '1000.00' },
          { rank: 3, name: 'BronzeBrawler', winnings: '750.00' },
          { rank: 4, name: 'FourthPlaceGuy', winnings: '500.00' },
          { rank: 5, name: 'FifthContender', winnings: '300.00' },
        ];
        if (mutate) mutate(data);
      }
    );

  const getMeFixture = () =>
    loadContractFixture('GET_api_v1_me.json', getMeGuard, 'GET /api/v1/me', (data) => {
      data.profile.name = 'Test User';
      data.profile.email = 'test@example.com';
    });

  beforeEach(() => {
    vi.restoreAllMocks();
    clearStoredToken();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Requirement 6: renders Top-3 visual hierarchy with gold, silver, bronze cards and ranks 4-50', async () => {
    vi.spyOn(leaderboardApi, 'getWeeklyLeaderboard').mockResolvedValue(getLeaderboardFixture());

    render(
      <MemoryRouter>
        <AuthProvider>
          <Leaderboard />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('rank-card-1')).toBeInTheDocument();
    });

    // 1st Place Gold Champion Card
    const rank1Card = screen.getByTestId('rank-card-1');
    expect(rank1Card).toHaveTextContent('ChampionPlayer');
    expect(rank1Card).toHaveTextContent('Rank 1 · Champion');
    expect(rank1Card).toHaveTextContent('Rs1,500.00');

    // 2nd Place Silver Card
    const rank2Card = screen.getByTestId('rank-card-2');
    expect(rank2Card).toHaveTextContent('SilverSniper');
    expect(rank2Card).toHaveTextContent('Rank 2');
    expect(rank2Card).toHaveTextContent('Rs1,000.00');

    // 3rd Place Bronze Card
    const rank3Card = screen.getByTestId('rank-card-3');
    expect(rank3Card).toHaveTextContent('BronzeBrawler');
    expect(rank3Card).toHaveTextContent('Rank 3');
    expect(rank3Card).toHaveTextContent('Rs750.00');

    // Ranks 4 to 50 list
    expect(screen.getByTestId('leaderboard-row-4')).toHaveTextContent('FourthPlaceGuy');
    expect(screen.getByTestId('leaderboard-row-4')).toHaveTextContent('Rs500.00');
    expect(screen.getByTestId('leaderboard-row-5')).toHaveTextContent('FifthContender');
    expect(screen.getByTestId('leaderboard-row-5')).toHaveTextContent('Rs300.00');
  });

  it('Requirement 8: displays rules notice and formatted IST week range', async () => {
    vi.spyOn(leaderboardApi, 'getWeeklyLeaderboard').mockResolvedValue(getLeaderboardFixture());

    render(
      <MemoryRouter>
        <AuthProvider>
          <Leaderboard />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Resets every Monday at 12:00 AM IST · Only match winnings count · Ties broken by earlier win/i)
      ).toBeInTheDocument();
    });

    // Verify IST week range format: Mon, 12 Oct – Sun, 18 Oct IST
    expect(screen.getByText(/Mon, 12 Oct – Sun, 18 Oct IST/i)).toBeInTheDocument();
  });

  it('Requirement 7: displays guest header with Login and Register buttons when logged out', async () => {
    vi.spyOn(leaderboardApi, 'getWeeklyLeaderboard').mockResolvedValue(getLeaderboardFixture());

    render(
      <MemoryRouter>
        <AuthProvider>
          <Leaderboard />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('guest-header')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute('href', '/register');

    // Sticky rank bar is completely hidden for logged-out guests
    expect(screen.queryByTestId('my-rank-bar')).not.toBeInTheDocument();
  });

  it('Requirement 7: renders sticky "My Rank" bar when logged in and ranked', async () => {
    setStoredToken('test-token');
    vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());
    vi.spyOn(leaderboardApi, 'getWeeklyLeaderboard').mockResolvedValue(getLeaderboardFixture());
    vi.spyOn(leaderboardApi, 'getUserLeaderboardRank').mockResolvedValue({
      rank: 4,
      winnings: '500.00',
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Leaderboard />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      const myRankBar = screen.getByTestId('my-rank-bar');
      expect(myRankBar).toHaveTextContent('Rank #4');
      expect(myRankBar).toHaveTextContent('Rs500.00');
    });

    // Guest header must be hidden for authenticated users
    expect(screen.queryByTestId('guest-header')).not.toBeInTheDocument();
  });

  it('Requirement 7: shows "Unranked — win a match to enter" when logged in user has no winnings', async () => {
    setStoredToken('test-token');
    vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());
    vi.spyOn(leaderboardApi, 'getWeeklyLeaderboard').mockResolvedValue(getLeaderboardFixture());
    vi.spyOn(leaderboardApi, 'getUserLeaderboardRank').mockResolvedValue(null);

    render(
      <MemoryRouter>
        <AuthProvider>
          <Leaderboard />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('my-rank-bar')).toBeInTheDocument();
    });

    const myRankBar = screen.getByTestId('my-rank-bar');
    expect(myRankBar).toHaveTextContent(/Unranked — win a match to enter/i);
  });

  it('Requirement 9: polls at most once every 60s and pauses when document is hidden', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(leaderboardApi, 'getWeeklyLeaderboard').mockResolvedValue(getLeaderboardFixture());

    render(
      <MemoryRouter>
        <AuthProvider>
          <Leaderboard />
        </AuthProvider>
      </MemoryRouter>
    );

    // Initial fetch on mount
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Advance 30 seconds - should not poll yet
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Advance to 60 seconds - should poll once
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Hide document tab
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Advance another 60 seconds while hidden - polling must NOT fire
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Bring document tab back to visible - should refresh if 60s elapsed
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
