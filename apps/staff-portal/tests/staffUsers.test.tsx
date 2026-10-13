/**
 * Employee User Directory & Detail Drawer Tests
 * Section 15 & Task B
 *
 * Requirements:
 * - Employee role accesses read-only user directory.
 * - Sensitive fields are strictly masked: mobile (******7890), UPI (****1234@upi).
 * - Strict allowlist enforcement: NO DOB, PAN, Aadhaar, or referral chain.
 * - Delete user and balance adjust buttons are hidden.
 * - 5-tab detail drawer: Profile, Wallets, Transactions, Matches, Requests (two-step approval statuses).
 * - Daily distinct view cap rate limit (300 views/day) error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { Users } from '../src/pages/Users.js';
import * as staffUsersApi from '../src/api/staffUsers.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/context/StaffAuthContext.js';
import { loadContractFixture } from './contractFixtures.js';
import {
  staffMeGuard,
  staffUserListResponseGuard,
  staffUserDetailResponseGuard,
} from '../src/api/guards.js';
import { ApiError } from '../src/api/client.js';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe('Employee User Directory & 5-Tab Detail Drawer', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'employee-token');
    vi.restoreAllMocks();

    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me', (d) => {
        d.profile.id = '2';
        d.profile.name = 'Employee John';
        d.profile.role = 'employee';
      })
    );
  });

  it('employee views users list with masked mobile and without delete or adjust buttons', async () => {
    const listSpy = vi.spyOn(staffUsersApi, 'getStaffUsers').mockResolvedValue(
      loadContractFixture('GET_staff_users.json', staffUserListResponseGuard, 'GET /staff/users', (d) => {
        d.items = [
          {
            id: '10',
            name: 'Target Player',
            email: 'player@example.com',
            mobile: '******7890',
            ffId: '55667788',
            ffName: 'ProTarget',
            upiId: '****1234@upi',
            isDeleted: false,
            deletedAt: null,
            createdAt: '2026-10-13T10:00:00.000Z',
          },
        ];
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Users />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Target Player')).toBeInTheDocument();
    });

    expect(listSpy).toHaveBeenCalled();
    expect(screen.getByText('******7890')).toBeInTheDocument();

    // Verify delete and adjust balance buttons are NOT rendered for employees
    expect(screen.queryByTestId('adjust-balance-btn-10')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-user-btn-10')).not.toBeInTheDocument();
  });

  it('clicking a user row opens the 5-tab drawer without adjust button', async () => {
    vi.spyOn(staffUsersApi, 'getStaffUsers').mockResolvedValue(
      loadContractFixture('GET_staff_users.json', staffUserListResponseGuard, 'GET /staff/users', (d) => {
        d.items = [
          {
            id: '1',
            name: 'Player One',
            email: 'player1@example.com',
            mobile: '******3210',
            ffId: '12345678',
            ffName: 'ProPlayer1',
            upiId: '****1234@upi',
            isDeleted: false,
            deletedAt: null,
            createdAt: '2026-10-13T10:00:00.000Z',
          },
        ];
      })
    );

    const detailSpy = vi.spyOn(staffUsersApi, 'getStaffUserDetail').mockResolvedValue(
      loadContractFixture('GET_staff_users_id.json', staffUserDetailResponseGuard, 'GET /staff/users/:id', (d) => {
        d.profile.id = '1';
        d.profile.name = 'Player One';
        d.profile.mobile = '******3210';
        d.profile.upiId = '****1234@upi';
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Users />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-row-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('user-row-1'));

    await waitFor(() => {
      expect(detailSpy).toHaveBeenCalledWith('1');
      expect(screen.getByTestId('tab-profile')).toBeInTheDocument();
    });

    // Check all 5 tabs exist
    expect(screen.getByTestId('tab-profile')).toBeInTheDocument();
    expect(screen.getByTestId('tab-wallets')).toBeInTheDocument();
    expect(screen.getByTestId('tab-transactions')).toBeInTheDocument();
    expect(screen.getByTestId('tab-matches')).toBeInTheDocument();
    expect(screen.getByTestId('tab-requests')).toBeInTheDocument();

    // Check adjust button is NOT present in detail view
    expect(screen.queryByTestId('detail-adjust-balance-btn')).not.toBeInTheDocument();
  });

  it('profile tab strictly enforces allowlist: shows masked mobile and upi, and NO DOB, PAN, Aadhaar, or referral code', async () => {
    vi.spyOn(staffUsersApi, 'getStaffUsers').mockResolvedValue(
      loadContractFixture('GET_staff_users.json', staffUserListResponseGuard, 'GET /staff/users', (d) => {
        d.items = [d.items[0]];
        d.items[0].id = '1';
      })
    );

    vi.spyOn(staffUsersApi, 'getStaffUserDetail').mockResolvedValue(
      loadContractFixture('GET_staff_users_id.json', staffUserDetailResponseGuard, 'GET /staff/users/:id', (d) => {
        d.profile.id = '1';
        d.profile.name = 'Allowlist Player';
        d.profile.email = 'allowlist@example.com';
        d.profile.mobile = '******7890';
        d.profile.upiId = '****1234@upi';
        d.profile.ffId = '99988877';
        d.profile.ffName = 'AllowlistIGN';
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Users />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-row-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('user-row-1'));

    await waitFor(() => {
      expect(screen.getByTestId('employee-profile-tab')).toBeInTheDocument();
    });

    // Verify allowed & masked fields are visible within profile tab
    const profileTab = screen.getByTestId('employee-profile-tab');
    expect(within(profileTab).getByText('Allowlist Player')).toBeInTheDocument();
    expect(within(profileTab).getByText('allowlist@example.com')).toBeInTheDocument();
    expect(within(profileTab).getByText('******7890')).toBeInTheDocument();
    expect(within(profileTab).getByText('****1234@upi')).toBeInTheDocument();
    expect(within(profileTab).getByText('99988877')).toBeInTheDocument();
    expect(within(profileTab).getByText('(AllowlistIGN)')).toBeInTheDocument();

    // STRICT ALLOWLIST ASSERTIONS: Prohibited sensitive fields must NOT be rendered
    expect(within(profileTab).queryByText(/Date of Birth/i)).not.toBeInTheDocument();
    expect(within(profileTab).queryByText(/Referral Code/i)).not.toBeInTheDocument();
    expect(within(profileTab).queryByText(/PAN/i)).not.toBeInTheDocument();
    expect(within(profileTab).queryByText(/Aadhaar/i)).not.toBeInTheDocument();
  });

  it('wallets tab displays string-formatted Indian rupee balances for each wallet', async () => {
    vi.spyOn(staffUsersApi, 'getStaffUsers').mockResolvedValue(
      loadContractFixture('GET_staff_users.json', staffUserListResponseGuard, 'GET /staff/users', (d) => {
        d.items = [d.items[0]];
        d.items[0].id = '1';
      })
    );

    vi.spyOn(staffUsersApi, 'getStaffUserDetail').mockResolvedValue(
      loadContractFixture('GET_staff_users_id.json', staffUserDetailResponseGuard, 'GET /staff/users/:id', (d) => {
        d.wallets = {
          addMoney: '250.50',
          cashback: '30.00',
          winning: '120.00',
          total: '400.50',
        };
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Users />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-row-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('user-row-1'));

    await waitFor(() => {
      expect(screen.getByTestId('tab-wallets')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-wallets'));

    await waitFor(() => {
      expect(screen.getByTestId('employee-wallets-tab')).toBeInTheDocument();
    });

    expect(screen.getByTestId('user-wallet-addMoney')).toHaveTextContent('Rs250.50');
    expect(screen.getByTestId('user-wallet-cashback')).toHaveTextContent('Rs30.00');
    expect(screen.getByTestId('user-wallet-winning')).toHaveTextContent('Rs120.00');
    expect(screen.getByTestId('user-wallet-total')).toHaveTextContent('Rs400.50');
  });

  it('transactions and matches tabs display history records', async () => {
    vi.spyOn(staffUsersApi, 'getStaffUsers').mockResolvedValue(
      loadContractFixture('GET_staff_users.json', staffUserListResponseGuard, 'GET /staff/users', (d) => {
        d.items = [d.items[0]];
        d.items[0].id = '1';
      })
    );

    vi.spyOn(staffUsersApi, 'getStaffUserDetail').mockResolvedValue(
      loadContractFixture('GET_staff_users_id.json', staffUserDetailResponseGuard, 'GET /staff/users/:id', (d) => {
        d.recentLedger = [
          {
            id: 101,
            wallet: 'winning',
            type: 'tournament_prize',
            amount: '150.00',
            balanceAfter: '150.00',
            totalAfter: '300.00',
            refType: 'match',
            refId: '55',
            createdAt: '2026-10-13T10:15:00.000Z',
          },
        ];
        d.recentMatches = [
          {
            matchId: '77',
            gameMode: 'battle_royale',
            teamMode: 'solo',
            entryFee: '10.00',
            startTime: '2026-10-13T10:00:00.000Z',
            matchStatus: 'completed',
            kills: 5,
            position: 1,
            payout: '75.00',
            displayStatus: 'Booyah',
            joinedAt: '2026-10-13T09:50:00.000Z',
          },
        ];
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Users />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-row-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('user-row-1'));

    // 1. Transactions tab
    await waitFor(() => {
      expect(screen.getByTestId('tab-transactions')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('tab-transactions'));

    await waitFor(() => {
      expect(screen.getByTestId('employee-transactions-tab')).toBeInTheDocument();
    });
    expect(within(screen.getByTestId('employee-transactions-tab')).getByText(/tournament prize/i)).toBeInTheDocument();
    expect(within(screen.getByTestId('employee-transactions-tab')).getByText('+Rs150.00')).toBeInTheDocument();

    // 2. Matches tab
    fireEvent.click(screen.getByTestId('tab-matches'));
    await waitFor(() => {
      expect(screen.getByTestId('employee-matches-tab')).toBeInTheDocument();
    });
    expect(screen.getByText('BW-MAT-77')).toBeInTheDocument();
    expect(screen.getByText('Booyah (5 kills)')).toBeInTheDocument();
    expect(screen.getByText('Payout: Rs75.00')).toBeInTheDocument();
  });

  it('requests tab displays pending deposits and withdrawals with two-step approval statuses', async () => {
    vi.spyOn(staffUsersApi, 'getStaffUsers').mockResolvedValue(
      loadContractFixture('GET_staff_users.json', staffUserListResponseGuard, 'GET /staff/users', (d) => {
        d.items = [d.items[0]];
        d.items[0].id = '1';
      })
    );

    vi.spyOn(staffUsersApi, 'getStaffUserDetail').mockResolvedValue(
      loadContractFixture('GET_staff_users_id.json', staffUserDetailResponseGuard, 'GET /staff/users/:id', (d) => {
        d.pendingRequests = {
          deposits: [
            {
              id: '501',
              amount: '100.00',
              status: 'employee_approved',
              createdAt: '2026-10-13T10:00:00.000Z',
            },
          ],
          withdrawals: [
            {
              id: '601',
              amount: '200.00',
              status: 'pending',
              createdAt: '2026-10-13T10:05:00.000Z',
            },
          ],
        };
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Users />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-row-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('user-row-1'));

    await waitFor(() => {
      expect(screen.getByTestId('tab-requests')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('tab-requests'));

    await waitFor(() => {
      expect(screen.getByTestId('employee-requests-tab')).toBeInTheDocument();
    });

    expect(screen.getByText('DEP-501')).toBeInTheDocument();
    expect(screen.getByText('Rs100.00')).toBeInTheDocument();
    expect(screen.getByText('employee approved')).toBeInTheDocument();

    expect(screen.getByText('WDR-601')).toBeInTheDocument();
    expect(screen.getByText('Rs200.00')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('displays friendly error message when employee hits the 300 daily view cap', async () => {
    vi.spyOn(staffUsersApi, 'getStaffUsers').mockResolvedValue(
      loadContractFixture('GET_staff_users.json', staffUserListResponseGuard, 'GET /staff/users', (d) => {
        d.items = [d.items[0]];
        d.items[0].id = '1';
      })
    );

    vi.spyOn(staffUsersApi, 'getStaffUserDetail').mockRejectedValue(
      new ApiError(429, 'RATE_LIMITED', 'Daily user detail view limit reached (300 views/day). Contact administrator if you need an increase.')
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Users />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-row-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('user-row-1'));

    await waitFor(() => {
      expect(screen.getByTestId('user-detail-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('user-detail-error')).toHaveTextContent(
      'Daily user detail view limit reached (300 views/day). Contact administrator if you need an increase.'
    );
  });
});
