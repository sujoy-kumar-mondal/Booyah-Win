/**
 * Admin Audit Logs Page Tests
 * Section 16.5
 *
 * Requirements:
 * - Constraint 4: Never render the raw "details" object of an audit entry.
 *   Show an allowlisted set of keys per action (wallet, amount, reason, ids) and nothing else.
 *   Add a test with details containing keys named pan, aadhaar, token and password
 *   whose values must not appear in the DOM.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { AuditLogs } from '../src/pages/AuditLogs.js';
import * as adminApi from '../src/api/admin.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/context/StaffAuthContext.js';
import { loadContractFixture } from './contractFixtures.js';
import {
  staffMeGuard,
  adminAuditLogsResponseGuard,
} from '../src/api/guards.js';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe('Admin Audit Logs Page', () => {
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

  it('never renders raw details object, only allowlisted keys per action, and secrets pan, aadhaar, token, password never appear in DOM', async () => {
    vi.spyOn(adminApi, 'getAdminAuditLogs').mockResolvedValue(
      loadContractFixture(
        'GET_admin_audit-logs.json',
        adminAuditLogsResponseGuard,
        'GET /admin/audit-logs',
        (d) => {
          d.items = [
            {
              id: '999',
              staffId: '1',
              staffName: 'Admin Sujoy',
              action: 'balance_adjusted',
              targetType: 'user',
              targetId: '42',
              details: {
                wallet: 'winning',
                amount: '50.00',
                reason: 'Legitimate compensation reason',
                adminId: '1',
                // Sensitive keys injected into audit details
                pan: 'SECRET_PAN_XYZ1234Q',
                aadhaar: 'SECRET_AADHAAR_888877776666',
                token: 'SECRET_BEARER_AUTH_TOKEN_999',
                password: 'SECRET_ADMIN_PASSWORD_HASH',
                unlistedKey: 'UNLISTED_INTERNAL_BLOB',
              },
              createdAt: '2026-10-11T16:26:06.460Z',
            },
          ];
        }
      )
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <AuditLogs />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Balance Adjusted')).toBeInTheDocument();
    });

    // Verify staff name and ID are rendered
    expect(screen.getByText('Admin Sujoy')).toBeInTheDocument();
    expect(screen.getByText('ID: #1')).toBeInTheDocument();

    // Verify action options render human-friendly labels with valid enum values
    expect(screen.getByRole('option', { name: 'Deposit Approved' })).toHaveValue('deposit_approved');
    expect(screen.getByRole('option', { name: 'Balance Adjusted' })).toHaveValue('balance_adjusted');

    // 1. Verify ALLOWLISTED keys ARE present in DOM
    expect(screen.getByText('Legitimate compensation reason')).toBeInTheDocument();
    expect(screen.getByText('winning')).toBeInTheDocument();
    expect(screen.getByText('Rs50.00')).toBeInTheDocument();

    // 2. Verify SECRET VALUES NEVER appear in the DOM
    expect(screen.queryByText(/SECRET_PAN_XYZ1234Q/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SECRET_AADHAAR_888877776666/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SECRET_BEARER_AUTH_TOKEN_999/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SECRET_ADMIN_PASSWORD_HASH/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/UNLISTED_INTERNAL_BLOB/i)).not.toBeInTheDocument();

    // 3. Verify sensitive key names do not appear in details DOM
    expect(screen.queryByTestId('audit-detail-pan')).not.toBeInTheDocument();
    expect(screen.queryByTestId('audit-detail-aadhaar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('audit-detail-token')).not.toBeInTheDocument();
    expect(screen.queryByTestId('audit-detail-password')).not.toBeInTheDocument();

    // 4. Verify raw details JSON is not rendered in DOM
    expect(document.body.textContent).not.toContain('SECRET_PAN_XYZ1234Q');
    expect(document.body.textContent).not.toContain('SECRET_AADHAAR_888877776666');
    expect(document.body.textContent).not.toContain('SECRET_BEARER_AUTH_TOKEN_999');
    expect(document.body.textContent).not.toContain('SECRET_ADMIN_PASSWORD_HASH');
  });

  it('filters audit entries by staffId, action, from, and to dates', async () => {
    const listSpy = vi.spyOn(adminApi, 'getAdminAuditLogs').mockResolvedValue(
      loadContractFixture('GET_admin_audit-logs.json', adminAuditLogsResponseGuard, 'GET /admin/audit-logs')
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <AuditLogs />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('filter-staffId-input')).toBeInTheDocument();
    });

    // Apply filters
    fireEvent.change(screen.getByTestId('filter-staffId-input'), { target: { value: '2' } });
    fireEvent.change(screen.getByTestId('filter-action-select'), {
      target: { value: 'user_deleted' },
    });
    fireEvent.change(screen.getByTestId('filter-from-input'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByTestId('filter-to-input'), { target: { value: '2026-10-11' } });

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          staffId: '2',
          action: 'user_deleted',
          from: '2026-10-01',
          to: '2026-10-11',
        })
      );
    });

    // Clear filters
    fireEvent.click(screen.getByTestId('clear-filters-btn'));

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          staffId: undefined,
          action: undefined,
          from: undefined,
          to: undefined,
        })
      );
    });
  });

  it('cursor pagination loads more audit logs', async () => {
    let callCount = 0;
    vi.spyOn(adminApi, 'getAdminAuditLogs').mockImplementation(async (params) => {
      callCount++;
      return loadContractFixture(
        'GET_admin_audit-logs.json',
        adminAuditLogsResponseGuard,
        'GET /admin/audit-logs',
        (d) => {
          if (params?.cursor === '34') {
            d.items = [
              {
                id: '33',
                staffId: '1',
                action: 'settings_updated',
                targetType: 'app_settings',
                targetId: null,
                details: { updatedKeys: ['min_deposit'] },
                createdAt: '2026-10-11T16:26:06.367Z',
              },
            ];
            d.nextCursor = null;
          } else {
            d.nextCursor = '34';
          }
        }
      );
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <AuditLogs />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('load-more-audit-logs-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('load-more-audit-logs-btn'));

    await waitFor(() => {
      expect(screen.getByText('#33')).toBeInTheDocument();
    });
  });
});
