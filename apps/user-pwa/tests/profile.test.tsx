import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Profile } from '../src/pages/Profile.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import * as userApi from '../src/api/user.js';
import { setStoredToken, ApiError } from '../src/api/client.js';

describe('Requirement 8: Profile Edits (Changed Fields Only & Field Error Display)', () => {
  const mockUser = {
    id: '1',
    email: 'player@example.com',
    name: 'Player One',
    mobile: '9876543210',
    ffId: '11223344',
    ffName: 'OldIGN',
    upiId: 'player@upi',
    dateOfBirth: '2000-01-01',
    referralCode: 'REF999',
    referredBy: null,
    createdAt: '2026-10-01T00:00:00.000Z',
  };

  const mockWallets = {
    addMoney: '50.00',
    cashback: '10.00',
    winning: '200.00',
    total: '260.00',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    setStoredToken('test-token');
  });

  it('renders locked fields disabled with explanatory notes', async () => {
    vi.spyOn(userApi, 'getMe').mockResolvedValue({
      profile: mockUser,
      wallets: mockWallets,
      cooldowns: {
        mobileAvailableAt: null,
        ffIdAvailableAt: null,
        ffNameAvailableAt: null,
        upiIdAvailableAt: null,
      },
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Profile />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Player Profile')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('Player One')).toBeDisabled();
    expect(screen.getByText(/Name cannot be changed after registration/i)).toBeInTheDocument();

    expect(screen.getByDisplayValue('player@example.com')).toBeDisabled();
    expect(screen.getByText(/Email is permanently linked to your account/i)).toBeInTheDocument();
  });

  it('Requirement 8: submits ONLY changed fields to PATCH /me/profile', async () => {
    vi.spyOn(userApi, 'getMe').mockResolvedValue({
      profile: mockUser,
      wallets: mockWallets,
      cooldowns: {
        mobileAvailableAt: null,
        ffIdAvailableAt: null,
        ffNameAvailableAt: null,
        upiIdAvailableAt: null,
      },
    });

    const updateProfileSpy = vi.spyOn(userApi, 'updateProfile').mockResolvedValue({
      profile: { ...mockUser, ffName: 'NewAwesomeIGN' },
      wallets: mockWallets,
      cooldowns: {
        mobileAvailableAt: null,
        ffIdAvailableAt: null,
        ffNameAvailableAt: new Date(Date.now() + 86400000).toISOString(),
        upiIdAvailableAt: null,
      },
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Profile />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('OldIGN')).toBeInTheDocument();
    });

    // Change ONLY the Free Fire Name
    const ffNameInput = screen.getByDisplayValue('OldIGN');
    fireEvent.change(ffNameInput, { target: { value: 'NewAwesomeIGN' } });

    // Submit the form
    const saveButton = screen.getByRole('button', { name: /Save Profile Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateProfileSpy).toHaveBeenCalledTimes(1);
    });

    // Proves ONLY ffName was sent, NOT mobile, ffId, or upiId
    expect(updateProfileSpy).toHaveBeenCalledWith({
      ffName: 'NewAwesomeIGN',
    });
  });

  it('Requirement 8: displays server errors directly under the corresponding field', async () => {
    vi.spyOn(userApi, 'getMe').mockResolvedValue({
      profile: mockUser,
      wallets: mockWallets,
      cooldowns: {
        mobileAvailableAt: null,
        ffIdAvailableAt: null,
        ffNameAvailableAt: null,
        upiIdAvailableAt: null,
      },
    });

    vi.spyOn(userApi, 'updateProfile').mockRejectedValue(
      new ApiError('MOBILE_EXISTS', 'Mobile already in use')
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <Profile />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('9876543210')).toBeInTheDocument();
    });

    const mobileInput = screen.getByDisplayValue('9876543210');
    fireEvent.change(mobileInput, { target: { value: '9876543211' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Profile Changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/This mobile number is already in use/i)).toBeInTheDocument();
    });
  });

  it('displays IN_ACTIVE_MATCH message next to Free Fire fields when user is in an active match', async () => {
    vi.spyOn(userApi, 'getMe').mockResolvedValue({
      profile: mockUser,
      wallets: mockWallets,
      cooldowns: {
        mobileAvailableAt: null,
        ffIdAvailableAt: null,
        ffNameAvailableAt: null,
        upiIdAvailableAt: null,
      },
    });

    vi.spyOn(userApi, 'updateProfile').mockRejectedValue(
      new ApiError('IN_ACTIVE_MATCH', 'Cannot edit during active match')
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <Profile />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('OldIGN')).toBeInTheDocument();
    });

    const ffNameInput = screen.getByDisplayValue('OldIGN');
    fireEvent.change(ffNameInput, { target: { value: 'UpdatedIGN' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Profile Changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Cannot change Free Fire details while enrolled in an upcoming or live match/i)
      ).toBeInTheDocument();
    });
  });

  it('disables input and displays cooldown message in IST when field cooldown is active', async () => {
    const futureIso = '2026-10-25T14:30:00.000Z'; // 25 Oct 2026, 08:00 PM IST
    vi.spyOn(userApi, 'getMe').mockResolvedValue({
      profile: mockUser,
      wallets: mockWallets,
      cooldowns: {
        mobileAvailableAt: futureIso,
        ffIdAvailableAt: null,
        ffNameAvailableAt: null,
        upiIdAvailableAt: null,
      },
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Profile />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('mobile-cooldown-msg')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mobile-cooldown-msg')).toHaveTextContent(/Next change available on/i);
    expect(screen.getByDisplayValue('9876543210')).toBeDisabled();
  });
});
