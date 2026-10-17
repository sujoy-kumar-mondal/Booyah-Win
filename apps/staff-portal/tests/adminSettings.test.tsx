/**
 * Admin Settings Page Tests
 * Section 16.4
 *
 * Requirements:
 * - Constraint 6: Keep settings money values as strings, validate with a string regex,
 *   never use Number(). Min greater than max is a warning only.
 * - Constraint 10: After saving settings, refetch and show what the server stored.
 *   Show the QR with referrerpolicy="no-referrer" and refetch the signed URL when it expires.
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
import {
  staffMeGuard,
  adminSettingsResponseGuard,
  adminUploadPaymentQrResponseGuard,
} from '../src/api/guards.js';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe('Admin Settings Page', () => {
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

  it('settings money values are kept as strings, validated with regex, without Number, and min greater than max is warning only', async () => {
    // Monitor global Number to verify it is never invoked for money validation in Settings
    let numberCallCount = 0;
    const origNumber = global.Number;
    const numberProxy = new Proxy(origNumber, {
      apply(target, thisArg, argArray) {
        numberCallCount++;
        return Reflect.apply(target, thisArg, argArray);
      },
    });
    // Replace global.Number with proxy that retains all static methods (isNaN, etc.)
    vi.stubGlobal('Number', numberProxy);

    vi.spyOn(adminApi, 'getAdminSettings').mockResolvedValue(
      loadContractFixture('GET_admin_settings.json', adminSettingsResponseGuard, 'GET /admin/settings')
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
      expect(screen.getByTestId('settings-min-deposit-input')).toBeInTheDocument();
    });

    const minInput = screen.getByTestId('settings-min-deposit-input');
    const maxInput = screen.getByTestId('settings-max-deposit-input');

    // 1. Set invalid money format (letters)
    fireEvent.change(minInput, { target: { value: 'invalid_money' } });
    fireEvent.click(screen.getByTestId('save-settings-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-error-banner')).toBeInTheDocument();
    });
    expect(screen.getByText(/Minimum deposit must be a valid numeric amount/i)).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();

    // 2. Set min greater than max: "5000.00" min and "100.00" max
    fireEvent.change(minInput, { target: { value: '5000.00' } });
    fireEvent.change(maxInput, { target: { value: '100.00' } });

    // Warning banner appears dynamically
    await waitFor(() => {
      expect(screen.getByTestId('settings-warning-banner')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Warning: Minimum deposit is currently greater than maximum deposit/i)
    ).toBeInTheDocument();

    // Min greater than max is a WARNING ONLY: saving is still allowed!
    fireEvent.click(screen.getByTestId('save-settings-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalled();
    });

    // Ensure payload sent to updateAdminSettings contains values as strings
    const calledUpdates = updateSpy.mock.calls[0][0];
    expect(typeof calledUpdates.min_deposit).toBe('string');
    expect(typeof calledUpdates.max_deposit).toBe('string');
    expect(calledUpdates.min_deposit).toBe('5000.00');
    expect(calledUpdates.max_deposit).toBe('100.00');
    expect(calledUpdates.payment_qr_key).toBeUndefined();

    // Verify Number() was NOT invoked in Settings logic
    expect(numberCallCount).toBe(0);
    vi.unstubAllGlobals();
  });

  it('after saving settings, refetches and shows what the server stored', async () => {
    let getCallCount = 0;

    vi.spyOn(adminApi, 'getAdminSettings').mockImplementation(async () => {
      getCallCount++;
      if (getCallCount === 1) {
        // Initial state
        return loadContractFixture('GET_admin_settings.json', adminSettingsResponseGuard, 'GET /admin/settings');
      }
      // State stored by server after update
      return loadContractFixture('PATCH_admin_settings.json', adminSettingsResponseGuard, 'PATCH /admin/settings', (d) => {
        d.settings.min_deposit = '15.00';
        d.settings.max_deposit = '6000.00';
        d.settings.support_name = 'Booyah Support Team (Stored by Server)';
      });
    });

    vi.spyOn(adminApi, 'updateAdminSettings').mockResolvedValue(
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
      expect(screen.getByTestId('settings-min-deposit-input')).toBeInTheDocument();
    });
    expect(getCallCount).toBe(1);

    // Save settings
    fireEvent.click(screen.getByTestId('save-settings-btn'));

    // Verify refetch occurred and input displays what the server stored
    await waitFor(() => {
      expect(getCallCount).toBeGreaterThanOrEqual(2);
      const nameInput = screen.getByTestId('settings-support-name-input') as HTMLInputElement;
      expect(nameInput.value).toBe('Booyah Support Team (Stored by Server)');
      const minInput = screen.getByTestId('settings-min-deposit-input') as HTMLInputElement;
      expect(minInput.value).toBe('15.00');
    });
  });

  it('shows payment QR image with referrerpolicy no-referrer', async () => {
    vi.spyOn(adminApi, 'getAdminSettings').mockResolvedValue(
      loadContractFixture('GET_admin_settings.json', adminSettingsResponseGuard, 'GET /admin/settings', (d) => {
        d.settings.payment_qr_url = 'https://storage.example.com/qr-code.png';
        d.settings.payment_qr_key = 'qrs/active.png';
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
      expect(screen.getByTestId('settings-qr-image')).toBeInTheDocument();
    });

    const qrImg = screen.getByTestId('settings-qr-image');
    expect(qrImg).toHaveAttribute('referrerPolicy', 'no-referrer');
    expect(qrImg).toHaveAttribute('src', 'https://storage.example.com/qr-code.png');
  });

  it('refetches signed URL when QR image encounters load error or expires', async () => {
    let getCallCount = 0;

    vi.spyOn(adminApi, 'getAdminSettings').mockImplementation(async () => {
      getCallCount++;
      return loadContractFixture('GET_admin_settings.json', adminSettingsResponseGuard, 'GET /admin/settings', (d) => {
        d.settings.payment_qr_url = `https://storage.example.com/qr-code.png?v=${getCallCount}`;
      });
    });

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
      expect(screen.getByTestId('settings-qr-image')).toBeInTheDocument();
    });
    expect(getCallCount).toBe(1);

    // Simulate image error (e.g. signed URL expired)
    const qrImg = screen.getByTestId('settings-qr-image');
    fireEvent.error(qrImg);

    // Should trigger refetch of settings to obtain fresh signed URL
    await waitFor(() => {
      expect(getCallCount).toBeGreaterThanOrEqual(2);
    });
  });

  it('uploads QR image and cleans up object URL preview on revoke', async () => {
    vi.spyOn(adminApi, 'getAdminSettings').mockResolvedValue(
      loadContractFixture('GET_admin_settings.json', adminSettingsResponseGuard, 'GET /admin/settings')
    );

    const uploadSpy = vi.spyOn(adminApi, 'uploadPaymentQr').mockResolvedValue(
      loadContractFixture('POST_admin_settings_payment-qr.json', adminUploadPaymentQrResponseGuard, 'POST /admin/settings/payment-qr')
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
      expect(screen.getByTestId('settings-qr-upload-input')).toBeInTheDocument();
    });

    const file = new File(['mock-image-content'], 'qr.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('settings-qr-upload-input');

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledWith(file);
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  it('validates cashback cap percentage and displays business cost warning note', async () => {
    vi.spyOn(adminApi, 'getAdminSettings').mockResolvedValue(
      loadContractFixture('GET_admin_settings.json', adminSettingsResponseGuard, 'GET /admin/settings')
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
      expect(screen.getByTestId('settings-cashback-percent-input')).toBeInTheDocument();
    });

    // Check helper note on business cost
    expect(
      screen.getByText(/Raising the percentage costs the business more cashback/i)
    ).toBeInTheDocument();

    const input = screen.getByTestId('settings-cashback-percent-input');

    // Invalid: negative
    fireEvent.change(input, { target: { value: '-2' } });
    expect(screen.getByTestId('settings-cashback-warning')).toHaveTextContent(
      'Cashback percentage must be a number between 0 and 100 with at most 2 decimal places.'
    );

    // Invalid: > 100
    fireEvent.change(input, { target: { value: '101' } });
    expect(screen.getByTestId('settings-cashback-warning')).toHaveTextContent(
      'Cashback percentage must be between 0 and 100.'
    );

    // Invalid: 3 decimals
    fireEvent.change(input, { target: { value: '12.345' } });
    expect(screen.getByTestId('settings-cashback-warning')).toHaveTextContent(
      'Cashback percentage must be a number between 0 and 100 with at most 2 decimal places.'
    );

    // Valid: 12.34
    fireEvent.change(input, { target: { value: '12.34' } });
    expect(screen.queryByTestId('settings-cashback-warning')).toBeNull();
  });

  it('requires confirmation modal showing old and new cap before saving cashback setting change', async () => {
    vi.spyOn(adminApi, 'getAdminSettings').mockResolvedValue(
      loadContractFixture('GET_admin_settings.json', adminSettingsResponseGuard, 'GET /admin/settings')
    );

    const updateSpy = vi.spyOn(adminApi, 'updateAdminSettings').mockResolvedValue({
      settings: {
        min_deposit: '10.00',
        max_deposit: '5000.00',
        min_withdrawal: '50.00',
        max_withdrawal: '10000.00',
        daily_withdrawal_limit: '25000.00',
        cashback_max_percent: '15.5',
      },
      updatedKeys: ['cashback_max_percent'],
    } as any);

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
      expect(screen.getByTestId('settings-cashback-percent-input')).toBeInTheDocument();
    });

    const input = screen.getByTestId('settings-cashback-percent-input');
    fireEvent.change(input, { target: { value: '15.5' } });

    // Click Save Settings button
    fireEvent.click(screen.getByTestId('save-settings-btn'));

    // Confirmation modal appears showing old and new caps
    await waitFor(() => {
      expect(screen.getByTestId('cashback-confirm-modal')).toBeInTheDocument();
    });
    expect(screen.getByTestId('modal-old-cashback-cap')).toHaveTextContent('5%');
    expect(screen.getByTestId('modal-new-cashback-cap')).toHaveTextContent('15.5%');

    // Confirm save
    fireEvent.click(screen.getByTestId('confirm-cashback-save-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cashback_max_percent: '15.5',
        })
      );
    });
  });
});
