/**
 * Admin Result Approvals Page Tests for Staff Portal
 *
 * Requirements & Changes:
 * - Admin queue loads pending results from GET /admin/results.
 * - Payout preview displays collected, payout, difference, and warning banner.
 * - Screenshot rendered with referrerPolicy="no-referrer".
 * - Approve dialog re-fetches preview on open and displays total payout.
 * - Reject dialog requires reason >= 5 characters.
 * - Reverse dialog requires reason >= 5 characters; shows affected users table on LOW_BALANCE.
 * - Reverse success resets match to live.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { AdminResultApprovals } from '../src/pages/AdminResultApprovals.js';
import * as matchesApi from '../src/api/matches.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/context/StaffAuthContext.js';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

import { loadContractFixture } from './contractFixtures.js';
import {
  staffMeGuard,
  adminQueueResponseGuard,
  resultPayoutPreviewGuard,
  matchResultStaffGuard,
} from '../src/api/guards.js';

describe('Admin Result Approvals Page', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();

    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me', (d) => {
        d.profile.role = 'admin';
      })
    );

    vi.spyOn(matchesApi, 'getAdminResultsQueue').mockResolvedValue(
      loadContractFixture('GET_admin_results__pending.json', adminQueueResponseGuard, 'GET /staff/admin/results/queue', (d) => {
        d.results = [d.results[0]];
        d.results[0].matchId = '501';
        d.count = 1;
      })
    );

    vi.spyOn(matchesApi, 'getAdminResultPreview').mockResolvedValue(
      loadContractFixture('GET_admin_results_preview__normal.json', resultPayoutPreviewGuard, 'GET /staff/admin/results/:id/preview', (d) => {
        d.totalPayout = '65.00';
      })
    );

    vi.spyOn(matchesApi, 'getStaffMatchResult').mockResolvedValue(
      loadContractFixture('GET_staff_matches_id_result__pending.json', matchResultStaffGuard, 'GET /staff/matches/:id/result', (d) => {
        d.id = '1';
        d.matchId = '501';
        d.entries = [{ userId: '10', kills: 3, position: 1 }];
        d.screenshotUrl = 'results/501.jpg';
        d.signedScreenshotUrl = 'http://localhost:3000/api/v1/files/results/501.jpg?token=secret';
        d.status = 'pending_approval';
        d.rejectReason = null;
        d.submittedBy = '2';
        d.approvedBy = null;
        d.createdAt = '2026-10-11T12:00:00.000Z';
        d.approvedAt = null;
      })
    );
  });

  it('renders pending results queue and loads payout preview with warning banner', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'admin-token');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <AdminResultApprovals />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MAT-501')).toBeInTheDocument();
    });

    // Click to review preview
    fireEvent.click(screen.getByText('Review Preview'));

    await waitFor(() => {
      expect(screen.getByText('Payout Preview & Scoreboard Audit (M501)')).toBeInTheDocument();
    });

    // Payout and financial numbers displayed (Rs formatting)
    expect(screen.getByText('Rs40.00')).toBeInTheDocument(); // total collected
    expect(screen.getAllByText('Rs65.00').length).toBeGreaterThanOrEqual(1); // total payout
    expect(screen.getByText('Fiscal Discrepancy Warning')).toBeInTheDocument();
    expect(screen.getByText(/Payout exceeds total entry fees collected/i)).toBeInTheDocument();

    // Fresh signed screenshot rendered with referrerPolicy="no-referrer"
    const img = screen.getByAltText('Match scoreboard');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('referrerPolicy', 'no-referrer');
  });

  it('approve confirm modal re-fetches live preview on open and displays total payout', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'admin-token');

    const approveSpy = vi.spyOn(matchesApi, 'approveAdminResult').mockResolvedValue({
      matchId: '501',
      status: 'approved',
      message: 'Result approved and payouts credited',
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <AdminResultApprovals />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MAT-501')).toBeInTheDocument();
    });

    // Click approve button
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(screen.getByText('Approve Match Result (M501)')).toBeInTheDocument();
    });

    // Shows total payout in confirmation modal
    expect(screen.getByText('Total Winnings Disbursed:')).toBeInTheDocument();
    expect(screen.getByText('Rs65.00')).toBeInTheDocument();

    // Confirm approval
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Approval & Payout' }));

    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith('501');
    });
  });

  it('reject dialog enforces minimum 5 characters reason and calls reject API', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'admin-token');

    const rejectSpy = vi.spyOn(matchesApi, 'rejectAdminResult').mockResolvedValue({
      matchId: '501',
      status: 'rejected',
      reason: 'Incorrect kills recorded',
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <AdminResultApprovals />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MAT-501')).toBeInTheDocument();
    });

    // Click reject button
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    await waitFor(() => {
      expect(screen.getByText('Reject Match Result (M501)')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Rejection' });
    expect(confirmBtn).toBeDisabled();

    // Type valid reason
    const textarea = screen.getByPlaceholderText(/Screenshot kills do not match/i);
    fireEvent.change(textarea, { target: { value: 'Kills entered for player 10 do not match screenshot' } });

    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(rejectSpy).toHaveBeenCalledWith(
        '501',
        'Kills entered for player 10 do not match screenshot'
      );
    });
  });

  it('reverse dialog displays affected users table when LOW_BALANCE is returned', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'admin-token');

    vi.spyOn(matchesApi, 'reverseAdminResult').mockRejectedValue({
      code: 'LOW_BALANCE',
      message: 'Cannot reverse: insufficient winning balance',
      details: {
        affectedUsers: [
          { userId: '10', winningPaise: 1000, requiredPaise: 6500 },
        ],
      },
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <AdminResultApprovals />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-MAT-501')).toBeInTheDocument();
    });

    // Open Dispute Reversal modal
    fireEvent.click(screen.getByRole('button', { name: /Dispute Reversal/i }));

    await waitFor(() => {
      expect(screen.getByText('Reverse Match Result')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('e.g. 2'), { target: { value: '501' } });
    fireEvent.change(screen.getByPlaceholderText(/Dispute resolved in favor/i), {
      target: { value: 'Player disqualified after anti-cheat review' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Execute Reversal' }));

    // Affected users table displayed
    await waitFor(() => {
      expect(
        screen.getByText(/Cannot reverse result: One or more players have already withdrawn/i)
      ).toBeInTheDocument();
      expect(screen.getByText('#10')).toBeInTheDocument();
      expect(screen.getByText('Rs10.00')).toBeInTheDocument(); // available
      expect(screen.getByText('Rs65.00')).toBeInTheDocument(); // required
    });
  });
});
