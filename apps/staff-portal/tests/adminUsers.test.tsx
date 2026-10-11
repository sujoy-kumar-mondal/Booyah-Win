/**
 * Admin User Management Page Tests
 * Section 16.3
 *
 * Requirements:
 * - Constraint 5: Balance adjustment dialog:
 *   a) show the user's current wallet balances
 *   b) require typing the user's ID to enable the confirm button
 *   c) keep the button disabled for 2 seconds after the dialog opens
 *   d) show that the adjustment is permanently recorded in the audit log. Test each.
 * - Constraint 8: Search results from an older request never overwrite a newer one. Test it.
 * - Constraint 9: If a user is deleted while their detail view is open, the view refreshes and shows "Deleted".
 * - Constraint 11: autocomplete="off" on PAN, Aadhaar and reason inputs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { Users } from '../src/pages/Users.js';
import * as adminApi from '../src/api/admin.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/context/StaffAuthContext.js';
import { loadContractFixture } from './contractFixtures.js';
import {
  staffMeGuard,
  adminUserListResponseGuard,
  adminUserDetailResponseGuard,
  adminUserDeleteResponseGuard,
} from '../src/api/guards.js';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe('Admin User Management Page', () => {
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

  it('balance adjustment dialog shows user current wallet balances', async () => {
    vi.spyOn(adminApi, 'getAdminUsers').mockResolvedValue(
      loadContractFixture('GET_admin_users.json', adminUserListResponseGuard, 'GET /admin/users', (d) => {
        d.items = [d.items[0]];
        d.items[0].id = '1';
      })
    );

    vi.spyOn(adminApi, 'getAdminUserDetail').mockResolvedValue(
      loadContractFixture('GET_admin_users_id.json', adminUserDetailResponseGuard, 'GET /admin/users/:id', (d) => {
        d.wallets = {
          addMoney: '130.00',
          cashback: '20.00',
          winning: '50.00',
          total: '200.00',
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
      expect(screen.getByTestId('adjust-balance-btn-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('adjust-balance-btn-1'));

    await waitFor(() => {
      expect(screen.getByTestId('adjust-balance-modal')).toBeInTheDocument();
    });

    // Check that current wallet balances are displayed inside the dialog
    const walletsBox = screen.getByTestId('adjust-user-current-wallets');
    expect(walletsBox).toHaveTextContent('Rs130.00'); // Add Money
    expect(walletsBox).toHaveTextContent('Rs20.00');  // Cashback
    expect(walletsBox).toHaveTextContent('Rs50.00');  // Winning
  });

  it('balance adjustment dialog requires typing user ID to enable confirm button', async () => {
    vi.useFakeTimers();

    vi.spyOn(adminApi, 'getAdminUsers').mockResolvedValue(
      loadContractFixture('GET_admin_users.json', adminUserListResponseGuard, 'GET /admin/users', (d) => {
        d.items = [d.items[0]];
        d.items[0].id = '1';
      })
    );

    vi.spyOn(adminApi, 'getAdminUserDetail').mockResolvedValue(
      loadContractFixture('GET_admin_users_id.json', adminUserDetailResponseGuard, 'GET /admin/users/:id')
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

    await vi.waitFor(() => {
      expect(screen.getByTestId('adjust-balance-btn-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('adjust-balance-btn-1'));

    await vi.waitFor(() => {
      expect(screen.getByTestId('adjust-balance-modal')).toBeInTheDocument();
    });

    // Fast forward past the 2s timer
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    // Fill amount and reason
    fireEvent.change(screen.getByTestId('adjust-amount-input'), { target: { value: '50.00' } });
    fireEvent.change(screen.getByTestId('adjust-reason-input'), {
      target: { value: 'Dispute compensation verified' },
    });

    const confirmBtn = screen.getByTestId('submit-adjust-balance-btn');
    const idInput = screen.getByTestId('adjust-confirm-id-input');

    // Without typing ID: button remains disabled
    expect(confirmBtn).toBeDisabled();

    // Type incorrect user ID: button remains disabled
    fireEvent.change(idInput, { target: { value: '999' } });
    expect(confirmBtn).toBeDisabled();

    // Type exact correct user ID ("1"): button becomes enabled
    fireEvent.change(idInput, { target: { value: '1' } });
    expect(confirmBtn).not.toBeDisabled();

    vi.useRealTimers();
  });

  it('balance adjustment dialog keeps confirm button disabled for 2 seconds after opening', async () => {
    vi.useFakeTimers();

    vi.spyOn(adminApi, 'getAdminUsers').mockResolvedValue(
      loadContractFixture('GET_admin_users.json', adminUserListResponseGuard, 'GET /admin/users', (d) => {
        d.items = [d.items[0]];
        d.items[0].id = '1';
      })
    );

    vi.spyOn(adminApi, 'getAdminUserDetail').mockResolvedValue(
      loadContractFixture('GET_admin_users_id.json', adminUserDetailResponseGuard, 'GET /admin/users/:id')
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

    await vi.waitFor(() => {
      expect(screen.getByTestId('adjust-balance-btn-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('adjust-balance-btn-1'));

    await vi.waitFor(() => {
      expect(screen.getByTestId('adjust-balance-modal')).toBeInTheDocument();
    });

    // Immediately fill valid amount, reason, and matching user ID
    fireEvent.change(screen.getByTestId('adjust-amount-input'), { target: { value: '50.00' } });
    fireEvent.change(screen.getByTestId('adjust-reason-input'), {
      target: { value: 'Tournament bonus adjustment' },
    });
    fireEvent.change(screen.getByTestId('adjust-confirm-id-input'), { target: { value: '1' } });

    const confirmBtn = screen.getByTestId('submit-adjust-balance-btn');

    // Within first 1000ms: still disabled due to 2-second lock
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(confirmBtn).toBeDisabled();

    // Advance remaining 1100ms (total > 2000ms): lock released and button enables
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(confirmBtn).not.toBeDisabled();

    vi.useRealTimers();
  });

  it('balance adjustment dialog shows adjustment is permanently recorded in immutable audit log', async () => {
    vi.spyOn(adminApi, 'getAdminUsers').mockResolvedValue(
      loadContractFixture('GET_admin_users.json', adminUserListResponseGuard, 'GET /admin/users', (d) => {
        d.items = [d.items[0]];
        d.items[0].id = '1';
      })
    );

    vi.spyOn(adminApi, 'getAdminUserDetail').mockResolvedValue(
      loadContractFixture('GET_admin_users_id.json', adminUserDetailResponseGuard, 'GET /admin/users/:id')
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
      expect(screen.getByTestId('adjust-balance-btn-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('adjust-balance-btn-1'));

    await waitFor(() => {
      expect(screen.getByTestId('adjust-balance-modal')).toBeInTheDocument();
    });

    // Verify audit log notice is present
    expect(screen.getByText('Immutable Audit Trace')).toBeInTheDocument();
    expect(
      screen.getByText(/This adjustment is permanently recorded in the immutable audit log/i)
    ).toBeInTheDocument();
  });

  it('search results from an older request never overwrite a newer one in users list', async () => {
    let resolveFirstQuery: ((val: any) => void) | null = null;
    let resolveSecondQuery: ((val: any) => void) | null = null;

    const fixtureSlow = loadContractFixture(
      'GET_admin_users.json',
      adminUserListResponseGuard,
      'GET /admin/users',
      (d) => {
        d.items = [
          {
            id: '10',
            name: 'Slow User Search',
            email: 'slow@booyah.win',
            mobile: '9111111111',
            ffId: '11111',
            ffName: 'SlowFF',
            upiId: 'slow@upi',
            isDeleted: false,
            deletedAt: null,
            createdAt: '2026-10-11T16:26:05.722Z',
          },
        ];
      }
    );

    const fixtureFast = loadContractFixture(
      'GET_admin_users.json',
      adminUserListResponseGuard,
      'GET /admin/users',
      (d) => {
        d.items = [
          {
            id: '20',
            name: 'Fast User Search',
            email: 'fast@booyah.win',
            mobile: '9222222222',
            ffId: '22222',
            ffName: 'FastFF',
            upiId: 'fast@upi',
            isDeleted: false,
            deletedAt: null,
            createdAt: '2026-10-11T16:26:05.722Z',
          },
        ];
      }
    );

    vi.spyOn(adminApi, 'getAdminUsers').mockImplementation((params) => {
      if (params?.q === 'slow') {
        return new Promise((resolve) => {
          resolveFirstQuery = () => resolve(fixtureSlow);
        });
      }
      if (params?.q === 'fast') {
        return new Promise((resolve) => {
          resolveSecondQuery = () => resolve(fixtureFast);
        });
      }
      return Promise.resolve(fixtureSlow);
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Users />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const searchInput = screen.getByTestId('user-search-input');

    // Trigger older search "slow"
    fireEvent.change(searchInput, { target: { value: 'slow' } });

    // Trigger newer search "fast" immediately
    fireEvent.change(searchInput, { target: { value: 'fast' } });

    // Resolve newer first
    expect(resolveSecondQuery).not.toBeNull();
    resolveSecondQuery!(null);

    await waitFor(() => {
      expect(screen.getByText('Fast User Search')).toBeInTheDocument();
    });

    // Resolve older later
    expect(resolveFirstQuery).not.toBeNull();
    resolveFirstQuery!(null);

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('Fast User Search')).toBeInTheDocument();
    expect(screen.queryByText('Slow User Search')).not.toBeInTheDocument();
  });

  it('if a user is deleted while their detail view is open, the view refreshes and shows "Deleted"', async () => {
    vi.spyOn(adminApi, 'getAdminUsers').mockResolvedValue(
      loadContractFixture('GET_admin_users.json', adminUserListResponseGuard, 'GET /admin/users', (d) => {
        d.items = [d.items[0]];
        d.items[0].id = '5';
        d.items[0].name = 'Player Five';
      })
    );

    let isDeletedState = false;
    vi.spyOn(adminApi, 'getAdminUserDetail').mockImplementation(async (id) => {
      return loadContractFixture(
        'GET_admin_users_id.json',
        adminUserDetailResponseGuard,
        'GET /admin/users/:id',
        (d) => {
          d.profile.id = id;
          d.profile.name = 'Player Five';
          if (isDeletedState) {
            d.profile.isDeleted = true;
            d.profile.deletedReason = 'Account banned for cheating violation';
            d.profile.deletedAt = '2026-10-11T16:26:06.467Z';
          }
        }
      );
    });

    vi.spyOn(adminApi, 'deleteAdminUser').mockImplementation(async (id) => {
      isDeletedState = true;
      return loadContractFixture(
        'DELETE_admin_users_id.json',
        adminUserDeleteResponseGuard,
        'DELETE /admin/users/:id',
        (d) => {
          d.id = id;
        }
      );
    });

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
      expect(screen.getByText('Player Five')).toBeInTheDocument();
    });

    // Click row to open detail view
    fireEvent.click(screen.getByTestId('user-row-5'));

    await waitFor(() => {
      expect(screen.getByTestId('user-detail-panel')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('detail-deleted-badge')).not.toBeInTheDocument();

    // Now delete the user while detail panel is open
    fireEvent.click(screen.getByTestId('delete-user-btn-5'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-user-modal')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('delete-user-reason-input'), {
      target: { value: 'Account banned for cheating violation' },
    });

    fireEvent.click(screen.getByTestId('confirm-delete-user-btn'));

    // Detail view refreshes and displays "Deleted" badge and deletion details box
    await waitFor(() => {
      expect(screen.getByTestId('detail-deleted-badge')).toBeInTheDocument();
      expect(screen.getByTestId('detail-deleted-info-box')).toBeInTheDocument();
      expect(screen.getByText(/Account banned for cheating violation/i)).toBeInTheDocument();
    });
  });

  it('autocomplete is off on reason inputs in user delete and adjust dialogs', async () => {
    vi.spyOn(adminApi, 'getAdminUsers').mockResolvedValue(
      loadContractFixture('GET_admin_users.json', adminUserListResponseGuard, 'GET /admin/users', (d) => {
        d.items = [d.items[0]];
        d.items[0].id = '1';
      })
    );

    vi.spyOn(adminApi, 'getAdminUserDetail').mockResolvedValue(
      loadContractFixture('GET_admin_users_id.json', adminUserDetailResponseGuard, 'GET /admin/users/:id')
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
      expect(screen.getByTestId('delete-user-btn-1')).toBeInTheDocument();
    });

    // 1. Delete reason input autocomplete check
    fireEvent.click(screen.getByTestId('delete-user-btn-1'));
    await waitFor(() => {
      expect(screen.getByTestId('delete-user-modal')).toBeInTheDocument();
    });
    expect(screen.getByTestId('delete-user-reason-input')).toHaveAttribute('autocomplete', 'off');

    // Close delete modal
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // 2. Adjust reason input autocomplete check
    fireEvent.click(screen.getByTestId('adjust-balance-btn-1'));
    await waitFor(() => {
      expect(screen.getByTestId('adjust-balance-modal')).toBeInTheDocument();
    });
    expect(screen.getByTestId('adjust-reason-input')).toHaveAttribute('autocomplete', 'off');
  });
});
