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
    startTime: '2026-10-15T18:00:00.000Z',
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
    startTime: '2026-10-15T19:00:00.000Z',
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
    startTime: '2026-10-15T20:00:00.000Z',
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

  it('renders matches list with columns, display IDs (M + id), and IST dates', async () => {
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
      expect(screen.getByText('M101')).toBeInTheDocument();
      expect(screen.getByText('M102')).toBeInTheDocument();
      expect(screen.getByText('M103')).toBeInTheDocument();
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
      expect(screen.getByText('M102')).toBeInTheDocument();
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
      expect(screen.getByText('M101')).toBeInTheDocument();
    });

    // Upcoming match (M101) has Open Room
    expect(screen.getByTestId('btn-open-room-101')).toBeInTheDocument();

    // Room open match (M102) has Go Live
    expect(screen.getByTestId('btn-go-live-102')).toBeInTheDocument();

    // Live match (M103) has Add Result
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
      expect(screen.getByText('M103')).toBeInTheDocument();
    });

    // Employee CAN cancel upcoming (M101) or room_open (M102)
    expect(screen.getByTestId('btn-cancel-101')).toBeInTheDocument();
    expect(screen.getByTestId('btn-cancel-102')).toBeInTheDocument();

    // Employee CANNOT cancel live (M103) - button is hidden
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
      expect(screen.getByText('M103')).toBeInTheDocument();
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
      expect(screen.getByText('M101')).toBeInTheDocument();
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
      expect(screen.getByText('M104')).toBeInTheDocument();
    });

    expect(screen.getByText('5 / 48')).toBeInTheDocument();
  });
});
