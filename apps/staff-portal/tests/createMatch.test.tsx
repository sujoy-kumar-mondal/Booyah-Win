/**
 * Create Match Page Tests for Staff Portal
 *
 * Requirements & Changes:
 * - Tier filtering by gameMode and teamMode.
 * - Clash Squad fixed to squad mode.
 * - Start time converts to IST ISO string with fixed +05:30 offset.
 * - Validates start time must be in future (IST).
 * - Displays snapshot values card after creation.
 * - Double-click guards.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { CreateMatch } from '../src/pages/CreateMatch.js';
import * as matchesApi from '../src/api/matches.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/context/StaffAuthContext.js';
import { staffMeGuard, entryTiersResponseGuard, matchStaffDtoGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';
import { z } from 'zod';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

const mockTiers: matchesApi.EntryTierDto[] = [
  {
    id: '1',
    gameMode: 'battle_royale',
    teamMode: 'solo',
    entryFee: '10.00',
    killPrice: '5.00',
    minKillsForReward: 2,
    maxPlayers: 48,
    minPlayers: 24,
    positions: [
      { position: 1, prize: '100.00' },
      { position: 2, prize: '60.00' },
    ],
    createdAt: '2026-10-10T12:00:00.000Z',
  },
  {
    id: '2',
    gameMode: 'battle_royale',
    teamMode: 'duo',
    entryFee: '20.00',
    killPrice: '10.00',
    minKillsForReward: 2,
    maxPlayers: 48,
    minPlayers: 24,
    positions: [{ position: 1, prize: '200.00' }],
    createdAt: '2026-10-10T12:00:00.000Z',
  },
  {
    id: '3',
    gameMode: 'clash_squad',
    teamMode: 'squad',
    entryFee: '50.00',
    killPrice: '0.00',
    minKillsForReward: 0,
    maxPlayers: 8,
    minPlayers: 8,
    positions: [{ position: 1, prize: '300.00' }],
    createdAt: '2026-10-10T12:00:00.000Z',
  },
];

describe('Create Match Page', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();

    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me')
    );

    vi.spyOn(matchesApi, 'getStaffEntryTiers').mockResolvedValue(
      loadContractFixture('GET_staff_entry-tiers.json', entryTiersResponseGuard, 'GET /staff/entry-tiers', (d) => {
        d.tiers = mockTiers;
      })
    );
  });

  it('filters available entry tiers based on selected gameMode and teamMode', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <CreateMatch />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Default: Battle Royale + Solo -> Tier #1 should be present in dropdown
    await waitFor(() => {
      const select = screen.getByLabelText('3. Choose Entry Tier');
      expect(select).toBeInTheDocument();
    });

    expect(screen.getByText(/Tier #1 - Entry: ₹10.00/)).toBeInTheDocument();
    expect(screen.queryByText(/Tier #2 - Entry: ₹20.00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tier #3 - Entry: ₹50.00/)).not.toBeInTheDocument();

    // Change to Duo mode
    fireEvent.click(screen.getByText('duo'));

    // Now Tier #2 is in dropdown
    expect(screen.getByText(/Tier #2 - Entry: ₹20.00/)).toBeInTheDocument();
    expect(screen.queryByText(/Tier #1 - Entry: ₹10.00/)).not.toBeInTheDocument();

    // Switch to Clash Squad
    fireEvent.click(screen.getByText('Clash Squad'));

    // Team mode is fixed to Squad Only, and Tier #3 is in dropdown
    expect(screen.getByText('Squad Only')).toBeInTheDocument();
    expect(screen.getByText(/Tier #3 - Entry: ₹50.00/)).toBeInTheDocument();
  });

  it('rejects past/present start time with validation error', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <CreateMatch />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('3. Choose Entry Tier')).toBeInTheDocument();
    });

    // Select Tier 1
    fireEvent.change(screen.getByLabelText('3. Choose Entry Tier'), {
      target: { value: '1' },
    });

    // Enter a past date (2020-01-01)
    fireEvent.change(screen.getByLabelText(/Date/i), {
      target: { value: '2020-01-01' },
    });
    fireEvent.change(screen.getByLabelText(/Time/i), {
      target: { value: '10:00' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Schedule Match/i }));

    await waitFor(() => {
      expect(screen.getByText(/Start time must be strictly in the future/i)).toBeInTheDocument();
    });
  });

  it('creates match with fixed +05:30 IST ISO string and renders snapshot values card', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'test-token');

    const createSpy = vi.spyOn(matchesApi, 'createStaffMatch').mockResolvedValue(
      loadContractFixture(
        'POST_staff_matches.json',
        z.object({ match: matchStaffDtoGuard }).passthrough(),
        'POST /staff/matches',
        (d) => {
          d.match.id = '201';
          d.match.startTime = '2027-10-15T18:30:00+05:30';
        }
      )
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <CreateMatch />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('3. Choose Entry Tier')).toBeInTheDocument();
    });

    // Select tier 1
    fireEvent.change(screen.getByLabelText('3. Choose Entry Tier'), {
      target: { value: '1' },
    });

    // Set future date and time
    fireEvent.change(screen.getByLabelText(/Date/i), {
      target: { value: '2027-10-15' },
    });
    fireEvent.change(screen.getByLabelText(/Time/i), {
      target: { value: '18:30' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Schedule Match/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        tierId: '1',
        startTime: '2027-10-15T18:30:00+05:30',
      });
    });

    // Displays snapshot values card
    await waitFor(() => {
      expect(screen.getByText('Match Created Successfully!')).toBeInTheDocument();
      expect(screen.getByText('M201')).toBeInTheDocument();
      expect(screen.getByText('View Match Detail')).toBeInTheDocument();
    });
  });
});
