import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ShareButton } from '../src/components/referral/ShareButton.js';
import { ShareModal } from '../src/components/referral/ShareModal.js';
import { Register } from '../src/pages/Register.js';
import { ReferRedirect } from '../src/pages/ReferRedirect.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import { buildReferralSharePayload, getWhatsAppShareUrl } from '../src/utils/share.js';
import * as authApi from '../src/api/auth.js';
import { registerVerifyResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Referral Sharing & Registration Auto-fill', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('buildReferralSharePayload creates expected message format with referral code and download link', () => {
    const payload = buildReferralSharePayload('BW7777', 'https://booyah-win.vercel.app');
    expect(payload.url).toBe('https://booyah-win.vercel.app/refer/BW7777');
    expect(payload.text).toContain('Use my referral code: BW7777 and make your booyah into money.');
    expect(payload.text).toContain('Download Link: https://booyah-win.vercel.app/refer/BW7777');

    const waUrl = getWhatsAppShareUrl(payload);
    expect(waUrl).toContain('https://wa.me/?text=');
    expect(waUrl).toContain('BW7777');

    // Test with custom invitation text from admin settings
    const customPayload = buildReferralSharePayload(
      'BW7777',
      'https://booyah-win.vercel.app',
      'Special custom invitation text for Free Fire tournament winners!'
    );
    expect(customPayload.text).toContain('Special custom invitation text for Free Fire tournament winners!');
    expect(customPayload.text).toContain('Use my referral code: BW7777 and make your booyah into money.');
  });

  it('buildReferralSharePayload auto-detects current websiteUrl when origin is not provided', () => {
    // When no origin is passed, auto-detects from window.location.origin
    const expectedOrigin = window.location.origin.replace(/\/+$/, '');
    const payload = buildReferralSharePayload('PRO_KILLER');
    expect(payload.url).toBe(`${expectedOrigin}/refer/PRO_KILLER`);
    expect(payload.text).toContain(`Download Link: ${expectedOrigin}/refer/PRO_KILLER`);
    expect(payload.text).toContain('Use my referral code: PRO_KILLER and make your booyah into money.');
  });

  it('ShareButton calls navigator.share when available and shows success toast', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share: shareMock });

    render(<ShareButton referralCode="BW1234" />);

    const shareBtn = screen.getByTestId('share-and-earn-btn');
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Booyah Win'),
          text: expect.stringContaining('/refer/BW1234'),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('referral-toast')).toHaveTextContent('Shared successfully!');
    });
  });

  it('ShareButton opens ShareModal fallback when navigator.share is undefined', async () => {
    Object.assign(navigator, { share: undefined });

    render(<ShareButton referralCode="BW9999" />);

    const shareBtn = screen.getByTestId('share-and-earn-btn');
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(screen.getByTestId('share-modal-content')).toBeInTheDocument();
      expect(screen.getByTestId('share-whatsapp-btn')).toBeInTheDocument();
      expect(screen.getByTestId('share-telegram-btn')).toBeInTheDocument();
      expect(screen.getByTestId('share-facebook-btn')).toBeInTheDocument();
      expect(screen.getByTestId('share-twitter-btn')).toBeInTheDocument();
      expect(screen.getByTestId('share-modal-copy-link-btn')).toBeInTheDocument();
    });
  });

  it('ShareModal copies link to clipboard and notifies user', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    const onNotify = vi.fn();
    const payload = buildReferralSharePayload('BW5555', 'https://booyah-win.vercel.app');

    render(
      <ShareModal
        isOpen={true}
        onClose={vi.fn()}
        payload={payload}
        referralCode="BW5555"
        onNotify={onNotify}
      />
    );

    const copyLinkBtn = screen.getByTestId('share-modal-copy-link-btn');
    fireEvent.click(copyLinkBtn);

    expect(writeTextMock).toHaveBeenCalledWith('https://booyah-win.vercel.app/refer/BW5555');
    expect(onNotify).toHaveBeenCalledWith('Referral link copied to clipboard!');
  });

  it('ReferRedirect route redirects to /register?ref=<code> without saving in localStorage', async () => {
    render(
      <MemoryRouter initialEntries={['/refer/l3cl7yr7']}>
        <AuthProvider>
          <Routes>
            <Route path="/refer/:code" element={<ReferRedirect />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('register-page')).toBeInTheDocument();
      expect(screen.getByTestId('referral-code-active-banner')).toHaveTextContent('l3cl7yr7');
    });

    expect(localStorage.getItem('booyah_ref')).toBeNull();
    expect(sessionStorage.getItem('booyah_ref')).toBeNull();
  });

  it('Register page pre-fills referralCode from ?ref= query parameter', async () => {
    render(
      <MemoryRouter initialEntries={['/register?ref=FRIEND123']}>
        <AuthProvider>
          <Register />
        </AuthProvider>
      </MemoryRouter>
    );

    // Initial step is email input
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByTestId('referral-code-active-banner')).toHaveTextContent('friend123');
  });

  it('clicking referral link, entering email, and verifying OTP autofills referral code in the registration form', async () => {
    vi.spyOn(authApi, 'lookupReferralCode').mockResolvedValue({
      exists: true,
      name: 'Sujoy Kumar Mondal',
      referralCode: 'l3cl7yr7',
    });
    vi.spyOn(authApi, 'requestRegisterOtp').mockResolvedValue({ message: 'OTP sent' });
    vi.spyOn(authApi, 'verifyRegisterOtp').mockResolvedValue(
      loadContractFixture(
        'POST_api_v1_auth_register_verify-otp.json',
        registerVerifyResponseGuard,
        'POST /api/v1/auth/register/verify-otp',
        (data) => {
          data.registrationToken = 'jwt-token-referral-test';
        }
      )
    );

    render(
      <MemoryRouter initialEntries={['/refer/l3cl7yr7']}>
        <AuthProvider>
          <Routes>
            <Route path="/refer/:code" element={<ReferRedirect />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    // 1. Redirects to /register and shows active referral banner
    await waitFor(() => {
      expect(screen.getByTestId('registration-email-form')).toBeInTheDocument();
    });

    // 2. User enters email and submits
    const emailInput = screen.getByLabelText(/Email Address/i);
    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue with OTP|Get Verification Code/i }));

    // 3. User enters OTP and submits
    await waitFor(() => {
      expect(screen.getByTestId('registration-otp-form')).toBeInTheDocument();
    });

    const digitInputs = screen.getAllByRole('textbox').slice(-6);
    for (let i = 0; i < 6; i++) {
      fireEvent.change(digitInputs[i], { target: { value: '1' } });
    }
    fireEvent.click(screen.getByRole('button', { name: /Verify & Log In|Verify Email/i }));

    // 4. Registration form appears, referral code field must be autofilled with 'l3cl7yr7' and NOT editable (readOnly)
    await waitFor(() => {
      expect(screen.getByTestId('registration-profile-form')).toBeInTheDocument();
    });

    const refInput = screen.getByPlaceholderText(/Enter friend's username/i) as HTMLInputElement;
    expect(refInput.value).toBe('l3cl7yr7');
    expect(refInput.readOnly).toBe(true);
    expect(screen.getByTestId('referral-locked-icon')).toBeInTheDocument();

    // 5. Verified badge with referrer name appears
    await waitFor(() => {
      expect(screen.getByTestId('referral-applied-badge')).toHaveTextContent('Bonus Applied (Sujoy Kumar Mondal)');
      expect(screen.getByTestId('referral-success-text')).toHaveTextContent('Referrer: Sujoy Kumar Mondal');
    });
  });

  it('referral field is editable when navigating to /register directly without referral link', async () => {
    const mockRegToken = 'jwt-reg-token-direct-12345';
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

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <Register />
        </AuthProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/Email Address/i);
    fireEvent.change(emailInput, { target: { value: 'directplayer@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue with OTP|Get Verification Code/i }));

    await waitFor(() => {
      expect(screen.getByTestId('otp-sent-success-msg')).toBeInTheDocument();
    });

    const digitInputs = screen.getAllByRole('textbox').slice(-6);
    for (let i = 0; i < 6; i++) {
      fireEvent.change(digitInputs[i], { target: { value: '1' } });
    }
    fireEvent.click(screen.getByRole('button', { name: /Verify & Log In|Verify Email/i }));

    await waitFor(() => {
      expect(screen.getByTestId('registration-profile-form')).toBeInTheDocument();
    });

    const refInput = screen.getByPlaceholderText(/Enter friend's username/i) as HTMLInputElement;
    expect(refInput.value).toBe('');
    expect(refInput.readOnly).toBe(false);
    expect(screen.queryByTestId('referral-locked-icon')).not.toBeInTheDocument();
  });

  it('referral field is editable when referral code in link is invalid (e.g. s20035)', async () => {
    vi.spyOn(authApi, 'lookupReferralCode').mockResolvedValue({
      exists: false,
      name: null,
      referralCode: 's20035',
    });
    vi.spyOn(authApi, 'requestRegisterOtp').mockResolvedValue({ message: 'OTP sent' });
    vi.spyOn(authApi, 'verifyRegisterOtp').mockResolvedValue(
      loadContractFixture(
        'POST_api_v1_auth_register_verify-otp.json',
        registerVerifyResponseGuard,
        'POST /api/v1/auth/register/verify-otp',
        (data) => {
          data.registrationToken = 'jwt-token-invalid-referral';
        }
      )
    );

    render(
      <MemoryRouter initialEntries={['/register?ref=s20035']}>
        <AuthProvider>
          <Register />
        </AuthProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/Email Address/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue with OTP|Get Verification Code/i }));

    await waitFor(() => {
      expect(screen.getByTestId('otp-sent-success-msg')).toBeInTheDocument();
    });

    const digitInputs = screen.getAllByRole('textbox').slice(-6);
    for (let i = 0; i < 6; i++) {
      fireEvent.change(digitInputs[i], { target: { value: '1' } });
    }
    fireEvent.click(screen.getByRole('button', { name: /Verify & Log In|Verify Email/i }));

    await waitFor(() => {
      expect(screen.getByTestId('registration-profile-form')).toBeInTheDocument();
    });

    const refInput = screen.getByPlaceholderText(/Enter friend's username/i) as HTMLInputElement;
    expect(refInput.value).toBe('s20035');

    // Because s20035 is invalid, it MUST be editable and lock icon must NOT appear
    await waitFor(() => {
      expect(screen.getByTestId('referral-invalid-badge')).toBeInTheDocument();
      expect(refInput.readOnly).toBe(false);
      expect(screen.queryByTestId('referral-locked-icon')).not.toBeInTheDocument();
    });

    // User can edit or clear the invalid referral code
    fireEvent.change(refInput, { target: { value: '' } });
    expect(refInput.value).toBe('');
  });

  describe('Registration Referral Code Validation', () => {
    async function advanceToStep3(initialEntries?: string[]) {
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

      render(
        <MemoryRouter initialEntries={initialEntries || ['/register']}>
          <AuthProvider>
            <Register />
          </AuthProvider>
        </MemoryRouter>
      );

      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.change(emailInput, { target: { value: 'player@example.com' } });
      fireEvent.click(screen.getByRole('button', { name: /Continue with OTP|Get Verification Code/i }));

      await waitFor(() => {
        expect(screen.getByTestId('otp-sent-success-msg')).toBeInTheDocument();
      });

      const digitInputs = screen.getAllByRole('textbox').slice(-6);
      for (let i = 0; i < 6; i++) {
        fireEvent.change(digitInputs[i], { target: { value: '1' } });
      }

      const verifyBtn = screen.getByRole('button', { name: /Verify & Log In|Verify Email/i });
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(screen.getByTestId('registration-profile-form')).toBeInTheDocument();
      });
    }

    it('validates referral code and shows green bonus badge and referrer name when valid', async () => {
      vi.spyOn(authApi, 'lookupReferralCode').mockResolvedValue({
        exists: true,
        name: 'Pro Referrer',
        referralCode: 'pro_friend',
      });

      await advanceToStep3();

      const refInput = screen.getByPlaceholderText(/Enter friend's username/i);
      fireEvent.change(refInput, { target: { value: 'pro_friend' } });
      fireEvent.blur(refInput);

      await waitFor(() => {
        expect(screen.getByTestId('referral-applied-badge')).toBeInTheDocument();
        expect(screen.getByTestId('referral-applied-badge')).toHaveTextContent('Bonus Applied (Pro Referrer)');
        expect(screen.getByTestId('referral-success-text')).toHaveTextContent('Referrer: Pro Referrer');
      });
    });

    it('validates referral code with optional leading @ and displays green bonus badge', async () => {
      vi.spyOn(authApi, 'lookupReferralCode').mockResolvedValue({
        exists: true,
        name: 'Sujoy Mondal',
        referralCode: 's2003',
      });

      await advanceToStep3();

      const refInput = screen.getByPlaceholderText(/Enter friend's username/i);
      fireEvent.change(refInput, { target: { value: '@s2003' } });
      fireEvent.blur(refInput);

      await waitFor(() => {
        expect(screen.getByTestId('referral-applied-badge')).toBeInTheDocument();
        expect(screen.getByTestId('referral-applied-badge')).toHaveTextContent('Bonus Applied (Sujoy Mondal)');
        expect(screen.getByTestId('referral-success-text')).toHaveTextContent('Referrer: Sujoy Mondal');
      });
    });

    it('shows red invalid badge and error message when referral code does not exist', async () => {
      vi.spyOn(authApi, 'lookupReferralCode').mockResolvedValue({
        exists: false,
        name: null,
        referralCode: 'ghost_user',
      });

      await advanceToStep3();

      const refInput = screen.getByPlaceholderText(/Enter friend's username/i);
      fireEvent.change(refInput, { target: { value: 'ghost_user' } });
      fireEvent.blur(refInput);

      await waitFor(() => {
        expect(screen.getByTestId('referral-invalid-badge')).toBeInTheDocument();
        expect(screen.getByTestId('referral-invalid-badge')).toHaveTextContent('Invalid Code');
        expect(screen.getByTestId('referral-error-text')).toHaveTextContent(
          'Invalid referral code. No player found with this username.'
        );
      });
    });

    it('prevents using own username as referral code and displays error', async () => {
      await advanceToStep3();

      const usernameInput = screen.getByPlaceholderText(/e\.g\. pro_killer99/i);
      fireEvent.change(usernameInput, { target: { value: 'my_hero' } });

      const refInput = screen.getByPlaceholderText(/Enter friend's username/i);
      fireEvent.change(refInput, { target: { value: 'my_hero' } });
      fireEvent.blur(refInput);

      await waitFor(() => {
        expect(screen.getByTestId('referral-invalid-badge')).toBeInTheDocument();
        expect(screen.getByTestId('referral-error-text')).toHaveTextContent(
          /Cannot use your own username as referral code/i
        );
      });
    });

    it('blocks submission when referral code is invalid', async () => {
      const completeRegisterMock = vi.spyOn(authApi, 'completeRegistration');
      vi.spyOn(authApi, 'lookupReferralCode').mockResolvedValue({
        exists: false,
        name: null,
        referralCode: 'ghost_user',
      });

      await advanceToStep3();

      // Fill in all required fields
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. pro_killer99/i), {
        target: { value: 'new_player' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Enter your full name/i), {
        target: { value: 'Test Player' },
      });
      fireEvent.change(screen.getByPlaceholderText(/9876543210/i), {
        target: { value: '9876543210' },
      });
      fireEvent.change(screen.getByPlaceholderText(/12345678/i), {
        target: { value: '987654321' },
      });
      fireEvent.change(screen.getByPlaceholderText(/ProGamer/i), {
        target: { value: 'NinjaPro' },
      });
      fireEvent.change(screen.getByPlaceholderText(/username@okhdfcbank/i), {
        target: { value: 'player@okaxis' },
      });
      fireEvent.change(screen.getByLabelText(/Date of Birth/i), {
        target: { value: '2000-01-01' },
      });
      fireEvent.click(screen.getByRole('checkbox'));

      // Enter invalid referral code
      const refInput = screen.getByPlaceholderText(/Enter friend's username/i);
      fireEvent.change(refInput, { target: { value: 'ghost_user' } });
      fireEvent.blur(refInput);

      await waitFor(() => {
        expect(screen.getByTestId('referral-invalid-badge')).toBeInTheDocument();
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /Complete Registration/i }));

      // completeRegistration should not have been called
      expect(completeRegisterMock).not.toHaveBeenCalled();
      expect(screen.getByTestId('referral-error-text')).toBeInTheDocument();
    });
  });
});
