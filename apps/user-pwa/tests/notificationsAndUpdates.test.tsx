import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Notifications } from '../src/pages/Notifications.js';
import { ImportantUpdates } from '../src/pages/ImportantUpdates.js';
import { PlayerTopBar } from '../src/components/layout/PlayerTopBar.js';
import { Home } from '../src/pages/Home.js';
import * as authModule from '../src/context/AuthContext.js';
import * as matchesApi from '../src/api/matches.js';
import * as notifApi from '../src/api/notifications.js';
import * as updatesApi from '../src/api/updates.js';

describe('Notifications and Important Updates Pages', () => {
  const mockAuthState: any = {
    user: {
      id: 'usr_1',
      name: 'Sujoy Kumar Mondal',
      mobile: '+919999999999',
      email: 'sujoy@example.com',
      ffName: 'ff_sujoy',
      ffUid: '123456789',
      role: 'player',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    wallets: {
      deposit: '100.00',
      winnings: '95.00',
      total: '195.00',
    },
    token: 'test-token',
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  };

  const mockActiveUpdates = [
    {
      id: '1',
      title: '🔥🚨 Important Update – Lone Wolf Headshot Mode',
      category: 'Announcement',
      dateDisplay: '23 Jul',
      heading: 'Headshot-Only Mode Rules & Fair Play',
      summary: 'Headshot-only mode regulations, prohibited weapons, and strict disqualification rules.',
      points: [
        {
          label: 'Headshot Requirement',
          text: 'Only kills registered via headshot are counted for victory.',
        },
      ],
      notice: 'Ensure your Free Fire game recording is enabled.',
      sortOrder: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      title: '🏆 Tournaments Are Back! 🎮 : Be Ready',
      category: 'Announcement',
      dateDisplay: '7 May',
      heading: 'Daily Tournament Schedule & UPI Payouts',
      summary: 'Daily Scrims, Battle Royale Solo & Duo, and CS custom rooms have officially resumed.',
      points: [
        {
          label: 'Daily Scrims Active',
          text: 'Join Battle Royale Solo, Duo, Squad, and Clash Squad matches.',
        },
      ],
      notice: 'Room ID & Password unlock 15 minutes before.',
      linkUrl: '/matches',
      linkText: 'Explore Matches',
      sortOrder: 2,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'test-token');
    vi.restoreAllMocks();
    vi.spyOn(matchesApi, 'fetchMatches').mockResolvedValue([]);
    vi.spyOn(authModule, 'useAuth').mockReturnValue(mockAuthState);
    vi.spyOn(updatesApi, 'fetchImportantUpdates').mockResolvedValue(mockActiveUpdates);
    vi.spyOn(notifApi, 'fetchUserNotifications').mockResolvedValue([
      {
        id: 'notif-room-1',
        type: 'room_open',
        title: 'FIRST COME FIRST SERVE | UNLIMITED AMMO',
        message: 'Room ID: 862488730 | Password: 00',
        roomId: '862488730',
        roomPassword: '00',
        timestamp: '39m',
        createdAt: Date.now() - 39 * 60 * 1000,
        actionUrl: '/matches',
      },
      {
        id: 'notif-match-joined',
        type: 'match_joined',
        title: 'Match Joined: Clash Squad [SQUAD]',
        message: 'You joined Clash Squad [SQUAD]. Match starts at 07:00 PM IST.',
        timestamp: '1h',
        createdAt: Date.now() - 60 * 60 * 1000,
        actionUrl: '/matches',
      },
      {
        id: 'notif-dep-1',
        type: 'wallet_deposit',
        title: 'Deposit Approved: ₹250',
        message: '₹250 has been successfully added to your wallet balance.',
        timestamp: '2h',
        createdAt: Date.now() - 2 * 60 * 60 * 1000,
        actionUrl: '/wallet',
      },
    ]);
  });

  it('renders Notifications page with room credentials and automatic notifications WITHOUT Copy Room & Pass button', async () => {
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/FIRST COME FIRST SERVE/i)).toBeInTheDocument();
      expect(screen.getByText(/Room ID: 862488730/i)).toBeInTheDocument();
      expect(screen.getByText(/Match Joined: Clash Squad/i)).toBeInTheDocument();
      expect(screen.getByText(/Deposit Approved: ₹250/i)).toBeInTheDocument();
    });

    // Requirement 1: Verify "Copy Room & Pass" button is removed
    expect(screen.queryByText(/Copy Room & Pass/i)).not.toBeInTheDocument();
  });

  it('renders Important Updates page with active announcements from server and excludes deleted ones', async () => {
    render(
      <MemoryRouter initialEntries={['/important-updates']}>
        <ImportantUpdates />
      </MemoryRouter>
    );

    expect(screen.getByText('Important updates')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Lone Wolf Headshot Mode/i)).toBeInTheDocument();
      expect(screen.getByText(/Tournaments Are Back!/i)).toBeInTheDocument();
    });

    // Verifies deleted updates do NOT appear in the user UI
    expect(screen.queryByText(/Notification About Snipers Ban/i)).not.toBeInTheDocument();
  });

  it('opens announcement detail modal when the card is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/important-updates']}>
        <ImportantUpdates />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Lone Wolf Headshot Mode/i)).toBeInTheDocument();
    });

    // Initial state: no modal
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Click on the active announcement card
    const card = screen.getByText(/Lone Wolf Headshot Mode/i);
    fireEvent.click(card);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Headshot-Only Mode Rules & Fair Play/i)).toBeInTheDocument();
      expect(screen.getByText(/Headshot Requirement/i)).toBeInTheDocument();
      expect(screen.getByText('I Understand & Agree')).toBeInTheDocument();
    });

    // Close the modal
    fireEvent.click(screen.getByText('I Understand & Agree'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('displays red unread dot on PlayerTopBar notification bell when unread', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <PlayerTopBar />
      </MemoryRouter>
    );

    const bellBtn = screen.getByTestId('header-notifications-btn');
    expect(bellBtn).toBeInTheDocument();

    await waitFor(() => {
      const unreadDot = screen.getByTestId('notification-unread-dot');
      expect(unreadDot).toBeInTheDocument();
    });
  });

  it('clicking the hot ticker bar in Home navigates directly to /important-updates', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/important-updates" element={<ImportantUpdates />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('home-hot-ticker')).toBeInTheDocument();
    });

    const tickerText = screen.getByTestId('home-hot-ticker');
    fireEvent.click(tickerText);

    await waitFor(() => {
      expect(screen.getByText('Important updates')).toBeInTheDocument();
      // Verifies no modal pops up automatically
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('hides the hot ticker in Home when no active updates exist', async () => {
    vi.spyOn(updatesApi, 'fetchImportantUpdates').mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Home />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('home-hot-ticker')).not.toBeInTheDocument();
    });
  });

  it('limits notification display to recent 25 items', async () => {
    // Generate 35 mock notifications
    const items = Array.from({ length: 35 }, (_, idx) => ({
      id: `notif-bulk-${idx + 1}`,
      type: 'tournament' as const,
      title: `Tournament Announcement #${idx + 1}`,
      message: `Announcement message number ${idx + 1}`,
      timestamp: '1h',
      createdAt: Date.now() - idx * 1000,
      actionUrl: '/matches',
    }));

    vi.spyOn(notifApi, 'fetchUserNotifications').mockResolvedValue(items);

    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <Notifications />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Tournament Announcement #1')).toBeInTheDocument();
    });

    // 25th should be rendered
    expect(screen.getByText('Tournament Announcement #25')).toBeInTheDocument();
    // 26th should NOT be rendered because limit is 25
    expect(screen.queryByText('Tournament Announcement #26')).not.toBeInTheDocument();
  });

  it('displays empty state when user has no notifications from server without hardcoded items', async () => {
    vi.spyOn(notifApi, 'fetchUserNotifications').mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <Notifications />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Notification About Snipers Ban/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Tournaments Are Back!/i)).not.toBeInTheDocument();
      expect(screen.getByText(/No Notifications/i)).toBeInTheDocument();
    });
  });
});
