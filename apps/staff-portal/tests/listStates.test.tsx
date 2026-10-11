import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { Matches } from '../src/pages/Matches.js';
import * as matchesApi from '../src/api/matches.js';
import * as staffApi from '../src/api/staff.js';
import { ApiError, STAFF_TOKEN_STORAGE_KEY } from '../src/api/client.js';

import { loadContractFixture } from './contractFixtures.js';
import { staffMeGuard, matchListResponseGuard } from '../src/api/guards.js';

describe('Phase 5 Proof: List States - Loading Skeleton, Empty State, and Friendly Error State', () => {
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

  it('renders loading state indicator while match query is fetching', () => {
    vi.spyOn(matchesApi, 'getStaffMatches').mockReturnValue(new Promise(() => {}));

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Matches />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('matches-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading matches catalog/i)).toBeInTheDocument();
  });

  it('renders empty state when returned match list contains 0 items', async () => {
    vi.spyOn(matchesApi, 'getStaffMatches').mockResolvedValue(
      loadContractFixture('GET_staff_matches.json', matchListResponseGuard, 'GET /staff/matches', (d) => {
        d.matches = [];
        d.nextCursor = null;
      })
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Matches />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByTestId('matches-empty')).toBeInTheDocument();
    expect(screen.getByText(/no matches found/i)).toBeInTheDocument();
  });

  it('renders friendly error message when match query fails with ApiError', async () => {
    vi.spyOn(matchesApi, 'getStaffMatches').mockRejectedValue(
      new ApiError('UNEXPECTED_RESPONSE', 'unexpected response, please refresh', {}, 500)
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Matches />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByTestId('matches-error')).toBeInTheDocument();
    expect(screen.getByText('unexpected response, please refresh')).toBeInTheDocument();
  });
});
