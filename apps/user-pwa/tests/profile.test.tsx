import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Profile } from '../src/pages/Profile.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import * as userApi from '../src/api/user.js';
import { setStoredToken, ApiError } from '../src/api/client.js';
import { getMeGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 8 & Profile Redesign: View Mode, Edit Mode & Avatar Upload', () => {
  const getMeFixture = (mutate?: (data: any) => void) =>
    loadContractFixture('GET_api_v1_me.json', getMeGuard, 'GET /api/v1/me', (data) => {
      data.profile.name = 'Player One';
      data.profile.email = 'player@example.com';
      data.profile.mobile = '9876543210';
      data.profile.ffId = '11223344';
      data.profile.ffName = 'OldIGN';
      data.profile.upiId = 'player@upi';
      data.profile.dateOfBirth = '2000-01-01';
      data.profile.referralCode = 'REF999';
      data.profile.referredBy = null;
      data.profile.avatarUrl = null;
      data.wallets = {
        addMoney: '50.00',
        cashback: '10.00',
        winning: '200.00',
        total: '260.00',
      };
      data.cooldowns = {
        mobileAvailableAt: null,
        ffIdAvailableAt: null,
        ffNameAvailableAt: null,
        upiIdAvailableAt: null,
      };
      if (mutate) mutate(data);
    });

  beforeEach(() => {
    vi.restoreAllMocks();
    setStoredToken('test-token');
  });

  it('renders profile view mode with avatar fallback initials, user info, credentials overview, and Edit Profile button', async () => {
    vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());

    render(
      <MemoryRouter>
        <AuthProvider>
          <Profile />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument();
    });

    // Check user info
    expect(screen.getByTestId('profile-user-name')).toHaveTextContent('Player One');
    expect(screen.getByTestId('profile-user-email')).toHaveTextContent('player@example.com');
    expect(screen.getByTestId('user-avatar-fallback')).toHaveTextContent('PO');
    expect(screen.getByTestId('edit-profile-btn')).toBeInTheDocument();

    // Check read-only credentials overview cards
    expect(screen.getByTestId('profile-view-ffName')).toHaveTextContent('OldIGN');
    expect(screen.getByTestId('profile-view-ffId')).toHaveTextContent('11223344');
    expect(screen.getByTestId('profile-view-mobile')).toHaveTextContent('+91 9876543210');
    expect(screen.getByTestId('profile-view-upiId')).toHaveTextContent('player@upi');
    expect(screen.getByTestId('view-referral-dashboard-link')).toHaveAttribute('href', '/referral');
  });

  it('renders locked fields disabled with explanatory notes when entering Edit Profile mode', async () => {
    vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());

    render(
      <MemoryRouter>
        <AuthProvider>
          <Profile />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-profile-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-profile-btn'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Player One')).toBeDisabled();
    });
    expect(screen.getByText(/Name cannot be changed after registration/i)).toBeInTheDocument();

    expect(screen.getByDisplayValue('player@example.com')).toBeDisabled();
    expect(screen.getByText(/Email is permanently linked to your account/i)).toBeInTheDocument();
  });

  it('allows navigating between View mode and Edit mode via Edit Profile and Back buttons', async () => {
    vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());

    render(
      <MemoryRouter>
        <AuthProvider>
          <Profile />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-profile-btn')).toBeInTheDocument();
    });

    // Click Edit Profile -> should show edit view
    fireEvent.click(screen.getByTestId('edit-profile-btn'));
    expect(screen.getByTestId('edit-profile-view')).toBeInTheDocument();

    // Click Back arrow -> should return to profile view
    fireEvent.click(screen.getByTestId('back-to-profile-btn'));
    expect(screen.queryByTestId('edit-profile-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('edit-profile-btn')).toBeInTheDocument();
  });

  it('Requirement 8: submits ONLY changed fields to PATCH /me/profile', async () => {
    vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());

    const updateProfileSpy = vi.spyOn(userApi, 'updateProfile').mockResolvedValue(
      getMeFixture((data) => {
        data.profile.ffName = 'NewAwesomeIGN';
        data.cooldowns.ffNameAvailableAt = new Date(Date.now() + 86400000).toISOString();
      })
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <Profile />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-profile-btn')).toBeInTheDocument();
    });

    // Enter edit mode
    fireEvent.click(screen.getByTestId('edit-profile-btn'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('OldIGN')).toBeInTheDocument();
    });

    // Change ONLY the Free Fire Name
    const ffNameInput = screen.getByDisplayValue('OldIGN');
    fireEvent.change(ffNameInput, { target: { value: 'NewAwesomeIGN' } });

    // Submit the form
    const saveButton = screen.getByTestId('save-profile-btn');
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
    vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());

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
      expect(screen.getByTestId('edit-profile-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-profile-btn'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('9876543210')).toBeInTheDocument();
    });

    const mobileInput = screen.getByDisplayValue('9876543210');
    fireEvent.change(mobileInput, { target: { value: '9876543211' } });

    fireEvent.click(screen.getByTestId('save-profile-btn'));

    await waitFor(() => {
      expect(screen.getByText(/This mobile number is already in use/i)).toBeInTheDocument();
    });
  });

  it('displays IN_ACTIVE_MATCH message next to Free Fire fields when user is in an active match', async () => {
    vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());

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
      expect(screen.getByTestId('edit-profile-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-profile-btn'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('OldIGN')).toBeInTheDocument();
    });

    const ffNameInput = screen.getByDisplayValue('OldIGN');
    fireEvent.change(ffNameInput, { target: { value: 'UpdatedIGN' } });

    fireEvent.click(screen.getByTestId('save-profile-btn'));

    await waitFor(() => {
      const messages = screen.getAllByText(
        /Cannot change Free Fire details while enrolled in an upcoming or live match/i
      );
      expect(messages.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('disables input and displays cooldown message in IST when field cooldown is active', async () => {
    const futureIso = new Date(Date.now() + 86400000 * 7).toISOString();
    vi.spyOn(userApi, 'getMe').mockResolvedValue(
      getMeFixture((data) => {
        data.cooldowns.mobileAvailableAt = futureIso;
      })
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <Profile />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-profile-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-profile-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('mobile-cooldown-msg')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mobile-cooldown-msg')).toHaveTextContent(/Next change available on/i);
    expect(screen.getByDisplayValue('9876543210')).toBeDisabled();
  });

  it('handles user avatar upload directly in profile section', async () => {
    const getMeSpy = vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());
    const uploadAvatarSpy = vi.spyOn(userApi, 'uploadAvatar').mockResolvedValue({
      avatarUrl: 'https://example.com/avatar.jpg',
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Profile />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('profile-user-name')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('avatar-file-input') as HTMLInputElement;
    const testFile = new File(['fake-image-bytes'], 'avatar.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(uploadAvatarSpy).toHaveBeenCalledTimes(1);
    });

    expect(uploadAvatarSpy).toHaveBeenCalledWith(testFile);
    // Profile is refreshed after successful upload
    expect(getMeSpy).toHaveBeenCalledTimes(2);
  });

  it('renders uploaded avatar image and does not show remove photo button', async () => {
    vi.spyOn(userApi, 'getMe').mockResolvedValue(
      getMeFixture((data) => {
        data.profile.avatarUrl = 'https://example.com/avatar.jpg';
      })
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <Profile />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-avatar-img')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('remove-avatar-btn')).not.toBeInTheDocument();
  });
});
