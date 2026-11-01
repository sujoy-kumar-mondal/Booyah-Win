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
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { AuditLogs } from '../src/pages/AuditLogs.js';
import { AuditLogDetail } from '../src/pages/AuditLogDetail.js';
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
      expect(screen.getByText('Admin Sujoy')).toBeInTheDocument();
      expect(screen.getByText('ID: BW-STF-1')).toBeInTheDocument();
    });

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

  it('renders allowlisted details for important updates and truncated key arrays', async () => {
    vi.spyOn(adminApi, 'getAdminAuditLogs').mockResolvedValue(
      loadContractFixture(
        'GET_admin_audit-logs.json',
        adminAuditLogsResponseGuard,
        'GET /admin/audit-logs',
        (d) => {
          d.items = [
            {
              id: '392',
              staffId: '1',
              staffName: 'Sujoy Kumar Mondal',
              action: 'important_update_modified',
              targetType: 'important_update',
              targetId: '1',
              details: {
                title: 'Lone Wolf Headshot Mode',
                category: 'Announcement',
                heading: 'Headshot-Only Mode Rules',
                isActive: true,
                sortOrder: 2,
              },
              createdAt: '2026-11-01T02:53:00.000Z',
            },
            {
              id: '389',
              staffId: '1',
              staffName: 'Sujoy Kumar Mondal',
              action: 'settings_updated',
              targetType: 'app_settings',
              targetId: null,
              details: {
                updatedKeys: [
                  'match_rules_image_url',
                  'match_rules_cs_image_url',
                  'match_rules_en',
                  'match_rules_bn',
                  'match_rules_cs_en',
                  'match_rules_cs_bn',
                ],
              },
              createdAt: '2026-11-01T02:50:00.000Z',
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
      expect(screen.getByText('#392')).toBeInTheDocument();
    });

    // Verify Important Update allowlisted details are rendered instead of "—"
    expect(screen.getByText('Lone Wolf Headshot Mode')).toBeInTheDocument();
    expect(screen.getByText('Announcement')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Verify settings with >2 keys shows compact summary with (+4 more)
    expect(screen.getByText(/match_rules_image_url, match_rules_cs_image_url/)).toBeInTheDocument();
    expect(screen.getByText(/\(\+4 more\)/)).toBeInTheDocument();
  });

  it('clicking an audit log row navigates to the dedicated audit log detail page and displays change info', async () => {
    vi.spyOn(adminApi, 'getAdminAuditLogs').mockResolvedValue(
      loadContractFixture(
        'GET_admin_audit-logs.json',
        adminAuditLogsResponseGuard,
        'GET /admin/audit-logs',
        (d) => {
          d.items = [
            {
              id: '389',
              staffId: '1',
              staffName: 'Sujoy Kumar Mondal',
              action: 'settings_updated',
              targetType: 'app_settings',
              targetId: null,
              details: {
                updatedKeys: ['cashback_max_percent'],
                changes: {
                  cashback_max_percent: {
                    old: '5',
                    new: '10',
                  },
                },
                // Injected sensitive secrets to test detail page boundary
                pan: 'FORBIDDEN_PAN_VAL',
                aadhaar: 'FORBIDDEN_AADHAAR_VAL',
                token: 'FORBIDDEN_TOKEN_VAL',
                password: 'FORBIDDEN_PASSWORD_HASH',
              },
              createdAt: '2026-11-01T02:50:00.000Z',
            },
          ];
        }
      )
    );

    vi.spyOn(adminApi, 'getAdminAuditLog').mockResolvedValue({
      log: {
        id: '389',
        staffId: 'BW-STF-1',
        staffName: 'Sujoy Kumar Mondal',
        staffRole: 'admin',
        staffEmail: 'sujoy@booyahwin.com',
        action: 'settings_updated',
        targetType: 'app_settings',
        targetId: null,
        details: {
          updatedKeys: ['cashback_max_percent'],
          changes: {
            cashback_max_percent: {
              old: '5',
              new: '10',
            },
          },
          pan: 'FORBIDDEN_PAN_VAL',
          aadhaar: 'FORBIDDEN_AADHAAR_VAL',
          token: 'FORBIDDEN_TOKEN_VAL',
          password: 'FORBIDDEN_PASSWORD_HASH',
        },
        createdAt: '2026-11-01T02:50:00.000Z',
      },
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/audit-logs']}>
          <StaffAuthProvider>
            <Routes>
              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/audit-logs/:id" element={<AuditLogDetail />} />
            </Routes>
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('audit-row-389')).toBeInTheDocument();
    });

    // Click the row to navigate to details
    fireEvent.click(screen.getByTestId('audit-row-389'));

    // Wait for the detail page to render
    await waitFor(() => {
      expect(screen.getByTestId('audit-log-detail-page')).toBeInTheDocument();
    });

    // Verify staff, target, action metadata
    expect(screen.getByText('Log #389')).toBeInTheDocument();
    expect(screen.getByText('Sujoy Kumar Mondal')).toBeInTheDocument();
    expect(screen.getByText('app settings')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('sujoy@booyahwin.com')).toBeInTheDocument();
    });

    // Verify previous and current information about changes
    expect(screen.getByTestId('audit-changes-table')).toBeInTheDocument();
    expect(screen.getAllByText('cashback_max_percent').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('5')).toBeInTheDocument(); // Previous value
    expect(screen.getByText('10')).toBeInTheDocument(); // Current value

    // Verify forbidden keys and sensitive values NEVER leak in the DOM
    expect(screen.queryByText(/FORBIDDEN_PAN_VAL/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/FORBIDDEN_AADHAAR_VAL/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/FORBIDDEN_TOKEN_VAL/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/FORBIDDEN_PASSWORD_HASH/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('FORBIDDEN_PAN_VAL');
    expect(document.body.textContent).not.toContain('FORBIDDEN_AADHAAR_VAL');
    expect(document.body.textContent).not.toContain('FORBIDDEN_TOKEN_VAL');
    expect(document.body.textContent).not.toContain('FORBIDDEN_PASSWORD_HASH');
  });

  it('formats userId as BW-USR-2 and staffId/adminId as BW-STF-1 in allowlisted details and detail page', async () => {
    vi.spyOn(adminApi, 'getAdminAuditLogs').mockResolvedValue(
      loadContractFixture(
        'GET_admin_audit-logs.json',
        adminAuditLogsResponseGuard,
        'GET /admin/audit-logs',
        (d) => {
          d.items = [
            {
              id: '1',
              staffId: 'BW-STF-1',
              staffName: 'Sujoy Kumar Mondal',
              action: 'deposit_approved',
              targetType: 'deposit_requests',
              targetId: 'BW-TRX-1',
              details: {
                amount: '50.00',
                userId: '2',
                adminId: '1',
              },
              createdAt: '2026-11-01T02:50:00.000Z',
            },
          ];
        }
      )
    );

    vi.spyOn(adminApi, 'getAdminAuditLog').mockResolvedValue({
      log: {
        id: '1',
        staffId: 'BW-STF-1',
        staffName: 'Sujoy Kumar Mondal',
        staffRole: 'employee',
        staffEmail: 'thegamersujoy@gmail.com',
        action: 'deposit_approved',
        targetType: 'deposit_requests',
        targetId: 'BW-TRX-1',
        details: {
          amount: '50.00',
          userId: '2',
        },
        createdAt: '2026-11-01T02:50:00.000Z',
      },
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/audit-logs']}>
          <StaffAuthProvider>
            <Routes>
              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/audit-logs/:id" element={<AuditLogDetail />} />
            </Routes>
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('audit-row-1')).toBeInTheDocument();
    });

    // 1. Verify Allowlisted Details in table formats "2" -> "BW-USR-2" and "1" -> "BW-STF-1"
    const userDetailPill = screen.getByTestId('audit-detail-userId');
    expect(userDetailPill).toHaveTextContent('BW-USR-2');

    // 2. Click through to details page
    fireEvent.click(screen.getByTestId('audit-row-1'));

    await waitFor(() => {
      expect(screen.getByTestId('audit-log-detail-page')).toBeInTheDocument();
    });

    // Verify detail attribute for User ID displays BW-USR-2, not "2"
    const userAttrCard = screen.getByTestId('audit-attr-userId');
    expect(userAttrCard).toHaveTextContent('BW-USR-2');
    expect(userAttrCard).toHaveTextContent(/user id/i);
  });

  it('formats allowlisted details semantically across match, settings, banner, and empty events', async () => {
    vi.spyOn(adminApi, 'getAdminAuditLogs').mockResolvedValue(
      loadContractFixture(
        'GET_admin_audit-logs.json',
        adminAuditLogsResponseGuard,
        'GET /admin/audit-logs',
        (d) => {
          d.items = [
            {
              id: '101',
              staffId: '1',
              action: 'match_room_opened',
              targetType: 'match',
              targetId: 'BW-MCH-1',
              details: { roomId: '435345' },
              createdAt: '2026-11-01T02:50:00.000Z',
            },
            {
              id: '102',
              staffId: '1',
              action: 'settings_match_banner_deleted',
              targetType: 'app_settings',
              targetId: null,
              details: { gameMode: 'battle_royale', oldKey: '74b5526615be860b2702ed2f5a60edf8.jpg' },
              createdAt: '2026-11-01T02:49:00.000Z',
            },
            {
              id: '103',
              staffId: '1',
              action: 'match_created',
              targetType: 'match',
              targetId: 'BW-MCH-2',
              details: {
                tierId: 1,
                gameMode: 'battle_royale',
                teamMode: 'solo',
                startTime: '2026-10-14T17:30:00.000Z',
              },
              createdAt: '2026-11-01T02:48:00.000Z',
            },
            {
              id: '104',
              staffId: '1',
              action: 'match_went_live',
              targetType: 'match',
              targetId: 'BW-MCH-3',
              details: {},
              createdAt: '2026-11-01T02:47:00.000Z',
            },
            {
              id: '105',
              staffId: '1',
              action: 'match_cancelled',
              targetType: 'match',
              targetId: 'BW-MCH-4',
              details: { reason: 'Technical glitch in server', refundedPlayersCount: 4 },
              createdAt: '2026-11-01T02:46:00.000Z',
            },
            {
              id: '106',
              staffId: '1',
              action: 'settings_payment_qr_updated',
              targetType: 'app_settings',
              targetId: null,
              details: { newKey: 'new-qr-key.png', oldKey: 'old-qr-key.png' },
              createdAt: '2026-11-01T02:45:00.000Z',
            },
            {
              id: '107',
              staffId: '1',
              action: 'tier_deleted',
              targetType: 'entry_tiers',
              targetId: '1',
              details: null,
              createdAt: '2026-11-01T02:44:00.000Z',
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
      expect(screen.getByText('#101')).toBeInTheDocument();
    });

    // 1. Room opened formats with Room #435345
    expect(screen.getByTestId('audit-detail-roomId')).toHaveTextContent('Room #435345');

    // 2. Banner deleted shows game mode and reset badge, oldKey hash is suppressed from visual text
    expect(screen.getAllByText('Battle Royale').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Reset to Default Graphic')).toBeInTheDocument();

    // 3. Match created shows Tier #1, Battle Royale • SOLO, and date
    expect(screen.getByTestId('audit-detail-tierId')).toHaveTextContent('Tier #1');
    expect(screen.getByTestId('audit-detail-teamMode')).toHaveTextContent('• SOLO');

    // 4. Match went live
    expect(screen.getAllByText('Match Went Live').length).toBeGreaterThanOrEqual(2);

    // 5. Match cancelled shows 4 players refunded and reason
    expect(screen.getByTestId('audit-detail-refundedPlayersCount')).toHaveTextContent('4 players refunded');
    expect(screen.getByText('Technical glitch in server')).toBeInTheDocument();

    // 6. Payment QR updated
    expect(screen.getByText('Payment QR Code Updated')).toBeInTheDocument();

    // 7. Tier deleted shows clean placeholder
    expect(screen.getByText('Tier deleted')).toBeInTheDocument();
  });
});
