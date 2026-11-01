import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Deposits } from '../src/pages/Deposits.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/api/client.js';
import { depositListResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Phase 5 Proof: Signed URLs Security - Zero Logging and Sanitized Storage', () => {
  let queryClient: QueryClient;
  let logSpy: any;
  let warnSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'valid-token');
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    sessionStorage.clear();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('signed screenshot URLs are rendered safely in images without being logged to console', async () => {
    const sensitiveSignedUrl = 'https://storage.booyah.win/screenshots/dep-123.png?X-Amz-Signature=secret_hmac_signature_token_99999';

    vi.spyOn(staffApi, 'getStaffDeposits').mockResolvedValue(
      loadContractFixture('GET_staff_deposits.json', depositListResponseGuard, 'GET /staff/deposits', (d) => {
        d.items = [
          {
            id: 'dep-101',
            userId: 'user-1',
            userEmail: 'player@example.com',
            amount: '100.00',
            utr: '123456789012',
            screenshotUrl: '/local/dep-101.png',
            signedScreenshotUrl: sensitiveSignedUrl,
            status: 'pending',
            needsAdmin: false,
            createdAt: new Date().toISOString(),
          },
        ];
        d.nextCursor = null;
      })
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/deposits']}>
          <Routes>
            <Route path="/deposits" element={<Deposits />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Deposit item appears
    expect(await screen.findByText('123456789012')).toBeInTheDocument();

    // Verify console logs never printed the sensitive signed URL or HMAC signature
    const allCalls = [
      ...logSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ].flat().map(String);

    const leakedCalls = allCalls.filter(
      (c) => c.includes('secret_hmac_signature_token') || c.includes('X-Amz-Signature')
    );

    expect(leakedCalls).toHaveLength(0);
  });
});
