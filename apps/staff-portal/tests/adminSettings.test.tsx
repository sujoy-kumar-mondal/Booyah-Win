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
    fireEvent.click(screen.getByTestId('save-thresholds-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('thresholds-error-banner')).toBeInTheDocument();
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
    fireEvent.click(screen.getByTestId('save-thresholds-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalled();
    });

    // Ensure payload sent to updateAdminSettings contains values as strings
    const calledUpdates = updateSpy.mock.calls[0][0];
    expect(typeof calledUpdates.min_deposit).toBe('string');
    expect(typeof calledUpdates.max_deposit).toBe('string');
    expect(typeof calledUpdates.min_withdrawal).toBe('string');
    expect(typeof calledUpdates.max_withdrawal).toBe('string');
    expect(calledUpdates.min_deposit).toBe('5000.00');
    expect(calledUpdates.max_deposit).toBe('100.00');
    expect(calledUpdates.payment_qr_key).toBeUndefined();

    // Verify Number() was NOT invoked in Settings logic
    expect(numberCallCount).toBe(0);
    vi.unstubAllGlobals();
  });

  it('allows admin to configure min and max withdrawal limits and validates with regex and min > max warning', async () => {
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
      expect(screen.getByTestId('settings-min-withdrawal-input')).toBeInTheDocument();
      expect(screen.getByTestId('settings-max-withdrawal-input')).toBeInTheDocument();
    });

    const minWInput = screen.getByTestId('settings-min-withdrawal-input') as HTMLInputElement;
    const maxWInput = screen.getByTestId('settings-max-withdrawal-input') as HTMLInputElement;
    expect(minWInput.value).toBe('50.00');
    expect(maxWInput.value).toBe('10000.00');

    // 1. Invalid regex format
    fireEvent.change(minWInput, { target: { value: 'invalid_num' } });
    fireEvent.click(screen.getByTestId('save-thresholds-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('thresholds-error-banner')).toBeInTheDocument();
    });
    expect(screen.getByText(/Minimum withdrawal must be a valid numeric amount/i)).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();

    // 2. Set min > max: "5000.00" min and "500.00" max -> warning only
    fireEvent.change(minWInput, { target: { value: '5000.00' } });
    fireEvent.change(maxWInput, { target: { value: '500.00' } });

    await waitFor(() => {
      expect(screen.getByTestId('settings-warning-banner')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Warning: Minimum withdrawal is currently greater than maximum withdrawal/i)
    ).toBeInTheDocument();

    // 3. Save with valid limits: "100.00" min and "25000.00" max
    fireEvent.change(minWInput, { target: { value: '100.00' } });
    fireEvent.change(maxWInput, { target: { value: '25000.00' } });

    fireEvent.click(screen.getByTestId('save-thresholds-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalled();
    });

    const called = updateSpy.mock.calls[0][0];
    expect(called.min_withdrawal).toBe('100.00');
    expect(called.max_withdrawal).toBe('25000.00');
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
    fireEvent.click(screen.getByTestId('save-thresholds-btn'));

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

    // Click Save Settings button on thresholds card
    fireEvent.click(screen.getByTestId('save-thresholds-btn'));

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

  it('switches between Battle Royale and Clash Squad rules tabs and saves both to server', async () => {
    vi.spyOn(adminApi, 'getAdminSettings').mockResolvedValue({
      settings: {
        match_rules_en: 'BR Rules En',
        match_rules_bn: 'BR Rules Bn',
        match_rules_cs_en: 'CS Rules En',
        match_rules_cs_bn: 'CS Rules Bn',
      },
    });

    const updateSpy = vi.spyOn(adminApi, 'updateAdminSettings').mockResolvedValue({
      settings: {
        match_rules_en: 'Updated BR Rules En',
        match_rules_bn: 'BR Rules Bn',
        match_rules_cs_en: 'Updated CS Rules En',
        match_rules_cs_bn: 'CS Rules Bn',
      },
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

    // Initial tab is Battle Royale
    await waitFor(() => {
      expect(screen.getByTestId('settings-match-rules-en-input')).toBeInTheDocument();
    });
    expect(screen.getByTestId('settings-match-rules-en-input')).toHaveValue('BR Rules En');

    // Switch to Clash Squad tab
    fireEvent.click(screen.getByTestId('rules-tab-clash-squad'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-match-rules-cs-en-input')).toBeInTheDocument();
    });
    expect(screen.getByTestId('settings-match-rules-cs-en-input')).toHaveValue('CS Rules En');

    // Edit Clash Squad rule
    fireEvent.change(screen.getByTestId('settings-match-rules-cs-en-input'), {
      target: { value: 'Updated CS Rules En' },
    });

    // Switch back to Battle Royale tab and edit
    fireEvent.click(screen.getByTestId('rules-tab-battle-royale'));
    fireEvent.change(screen.getByTestId('settings-match-rules-en-input'), {
      target: { value: 'Updated BR Rules En' },
    });

    // Save match rules
    fireEvent.click(screen.getByTestId('save-match-rules-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          match_rules_en: 'Updated BR Rules En',
          match_rules_cs_en: 'Updated CS Rules En',
        })
      );
    });
  });

  it('switches between Battle Royale and Clash Squad banner tabs and supports mode-specific banner upload and reset', async () => {
    vi.spyOn(adminApi, 'getAdminSettings').mockResolvedValue({
      settings: {
        match_rules_image_url: 'https://example.com/br-banner.jpg',
        match_rules_cs_image_url: '',
      },
    });

    const uploadSpy = vi.spyOn(adminApi, 'uploadMatchBanner').mockResolvedValue({
      matchRulesImageKey: 'banner-cs-key.jpg',
      matchRulesImageUrl: 'https://example.com/cs-banner.jpg',
    });

    const deleteSpy = vi.spyOn(adminApi, 'deleteMatchBanner').mockResolvedValue({
      success: true,
      matchRulesImageUrl: '',
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

    // Initial banner mode tab is Battle Royale
    await waitFor(() => {
      expect(screen.getByTestId('banner-tab-battle-royale')).toBeInTheDocument();
      expect(screen.getByTestId('banner-tab-clash-squad')).toBeInTheDocument();
    });

    const previewImg = screen.getByTestId('settings-match-banner-preview-img');
    expect(previewImg).toHaveAttribute('src', 'https://example.com/br-banner.jpg');
    expect(screen.getByText('BATTLE ROYALE | DUO')).toBeInTheDocument();

    // Switch to Clash Squad banner tab
    fireEvent.click(screen.getByTestId('banner-tab-clash-squad'));
    expect(screen.getByText('CLASH SQUAD | 4V4')).toBeInTheDocument();
    // Default graphic because match_rules_cs_image_url is empty
    expect(previewImg).toHaveAttribute('src', '/assets/default_match_banner.jpg');

    // Upload Clash Squad banner
    const file = new File(['test-image'], 'cs-banner.png', { type: 'image/png' });
    const input = screen.getByTestId('settings-match-banner-upload-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledWith(file, 'clash_squad');
    });

    // Reset Clash Squad banner
    await waitFor(() => {
      expect(screen.getByTestId('settings-match-banner-reset-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('settings-match-banner-reset-btn'));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('clash_squad');
    });
  });

  it('each box has dedicated save button, and validation error shows only at top of the invalid box', async () => {
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
      expect(screen.getByTestId('support-card')).toBeInTheDocument();
    });

    // 1. Enter invalid phone in Customer Support box
    const phoneInput = screen.getByTestId('settings-support-phone-input');
    fireEvent.change(phoneInput, { target: { value: '123' } }); // invalid mobile number
    fireEvent.click(screen.getByTestId('save-support-btn'));

    // Error banner appears at the top of support card
    await waitFor(() => {
      expect(screen.getByTestId('support-error-banner')).toBeInTheDocument();
    });
    expect(screen.getByText(/Support phone must be a 10-digit Indian mobile number/i)).toBeInTheDocument();
    // Thresholds error banner is NOT present
    expect(screen.queryByTestId('thresholds-error-banner')).toBeNull();
    expect(updateSpy).not.toHaveBeenCalled();

    // 2. Fix phone and save Customer Support box
    fireEvent.change(phoneInput, { target: { value: '9876543210' } });
    fireEvent.click(screen.getByTestId('save-support-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        support_name: expect.any(String),
        support_hours: expect.any(String),
        support_phone: '9876543210',
        support_email: expect.any(String),
      });
    });

    // Error banner in support card cleared
    expect(screen.queryByTestId('support-error-banner')).toBeNull();
  });

  it('saving payment box sends only payment details to server', async () => {
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
      expect(screen.getByTestId('payment-card')).toBeInTheDocument();
    });

    const upiInput = screen.getByTestId('settings-payment-upi-input');

    // 1. Invalid UPI ID format shows error at top of payment card
    fireEvent.change(upiInput, { target: { value: 'invalid-upi' } });
    fireEvent.click(screen.getByTestId('save-payment-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('payment-error-banner')).toBeInTheDocument();
    });
    expect(screen.getByText(/Payment UPI ID must be a valid UPI format/i)).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();

    // 2. Valid UPI ID saves successfully
    fireEvent.change(upiInput, { target: { value: 'booyahwin@oksbi' } });
    fireEvent.click(screen.getByTestId('save-payment-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        payment_upi_id: 'booyahwin@oksbi',
      });
    });
  });

  it('saving community links sends only community links to server', async () => {
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
      expect(screen.getByTestId('community-card')).toBeInTheDocument();
    });

    const tgInput = screen.getByTestId('settings-community-telegram-input');

    // 1. Invalid URL shows error at top of community card
    fireEvent.change(tgInput, { target: { value: 'invalid_telegram_link' } });
    fireEvent.click(screen.getByTestId('save-community-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('community-error-banner')).toBeInTheDocument();
    });
    expect(screen.getByText(/Telegram link must be a valid URL/i)).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();

    // 2. Valid URL saves successfully
    fireEvent.change(tgInput, { target: { value: 'https://t.me/booyah_official' } });
    fireEvent.click(screen.getByTestId('save-community-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          community_telegram: 'https://t.me/booyah_official',
        })
      );
    });

    // 3. YouTube link validation & update
    const ytInput = screen.getByTestId('settings-community-youtube-input');
    fireEvent.change(ytInput, { target: { value: 'invalid_youtube_link' } });
    fireEvent.click(screen.getByTestId('save-community-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('community-error-banner')).toBeInTheDocument();
    });
    expect(screen.getByText(/YouTube link must be a valid URL/i)).toBeInTheDocument();

    fireEvent.change(ytInput, { target: { value: 'https://youtube.com/@booyah_official' } });
    fireEvent.click(screen.getByTestId('save-community-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          community_youtube: 'https://youtube.com/@booyah_official',
        })
      );
    });
  });

  it('admin can change referral bonus price with validation and persistence to server', async () => {
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
      expect(screen.getByTestId('settings-referral-reward-input')).toBeInTheDocument();
    });

    const refInput = screen.getByTestId('settings-referral-reward-input');

    // 1. Invalid money format shows error at top of thresholds card
    fireEvent.change(refInput, { target: { value: 'not_money' } });
    fireEvent.click(screen.getByTestId('save-thresholds-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('thresholds-error-banner')).toBeInTheDocument();
    });
    expect(screen.getByText(/Referral bonus must be a valid numeric amount/i)).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();

    // 2. Valid amount saves successfully
    fireEvent.change(refInput, { target: { value: '15.00' } });
    fireEvent.click(screen.getByTestId('save-thresholds-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          referral_reward: '15.00',
        })
      );
    });
  });

  it('admin can change referral invitation message with validation and persistence to server', async () => {
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
      expect(screen.getByTestId('invitation-card')).toBeInTheDocument();
      expect(screen.getByTestId('settings-invitation-text-input')).toBeInTheDocument();
      expect(screen.getByTestId('invitation-fixed-content')).toBeInTheDocument();
      expect(screen.getByTestId('invitation-preview-card')).toBeInTheDocument();
    });

    // Check fixed non-editable content
    expect(screen.getByTestId('invitation-fixed-content')).toHaveTextContent(
      'Use my referral code: <username> and make your booyah into money.'
    );
    expect(screen.getByTestId('invitation-fixed-content')).toHaveTextContent(
      'Download Link: https://<websiteUrl>/refer/<username>'
    );

    const inviteInput = screen.getByTestId('settings-invitation-text-input');

    // 1. Validation: text exceeding 500 characters shows error at top of invitation card
    const tooLongText = 'A'.repeat(501);
    fireEvent.change(inviteInput, { target: { value: tooLongText } });
    fireEvent.click(screen.getByTestId('save-invitation-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('invitation-error-banner')).toBeInTheDocument();
    });
    expect(screen.getByText(/Invitation message must not exceed 500 characters/i)).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();

    // 2. Valid updated text updates preview and saves successfully
    const newInviteText = 'Hey, Join Booyah Win tournaments and win real cash daily!';
    fireEvent.change(inviteInput, { target: { value: newInviteText } });

    // Live preview must reflect updated message
    expect(screen.getByTestId('invitation-preview-card')).toHaveTextContent(newInviteText);
    expect(screen.getByTestId('invitation-preview-card')).toHaveTextContent(
      'Use my referral code: PLAYER99 and make your booyah into money.'
    );
    expect(screen.getByTestId('invitation-preview-card')).toHaveTextContent(
      'Download Link: https://<websiteUrl>/refer/PLAYER99'
    );

    fireEvent.click(screen.getByTestId('save-invitation-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          invitation_text: newInviteText,
        })
      );
    });
  });
});
