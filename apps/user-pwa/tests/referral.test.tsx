import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Referral } from '../src/pages/Referral.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import * as rulesApi from '../src/api/rules.js';
import * as userApi from '../src/api/user.js';
import { setStoredToken } from '../src/api/client.js';
import { rulesResponseGuard, referralSummaryResponseGuard, getMeGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 10: Referral Screen UI & Privacy', () => {
  const getRulesFixture = () =>
    loadContractFixture('GET_api_v1_rules.json', rulesResponseGuard, 'GET /api/v1/rules', (data) => {
      data.referralReward = '5.00';
      data.maxCashbackUsagePercent = 5;
      data.minWithdrawal = '50.00';
    });

  const getReferralSummaryFixture = (mutate?: (data: any) => void) =>
    loadContractFixture(
      'GET_api_v1_me_referral-summary.json',
      referralSummaryResponseGuard,
      'GET /api/v1/me/referral-summary',
      (data) => {
        data.referralCode = 'BOOYAH123';
        data.referredCount = 12;
        data.bonusEarnedCount = 7;
        data.totalBonusEarned = '35.00';
        if (mutate) mutate(data);
      }
    );

  const getMeFixture = () =>
    loadContractFixture('GET_api_v1_me.json', getMeGuard, 'GET /api/v1/me', (data) => {
      data.profile.name = 'Referral Player';
      data.profile.referralCode = 'BOOYAH123';
    });

  beforeEach(() => {
    vi.restoreAllMocks();
    setStoredToken('test-token');
  });

  it('Requirement 10: renders referral code, copies to clipboard, and shares to WhatsApp', async () => {
    vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());
    vi.spyOn(rulesApi, 'getRules').mockResolvedValue(getRulesFixture());
    vi.spyOn(rulesApi, 'getReferralSummary').mockResolvedValue(getReferralSummaryFixture());

    // Mock clipboard
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    // Mock window.open
    const windowOpenMock = vi.fn();
    vi.spyOn(window, 'open').mockImplementation(windowOpenMock as any);

    render(
      <MemoryRouter>
        <AuthProvider>
          <Referral />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('referral-code-display')).toHaveTextContent('BOOYAH123');
    });

    // Copy to clipboard
    const copyBtn = screen.getByTestId('copy-referral-btn');
    fireEvent.click(copyBtn);
    expect(writeTextMock).toHaveBeenCalledWith('BOOYAH123');

    // Share on WhatsApp
    const whatsappBtn = screen.getByTestId('whatsapp-share-btn');
    fireEvent.click(whatsappBtn);
    expect(windowOpenMock).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/?text='),
      '_blank'
    );
    expect(windowOpenMock.mock.calls[0][0]).toContain('BOOYAH123');
  });

  it('Requirement 10: displays summary cards with exact counts and total bonus earned', async () => {
    vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());
    vi.spyOn(rulesApi, 'getRules').mockResolvedValue(getRulesFixture());
    vi.spyOn(rulesApi, 'getReferralSummary').mockResolvedValue(getReferralSummaryFixture());

    render(
      <MemoryRouter>
        <AuthProvider>
          <Referral />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('referred-count')).toHaveTextContent('12');
    });

    expect(screen.getByTestId('bonus-earned-count')).toHaveTextContent('7');
    expect(screen.getByTestId('total-bonus-earned')).toHaveTextContent('Rs35.00');
  });

  it('Requirement 10: displays dynamic rules notice with cashback reward from rules API', async () => {
    vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());
    vi.spyOn(rulesApi, 'getRules').mockResolvedValue(getRulesFixture());
    vi.spyOn(rulesApi, 'getReferralSummary').mockResolvedValue(getReferralSummaryFixture());

    render(
      <MemoryRouter>
        <AuthProvider>
          <Referral />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      const notice = screen.getByTestId('referral-rule-notice');
      expect(notice).toHaveTextContent(/You get ₹5 cashback when your friend joins their first match/i);
    });
  });

  it('Requirement 10: strictly preserves privacy with zero personal data of friends rendered', async () => {
    vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());
    vi.spyOn(rulesApi, 'getRules').mockResolvedValue(getRulesFixture());
    vi.spyOn(rulesApi, 'getReferralSummary').mockResolvedValue(getReferralSummaryFixture());

    const { container } = render(
      <MemoryRouter>
        <AuthProvider>
          <Referral />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('referral-code-display')).toBeInTheDocument();
    });

    const fullText = container.textContent || '';
    // Asserts no friend list, phone numbers, or emails
    expect(fullText).not.toMatch(/\+91\d{10}/);
    expect(fullText).not.toMatch(/@example\.com/);
    expect(screen.queryByTestId('friends-list')).not.toBeInTheDocument();
  });
});
