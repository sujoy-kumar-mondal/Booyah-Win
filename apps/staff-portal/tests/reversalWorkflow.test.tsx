import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { AdminResultApprovals } from '../src/pages/AdminResultApprovals.js';
import * as matchesApi from '../src/api/matches.js';
import * as staffApi from '../src/api/staff.js';
import { ApiError, STAFF_TOKEN_STORAGE_KEY } from '../src/api/client.js';

import { loadContractFixture } from './contractFixtures.js';
import { staffMeGuard, adminQueueResponseGuard } from '../src/api/guards.js';

describe('Phase 5 Proof: Admin Result Reversal Workflow and Insufficient Balance Guard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'admin-token');
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me', (d) => {
        d.profile.role = 'admin';
      })
    );

    vi.spyOn(matchesApi, 'getAdminResultsQueue').mockResolvedValue(
      loadContractFixture('GET_admin_results__empty.json', adminQueueResponseGuard, 'GET /staff/admin/results/queue')
    );
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('validates min reason length before submitting reversal', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StaffAuthProvider>
            <AdminResultApprovals />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Open Dispute Reversal modal
    const disputeReversalBtn = await screen.findByRole('button', { name: /Dispute Reversal/i });
    fireEvent.click(disputeReversalBtn);

    const matchIdInput = await screen.findByPlaceholderText('e.g. 2');
    fireEvent.change(matchIdInput, { target: { value: 'match-101' } });

    const reasonInput = screen.getByPlaceholderText(/Dispute resolved in favor of runner up/i);
    fireEvent.change(reasonInput, { target: { value: 'tiny' } }); // < 5 chars

    const submitBtn = screen.getByRole('button', { name: /Execute Reversal/i });
    expect(submitBtn).toBeDisabled();

    // Type valid reason >= 5 characters
    fireEvent.change(reasonInput, { target: { value: 'Valid reason here' } });
    expect(submitBtn).not.toBeDisabled();
  });

  it('displays friendly message and affected users when LOW_BALANCE error prevents reversal', async () => {
    vi.spyOn(matchesApi, 'reverseAdminResult').mockRejectedValue(
      new ApiError(
        'LOW_BALANCE',
        'Cannot reverse result',
        {
          affectedUsers: [
            {
              userId: 'user-player-1',
              requiredWinningPaise: 5000,
              currentWinningPaise: 1000,
              deficitPaise: 4000,
            },
          ],
        },
        400
      )
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StaffAuthProvider>
            <AdminResultApprovals />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const disputeReversalBtn = await screen.findByRole('button', { name: /Dispute Reversal/i });
    fireEvent.click(disputeReversalBtn);

    const matchIdInput = await screen.findByPlaceholderText('e.g. 2');
    fireEvent.change(matchIdInput, { target: { value: 'match-101' } });

    const reasonInput = screen.getByPlaceholderText(/Dispute resolved in favor of runner up/i);
    fireEvent.change(reasonInput, { target: { value: 'Player dispute validated after review' } });

    const submitBtn = screen.getByRole('button', { name: /Execute Reversal/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Cannot reverse result: One or more players have already withdrawn or spent their winnings/i)
      ).toBeInTheDocument();
    });
  });

  it('successfully displays success message upon valid reversal', async () => {
    vi.spyOn(matchesApi, 'reverseAdminResult').mockResolvedValue({
      message: 'Result reversed successfully',
      matchId: 'match-101',
      status: 'reversed',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StaffAuthProvider>
            <AdminResultApprovals />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const disputeReversalBtn = await screen.findByRole('button', { name: /Dispute Reversal/i });
    fireEvent.click(disputeReversalBtn);

    const matchIdInput = await screen.findByPlaceholderText('e.g. 2');
    fireEvent.change(matchIdInput, { target: { value: 'match-101' } });

    const reasonInput = screen.getByPlaceholderText(/Dispute resolved in favor of runner up/i);
    fireEvent.change(reasonInput, { target: { value: 'Staff entered wrong scores for player 2' } });

    const submitBtn = screen.getByRole('button', { name: /Execute Reversal/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Result for Match #match-101 was reversed successfully/i)
      ).toBeInTheDocument();
    });
  });
});
