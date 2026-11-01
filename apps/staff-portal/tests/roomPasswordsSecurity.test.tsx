import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { MatchDetail } from '../src/pages/MatchDetail.js';
import * as matchesApi from '../src/api/matches.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/api/client.js';

import { loadContractFixture } from './contractFixtures.js';
import { staffMeGuard, matchDetailResponseGuard } from '../src/api/guards.js';

describe('Phase 5 Proof: Room Password Security - Masked by Default and Never Logged', () => {
  let queryClient: QueryClient;
  let logSpy: any;
  let warnSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'valid-token');
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, '/staff/me')
    );
  });

  afterEach(() => {
    sessionStorage.clear();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('room password is masked by default, can be revealed, and is never printed to logs', async () => {
    const sensitivePassword = 'SecretPass9988!';

    vi.spyOn(matchesApi, 'getStaffMatchDetail').mockResolvedValue(
      loadContractFixture(
        'GET_staff_matches_id__solo.json',
        matchDetailResponseGuard,
        'GET /staff/matches/:id',
        (data) => {
          data.match.roomId = 'ROOM-12345';
          data.match.roomPassword = sensitivePassword;
          data.match.status = 'room_open';
        }
      )
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/matches/match-101']}>
          <StaffAuthProvider>
            <Routes>
              <Route path="/matches/:id" element={<MatchDetail />} />
            </Routes>
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for match details to load
    await waitFor(() => {
      expect(screen.getByText('ROOM-12345')).toBeInTheDocument();
    });

    // Password must be masked by default
    expect(screen.getByText('••••••••••••')).toBeInTheDocument();
    expect(screen.queryByText(sensitivePassword)).not.toBeInTheDocument();

    // Click reveal button
    const revealBtn = screen.getByRole('button', { name: /reveal/i });
    fireEvent.click(revealBtn);

    // Now plain text password is visible
    expect(screen.getByText(sensitivePassword)).toBeInTheDocument();

    // Click hide button
    const hideBtn = screen.getByRole('button', { name: /hide/i });
    fireEvent.click(hideBtn);
    expect(screen.getByText('••••••••••••')).toBeInTheDocument();

    // Ensure password was NEVER logged to console
    const allCalls = [
      ...logSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ].flat().map(String);

    expect(allCalls.some((c) => c.includes(sensitivePassword))).toBe(false);
  });
});
