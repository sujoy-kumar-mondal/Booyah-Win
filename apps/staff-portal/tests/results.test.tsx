/**
 * Add / Edit Results Page Tests for Staff Portal
 *
 * Requirements & Changes:
 * - Real team data only; never infer teams from order.
 * - Only active players in confirmed teams count for results.
 * - Incomplete confirmed teams (memberUserIds.length < size) cannot be used in results.
 * - Duo/squad: shared position selector per confirmed team; kills per player.
 * - Clash squad: winning team dropdown lists only confirmed teams.
 * - Screenshot upload: memory preview, 2MB limit, JPEG/PNG/WebP.
 * - Client checks: unsendable errors block submission; warnings are advisory.
 * - Pre-submit roster re-fetch detects roster changes and warns.
 * - Resubmission displays previous rejection reason.
 * - Admin auto-approve checkbox.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { AddResult } from '../src/pages/AddResult.js';
import * as matchesApi from '../src/api/matches.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/context/StaffAuthContext.js';

import { loadContractFixture } from './contractFixtures.js';
import { staffMeGuard, matchDetailResponseGuard, matchResultStaffGuard } from '../src/api/guards.js';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

// Global URL mock for file preview
if (typeof window.URL.createObjectURL === 'undefined') {
  window.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/fake-screenshot');
  window.URL.revokeObjectURL = vi.fn();
}

function getMockDuoMatch(): matchesApi.MatchDetailStaffDto {
  const detail = loadContractFixture(
    'GET_staff_matches_id__duo.json',
    matchDetailResponseGuard,
    'GET /staff/matches/:id',
    (d) => {
      d.match.id = '401';
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
      d.match.roomId = 'ROOM-401';
      d.match.roomPassword = 'PW-401';
      d.match.status = 'live';
      d.match.cancelReason = null;
      d.match.createdBy = '1';
      d.match.createdAt = '2026-10-11T10:00:00.000Z';
      d.match.joinedCount = 4;
      d.match.players = [
        {
          userId: '10',
          name: 'Player 10',
          ffId: 'FF10',
          ffName: 'P10',
          teamId: '1',
          paidAddMoney: '20.00',
          paidCashback: '0.00',
          paidWinning: '0.00',
          refundedAt: null,
          joinedAt: '2026-10-11T10:01:00.000Z',
        },
        {
          userId: '11',
          name: 'Player 11',
          ffId: 'FF11',
          ffName: 'P11',
          teamId: '1',
          paidAddMoney: '20.00',
          paidCashback: '0.00',
          paidWinning: '0.00',
          refundedAt: null,
          joinedAt: '2026-10-11T10:02:00.000Z',
        },
        {
          userId: '12',
          name: 'Player 12',
          ffId: 'FF12',
          ffName: 'P12',
          teamId: '2',
          paidAddMoney: '20.00',
          paidCashback: '0.00',
          paidWinning: '0.00',
          refundedAt: null,
          joinedAt: '2026-10-11T10:03:00.000Z',
        },
        {
          userId: '13',
          name: 'Player 13',
          ffId: 'FF13',
          ffName: 'P13',
          teamId: '2',
          paidAddMoney: '20.00',
          paidCashback: '0.00',
          paidWinning: '0.00',
          refundedAt: '2026-10-11T10:20:00.000Z',
          joinedAt: '2026-10-11T10:04:00.000Z',
        },
      ];
      d.match.teams = [
        {
          id: '1',
          name: 'Confirmed Duo',
          size: 2,
          status: 'confirmed',
          leaderId: '10',
          memberUserIds: ['10', '11'],
        },
        {
          id: '2',
          name: 'Broken Duo',
          size: 2,
          status: 'confirmed',
          leaderId: '12',
          memberUserIds: ['12'],
        },
      ];
    }
  );
  return detail.match;
}

describe('Add Result Page', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();

    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me', (d) => {
        d.profile.role = 'admin';
      })
    );

    vi.spyOn(matchesApi, 'getStaffMatchDetail').mockResolvedValue({
      match: getMockDuoMatch(),
    });
  });

  it('renders confirmed teams with shared position selector and flags incomplete teams', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/matches/401/result']}>
          <StaffAuthProvider>
            <Routes>
              <Route path="/matches/:id/result" element={<AddResult />} />
            </Routes>
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/BW-MAT-401/)).toBeInTheDocument();
    });

    // Confirmed Duo (complete) is listed with shared position selector
    expect(screen.getByText('Confirmed Duo')).toBeInTheDocument();
    expect(screen.getByLabelText('Team Position:')).toBeInTheDocument();

    // Broken Duo (incomplete) is flagged under Ineligible Teams
    expect(screen.getByText('Broken Duo')).toBeInTheDocument();
    expect(screen.getByText(/Incomplete: 1\/2 active members/i)).toBeInTheDocument();
  });

  it('unsendable error blocks submit if no screenshot is uploaded', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/matches/401/result']}>
          <StaffAuthProvider>
            <Routes>
              <Route path="/matches/:id/result" element={<AddResult />} />
            </Routes>
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/BW-MAT-401/)).toBeInTheDocument();
    });

    // Submit button is disabled because no screenshot is uploaded
    const submitBtn = screen.getByRole('button', { name: /Submit Match Result/i });
    expect(submitBtn).toBeDisabled();
  });

  it('submits result successfully when screenshot and entries are valid', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    const submitSpy = vi.spyOn(matchesApi, 'submitStaffMatchResult').mockResolvedValue({
      id: '1',
      matchId: '401',
      status: 'pending_approval',
      screenshotUrl: 'screenshots/shot.jpg',
      approved: false,
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/matches/401/result']}>
          <StaffAuthProvider>
            <Routes>
              <Route path="/matches/:id/result" element={<AddResult />} />
            </Routes>
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Confirmed Duo')).toBeInTheDocument();
    });

    // Upload a valid fake file
    const file = new File(['valid-image-bytes'], 'scoreboard.jpg', { type: 'image/jpeg' });
    const fileInput = screen.getByLabelText(/Click to select screenshot/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Set position for Confirmed Duo
    fireEvent.change(screen.getByLabelText('Team Position:'), {
      target: { value: '1' },
    });

    // Set kills for player 10
    const killInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(killInputs[0], { target: { value: '5' } });

    const submitBtn = screen.getByRole('button', { name: /Submit Match Result/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalled();
    });

    expect(
      screen.getByText(/Match result submitted successfully and sent to admin approval queue/i)
    ).toBeInTheDocument();
  });

  it('detects roster change pre-submit and requires review before sending', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    // First call returns initial roster (users 10, 11, 12)
    // Pre-submit call returns changed roster (user 10 was refunded, now only 11, 12 remain)
    const initialMatch = getMockDuoMatch();
    const modifiedMatch: matchesApi.MatchDetailStaffDto = {
      ...initialMatch,
      players: initialMatch.players.map((p: any) =>
        p.userId === '10' ? { ...p, refundedAt: '2026-10-11T12:00:00.000Z' } : p
      ),
    };

    let callCount = 0;
    vi.spyOn(matchesApi, 'getStaffMatchDetail').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { match: initialMatch };
      }
      return { match: modifiedMatch };
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/matches/401/result']}>
          <StaffAuthProvider>
            <Routes>
              <Route path="/matches/:id/result" element={<AddResult />} />
            </Routes>
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Confirmed Duo')).toBeInTheDocument();
    });

    // Upload file
    const file = new File(['valid-image-bytes'], 'scoreboard.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText(/Click to select screenshot/i), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole('button', { name: /Submit Match Result/i }));

    // Detects roster change and displays warning banner
    await waitFor(() => {
      expect(screen.getByText('Roster Changed Detected!')).toBeInTheDocument();
    });
  });

  it('displays rejection reason banner during resubmission', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    vi.spyOn(matchesApi, 'getStaffMatchResult').mockResolvedValue(
      loadContractFixture(
        'GET_staff_matches_id_result__rejected.json',
        matchResultStaffGuard,
        'GET /staff/matches/:id/result',
        (d) => {
          d.id = '99';
          d.matchId = '401';
          d.entries = [{ userId: '10', kills: 2, position: 1 }];
          d.rejectReason = 'Kills entered for player 10 did not match screenshot score';
        }
      )
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/matches/401/result']}>
          <StaffAuthProvider>
            <Routes>
              <Route path="/matches/:id/result" element={<AddResult />} />
            </Routes>
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Previous Result Rejected by Admin')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Kills entered for player 10 did not match screenshot score/i)
    ).toBeInTheDocument();
  });
});
