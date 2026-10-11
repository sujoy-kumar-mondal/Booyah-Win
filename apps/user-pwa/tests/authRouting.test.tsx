import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/App.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import * as userApi from '../src/api/user.js';
import { setStoredToken, clearStoredToken } from '../src/api/client.js';

describe('Requirement 7: Route Protection & Zero-Flash Loading State', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearStoredToken();
  });

  it('unauthenticated users attempting to access / or /profile are redirected to /login', async () => {
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
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    // Initially while GET /me is in flight, MUST show LoadingScreen
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('home-screen')).not.toBeInTheDocument();

    // Now resolve getMe with rejection (invalid/expired session)
    resolveGetMe();

    // After session failure, redirects to /login cleanly without ever having flashed /
    await waitFor(() => {
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('home-screen')).not.toBeInTheDocument();
  });

  it('renders protected screen after successful GET /me on boot with stored token', async () => {
    setStoredToken('valid-stored-token');

    vi.spyOn(userApi, 'getMe').mockResolvedValue({
      profile: {
        id: '1',
        email: 'player@example.com',
        name: 'Pro Player',
        mobile: '9876543210',
        ffId: '12345678',
        ffName: 'ProPlayerIGN',
        upiId: 'pro@upi',
        dateOfBirth: '2000-01-01',
        referralCode: 'REF123',
        referredBy: null,
        createdAt: '2026-10-01T00:00:00.000Z',
      },
      wallets: {
        addMoney: '100.00',
        cashback: '20.00',
        winning: '300.00',
        total: '420.00',
      },
      cooldowns: {
        mobileAvailableAt: null,
        ffIdAvailableAt: null,
        ffNameAvailableAt: null,
        upiIdAvailableAt: null,
      },
    });

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
  });
});
