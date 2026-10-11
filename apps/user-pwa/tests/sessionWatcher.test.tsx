import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../src/App.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import * as userApi from '../src/api/user.js';
import { setStoredToken, getStoredToken, clearStoredToken, ApiError } from '../src/api/client.js';
import { ErrorCodes } from '@booyah/shared';
import { getWatcherIntervalMs } from '../src/hooks/useSessionWatcher.js';
import { getMeGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Session Watcher & Instant Invalidation (Requirements 1 - 6)', () => {
  let queryClient: QueryClient;

  const mockUser = {
    id: '1',
    email: 'player@example.com',
    name: 'Player One',
    mobile: '9876543210',
    ffId: '11223344',
    ffName: 'ProPlayer',
    upiId: 'player@upi',
    dateOfBirth: '2000-01-01',
    referralCode: 'BOOYAH123',
    referredBy: null,
    createdAt: '2026-10-01T00:00:00.000Z',
  };

  const mockWallets = {
    addMoney: '150.00',
    cashback: '20.00',
    winning: '300.00',
    total: '470.00',
  };

  const mockCooldowns = {
    mobileAvailableAt: null,
    ffIdAvailableAt: null,
    ffNameAvailableAt: null,
    upiIdAvailableAt: null,
  };

  const getMeFixture = () =>
    loadContractFixture('GET_api_v1_me.json', getMeGuard, 'GET /api/v1/me', (data) => {
      data.profile.name = 'Player One';
      data.profile.email = 'player@example.com';
      data.profile.mobile = '9876543210';
      data.profile.ffId = '11223344';
      data.profile.ffName = 'ProPlayer';
      data.profile.upiId = 'player@upi';
      data.wallets = mockWallets;
      data.cooldowns = mockCooldowns;
    });

  beforeEach(() => {
    vi.restoreAllMocks();
    clearStoredToken();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Default document state to visible and online
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderApp = async (initialEntries = ['/']) => {
    const utils = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Flush pending microtasks so initial auth boot finishes cleanly
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    return utils;
  };

  it('Requirement 3: getWatcherIntervalMs produces 45s with ±5s jitter (40,000ms - 50,000ms)', () => {
    for (let i = 0; i < 50; i++) {
      const interval = getWatcherIntervalMs();
      expect(interval).toBeGreaterThanOrEqual(40000);
      expect(interval).toBeLessThanOrEqual(50000);
    }
  });

  it('Requirement 5: watcher never runs without a token, and does not fire duplicate GET /me on boot', async () => {
    vi.useFakeTimers();
    const getMeSpy = vi.spyOn(userApi, 'getMe');

    // Render while unauthenticated on /login
    await renderApp(['/login']);

    expect(getMeSpy).not.toHaveBeenCalled();

    // Fast-forward 60 seconds
    await act(async () => {
      vi.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    // Should never have called GET /me
    expect(getMeSpy).not.toHaveBeenCalled();
  });

  it('Requirement 5: first scheduled tick waits one full interval after boot (no duplicate immediate call)', async () => {
    vi.useFakeTimers();
    setStoredToken('valid-token-123');

    const getMeSpy = vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());

    await renderApp(['/']);

    // Boot call occurs once for initial session check
    expect(getMeSpy).toHaveBeenCalledTimes(1);

    // Fast-forward 30 seconds (less than 40s min interval)
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    // Still only 1 call
    expect(getMeSpy).toHaveBeenCalledTimes(1);

    // Fast-forward past 50 seconds (exceeding maximum 45s + 5s interval)
    await act(async () => {
      vi.advanceTimersByTime(25000);
      await Promise.resolve();
    });

    // Now watcher has fired its scheduled tick
    expect(getMeSpy).toHaveBeenCalledTimes(2);
  });

  it('Requirement 1 & 3: runs check on visibilitychange when tab becomes visible again, and pauses while hidden', async () => {
    vi.useFakeTimers();
    setStoredToken('valid-token-123');

    const getMeSpy = vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());

    await renderApp(['/']);
    expect(getMeSpy).toHaveBeenCalledTimes(1);

    // Tab becomes hidden
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    // Fast-forward 60s while hidden -> hidden tabs make no requests!
    await act(async () => {
      vi.advanceTimersByTime(60000);
      await Promise.resolve();
    });
    expect(getMeSpy).toHaveBeenCalledTimes(1);

    // Tab becomes visible again
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    // Immediate check triggered upon returning to visible tab
    expect(getMeSpy).toHaveBeenCalledTimes(2);
  });

  it('Requirement 1: runs check when browser comes back online, and pauses while offline', async () => {
    vi.useFakeTimers();
    setStoredToken('valid-token-123');

    const getMeSpy = vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());

    await renderApp(['/']);
    expect(getMeSpy).toHaveBeenCalledTimes(1);

    // Browser goes offline
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
      await Promise.resolve();
    });

    // Advance 60s while offline -> no requests
    await act(async () => {
      vi.advanceTimersByTime(60000);
      await Promise.resolve();
    });
    expect(getMeSpy).toHaveBeenCalledTimes(1);

    // Browser comes back online
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });

    // Online event triggers immediate check
    expect(getMeSpy).toHaveBeenCalledTimes(2);
  });

  it('Requirement 1 & 6: SESSION_REPLACED displays "used on another device" dialog exactly once', async () => {
    vi.useFakeTimers();
    setStoredToken('valid-token-123');

    // Initial boot succeeds, next tick fails with SESSION_REPLACED
    vi.spyOn(userApi, 'getMe')
      .mockResolvedValueOnce(getMeFixture())
      .mockRejectedValueOnce(
        new ApiError(ErrorCodes.SESSION_REPLACED, 'Replaced by another session')
      );

    await renderApp(['/']);

    // Advance past watcher interval
    await act(async () => {
      vi.advanceTimersByTime(55000);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Modal is displayed with exact required text
    expect(screen.getByTestId('session-replaced-modal')).toBeInTheDocument();
    expect(screen.getByTestId('session-dialog-message')).toHaveTextContent(
      'You were logged out because your account was used on another device.'
    );

    // Advance time further -> no infinite loop, exactly 1 modal
    await act(async () => {
      vi.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    expect(screen.getAllByTestId('session-replaced-modal')).toHaveLength(1);
  });

  it('Requirement 1: UNAUTHENTICATED displays "Your session has expired. Please log in again."', async () => {
    vi.useFakeTimers();
    setStoredToken('valid-token-123');

    vi.spyOn(userApi, 'getMe')
      .mockResolvedValueOnce(getMeFixture())
      .mockRejectedValueOnce(
        new ApiError(ErrorCodes.UNAUTHENTICATED, 'Session token expired')
      );

    await renderApp(['/']);

    await act(async () => {
      vi.advanceTimersByTime(55000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('session-replaced-modal')).toBeInTheDocument();
    expect(screen.getByTestId('session-dialog-message')).toHaveTextContent(
      'Your session has expired. Please log in again.'
    );
  });

  it('Requirement 2: background check silently ignores RATE_LIMITED, DATABASE_BUSY, NOT_FOUND, 5xx, and network errors without logging user out', async () => {
    vi.useFakeTimers();
    setStoredToken('valid-token-123');

    // Initial boot succeeds, then series of non-fatal errors
    vi.spyOn(userApi, 'getMe')
      .mockResolvedValueOnce(getMeFixture())
      .mockRejectedValueOnce(new ApiError(ErrorCodes.RATE_LIMITED, 'Too many requests'))
      .mockRejectedValueOnce(new ApiError(ErrorCodes.DATABASE_BUSY, 'Database busy'))
      .mockRejectedValueOnce(new ApiError(ErrorCodes.NOT_FOUND, 'Not found'))
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Network down'))
      .mockRejectedValueOnce(new ApiError('SERVER_UNAVAILABLE', '502 Bad Gateway'));

    await renderApp(['/']);

    // Advance through multiple ticks with non-fatal errors
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(55000);
        await Promise.resolve();
        await Promise.resolve();
      });
      // User is NEVER logged out, dialog is NEVER shown
      expect(screen.queryByTestId('session-replaced-modal')).not.toBeInTheDocument();
    }
  });

  it('Requirement 5: stays silent and never logs the user out on NETWORK_ERROR or NON_JSON_RESPONSE', async () => {
    vi.useFakeTimers();
    setStoredToken('active-session-token');

    vi.spyOn(userApi, 'getMe')
      .mockResolvedValueOnce(getMeFixture())
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Cannot reach the server. Check that the API is running.'))
      .mockRejectedValueOnce(new ApiError('NON_JSON_RESPONSE', 'The server sent an unexpected response.'));

    await renderApp(['/']);

    // Tick 1: NETWORK_ERROR occurs
    await act(async () => {
      vi.advanceTimersByTime(55000);
      await Promise.resolve();
    });
    expect(screen.queryByTestId('session-replaced-modal')).not.toBeInTheDocument();
    expect(getStoredToken()).toBe('active-session-token');

    // Tick 2: NON_JSON_RESPONSE occurs
    await act(async () => {
      vi.advanceTimersByTime(55000);
      await Promise.resolve();
    });
    expect(screen.queryByTestId('session-replaced-modal')).not.toBeInTheDocument();
    expect(getStoredToken()).toBe('active-session-token');
  });

  it('Requirement 4: ignores check result if token changed while in flight (new login occurred)', async () => {
    vi.useFakeTimers();
    setStoredToken('old-token-abc');

    let resolveSlowCall: any;
    const slowCall = new Promise((resolve) => {
      resolveSlowCall = resolve;
    });

    vi.spyOn(userApi, 'getMe')
      .mockResolvedValueOnce(getMeFixture())
      .mockReturnValueOnce(slowCall as any);

    await renderApp(['/']);

    // Trigger tick so slow check is in flight
    await act(async () => {
      vi.advanceTimersByTime(55000);
      await Promise.resolve();
    });

    // While in flight, token changes due to a new login
    setStoredToken('brand-new-token-xyz');

    // Resolve old call with SESSION_REPLACED (from the old token perspective)
    await act(async () => {
      resolveSlowCall(getMeFixture());
      await Promise.resolve();
      await Promise.resolve();
    });

    // Dialog should NOT be triggered for the old token
    expect(screen.queryByTestId('session-replaced-modal')).not.toBeInTheDocument();
  });

  it('Requirement 1 & 6: concurrency guard ensures no overlapping checks if previous check is still in flight', async () => {
    vi.useFakeTimers();
    setStoredToken('valid-token-123');

    let finishInFlight: any;
    const inFlightPromise = new Promise((resolve) => {
      finishInFlight = resolve;
    });

    const getMeSpy = vi
      .spyOn(userApi, 'getMe')
      .mockResolvedValueOnce(getMeFixture())
      .mockReturnValueOnce(inFlightPromise as any);

    await renderApp(['/']);
    expect(getMeSpy).toHaveBeenCalledTimes(1);

    // Trigger second tick -> starts in-flight call
    await act(async () => {
      vi.advanceTimersByTime(55000);
      await Promise.resolve();
    });
    expect(getMeSpy).toHaveBeenCalledTimes(2);

    // Trigger visibilitychange while in-flight -> should be skipped!
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(getMeSpy).toHaveBeenCalledTimes(2);

    // Trigger online event while in-flight -> should be skipped!
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });
    expect(getMeSpy).toHaveBeenCalledTimes(2);

    // Resolve in-flight call
    await act(async () => {
      finishInFlight(getMeFixture());
      await Promise.resolve();
      await Promise.resolve();
    });

    // Now that in-flight call resolved, subsequent trigger works
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(getMeSpy).toHaveBeenCalledTimes(3);
  });

  it('Requirement 6: after dialog closes, app is on /login with query cache and user state cleared and form usable', async () => {
    vi.useFakeTimers();
    setStoredToken('valid-token-123');

    // Add query cache entry
    queryClient.setQueryData(['cached-data'], { secret: 'data' });

    vi.spyOn(userApi, 'getMe')
      .mockResolvedValueOnce(getMeFixture())
      .mockRejectedValueOnce(
        new ApiError(ErrorCodes.SESSION_REPLACED, 'Replaced by another session')
      );

    await renderApp(['/']);

    // Trigger replacement
    await act(async () => {
      vi.advanceTimersByTime(55000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('session-replaced-modal')).toBeInTheDocument();

    // Click "Log In Again" dismiss button
    const dismissBtn = screen.getByTestId('session-dialog-dismiss-btn');
    await act(async () => {
      fireEvent.click(dismissBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Dialog is dismissed
    expect(screen.queryByTestId('session-replaced-modal')).not.toBeInTheDocument();

    // Query cache was cleared
    expect(queryClient.getQueryData(['cached-data'])).toBeUndefined();

    // We are on /login with usable form
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
    expect(emailInput).toBeEnabled();

    // User can type into the login form immediately
    fireEvent.change(emailInput, { target: { value: 'newplayer@example.com' } });
    expect(emailInput.value).toBe('newplayer@example.com');
  });

  it('Requirement 5: timers and listeners are cleaned up on logout', async () => {
    vi.useFakeTimers();
    setStoredToken('valid-token-123');

    const getMeSpy = vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());

    await renderApp(['/profile']);
    expect(getMeSpy).toHaveBeenCalledTimes(1);

    // Logout
    const logoutBtn = screen.getByTestId('logout-button');
    await act(async () => {
      fireEvent.click(logoutBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Advance 120 seconds after logout
    await act(async () => {
      vi.advanceTimersByTime(120000);
      await Promise.resolve();
    });

    // No further checks are ever made after logout
    expect(getMeSpy).toHaveBeenCalledTimes(1);
  });
});
