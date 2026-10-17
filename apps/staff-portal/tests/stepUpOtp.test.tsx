import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient, setStoredStaffToken, getStoredStaffToken } from '../src/api/client';
import { StepUpOtpModal } from '../src/components/common/StepUpOtpModal';

const TestComponent: React.FC = () => {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSensitiveAction = async () => {
    try {
      setError(null);
      const res = await apiClient.post<{ message: string }>('/admin/settings', {
        payment_upi_id: 'new@upi',
      });
      setResult(res.message);
    } catch (err: any) {
      setError(err.code || err.message);
    }
  };

  return (
    <div>
      <button data-testid="do-sensitive-action" onClick={handleSensitiveAction}>
        Update UPI
      </button>
      {result && <div data-testid="success-result">{result}</div>}
      {error && <div data-testid="error-result">{error}</div>}
      <StepUpOtpModal />
    </div>
  );
};

describe('Staff Portal: Step-Up OTP & Transparent Retries on REAUTH_REQUIRED', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
    setStoredStaffToken('valid-staff-token', true);
  });

  it('shows OTP dialog on REAUTH_REQUIRED and transparently retries the action upon verification', async () => {
    const user = userEvent.setup();

    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);

      if (urlStr.includes('/admin/settings')) {
        callCount++;
        if (callCount === 1) {
          // First attempt: require step-up reauth
          return new Response(
            JSON.stringify({
              error: {
                code: 'REAUTH_REQUIRED',
                message: 'Elevated session required. Please verify OTP to proceed.',
              },
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        } else {
          // Second attempt: transparent retry succeeds!
          return new Response(
            JSON.stringify({
              data: { message: 'Settings updated successfully' },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }

      if (urlStr.includes('/staff/auth/step-up/request-otp')) {
        return new Response(
          JSON.stringify({
            data: { message: 'OTP sent to registered staff email' },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (urlStr.includes('/staff/auth/step-up/verify-otp')) {
        return new Response(
          JSON.stringify({
            data: {
              message: 'Session elevated successfully',
              elevatedUntil: new Date(Date.now() + 3600000).toISOString(),
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response('Not found', { status: 404 });
    });

    render(<TestComponent />);

    // Click the sensitive action button
    await user.click(screen.getByTestId('do-sensitive-action'));

    // Step-up modal should appear
    await waitFor(() => {
      expect(screen.getByTestId('step-up-otp-modal')).toBeInTheDocument();
    });
    expect(screen.getByText('Security Verification Required')).toBeInTheDocument();

    // Enter OTP
    const otpInput = screen.getByTestId('step-up-otp-input');
    await user.type(otpInput, '654321');

    // Click Verify & Proceed
    await user.click(screen.getByTestId('step-up-verify-btn'));

    // Modal should close and the action should succeed transparently!
    await waitFor(() => {
      expect(screen.queryByTestId('step-up-otp-modal')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('success-result')).toHaveTextContent('Settings updated successfully');
    });

    // Verify 2 calls to /admin/settings were made (initial + retry)
    expect(callCount).toBe(2);
    // User token remains valid
    expect(getStoredStaffToken()).toBe('valid-staff-token');
  });

  it('cancelling step-up modal aborts the action without logging the user out', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);

      if (urlStr.includes('/admin/settings')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'REAUTH_REQUIRED',
              message: 'Elevated session required. Please verify OTP to proceed.',
            },
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (urlStr.includes('/staff/auth/step-up/request-otp')) {
        return new Response(
          JSON.stringify({
            data: { message: 'OTP sent to registered staff email' },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response('Not found', { status: 404 });
    });

    render(<TestComponent />);

    await user.click(screen.getByTestId('do-sensitive-action'));

    await waitFor(() => {
      expect(screen.getByTestId('step-up-otp-modal')).toBeInTheDocument();
    });

    // Click Cancel
    await user.click(screen.getByTestId('step-up-cancel-btn'));

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByTestId('step-up-otp-modal')).not.toBeInTheDocument();
    });

    // Error is set to REAUTH_REQUIRED without logging out
    await waitFor(() => {
      expect(screen.getByTestId('error-result')).toHaveTextContent('REAUTH_REQUIRED');
    });

    // User is still logged in!
    expect(getStoredStaffToken()).toBe('valid-staff-token');
  });
});
