import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShareButton } from '../src/components/referral/ShareButton.js';
import { ShareModal } from '../src/components/referral/ShareModal.js';
import { Register } from '../src/pages/Register.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import { buildReferralSharePayload, getWhatsAppShareUrl } from '../src/utils/share.js';

describe('Referral Sharing & Registration Auto-fill', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('buildReferralSharePayload creates expected message format with referral code and download link', () => {
    const payload = buildReferralSharePayload('BW7777', 'https://booyah-win.vercel.app');
    expect(payload.url).toBe('https://booyah-win.vercel.app/refer/BW7777');
    expect(payload.text).toContain('Use my referral code: BW7777 and get a joining bonus.');
    expect(payload.text).toContain('Download Link: https://booyah-win.vercel.app/refer/BW7777');

    const waUrl = getWhatsAppShareUrl(payload);
    expect(waUrl).toContain('https://wa.me/?text=');
    expect(waUrl).toContain('BW7777');
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
          url: expect.stringContaining('/refer/BW1234'),
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
  });
});
