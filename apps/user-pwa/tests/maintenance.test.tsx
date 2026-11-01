import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MaintenanceBanner, formatIstDateTime } from '../src/components/common/MaintenanceBanner.js';
import { MaintenanceProvider } from '../src/context/MaintenanceContext.js';
import { getSystemStatus } from '../src/api/status.js';

describe('User PWA Maintenance Mode (Requirements 6, 7, 9)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Requirement 6: Plain Text Rendering & XSS Safety', () => {
    it('renders maintenance message as plain text and does not execute or inject script tags', () => {
      const scriptMessage = '<script>alert("xss")</script> Scheduled maintenance until 6 PM.';

      // Mock fetch returning maintenance on
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          data: {
            maintenance: {
              enabled: true,
              message: scriptMessage,
              until: null,
            },
          },
        }),
      } as any);

      render(
        <MaintenanceProvider>
          <MaintenanceBanner />
        </MaintenanceProvider>
      );

      return waitFor(() => {
        const banner = screen.getByTestId('maintenance-banner');
        expect(banner).toBeInTheDocument();
        const msgEl = screen.getByTestId('maintenance-message');
        expect(msgEl.textContent).toBe(scriptMessage);
        // Verify no <script> tag was created in DOM
        expect(document.querySelector('script[src*="xss"], script:not([type])')).toBeNull();
      });
    });

    it('does not render banner when maintenance is disabled', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          data: {
            maintenance: {
              enabled: false,
              message: 'All systems operational',
              until: null,
            },
          },
        }),
      } as any);

      render(
        <MaintenanceProvider>
          <MaintenanceBanner />
        </MaintenanceProvider>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('maintenance-banner')).toBeNull();
      });
    });
  });

  describe('Requirement 7: IST Timezone Formatting', () => {
    it('formats until timestamp with fixed +05:30 IST timezone', () => {
      const isoUtc = '2026-10-15T10:30:00.000Z'; // 10:30 UTC = 16:00 (4:00 PM) IST
      const formatted = formatIstDateTime(isoUtc);
      expect(formatted).toContain('IST');
      expect(formatted).toMatch(/4:00\s*(pm|PM)/i);
    });
  });

  describe('Requirement 9: Polling Respects 429 Retry-After Without Error Banner', () => {
    it('returns retryAfter on 429 and does not throw or crash', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          'Retry-After': '45',
        }),
      } as any);

      const result = await getSystemStatus();
      expect(result).not.toBeNull();
      expect(result?.retryAfter).toBe(45);
      expect(result?.maintenance.unknown).toBe(true);
    });
  });
});
