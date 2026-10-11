import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Register } from '../src/pages/Register.js';
import * as authApi from '../src/api/auth.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import { registerVerifyResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 2 & 5: Registration Token Lifecycle & Storage Isolation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps registration token in component state only, never writes to storage, and a refresh resets to Step 1', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log');
    const mockRegToken = 'jwt-reg-token-xyz-12345';

    vi.spyOn(authApi, 'requestRegisterOtp').mockResolvedValue({ message: 'OTP sent' });
    vi.spyOn(authApi, 'verifyRegisterOtp').mockResolvedValue(
      loadContractFixture(
        'POST_api_v1_auth_register_verify-otp.json',
        registerVerifyResponseGuard,
        'POST /api/v1/auth/register/verify-otp',
        (data) => {
          data.registrationToken = mockRegToken;
        }
      )
    );

    const { unmount } = render(
      <MemoryRouter>
        <AuthProvider>
          <Register />
        </AuthProvider>
      </MemoryRouter>
    );

    // Step 1: Submit Email
    const emailInput = screen.getByLabelText(/Email Address/i);
    fireEvent.change(emailInput, { target: { value: 'player@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Get Verification Code/i }));

    // Step 2: Verification Code screen
    await waitFor(() => {
      expect(screen.getByText(/Enter the 6-digit verification code/i)).toBeInTheDocument();
    });

    const digitInputs = screen.getAllByRole('textbox');
    // First 6 textboxes are OTP inputs
    for (let i = 0; i < 6; i++) {
      fireEvent.change(digitInputs[i], { target: { value: '1' } });
    }

    const verifyBtn = screen.getByRole('button', { name: /Verify Email/i });
    fireEvent.click(verifyBtn);

    // Step 3: Registration Profile Form is now displayed
    await waitFor(() => {
      expect(screen.getByTestId('registration-profile-form')).toBeInTheDocument();
    });

    // Requirement 2 & 5: Assert registration token is NEVER stored in localStorage or sessionStorage
    expect(localStorage.getItem('registrationToken')).toBeNull();
    expect(localStorage.getItem('booyah_registration_token')).toBeNull();
    expect(sessionStorage.getItem('registrationToken')).toBeNull();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      expect(localStorage.getItem(key)).not.toContain(mockRegToken);
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)!;
      expect(sessionStorage.getItem(key)).not.toContain(mockRegToken);
    }

    // Never logged anywhere
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining(mockRegToken));

    // Simulate page refresh by unmounting and re-rendering Register
    unmount();

    render(
      <MemoryRouter>
        <AuthProvider>
          <Register />
        </AuthProvider>
      </MemoryRouter>
    );

    // Assert it returns to Step 1 (email form), not Step 3
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.queryByTestId('registration-profile-form')).not.toBeInTheDocument();
  });
});
