/**
 * Match Detail Page Tests for Staff Portal
 *
 * Requirements & Changes:
 * - Match summary, snapshot rules, room credentials with masked password and copy button.
 * - Roster table showing FF name, FF ID, fee breakdown, and refunded state.
 * - Teams list showing status (confirmed, forming, disbanded) and incomplete flags (memberUserIds.length < size).
 * - Action modals: Open Room, Go Live, Cancel.
 * - Employees cannot cancel a live match (button hidden).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { MatchDetail } from '../src/pages/MatchDetail.js';
import * as matchesApi from '../src/api/matches.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/context/StaffAuthContext.js';

import { loadContractFixture } from './contractFixtures.js';
import { staffMeGuard, matchDetailResponseGuard } from '../src/api/guards.js';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function getMockMatchDetail(): matchesApi.MatchDetailStaffDto {
  const detail = loadContractFixture(
    'GET_staff_matches_id__duo.json',
    matchDetailResponseGuard,
    'GET /staff/matches/:id',
    (d) => {
      d.match.id = '301';
      d.match.tierId = '2';
      d.match.gameMode = 'battle_royale';
      d.match.teamMode = 'duo';
      d.match.entryFee = '20.00';
      d.match.killPrice = '10.00';
      d.match.minKillsForReward = 2;
      d.match.positionPrizes = { '1': '200.00', '2': '100.00' };
      d.match.maxPlayers = 48;
      d.match.minPlayers = 24;
      d.match.startTime = '2026-10-15T18:00:00.000Z';
      d.match.roomId = 'ROOM-301';
      d.match.roomPassword = 'ROOM-PW-301';
      d.match.status = 'live';
      d.match.cancelReason = null;
      d.match.createdBy = '1';
      d.match.createdAt = '2026-10-11T10:00:00.000Z';
      d.match.joinedCount = 3;
      d.match.players = [
        {
          userId: '10',
          name: 'Player One',
          ffId: 'FF101010',
          ffName: 'Shooter1',
          teamId: '5',
          paidAddMoney: '20.00',
          paidCashback: '0.00',
          paidWinning: '0.00',
          refundedAt: null,
          joinedAt: '2026-10-11T10:05:00.000Z',
        },
        {
          userId: '11',
          name: 'Player Two',
          ffId: 'FF111111',
          ffName: 'Shooter2',
          teamId: '5',
          paidAddMoney: '20.00',
          paidCashback: '0.00',
          paidWinning: '0.00',
          refundedAt: '2026-10-11T10:20:00.000Z',
          joinedAt: '2026-10-11T10:06:00.000Z',
        },
        {
          userId: '12',
          name: 'Player Three',
          ffId: 'FF121212',
          ffName: 'Shooter3',
          teamId: '6',
          paidAddMoney: '20.00',
          paidCashback: '0.00',
          paidWinning: '0.00',
          refundedAt: null,
          joinedAt: '2026-10-11T10:07:00.000Z',
        },
      ];
      d.match.teams = [
        {
          id: '5',
          name: 'Alpha Duo',
          size: 2,
          status: 'confirmed',
          leaderId: '10',
          memberUserIds: ['10'],
        },
        {
          id: '6',
          name: 'Beta Duo',
          size: 2,
          status: 'forming',
          leaderId: '12',
          memberUserIds: ['12'],
        },
        {
          id: '7',
          name: 'Old Team',
          size: 2,
          status: 'disbanded',
          leaderId: '99',
          memberUserIds: [],
        },
      ];
    }
  );
  return detail.match;
}

describe('Match Detail Page', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();

    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me')
    );

    vi.spyOn(matchesApi, 'getStaffMatchDetail').mockResolvedValue({
      match: getMockMatchDetail(),
    });
  });

  it('renders tournament overview, room credentials with reveal/copy, and roster', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/matches/301']}>
          <StaffAuthProvider>
            <Routes>
              <Route path="/matches/:id" element={<MatchDetail />} />
            </Routes>
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MAT-301')).toBeInTheDocument();
    });

    // Room ID visible, password masked
    expect(screen.getByText('ROOM-301')).toBeInTheDocument();
    expect(screen.queryByText('ROOM-PW-301')).not.toBeInTheDocument();
    expect(screen.getByText('••••••••••••')).toBeInTheDocument();

    // Toggle reveal
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByText('ROOM-PW-301')).toBeInTheDocument();

    // Players list
    expect(screen.getAllByText('Shooter1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Shooter2').length).toBeGreaterThan(0);
    expect(screen.getByText('Refunded')).toBeInTheDocument();
  });

  it('flags incomplete confirmed team (memberUserIds.length < size) as ineligible', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/matches/301']}>
          <StaffAuthProvider>
            <Routes>
              <Route path="/matches/:id" element={<MatchDetail />} />
            </Routes>
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Alpha Duo').length).toBeGreaterThan(0);
    });

    // Incomplete badge and notice
    expect(screen.getByText('Incomplete (1/2)')).toBeInTheDocument();
    expect(
      screen.getByText(/Incomplete team: Cannot be assigned a position or prize in results/i)
    ).toBeInTheDocument();

    // Forming and disbanded teams clearly marked
    expect(screen.getByText('Forming (1/2)')).toBeInTheDocument();
    expect(screen.getByText('Disbanded')).toBeInTheDocument();
  });

  it('Change 3: employee cannot cancel a live match (button hidden)', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'employee-token');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/matches/301']}>
          <StaffAuthProvider>
            <Routes>
              <Route path="/matches/:id" element={<MatchDetail />} />
            </Routes>
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MAT-301')).toBeInTheDocument();
    });

    // Live match has Add Result button
    expect(screen.getByText('Add Result')).toBeInTheDocument();

    // Cancel Match button is NOT rendered for employees on live match
    expect(screen.queryByText('Cancel Match')).not.toBeInTheDocument();
  });
});
