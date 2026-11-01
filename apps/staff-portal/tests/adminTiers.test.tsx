/**
 * Admin Entry Tier Management Page Tests
 * Section 10 & 16.2
 *
 * Requirements:
 * - Constraint 2: The admin tier form uses exactly the field names of the real tier contract
 *   (killPrice, minKillsForReward, positions: [{position, prize}], maxPlayers, minPlayers, gameMode, teamMode, entryFee).
 *   Add a test that a create request built by the form validates against the API's request shape
 *   (use the API's own schema or a captured request example).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { EntryTiers } from '../src/pages/EntryTiers.js';
import * as adminApi from '../src/api/admin.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/context/StaffAuthContext.js';
import { loadContractFixture } from './contractFixtures.js';
import {
  staffMeGuard,
  entryTiersResponseGuard,
  createTierResponseGuard,
  updateTierResponseGuard,
  deleteTierResponseGuard,
} from '../src/api/guards.js';
import { createTierSchema } from '@booyah/shared';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe('Admin Entry Tiers Management Page', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'admin-token');
    vi.restoreAllMocks();

    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me', (d) => {
        d.profile.id = '1';
        d.profile.role = 'admin';
      })
    );
  });

  it('create request built by tier form validates against the API request schema using exact contract field names', async () => {
    vi.spyOn(adminApi, 'getAdminTiers').mockResolvedValue(
      loadContractFixture('GET_admin_tiers.json', entryTiersResponseGuard, 'GET /admin/tiers')
    );

    let capturedPayload: any = null;
    vi.spyOn(adminApi, 'createAdminTier').mockImplementation(async (payload) => {
      capturedPayload = payload;
      return loadContractFixture(
        'POST_admin_tiers.json',
        createTierResponseGuard,
        'POST /admin/tiers'
      );
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <EntryTiers />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('create-tier-btn')).toBeInTheDocument();
    });

    // Open create tier modal
    fireEvent.click(screen.getByTestId('create-tier-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('tier-modal')).toBeInTheDocument();
    });

    // Fill the tier form with custom values
    fireEvent.change(screen.getByTestId('tier-gameMode-select'), {
      target: { value: 'battle_royale' },
    });
    fireEvent.change(screen.getByTestId('tier-teamMode-select'), {
      target: { value: 'squad' },
    });
    fireEvent.change(screen.getByTestId('tier-entryFee-input'), {
      target: { value: '25.00' },
    });
    fireEvent.change(screen.getByTestId('tier-killPrice-input'), {
      target: { value: '10.00' },
    });
    fireEvent.change(screen.getByTestId('tier-minKillsForReward-input'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByTestId('tier-minPlayers-input'), {
      target: { value: '24' },
    });
    fireEvent.change(screen.getByTestId('tier-maxPlayers-input'), {
      target: { value: '48' },
    });

    // Submit form
    fireEvent.click(screen.getByTestId('submit-tier-btn'));

    await waitFor(() => {
      expect(capturedPayload).not.toBeNull();
    });

    // 1. Verify exact field names required by real tier contract
    expect(capturedPayload).toHaveProperty('gameMode');
    expect(capturedPayload).toHaveProperty('teamMode');
    expect(capturedPayload).toHaveProperty('entryFee');
    expect(capturedPayload).toHaveProperty('killPrice');
    expect(capturedPayload).toHaveProperty('minKillsForReward');
    expect(capturedPayload).toHaveProperty('maxPlayers');
    expect(capturedPayload).toHaveProperty('minPlayers');
    expect(capturedPayload).toHaveProperty('positions');

    // 2. Validate payload against API's own createTierSchema
    const parseResult = createTierSchema.safeParse(capturedPayload);
    expect(parseResult.success).toBe(true);
  });

  it('enforces clash squad fixed rules and auto-adjusts fields', async () => {
    vi.spyOn(adminApi, 'getAdminTiers').mockResolvedValue(
      loadContractFixture('GET_admin_tiers.json', entryTiersResponseGuard, 'GET /admin/tiers')
    );

    let capturedPayload: any = null;
    vi.spyOn(adminApi, 'createAdminTier').mockImplementation(async (payload) => {
      capturedPayload = payload;
      return loadContractFixture(
        'POST_admin_tiers.json',
        createTierResponseGuard,
        'POST /admin/tiers',
        (d) => {
          d.tier.gameMode = 'clash_squad';
          d.tier.teamMode = 'squad';
          d.tier.killPrice = '0.00';
          d.tier.maxPlayers = 8;
          d.tier.minPlayers = 8;
        }
      );
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <EntryTiers />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByTestId('create-tier-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('tier-modal')).toBeInTheDocument();
    });

    // Select Clash Squad
    fireEvent.change(screen.getByTestId('tier-gameMode-select'), {
      target: { value: 'clash_squad' },
    });

    // Check locked inputs
    const teamSelect = screen.getByTestId('tier-teamMode-select') as HTMLSelectElement;
    expect(teamSelect.value).toBe('squad');
    expect(teamSelect).toBeDisabled();

    const killPriceInput = screen.getByTestId('tier-killPrice-input') as HTMLInputElement;
    expect(killPriceInput.value).toBe('0.00');
    expect(killPriceInput).toBeDisabled();

    // Submit Clash Squad tier
    fireEvent.click(screen.getByTestId('submit-tier-btn'));

    await waitFor(() => {
      expect(capturedPayload).not.toBeNull();
    });

    expect(capturedPayload.gameMode).toBe('clash_squad');
    expect(capturedPayload.teamMode).toBe('squad');
    expect(capturedPayload.maxPlayers).toBe(8);
    expect(capturedPayload.minPlayers).toBe(8);
    expect(capturedPayload.killPrice).toBe('0.00');
    expect(createTierSchema.safeParse(capturedPayload).success).toBe(true);
  });

  it('renders profit guard warning banner returned by server on tier creation', async () => {
    vi.spyOn(adminApi, 'getAdminTiers').mockResolvedValue(
      loadContractFixture('GET_admin_tiers.json', entryTiersResponseGuard, 'GET /admin/tiers')
    );

    vi.spyOn(adminApi, 'createAdminTier').mockResolvedValue(
      loadContractFixture(
        'POST_admin_tiers.json',
        createTierResponseGuard,
        'POST /admin/tiers',
        (d) => {
          d.warning = 'Profit guard warning: Max possible payout (₹620.00) exceeds minimum collected fees (₹600.00).';
        }
      )
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <EntryTiers />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByTestId('create-tier-btn'));
    fireEvent.click(screen.getByTestId('submit-tier-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('profit-guard-banner')).toBeInTheDocument();
      expect(screen.getByText(/Profit guard warning: Max possible payout/i)).toBeInTheDocument();
    });
  });

  it('displays rule snapshot guarantee disclaimer and deletes tier with modal confirmation', async () => {
    vi.spyOn(adminApi, 'getAdminTiers').mockResolvedValue(
      loadContractFixture('GET_admin_tiers.json', entryTiersResponseGuard, 'GET /admin/tiers', (d) => {
        d.tiers = [d.tiers[0]];
      })
    );

    const deleteSpy = vi.spyOn(adminApi, 'deleteAdminTier').mockResolvedValue(
      loadContractFixture('DELETE_admin_tiers_id.json', deleteTierResponseGuard, 'DELETE /admin/tiers/:id')
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <EntryTiers />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Rule Snapshot Guarantee')).toBeInTheDocument();
    });

    // Delete tier
    fireEvent.click(screen.getByTestId('delete-tier-btn-1'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-tier-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-delete-tier-btn'));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('1');
    });
  });

  it('updates tier successfully when server response omits warning', async () => {
    vi.spyOn(adminApi, 'getAdminTiers').mockResolvedValue(
      loadContractFixture('GET_admin_tiers.json', entryTiersResponseGuard, 'GET /admin/tiers', (d) => {
        d.tiers = [d.tiers[0]];
      })
    );

    const updateSpy = vi.spyOn(adminApi, 'updateAdminTier').mockImplementation(async (id) => {
      const rawData = {
        tier: {
          id,
          gameMode: 'clash_squad',
          teamMode: 'squad',
          entryFee: '50.00',
          killPrice: '0.00',
          minKillsForReward: 0,
          maxPlayers: 8,
          minPlayers: 8,
          positions: [{ position: 1, prize: '90.00' }],
          createdAt: new Date().toISOString(),
        },
      };
      return updateTierResponseGuard.parse(rawData);
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <EntryTiers />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-tier-btn-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-tier-btn-1'));

    await waitFor(() => {
      expect(screen.getByTestId('tier-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('submit-tier-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByText(/unexpected response/i)).not.toBeInTheDocument();
      expect(screen.getByText('Entry tier updated successfully.')).toBeInTheDocument();
    });
  });
});

