import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Account } from '../src/pages/Account.js';
import { GameUidDetails } from '../src/pages/GameUidDetails.js';
import { MyStatistics } from '../src/pages/MyStatistics.js';
import { Community } from '../src/pages/Community.js';
import { AboutUs } from '../src/pages/AboutUs.js';
import { PrivacyPolicy } from '../src/pages/PrivacyPolicy.js';
import { MyProfile } from '../src/pages/MyProfile.js';
import { PlayerTopBar } from '../src/components/layout/PlayerTopBar.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import * as userApi from '../src/api/user.js';
import * as matchApi from '../src/api/matches.js';
import { setStoredToken, clearStoredToken } from '../src/api/client.js';
import { getMeGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Redesigned Account Page and Sub-Pages', () => {
  const getMeFixture = () =>
    loadContractFixture('GET_api_v1_me.json', getMeGuard, 'GET /api/v1/me', (data) => {
      data.profile.name = 'Sujoy Kumar Mondal';
      data.profile.username = 'sujoy721642';
      data.profile.email = 'sujoy@example.com';
      data.profile.mobile = '8972854737';
      data.profile.ffId = '1457625118';
      data.profile.ffName = 'Kingrohitt';
      data.profile.upiId = 'sujoy@upi';
      data.profile.dateOfBirth = '2003-07-15';
    });

  beforeEach(() => {
    vi.restoreAllMocks();
    setStoredToken('test-token');
    vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());
  });

  it('renders Account page with stats card (PLAYED, KILLS, WIN) and sectioned menu items', async () => {
    vi.spyOn(userApi, 'fetchUserStatistics').mockResolvedValue({
      played: 6,
      kills: 0,
      totalWinnings: '0.00',
    });

    render(
      <MemoryRouter initialEntries={['/account']}>
        <AuthProvider>
          <Account />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('account-user-name')).toHaveTextContent('Sujoy Kumar Mondal');
      expect(screen.getByTestId('account-user-username')).toHaveTextContent('@sujoy721642');
      expect(screen.getByTestId('stat-played')).toHaveTextContent('6');
    });

    // Check stats card
    expect(screen.getByTestId('stat-played')).toHaveTextContent('6');
    expect(screen.getByTestId('stat-kills')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-win')).toHaveTextContent('₹0');

    // Check menu items
    expect(screen.getByTestId('menu-my-profile-btn')).toBeInTheDocument();
    expect(screen.getByTestId('menu-game-uid-btn')).toBeInTheDocument();
    expect(screen.getByTestId('menu-my-statistics-btn')).toBeInTheDocument();
    expect(screen.getByTestId('menu-join-community-btn')).toBeInTheDocument();
    expect(screen.getByTestId('menu-customer-support-btn')).toBeInTheDocument();
    expect(screen.getByTestId('menu-about-us-btn')).toBeInTheDocument();
    expect(screen.getByTestId('menu-privacy-policy-btn')).toBeInTheDocument();
    expect(screen.getByTestId('menu-share-app-btn')).toBeInTheDocument();
    expect(screen.getByTestId('menu-share-app-btn')).toHaveTextContent('Refer App');
    expect(screen.getByTestId('profile-download-app-btn')).toBeInTheDocument();
    expect(screen.getByTestId('profile-download-app-btn')).toHaveAttribute('download', 'Booyah_Win.apk');
    expect(screen.getByTestId('menu-logout-btn')).toBeInTheDocument();
    expect(screen.getByTestId('profile-language-section')).toBeInTheDocument();
    expect(screen.getByTestId('profile-lang-en')).toBeInTheDocument();
    expect(screen.getByTestId('profile-lang-bn')).toBeInTheDocument();
  });

  it('renders redesigned Account page for unauthenticated guest user with CTAs, Community, About, and Language sections', async () => {
    clearStoredToken();

    render(
      <MemoryRouter initialEntries={['/account']}>
        <AuthProvider>
          <Account />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('account-guest-title')).toHaveTextContent('Guest Player');
    });

    // Verify Guest CTA buttons
    expect(screen.getByTestId('account-guest-register-btn')).toBeInTheDocument();
    expect(screen.getByTestId('account-guest-register-btn')).toHaveTextContent('Create Account');
    expect(screen.getByTestId('account-guest-login-btn')).toBeInTheDocument();
    expect(screen.getByTestId('account-guest-login-btn')).toHaveTextContent('Login');

    // Verify COMMUNITY & SUPPORT items
    expect(screen.getByTestId('menu-join-community-btn')).toBeInTheDocument();
    expect(screen.getByTestId('menu-customer-support-btn')).toBeInTheDocument();

    // Verify ABOUT & LEGAL items
    expect(screen.getByTestId('menu-about-us-btn')).toBeInTheDocument();
    expect(screen.getByTestId('menu-privacy-policy-btn')).toBeInTheDocument();
    expect(screen.getByTestId('profile-download-app-btn')).toBeInTheDocument();

    // Verify Language Preference
    expect(screen.getByTestId('profile-language-section')).toBeInTheDocument();
    expect(screen.getByTestId('profile-lang-en')).toBeInTheDocument();
    expect(screen.getByTestId('profile-lang-bn')).toBeInTheDocument();

    // Authenticated-only sections must NOT be rendered
    expect(screen.queryByTestId('account-stats-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-my-profile-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-game-uid-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-my-statistics-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-share-app-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-logout-btn')).not.toBeInTheDocument();
  });

  it('opens logout confirmation modal when clicking Logout', async () => {
    vi.spyOn(userApi, 'fetchUserStatistics').mockResolvedValue({
      played: 0,
      kills: 0,
      totalWinnings: '0.00',
    });

    render(
      <MemoryRouter initialEntries={['/account']}>
        <AuthProvider>
          <Account />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('menu-logout-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('menu-logout-btn'));
    expect(screen.getByTestId('logout-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cancel-logout-btn'));
    expect(screen.queryByTestId('logout-modal')).not.toBeInTheDocument();
  });

  it('renders Game UID Details page and allows editing Free Fire credentials', async () => {
    const updateProfileSpy = vi.spyOn(userApi, 'updateProfile').mockResolvedValue(getMeFixture());

    render(
      <MemoryRouter initialEntries={['/account/game-uid']}>
        <AuthProvider>
          <GameUidDetails />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-ffid-display')).toHaveTextContent('1457625118');
      expect(screen.getByTestId('current-ffname-display')).toHaveTextContent('Kingrohitt');
    });

    // Click Edit button to enter edit mode
    const editBtn = screen.getByTestId('edit-game-uid-btn');
    fireEvent.click(editBtn);

    // Edit in-game name
    const nameInput = screen.getByTestId('edit-ffname-input');
    fireEvent.change(nameInput, { target: { value: 'Kingrohitt99' } });

    const saveBtn = screen.getByTestId('save-game-uid-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateProfileSpy).toHaveBeenCalledWith({
        ffName: 'Kingrohitt99',
      });
    });
  });

  it('allows cancelling Game UID edits and reverting changes', async () => {
    render(
      <MemoryRouter initialEntries={['/account/game-uid']}>
        <AuthProvider>
          <GameUidDetails />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-game-uid-btn')).toBeInTheDocument();
    });

    // Enter edit mode
    fireEvent.click(screen.getByTestId('edit-game-uid-btn'));
    expect(screen.getByTestId('cancel-game-uid-btn')).toBeInTheDocument();

    const nameInput = screen.getByTestId('edit-ffname-input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'TemporaryName' } });
    expect(nameInput.value).toBe('TemporaryName');

    // Cancel edit
    fireEvent.click(screen.getByTestId('cancel-game-uid-btn'));
    expect(screen.getByTestId('edit-game-uid-btn')).toBeInTheDocument();
    expect(nameInput.value).toBe('Kingrohitt');
  });

  it('renders My Statistics page with breakdown cards and recent matches', async () => {
    vi.spyOn(userApi, 'fetchUserStatistics').mockResolvedValue({
      played: 5,
      kills: 12,
      totalWinnings: '150.00',
    });

    vi.spyOn(matchApi, 'fetchMatchHistory').mockResolvedValue({
      items: [
        {
          matchId: '101',
          gameMode: 'battle_royale',
          teamMode: 'solo',
          entryFee: '10.00',
          startTime: '2026-10-29T10:00:00Z',
          matchStatus: 'completed',
          joinedAt: '2026-10-29T09:00:00Z',
          refundedAt: null,
          kills: 4,
          position: 1,
          payout: '50.00',
          displayStatus: 'Completed',
          positionLabel: '#1 Winner',
        },
      ],
      hasMore: false,
    });

    render(
      <MemoryRouter initialEntries={['/account/statistics']}>
        <AuthProvider>
          <MyStatistics />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('stats-played-val')).toHaveTextContent('5');
      expect(screen.getByTestId('stats-kills-val')).toHaveTextContent('12');
      expect(screen.getByTestId('stats-win-val')).toHaveTextContent('₹150');
    });

    expect(screen.getByTestId('stats-avg-kills')).toHaveTextContent('2.4 / match');
    expect(screen.getByTestId('stats-match-item-101')).toBeInTheDocument();
  });

  it('renders Join Community page and redirects on channel click', async () => {
    vi.spyOn(userApi, 'fetchCommunityLinks').mockResolvedValue({
      whatsapp: 'https://chat.whatsapp.com/test-group',
      instagram: 'https://instagram.com/test-page',
      telegram: 'https://t.me/test-channel',
      youtube: 'https://youtube.com/@test-channel',
    });

    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <MemoryRouter initialEntries={['/community']}>
        <AuthProvider>
          <Community />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('community-card-whatsapp')).toBeInTheDocument();
      expect(screen.getByTestId('community-card-instagram')).toBeInTheDocument();
      expect(screen.getByTestId('community-card-telegram')).toBeInTheDocument();
      expect(screen.getByTestId('community-card-youtube')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('join-whatsapp-btn'));
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://chat.whatsapp.com/test-group',
      '_blank',
      'noopener,noreferrer'
    );

    fireEvent.click(screen.getByTestId('join-youtube-btn'));
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://youtube.com/@test-channel',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('renders About Us page with company and fair play info', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <AboutUs />
      </MemoryRouter>
    );

    expect(screen.getByTestId('about-us-screen')).toBeInTheDocument();
    expect(screen.getByText('BOOYAH WIN')).toBeInTheDocument();
    expect(screen.getByText(/Strict Anti-Cheat/i)).toBeInTheDocument();
    expect(screen.getByText('Legal & Corporate Notice')).toBeInTheDocument();
    expect(
      screen.getByText(/Booyah Win is operated by Booyah Win Technologies/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('aboutUs.legalNoticeTitle')).not.toBeInTheDocument();
    expect(screen.queryByText('aboutUs.legalNoticeDesc')).not.toBeInTheDocument();
  });

  it('renders Privacy Policy page with legal data protection sections', () => {
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <PrivacyPolicy />
      </MemoryRouter>
    );

    expect(screen.getByTestId('privacy-policy-screen')).toBeInTheDocument();
    expect(screen.getByText(/Information We Collect/i)).toBeInTheDocument();
    expect(screen.getByText(/No Data Selling/i)).toBeInTheDocument();
    expect(screen.getByText('5. Account Rights & Deletion')).toBeInTheDocument();
    expect(screen.getByText('Questions Regarding Privacy?')).toBeInTheDocument();
    expect(screen.queryByText('privacyPolicy.sec5Title')).not.toBeInTheDocument();
  });

  describe('MyProfile (Inline Edit Mode & 30-Day Cooldowns)', () => {
    it('renders MyProfile in view mode with credentials and Edit Profile button', async () => {
      render(
        <MemoryRouter initialEntries={['/account/profile']}>
          <AuthProvider>
            <MyProfile />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('profile-user-name')).toHaveTextContent('Sujoy Kumar Mondal');
      });

      expect(screen.getByTestId('profile-user-email')).toHaveTextContent('sujoy@example.com');
      expect(screen.getByTestId('profile-user-username')).toHaveTextContent('@sujoy721642');
      expect(screen.getByTestId('profile-view-name')).toHaveTextContent('Sujoy Kumar Mondal');
      expect(screen.getByTestId('profile-view-mobile')).toHaveTextContent('+91 8972854737');
      expect(screen.getByTestId('profile-view-upiId')).toHaveTextContent('sujoy@upi');
      expect(screen.getByTestId('profile-view-dob')).toHaveTextContent('15 Jul 2003');
      expect(screen.getByText('18+ Verified')).toBeInTheDocument();
      expect(screen.getByTestId('upi-withdrawal-lock-notice')).toHaveTextContent(
        'Note: If you change your UPI ID, withdrawals will be disabled for 24 hours for security.'
      );

      expect(screen.getByTestId('edit-profile-btn')).toBeInTheDocument();
    });

    it('switches to inline edit mode on Edit Profile click and saves updated credentials', async () => {
      const updateProfileSpy = vi.spyOn(userApi, 'updateProfile').mockResolvedValue(getMeFixture());

      render(
        <MemoryRouter initialEntries={['/account/profile']}>
          <AuthProvider>
            <MyProfile />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('edit-profile-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('edit-profile-btn'));

      // Check Save & Cancel buttons are present, and input fields appear
      expect(screen.getByTestId('save-profile-btn')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-edit-btn')).toBeInTheDocument();

      const nameInput = screen.getByTestId('profile-input-name');
      const mobileInput = screen.getByTestId('profile-input-mobile');
      const upiInput = screen.getByTestId('profile-input-upiId');

      // Date of birth remains read-only
      expect(screen.getByTestId('profile-view-dob')).toBeInTheDocument();

      // Edit fields
      fireEvent.change(nameInput, { target: { value: 'Sujoy Kumar Mondal BCA' } });
      fireEvent.change(mobileInput, { target: { value: '+91 9876543210' } });
      fireEvent.change(upiInput, { target: { value: 'bwubca23206@upi' } });

      fireEvent.click(screen.getByTestId('save-profile-btn'));

      await waitFor(() => {
        expect(updateProfileSpy).toHaveBeenCalledWith({
          name: 'Sujoy Kumar Mondal BCA',
          mobile: '9876543210',
          upiId: 'bwubca23206@upi',
        });
      });
    });

    it('reverts edits and returns to view mode when clicking Cancel', async () => {
      render(
        <MemoryRouter initialEntries={['/account/profile']}>
          <AuthProvider>
            <MyProfile />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('edit-profile-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('edit-profile-btn'));

      const nameInput = screen.getByTestId('profile-input-name');
      fireEvent.change(nameInput, { target: { value: 'Unsaved Name Edit' } });

      fireEvent.click(screen.getByTestId('cancel-edit-btn'));

      // Back in view mode with original name
      expect(screen.getByTestId('edit-profile-btn')).toBeInTheDocument();
      expect(screen.getByTestId('profile-view-name')).toHaveTextContent('Sujoy Kumar Mondal');
    });

    it('disables input when cooldown is active', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 10).toISOString();
      vi.spyOn(userApi, 'getMe').mockResolvedValue(
        loadContractFixture('GET_api_v1_me.json', getMeGuard, 'GET /api/v1/me', (data) => {
          data.profile.name = 'Sujoy Kumar Mondal';
          data.cooldowns.nameAvailableAt = futureDate;
        })
      );

      render(
        <MemoryRouter initialEntries={['/account/profile']}>
          <AuthProvider>
            <MyProfile />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('edit-profile-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('edit-profile-btn'));

      const nameInput = screen.getByTestId('profile-input-name');
      expect(nameInput).toBeDisabled();
      expect(screen.getByText(/Next change available on/i)).toBeInTheDocument();
    });

    it('renders logo_icon as fallback profile photo on Account and MyProfile when avatarUrl is absent', async () => {
      render(
        <MemoryRouter initialEntries={['/account']}>
          <AuthProvider>
            <Account />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        const fallback = screen.getByTestId('account-avatar-fallback');
        const img = fallback.querySelector('img');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', '/assets/logo_icon.png');
      });
    });
  });

  describe('PlayerTopBar Navbar Brand & Avatar', () => {
    it('renders full logo and fallback logo_icon when user has no avatarUrl', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <PlayerTopBar />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        const logo = screen.getByTestId('navbar-brand-logo');
        expect(logo).toHaveAttribute('src', '/assets/logo_full.png');
        const defaultAvatar = screen.getByTestId('navbar-default-avatar');
        expect(defaultAvatar).toHaveAttribute('src', '/assets/logo_icon.png');
      });
    });
  });
});

