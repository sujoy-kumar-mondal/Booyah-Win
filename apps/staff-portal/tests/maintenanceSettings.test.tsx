/**
 * Admin Maintenance Settings Tests
 * Section 16.5 & Task A
 *
 * Requirements:
 * - Maintenance card renders toggle, plain text message input, and IST datetime picker.
 * - IST +05:30 offset is fixed and strictly independent of browser/OS local timezone.
 * - Past time warning appears when maintenance_until is in the past.
 * - Maintenance message is rendered safely as plain text (never HTML/unescaped, e.g. <script> tags).
 * - Confirmation modal is required before saving maintenance mode toggle change.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { Settings } from '../src/pages/Settings.js';
import * as adminApi from '../src/api/admin.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/context/StaffAuthContext.js';
import { loadContractFixture } from './contractFixtures.js';
import { buildISTIsoString } from '../src/utils/formatters.js';
import {
  staffMeGuard,
  adminSettingsResponseGuard,
} from '../src/api/guards.js';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe('Admin Maintenance Mode Settings & Security', () => {
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

  it('renders admin maintenance card with toggle, message, datetime picker, and plain text preview', async () => {
    vi.spyOn(adminApi, 'getAdminSettings').mockResolvedValue(
      loadContractFixture('GET_admin_settings.json', adminSettingsResponseGuard, 'GET /admin/settings', (d) => {
        d.settings.maintenance_enabled = 'false';
        d.settings.maintenance_message = 'Under scheduled maintenance. Please check back shortly.';
        d.settings.maintenance_until = '2099-10-15T18:00:00+05:30';
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Settings />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('settings-maintenance-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('settings-maintenance-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('settings-maintenance-message-input')).toBeInTheDocument();
    expect(screen.getByTestId('settings-maintenance-date-input')).toBeInTheDocument();
    expect(screen.getByTestId('settings-maintenance-time-input')).toBeInTheDocument();
    expect(screen.getByTestId('settings-maintenance-until-input')).toBeInTheDocument();
    expect(screen.getByTestId('settings-maintenance-preview')).toBeInTheDocument();

    const toggle = screen.getByTestId('settings-maintenance-toggle') as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    const messageInput = screen.getByTestId('settings-maintenance-message-input') as HTMLTextAreaElement;
    expect(messageInput.value).toBe('Under scheduled maintenance. Please check back shortly.');
  });

  it('fixed +05:30 offset is constructed consistently regardless of local timezone (e.g. UTC)', () => {
    // Test pure formatter helper for fixed offset
    const iso1 = buildISTIsoString('2026-10-15', '18:30');
    expect(iso1).toBe('2026-10-15T18:30:00+05:30');

    const iso2 = buildISTIsoString('2026-10-15T14:45');
    expect(iso2).toBe('2026-10-15T14:45:00+05:30');

    // Offset is strictly +05:30, never converted to local machine UTC or other timezone
    expect(iso1.endsWith('+05:30')).toBe(true);
    expect(iso2.endsWith('+05:30')).toBe(true);
  });

  it('displays past time warning when maintenance_until is set to an earlier timestamp', async () => {
    vi.spyOn(adminApi, 'getAdminSettings').mockResolvedValue(
      loadContractFixture('GET_admin_settings.json', adminSettingsResponseGuard, 'GET /admin/settings', (d) => {
        d.settings.maintenance_enabled = 'false';
        d.settings.maintenance_until = '';
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Settings />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('settings-maintenance-until-input')).toBeInTheDocument();
    });

    const untilInput = screen.getByTestId('settings-maintenance-until-input');

    // 1. Enter timestamp in the past
    fireEvent.change(untilInput, { target: { value: '2020-01-01T12:00:00+05:30' } });

    await waitFor(() => {
      expect(screen.getByTestId('settings-maintenance-past-warning')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Warning: The selected maintenance end time is in the past/i)
    ).toBeInTheDocument();

    // 2. Change to future timestamp
    fireEvent.change(untilInput, { target: { value: '2099-01-01T12:00:00+05:30' } });

    await waitFor(() => {
      expect(screen.queryByTestId('settings-maintenance-past-warning')).not.toBeInTheDocument();
    });
  });

  it('renders maintenance message containing <script> tag safely as plain text without HTML injection', async () => {
    vi.spyOn(adminApi, 'getAdminSettings').mockResolvedValue(
      loadContractFixture('GET_admin_settings.json', adminSettingsResponseGuard, 'GET /admin/settings', (d) => {
        d.settings.maintenance_message = "<script>alert('xss')</script><b>Scheduled downtime</b>";
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Settings />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('settings-maintenance-preview')).toBeInTheDocument();
    });

    const preview = screen.getByTestId('settings-maintenance-preview');

    // Literal script text is rendered
    expect(preview).toHaveTextContent("<script>alert('xss')</script><b>Scheduled downtime</b>");

    // Critical XSS assertion: No script tag or bold tag element was created in DOM
    expect(preview.querySelector('script')).toBeNull();
    expect(preview.querySelector('b')).toBeNull();
  });

  it('requires confirmation modal before saving maintenance mode toggle change', async () => {
    vi.spyOn(adminApi, 'getAdminSettings').mockResolvedValue(
      loadContractFixture('GET_admin_settings.json', adminSettingsResponseGuard, 'GET /admin/settings', (d) => {
        d.settings.maintenance_enabled = 'false';
        d.settings.maintenance_message = 'Upgrading servers for tournament season.';
        d.settings.maintenance_until = '2099-10-15T22:00:00+05:30';
      })
    );

    const updateSpy = vi.spyOn(adminApi, 'updateAdminSettings').mockResolvedValue(
      loadContractFixture('PATCH_admin_settings.json', adminSettingsResponseGuard, 'PATCH /admin/settings')
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Settings />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('settings-maintenance-toggle')).toBeInTheDocument();
    });

    const toggle = screen.getByTestId('settings-maintenance-toggle');
    const saveBtn = screen.getByTestId('save-settings-btn');

    // Toggle maintenance mode from false to true
    fireEvent.click(toggle);

    // Click Save Settings button
    fireEvent.click(saveBtn);

    // Confirmation modal appears and update is NOT called yet
    await waitFor(() => {
      expect(screen.getByTestId('maintenance-confirm-modal')).toBeInTheDocument();
    });
    expect(updateSpy).not.toHaveBeenCalled();

    // Verify modal contains announcement message preview
    expect(screen.getByTestId('modal-maintenance-message')).toHaveTextContent(
      'Upgrading servers for tournament season.'
    );

    // 1. Cancel modal
    fireEvent.click(screen.getByTestId('maintenance-cancel-modal-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('maintenance-confirm-modal')).not.toBeInTheDocument();
    });
    expect(updateSpy).not.toHaveBeenCalled();

    // 2. Open modal again and confirm
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByTestId('maintenance-confirm-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('maintenance-confirm-save-btn'));

    // Modal closes and update is called with maintenance_enabled: 'true'
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalled();
    });

    const payload = updateSpy.mock.calls[0][0];
    expect(payload.maintenance_enabled).toBe('true');
    expect(payload.maintenance_message).toBe('Upgrading servers for tournament season.');
    expect(payload.maintenance_until).toBe('2099-10-15T22:00:00+05:30');
  });
});
