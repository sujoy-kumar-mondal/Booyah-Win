import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CopyOtp } from '../src/pages/CopyOtp.js';
import { Login } from '../src/pages/Login.js';
import { AuthProvider } from '../src/context/AuthContext.js';

describe('CopyOtp Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the verification code from query params and copies to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <MemoryRouter initialEntries={['/copy-otp?code=767202&email=test@booyah.win']}>
        <AuthProvider>
          <CopyOtp />
        </AuthProvider>
      </MemoryRouter>
    );

    // Code is displayed
    expect(screen.getByText('767202')).toBeInTheDocument();
    // Copy function is called
    expect(writeTextMock).toHaveBeenCalledWith('767202');
    // Success badge is displayed
    await waitFor(() => {
      expect(screen.getByTestId('copy-success-badge')).toHaveTextContent(/Code copied to clipboard/i);
    });

    // Continue to login link contains the pre-filled otp and email
    const continueBtn = screen.getByTestId('copy-otp-continue-btn');
    expect(continueBtn).toHaveAttribute('href', '/login?otp=767202&email=test%40booyah.win');

    // Clicking copy again triggers writeText again
    const copyBtn = screen.getByTestId('copy-otp-action-btn');
    fireEvent.click(copyBtn);
    expect(writeTextMock).toHaveBeenCalledTimes(2);
  });

  it('pre-fills email and otp and enters OTP step when arriving on /login with params', async () => {
    render(
      <MemoryRouter initialEntries={['/login?otp=767202&email=player@example.com']}>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
      expect(emailInput.value).toBe('player@example.com');
      expect(screen.getByRole('button', { name: /Verify & Log In/i })).toBeInTheDocument();
    });
  });
});
