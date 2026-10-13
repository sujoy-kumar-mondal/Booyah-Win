import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { Login } from '../src/pages/Login.js';
import * as staffApi from '../src/api/staff.js';
import { ApiError } from '../src/api/client.js';
import {
  getFriendlyErrorMessage,
  DEV_NETWORK_MESSAGE,
  DEV_NON_JSON_MESSAGE,
  PROD_NETWORK_OR_NON_JSON_MESSAGE,
} from '../src/utils/errors.js';
import { ErrorCodes } from '@booyah/shared';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe('Requirement 2 & 3: Login Error Specificity & Dev vs Prod Messaging', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Login Screen Display in Development Mode (import.meta.env.DEV = true)', () => {
    it('shows developer network error message when API call fails at the network level', async () => {
      const user = userEvent.setup();
      vi.spyOn(staffApi, 'requestStaffOtp').mockRejectedValue(
        new ApiError('NETWORK_ERROR', 'Cannot reach the server. Check that the API is running.', {}, 0)
      );

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <StaffAuthProvider>
              <Login />
            </StaffAuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const emailInput = screen.getByTestId('staff-email-input');
      await user.type(emailInput, 'staff@booyah.win');
      await user.click(screen.getByTestId('request-otp-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('login-error-message')).toBeInTheDocument();
      });

      expect(screen.getByTestId('login-error-message')).toHaveTextContent(
        'Cannot reach the server. Check that the API is running.'
      );
    });

    it('shows staff account not found error message when registered is false', async () => {
      const user = userEvent.setup();
      vi.spyOn(staffApi, 'requestStaffOtp').mockResolvedValue({
        message: 'If this email is registered, an OTP has been sent',
        registered: false,
      });

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <StaffAuthProvider>
              <Login />
            </StaffAuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const emailInput = screen.getByTestId('staff-email-input');
      await user.type(emailInput, 'unknown@booyah.win');
      await user.click(screen.getByTestId('request-otp-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('login-error-message')).toBeInTheDocument();
      });

      expect(screen.getByTestId('login-error-message')).toHaveTextContent(
        'Staff account not found. Please contact an administrator.'
      );
      expect(screen.queryByTestId('staff-login-step2')).not.toBeInTheDocument();
    });

    it('shows developer non-JSON error message when server returns non-JSON / HTML response', async () => {
      const user = userEvent.setup();
      vi.spyOn(staffApi, 'requestStaffOtp').mockRejectedValue(
        new ApiError('NON_JSON_RESPONSE', 'The server sent an unexpected response.', {}, 200)
      );

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <StaffAuthProvider>
              <Login />
            </StaffAuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const emailInput = screen.getByTestId('staff-email-input');
      await user.type(emailInput, 'staff@booyah.win');
      await user.click(screen.getByTestId('request-otp-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('login-error-message')).toBeInTheDocument();
      });

      expect(screen.getByTestId('login-error-message')).toHaveTextContent(
        'The server sent an unexpected response.'
      );
    });

    it('shows developer network error message when fetch throws a raw TypeError', async () => {
      const user = userEvent.setup();
      vi.spyOn(staffApi, 'requestStaffOtp').mockRejectedValue(
        new TypeError('Failed to fetch')
      );

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <StaffAuthProvider>
              <Login />
            </StaffAuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const emailInput = screen.getByTestId('staff-email-input');
      await user.type(emailInput, 'staff@booyah.win');
      await user.click(screen.getByTestId('request-otp-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('login-error-message')).toBeInTheDocument();
      });

      expect(screen.getByTestId('login-error-message')).toHaveTextContent(
        'Cannot reach the server. Check that the API is running.'
      );
    });
  });

  describe('Requirement 3: Unit Testing Dev Mode vs Prod Mode Error Resolution', () => {
    it('returns developer wording when isDev is true', () => {
      const networkErr = new ApiError('NETWORK_ERROR', 'Network down');
      const nonJsonErr = new ApiError('NON_JSON_RESPONSE', 'Non json');

      expect(getFriendlyErrorMessage(networkErr, undefined, true)).toBe(DEV_NETWORK_MESSAGE);
      expect(getFriendlyErrorMessage(networkErr, undefined, true)).toBe(
        'Cannot reach the server. Check that the API is running.'
      );

      expect(getFriendlyErrorMessage(nonJsonErr, undefined, true)).toBe(DEV_NON_JSON_MESSAGE);
      expect(getFriendlyErrorMessage(nonJsonErr, undefined, true)).toBe(
        'The server sent an unexpected response.'
      );

      const rawFetchErr = new TypeError('Failed to fetch');
      expect(getFriendlyErrorMessage(rawFetchErr, undefined, true)).toBe(
        'Cannot reach the server. Check that the API is running.'
      );
    });

    it('returns friendly production message when isDev is false (production build)', () => {
      const networkErr = new ApiError('NETWORK_ERROR', 'Network down');
      const nonJsonErr = new ApiError('NON_JSON_RESPONSE', 'Non json');

      expect(getFriendlyErrorMessage(networkErr, undefined, false)).toBe(PROD_NETWORK_OR_NON_JSON_MESSAGE);
      expect(getFriendlyErrorMessage(networkErr, undefined, false)).toBe(
        "We couldn't reach the server. Please check your connection and try again."
      );

      expect(getFriendlyErrorMessage(nonJsonErr, undefined, false)).toBe(PROD_NETWORK_OR_NON_JSON_MESSAGE);
      expect(getFriendlyErrorMessage(nonJsonErr, undefined, false)).toBe(
        "We couldn't reach the server. Please check your connection and try again."
      );

      const rawFetchErr = new TypeError('Failed to fetch');
      expect(getFriendlyErrorMessage(rawFetchErr, undefined, false)).toBe(
        "We couldn't reach the server. Please check your connection and try again."
      );
    });
  });

  describe('Requirement 2: Preserves Existing Friendly Messages by Error Code', () => {
    it('preserves INVALID_OTP message', () => {
      const err = new ApiError(ErrorCodes.INVALID_OTP, 'Server msg');
      expect(getFriendlyErrorMessage(err)).toBe('Invalid OTP code. Please check the code and try again.');
    });

    it('preserves OTP_RATE_LIMITED message', () => {
      const err = new ApiError(ErrorCodes.OTP_RATE_LIMITED, 'Server msg');
      expect(getFriendlyErrorMessage(err)).toBe('Too many OTP requests. Please wait before trying again.');
    });

    it('preserves UNAUTHENTICATED message', () => {
      const err = new ApiError(ErrorCodes.UNAUTHENTICATED, 'Server msg');
      expect(getFriendlyErrorMessage(err)).toBe('Your session has expired. Please log in again.');
    });

    it('preserves 409 conflict message', () => {
      const err = new ApiError(409, 'CONFLICT', 'Server msg');
      expect(getFriendlyErrorMessage(err)).toBe('This request was already processed');
    });

    it('preserves FORBIDDEN deposit self-approval message', () => {
      const err = new ApiError(ErrorCodes.FORBIDDEN, 'Server msg');
      expect(getFriendlyErrorMessage(err, 'deposit')).toBe('Staff cannot approve their own deposit');
    });

    it('preserves FORBIDDEN withdrawal self-marking message', () => {
      const err = new ApiError(ErrorCodes.FORBIDDEN, 'Server msg');
      expect(getFriendlyErrorMessage(err, 'withdrawal')).toBe('Staff cannot mark their own withdrawal as paid');
    });
  });
});
