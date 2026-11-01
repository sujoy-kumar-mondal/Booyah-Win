import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/App.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import * as userApi from '../src/api/user.js';
import * as authApi from '../src/api/auth.js';
import { setStoredToken, clearStoredToken } from '../src/api/client.js';
import { getMeGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 7: Landing vs Home & Route Protection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearStoredToken();
  });

  it('unauthenticated users accessing / see the landing page without being redirected to /login', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    // Should stay on / and render landing page
    await waitFor(() => {
      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      expect(screen.getByTestId('landing-register-btn')).toBeInTheDocument();
      expect(screen.getByTestId('landing-login-btn')).toBeInTheDocument();
    });

    // Should NOT be on login screen
    expect(screen.queryByLabelText(/Email Address/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-screen')).not.toBeInTheDocument();
  });

  it('authenticated users accessing / see the home page dashboard with wallet balances', async () => {
    setStoredToken('valid-stored-token');

    vi.spyOn(userApi, 'getMe').mockResolvedValue(
      loadContractFixture('GET_api_v1_me.json', getMeGuard, 'GET /api/v1/me', (data) => {
        data.profile.name = 'Pro Player';
        data.wallets = {
          addMoney: '100.00',
          cashback: '20.00',
          winning: '300.00',
          total: '420.00',
        };
        data.cooldowns = {
          mobileAvailableAt: null,
          ffIdAvailableAt: null,
          ffNameAvailableAt: null,
          upiIdAvailableAt: null,
        };
      })
    );

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('home-screen')).toBeInTheDocument();
      expect(screen.getByText('Pro Player')).toBeInTheDocument();
      expect(screen.getByTestId('total-balance')).toHaveTextContent('Rs420.00');
    });

    // Landing page is not rendered when authenticated
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument();
  });

  it('unauthenticated users attempting to access protected routes like /profile are redirected to /login', async () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    // Should redirect to login screen
    await waitFor(() => {
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Continue with OTP/i })).toBeInTheDocument();
    });
    expect(screen.queryByTestId('profile-screen')).not.toBeInTheDocument();
  });

  it('shows loading state on boot with stored token until GET /me finishes, never flashing protected screen to logged-out user', async () => {
    setStoredToken('existing-stored-token');

    // Create a delayed promise for getMe
    let resolveGetMe: any;
    const getMePromise = new Promise((_, reject) => {
      resolveGetMe = () =>
        reject({
          code: 'UNAUTHENTICATED',
          message: 'Your session has expired. Please log in again.',
        });
    });

    vi.spyOn(userApi, 'getMe').mockReturnValue(getMePromise as any);

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    // Initially while GET /me is in flight, MUST show LoadingScreen
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-screen')).not.toBeInTheDocument();

    // Now resolve getMe with rejection (invalid/expired session)
    resolveGetMe();

    // After session failure on protected route, redirects to /login cleanly without ever having flashed protected screen
    await waitFor(() => {
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('profile-screen')).not.toBeInTheDocument();
  });

  it('unauthenticated users with expired stored token on boot accessing / see the landing page and NOT the session expired modal', async () => {
    setStoredToken('expired-stale-token');

    vi.spyOn(userApi, 'getMe').mockRejectedValue({
      code: 'UNAUTHENTICATED',
      message: 'Your session has expired. Please log in again.',
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      expect(screen.getByTestId('landing-register-btn')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('session-replaced-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-screen')).not.toBeInTheDocument();
  });

  it('shows proper error message when an unregistered user attempts to log in', async () => {
    vi.spyOn(authApi, 'requestLoginOtp').mockResolvedValue({
      message: 'If this email is registered, an OTP has been sent',
      registered: false,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/Email Address/i);
    fireEvent.change(emailInput, { target: { value: 'notfound@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /Continue with OTP/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText('No account found with this email. Please create an account first.')
      ).toBeInTheDocument();
    });

    // Should NOT transition to OTP step
    expect(screen.queryByText(/Security Code \(OTP\)/i)).not.toBeInTheDocument();
  });

  it('allows unauthenticated users to access allowed routes and redirects other routes to /login', async () => {
    // 1. Allowed routes do NOT redirect to /login
    const allowedRoutes = [
      '/',
      '/important-updates',
      '/support',
      '/register',
      '/matches',
      '/matches?tab=live',
      '/matches?tab=history',
      '/matches/BW-MCH-1',
      '/leaderboard',
      '/community',
      '/about',
      '/privacy',
      '/account',
    ];

    for (const route of allowedRoutes) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      );
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
      unmount();
    }

    // 2. Blocked routes DO redirect to /login
    const blockedRoutes = [
      '/notifications',
      '/wallet',
      '/wallet/add',
      '/wallet/withdraw',
      '/wallet/history',
      '/account/profile',
      '/account/game-uid',
      '/account/statistics',
      '/referral',
      '/non-existent-route',
    ];

    for (const route of blockedRoutes) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue with OTP/i })).toBeInTheDocument();
      });
      unmount();
    }
  });

  it('single-page login flow keeps email input visible and mounts OTP verification on the same card', async () => {
    vi.spyOn(authApi, 'requestLoginOtp').mockResolvedValue({
      message: 'OTP sent successfully',
      registered: true,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'player@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /Continue with OTP/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Security Code \(OTP\)/i)).toBeInTheDocument();
    });

    // Email Address field remains visible on the SAME page
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(emailInput.value).toBe('player@example.com');
    expect(screen.getByTestId('login-change-email-btn')).toBeInTheDocument();

    // Clicking Change Email resets to editable email state on the same page
    fireEvent.click(screen.getByTestId('login-change-email-btn'));
    expect(screen.queryByText(/Security Code \(OTP\)/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue with OTP/i })).toBeInTheDocument();
  });
});
