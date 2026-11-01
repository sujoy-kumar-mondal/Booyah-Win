import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { MatchDetail } from '../src/pages/MatchDetail.js';
import * as matchesApi from '../src/api/matches.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/api/client.js';
import { staffMeGuard, matchDetailResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Phase 5 Proof: Roster Scaling to 48 Players in Battle Royale', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'valid-token');
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me')
    );
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders a full 48-player Battle Royale roster with player IDs and FF identities', async () => {
    // Generate 48 players
    const players = Array.from({ length: 48 }, (_, i) => ({
      userId: `user-${i + 1}`,
      name: `Player ${i + 1}`,
      ffId: `FF-${1000000 + i}`,
      ffName: `ProGamer_${i + 1}`,
      teamId: null,
      paidAddMoney: '25.00',
      paidCashback: '0.00',
      paidWinning: '0.00',
      refundedAt: null,
      joinedAt: new Date(Date.now() - (48 - i) * 60000).toISOString(),
    }));

    vi.spyOn(matchesApi, 'getStaffMatchDetail').mockResolvedValue(
      loadContractFixture('GET_staff_matches_id__solo.json', matchDetailResponseGuard, 'GET /staff/matches/:id', (d) => {
        d.match.id = 'match-br-48';
        d.match.roomId = 'BR-ROOM-48';
        d.match.roomPassword = 'pass';
        d.match.status = 'room_open';
        d.match.joinedCount = 48;
        d.match.players = players;
        d.match.teams = [];
      })
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/matches/match-br-48']}>
          <StaffAuthProvider>
            <Routes>
              <Route path="/matches/:id" element={<MatchDetail />} />
            </Routes>
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify 48 players header
    await waitFor(() => {
      expect(screen.getByText(/Roster Players \(48 Active \/ 48 Total\)/i)).toBeInTheDocument();
    });

    // Verify first and last player are both rendered
    expect(screen.getByText('Player 1')).toBeInTheDocument();
    expect(screen.getByText('FFID: FF-1000000')).toBeInTheDocument();
    expect(screen.getByText('Player 48')).toBeInTheDocument();
    expect(screen.getByText('FFID: FF-1000047')).toBeInTheDocument();
  });
});
