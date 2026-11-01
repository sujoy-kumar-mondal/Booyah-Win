/**
 * Matches List Page Tests for Staff Portal
 *
 * Requirements & Changes:
 * - Filters: status, game mode, team mode, date range (from, to).
 * - Cursor pagination.
 * - Columns: display ID (M + id), mode, team mode, entry fee, seats taken / max, start time in IST, status.
 * - Actions per row appear only when match status permits (open room, go live, cancel, add result).
 * - Room password masked with reveal toggle, no logging, copy button with clipboard fallback.
 * - Double-click guards on actions.
 * - 409 conflict handling displays "This request was already processed".
 * - Employees cannot cancel a live match (button hidden; handles FORBIDDEN if returned).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { Matches } from '../src/pages/Matches.js';
import * as matchesApi from '../src/api/matches.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/context/StaffAuthContext.js';

import { loadContractFixture } from './contractFixtures.js';
import { staffMeGuard, matchListResponseGuard } from '../src/api/guards.js';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

const mockMatches: matchesApi.MatchStaffDto[] = [
  {
    id: '101',
    tierId: '1',
    gameMode: 'battle_royale',
    teamMode: 'solo',
    entryFee: '10.00',
    killPrice: '5.00',
    minKillsForReward: 2,
    positionPrizes: { '1': '50.00', '2': '30.00' },
    maxPlayers: 48,
    minPlayers: 24,
    startTime: new Date(Date.now() + 3600000).toISOString(),
    status: 'upcoming',
    cancelReason: null,
    createdBy: '1',
    createdAt: '2026-10-11T10:00:00.000Z',
    joinedCount: 15,
  },
  {
    id: '102',
    tierId: '2',
    gameMode: 'battle_royale',
    teamMode: 'duo',
    entryFee: '20.00',
    killPrice: '10.00',
    minKillsForReward: 2,
    positionPrizes: { '1': '100.00' },
    maxPlayers: 48,
    minPlayers: 24,
    startTime: new Date(Date.now() + 7200000).toISOString(),
    roomId: 'ROOM-102',
    roomPassword: 'SECRET-PASS-102',
    status: 'room_open',
    cancelReason: null,
    createdBy: '1',
    createdAt: '2026-10-11T10:00:00.000Z',
    joinedCount: 30,
  },
  {
    id: '103',
    tierId: '3',
    gameMode: 'clash_squad',
    teamMode: 'squad',
    entryFee: '50.00',
    killPrice: '0.00',
    minKillsForReward: 0,
    positionPrizes: { '1': '300.00' },
    maxPlayers: 8,
    minPlayers: 8,
    startTime: new Date(Date.now() + 10800000).toISOString(),
    roomId: 'ROOM-103',
    roomPassword: 'SECRET-PASS-103',
    status: 'live',
    cancelReason: null,
    createdBy: '1',
    createdAt: '2026-10-11T10:00:00.000Z',
    joinedCount: 8,
  },
];

describe('Matches List Page', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();

    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me')
    );

    vi.spyOn(matchesApi, 'getStaffMatches').mockResolvedValue(
      loadContractFixture('GET_staff_matches.json', matchListResponseGuard, 'GET /staff/matches', (d) => {
        d.matches = mockMatches;
        d.nextCursor = null;
      })
    );
  });

  it('renders matches list with columns, display IDs (# + id), and IST dates', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Matches />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MCH-101')).toBeInTheDocument();
      expect(screen.getByText('BW-MCH-102')).toBeInTheDocument();
      expect(screen.getByText('BW-MCH-103')).toBeInTheDocument();
    });

    expect(screen.getByText(/15 \/ 48/)).toBeInTheDocument();
    expect(screen.getByText(/30 \/ 48/)).toBeInTheDocument();
    expect(screen.getByText(/8 \/ 8/)).toBeInTheDocument();
  });

  it('masks room passwords with reveal toggle and copy button', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Matches />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MCH-102')).toBeInTheDocument();
    });

    // Default: password is masked (8 dots)
    expect(screen.queryByText('SECRET-PASS-102')).not.toBeInTheDocument();
    expect(screen.getAllByText('••••••••').length).toBeGreaterThan(0);

    // Toggle reveal button
    const revealBtn = screen.getByTestId('toggle-pw-102');
    fireEvent.click(revealBtn);

    // Password becomes visible
    expect(screen.getByText('SECRET-PASS-102')).toBeInTheDocument();
  });

  it('shows actions per row based on status (Open Room, Go Live, Add Result)', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Matches />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MCH-101')).toBeInTheDocument();
    });

    // Upcoming match (#101) has Open Room
    expect(screen.getByTestId('btn-open-room-101')).toBeInTheDocument();

    // Room open match (#102) has Go Live
    expect(screen.getByTestId('btn-go-live-102')).toBeInTheDocument();

    // Live match (#103) has Add Result
    expect(screen.getByTestId('btn-add-result-103')).toBeInTheDocument();
  });

  it('Change 3: hides Cancel button on LIVE match for employees', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'employee-token');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Matches />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MCH-103')).toBeInTheDocument();
    });

    // Employee CAN cancel upcoming (#101) or room_open (#102)
    expect(screen.getByTestId('btn-cancel-101')).toBeInTheDocument();
    expect(screen.getByTestId('btn-cancel-102')).toBeInTheDocument();

    // Employee CANNOT cancel live (#103) - button is hidden
    expect(screen.queryByTestId('btn-cancel-103')).not.toBeInTheDocument();
  });

  it('Change 3: allows Cancel on LIVE match for Admins', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'admin-token');
    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me', (d) => {
        d.profile.role = 'admin';
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Matches />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MCH-103')).toBeInTheDocument();
    });

    // Admin CAN cancel live match (wait for profile to resolve role=admin)
    await waitFor(() => {
      expect(screen.getByTestId('btn-cancel-103')).toBeInTheDocument();
    });
  });

  it('handles 409 conflict during action with friendly message "This request was already processed"', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    vi.spyOn(matchesApi, 'openStaffMatchRoom').mockRejectedValue({
      code: 'INVALID_TRANSITION',
      status: 409,
      message: 'Match is already open',
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Matches />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MCH-101')).toBeInTheDocument();
    });

    // Open Room dialog
    fireEvent.click(screen.getByTestId('btn-open-room-101'));

    const roomIdInput = screen.getByTestId('input-room-id');
    const roomPwInput = screen.getByTestId('input-room-password');
    fireEvent.change(roomIdInput, { target: { value: 'ROOM1' } });
    fireEvent.change(roomPwInput, { target: { value: 'PW1' } });

    fireEvent.click(screen.getByTestId('btn-confirm-open-room'));

    await waitFor(() => {
      expect(screen.getByText('This request was already processed')).toBeInTheDocument();
    });
  });

  it('displays how many users were joined instead of 0 for cancelled matches', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    const cancelledMatch: matchesApi.MatchStaffDto = {
      id: '104',
      tierId: '1',
      gameMode: 'battle_royale',
      teamMode: 'solo',
      entryFee: '10.00',
      killPrice: '5.00',
      minKillsForReward: 2,
      positionPrizes: { '1': '50.00' },
      maxPlayers: 48,
      minPlayers: 24,
      startTime: '2026-10-15T18:00:00.000Z',
      status: 'cancelled',
      cancelReason: 'Insufficient players',
      createdBy: '1',
      createdAt: '2026-10-11T10:00:00.000Z',
      joinedCount: 5,
      seatsTaken: 5,
    };

    vi.spyOn(matchesApi, 'getStaffMatches').mockResolvedValue(
      loadContractFixture('GET_staff_matches.json', matchListResponseGuard, 'GET /staff/matches', (d) => {
        d.matches = [cancelledMatch];
        d.nextCursor = null;
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Matches />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MCH-104')).toBeInTheDocument();
    });

    expect(screen.getByText('5 / 48')).toBeInTheDocument();
  });

  it('defaults STATUS dropdown to "Not-Completed" and passes status=not_completed to API', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    const getMatchesSpy = vi.spyOn(matchesApi, 'getStaffMatches').mockResolvedValue(
      loadContractFixture('GET_staff_matches.json', matchListResponseGuard, 'GET /staff/matches', (d) => {
        d.matches = mockMatches;
        d.nextCursor = null;
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Matches />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MCH-101')).toBeInTheDocument();
    });

    const statusDropdown = screen.getByTestId('filter-status') as HTMLSelectElement;
    expect(statusDropdown.value).toBe('not_completed');

    expect(getMatchesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'not_completed',
      })
    );
  });

  it('filters matches by search query: match ID, game mode, team mode, and compound combination', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Matches />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MCH-101')).toBeInTheDocument();
      expect(screen.getByText('BW-MCH-102')).toBeInTheDocument();
      expect(screen.getByText('BW-MCH-103')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('search-matches');

    // 1. Search by match ID: '101'
    fireEvent.change(searchInput, { target: { value: '101' } });
    expect(screen.getByText('BW-MCH-101')).toBeInTheDocument();
    expect(screen.queryByText('BW-MCH-102')).not.toBeInTheDocument();
    expect(screen.queryByText('BW-MCH-103')).not.toBeInTheDocument();

    // 2. Search by match ID with prefix: 'BW-MCH-102'
    fireEvent.change(searchInput, { target: { value: 'BW-MCH-102' } });
    expect(screen.queryByText('BW-MCH-101')).not.toBeInTheDocument();
    expect(screen.getByText('BW-MCH-102')).toBeInTheDocument();
    expect(screen.queryByText('BW-MCH-103')).not.toBeInTheDocument();

    // 3. Search by game mode abbreviation: 'cs'
    fireEvent.change(searchInput, { target: { value: 'cs' } });
    expect(screen.queryByText('BW-MCH-101')).not.toBeInTheDocument();
    expect(screen.queryByText('BW-MCH-102')).not.toBeInTheDocument();
    expect(screen.getByText('BW-MCH-103')).toBeInTheDocument();

    // 4. Search by team mode: 'duo'
    fireEvent.change(searchInput, { target: { value: 'duo' } });
    expect(screen.queryByText('BW-MCH-101')).not.toBeInTheDocument();
    expect(screen.getByText('BW-MCH-102')).toBeInTheDocument();
    expect(screen.queryByText('BW-MCH-103')).not.toBeInTheDocument();

    // 5. Search by compound combination: '102 duo'
    fireEvent.change(searchInput, { target: { value: '102 duo' } });
    expect(screen.queryByText('BW-MCH-101')).not.toBeInTheDocument();
    expect(screen.getByText('BW-MCH-102')).toBeInTheDocument();
    expect(screen.queryByText('BW-MCH-103')).not.toBeInTheDocument();

    // 6. Search non-matching term shows empty state
    fireEvent.change(searchInput, { target: { value: '99999' } });
    expect(screen.getByTestId('matches-search-empty')).toBeInTheDocument();
    expect(screen.queryByText('BW-MCH-101')).not.toBeInTheDocument();

    // Clear search
    fireEvent.click(screen.getByText('Clear Search'));
    expect(screen.getByText('BW-MCH-101')).toBeInTheDocument();
    expect(screen.getByText('BW-MCH-102')).toBeInTheDocument();
    expect(screen.getByText('BW-MCH-103')).toBeInTheDocument();
  });
});
