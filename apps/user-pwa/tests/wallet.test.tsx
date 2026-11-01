import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor, renderHook } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/context/AuthContext.js';
import { Wallet } from '../src/pages/Wallet.js';
import { History } from '../src/pages/History.js';
import { TransactionDetail } from '../src/pages/TransactionDetail.js';
import { DepositForm } from '../src/components/wallet/DepositForm.js';
import { WithdrawForm } from '../src/components/wallet/WithdrawForm.js';
import { TransactionsList } from '../src/components/wallet/TransactionsList.js';
import { usePendingWalletPoller } from '../src/hooks/usePendingWalletPoller.js';
import * as walletApi from '../src/api/wallet.js';
import * as userApi from '../src/api/user.js';
import * as rulesApi from '../src/api/rules.js';
import { ApiError, setStoredToken, clearStoredToken } from '../src/api/client.js';
import { ErrorCodes } from '@booyah/shared';
import {
  getMeGuard,
  paymentInfoDtoGuard,
  transactionListResponseGuard,
  rulesResponseGuard,
} from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Wallet Screens & Milestone 9b-1 Integration', () => {
  let queryClient: QueryClient;

  const mockUser = {
    id: '1',
    email: 'player@example.com',
    name: 'Player One',
    mobile: '9876543210',
    ffId: '11223344',
    ffName: 'ProPlayer',
    upiId: 'player@upi',
    dateOfBirth: '2000-01-01',
    referralCode: 'BOOYAH123',
    referredBy: null,
    createdAt: '2026-10-01T00:00:00.000Z',
  };

  const mockWallets = {
    addMoney: '150.00',
    cashback: '20.00',
    winning: '300.00',
    total: '470.00',
  };

  const mockCooldowns = {
    mobileAvailableAt: null,
    ffIdAvailableAt: null,
    ffNameAvailableAt: null,
    upiIdAvailableAt: null,
  };

  const getMeFixture = () =>
    loadContractFixture('GET_api_v1_me.json', getMeGuard, 'GET /api/v1/me', (data) => {
      data.profile.name = 'Player One';
      data.profile.email = 'player@example.com';
      data.profile.mobile = '9876543210';
      data.profile.ffId = '11223344';
      data.profile.ffName = 'ProPlayer';
      data.profile.upiId = 'player@upi';
      data.wallets = mockWallets;
      data.cooldowns = mockCooldowns;
    });

  const getPaymentInfoFixture = (mutate?: (data: any) => void) =>
    loadContractFixture('GET_api_v1_payment-info.json', paymentInfoDtoGuard, 'GET /api/v1/payment-info', (data) => {
      data.configured = true;
      data.paymentUpiId = 'merchant@booyah';
      data.paymentQrUrl = 'https://storage/qr.png';
      data.qrUrl = 'https://storage/qr.png';
      data.minDeposit = '10.00';
      data.maxDeposit = '5000.00';
      if (mutate) mutate(data);
    });

  const getTransactionsFixture = (mutate?: (data: any) => void) =>
    loadContractFixture('GET_api_v1_wallet_transactions.json', transactionListResponseGuard, 'GET /api/v1/wallet/transactions', (data) => {
      data.items = [];
      data.nextCursor = null;
      if (mutate) mutate(data);
    });

  beforeEach(() => {
    vi.restoreAllMocks();
    clearStoredToken();
    setStoredToken('test-token');

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
      },
    });

    vi.spyOn(userApi, 'getMe').mockResolvedValue(getMeFixture());
    vi.spyOn(walletApi, 'getPaymentInfo').mockResolvedValue(getPaymentInfoFixture());
    vi.spyOn(walletApi, 'getTransactions').mockResolvedValue(getTransactionsFixture());
    vi.spyOn(rulesApi, 'getRules').mockResolvedValue(
      loadContractFixture('GET_api_v1_rules.json', rulesResponseGuard, 'GET /api/v1/rules')
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderComponent = async (ui: React.ReactElement, initialEntries = ['/wallet']) => {
    const utils = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthProvider>{ui}</AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for any initial query loading indicator to settle
    await waitFor(() => {
      expect(screen.queryByText('Loading payment details...')).not.toBeInTheDocument();
    });

    return utils;
  };

  describe('Wallet Screen Balances & Explanations', () => {
    it('displays total and three balances with short explanations', async () => {
      await renderComponent(<Wallet />);

      expect(screen.getByTestId('wallet-total-balance')).toHaveTextContent('Rs470.00');
      expect(screen.getByTestId('wallet-add-money')).toHaveTextContent('Rs150.00');
      expect(screen.getByTestId('wallet-cashback')).toHaveTextContent('Rs20.00');
      expect(screen.getByTestId('wallet-winning')).toHaveTextContent('Rs300.00');

      const explanations = screen.getByTestId('wallet-explanations-banner');
      expect(explanations).toHaveTextContent(
        'Deposited & Cashback can be used for tournament entry fees. Only Winning can be withdrawn.'
      );
      expect(explanations).toHaveTextContent(
        'Cashback covers at most 5% of an entry fee per match.'
      );
    });

    it('displays dynamic cashback percent from rules API (e.g. 12.34%)', async () => {
      vi.spyOn(rulesApi, 'getRules').mockResolvedValue({
        referralReward: '5.00',
        maxCashbackUsagePercent: 12.34,
        minWithdrawal: '50.00',
      });

      await renderComponent(<Wallet />);

      const explanations = screen.getByTestId('wallet-explanations-banner');
      expect(explanations).toHaveTextContent(
        'Cashback covers at most 12.34% of an entry fee per match.'
      );
      expect(screen.getByText('Max 12.34% / join')).toBeInTheDocument();
    });

    it('renders fallback text without numbers when rules API fails', async () => {
      vi.spyOn(rulesApi, 'getRules').mockRejectedValue(new Error('Rules service unavailable'));

      await renderComponent(<Wallet />);

      const explanations = screen.getByTestId('wallet-explanations-banner');
      expect(explanations).toHaveTextContent(
        'Cashback covers a capped portion of an entry fee per match.'
      );
      expect(explanations).not.toHaveTextContent('%');
      expect(screen.getByText('Capped per join')).toBeInTheDocument();
    });

    it('provides quick action navigation to add money, withdraw, and history', async () => {
      await renderComponent(<Wallet />);
      expect(screen.getByTestId('quick-add-money-btn')).toBeInTheDocument();
      expect(screen.getByTestId('quick-withdraw-btn')).toBeInTheDocument();
      expect(screen.getByTestId('wallet-history-btn')).toBeInTheDocument();
    });
  });

  describe('Add Money (Section 7)', () => {
    it('shows QR image and UPI ID from GET /payment-info', async () => {
      await renderComponent(<DepositForm />);

      expect(screen.getByTestId('merchant-upi-id')).toHaveTextContent('merchant@booyah');
      const qrImg = screen.getByTestId('payment-qr-image') as HTMLImageElement;
      expect(qrImg.src).toContain('https://storage/qr.png');
    });

    it('disables the deposit form when payment is not configured', async () => {
      vi.spyOn(walletApi, 'getPaymentInfo').mockResolvedValueOnce(
        getPaymentInfoFixture((data) => {
          data.configured = false;
          data.message = 'Payment information not configured yet';
          data.paymentUpiId = null;
          data.paymentQrUrl = null;
          data.qrUrl = null;
        })
      );

      await renderComponent(<DepositForm />);

      expect(screen.getByTestId('payment-not-configured-banner')).toBeInTheDocument();
      expect(screen.getByTestId('deposit-amount-input')).toBeDisabled();
      expect(screen.getByTestId('deposit-utr-input')).toBeDisabled();
      expect(screen.getByTestId('submit-deposit-btn')).toBeDisabled();
    });

    it('auto-uppercases UTR on entry', async () => {
      await renderComponent(<DepositForm />);

      const utrInput = screen.getByTestId('deposit-utr-input') as HTMLInputElement;
      fireEvent.change(utrInput, { target: { value: 'utrabc123456' } });
      expect(utrInput.value).toBe('UTRABC123456');
    });

    it('revokes blob URL on screenshot change and on unmount (Requirement 12)', async () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-preview');

      const { unmount } = await renderComponent(<DepositForm />);

      const fileInput = screen.getByTestId('deposit-screenshot-input');
      const file1 = new File(['img1'], 'file1.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [file1] } });
      expect(createSpy).toHaveBeenCalledWith(file1);

      // Change file
      const file2 = new File(['img2'], 'file2.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [file2] } });

      // Old blob URL was revoked
      expect(revokeSpy).toHaveBeenCalledWith('blob:test-preview');

      // Unmount component
      unmount();
      expect(revokeSpy).toHaveBeenCalled();
    });

    it('guards double submit with ref and disables button during pending state (Requirement 7)', async () => {
      let resolveCall: any;
      const slowCall = new Promise((resolve) => {
        resolveCall = resolve;
      });

      const createDepositSpy = vi
        .spyOn(walletApi, 'createDeposit')
        .mockReturnValue(slowCall as any);

      await renderComponent(<DepositForm />);

      // Fill valid inputs
      fireEvent.change(screen.getByTestId('deposit-amount-input'), {
        target: { value: '100.00' },
      });
      fireEvent.change(screen.getByTestId('deposit-utr-input'), {
        target: { value: '123456789012' },
      });

      const file = new File(['image-bytes'], 'screenshot.jpg', { type: 'image/jpeg' });
      fireEvent.change(screen.getByTestId('deposit-screenshot-input'), {
        target: { files: [file] },
      });

      const submitBtn = screen.getByTestId('submit-deposit-btn');

      // Fast double click
      fireEvent.click(submitBtn);
      fireEvent.click(submitBtn);

      await act(async () => {
        await Promise.resolve();
      });

      // Mutex ref and disabled state guarantee exactly 1 request
      expect(createDepositSpy).toHaveBeenCalledTimes(1);
      expect(submitBtn).toBeDisabled();
      expect(screen.getByTestId('uploading-state-label')).toHaveTextContent('Uploading...');

      // Finish mutation
      await act(async () => {
        resolveCall({
          id: '1',
          amount: '100.00',
          utr: '123456789012',
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
        await Promise.resolve();
      });

      // Renders pending confirmation screen with "Usually reviewed within 30 minutes, final approval can take a bit longer"
      expect(screen.getByTestId('deposit-success-view')).toBeInTheDocument();
      expect(
        screen.getByText('Usually reviewed within 30 minutes, final approval can take a bit longer')
      ).toBeInTheDocument();
    });

    it('shows friendly timeout/network error message and refetches lists without retrying (Requirement 5)', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      vi.spyOn(walletApi, 'createDeposit').mockRejectedValue(
        new ApiError('NETWORK_ERROR', 'Failed to fetch', {}, 503)
      );

      await renderComponent(<DepositForm />);

      fireEvent.change(screen.getByTestId('deposit-amount-input'), {
        target: { value: '100.00' },
      });
      fireEvent.change(screen.getByTestId('deposit-utr-input'), {
        target: { value: '123456789012' },
      });

      const file = new File(['image-bytes'], 'screenshot.jpg', { type: 'image/jpeg' });
      fireEvent.change(screen.getByTestId('deposit-screenshot-input'), {
        target: { files: [file] },
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('submit-deposit-btn'));
        await Promise.resolve();
      });

      // Requirement 5 error text
      expect(screen.getByTestId('deposit-submission-error')).toHaveTextContent(
        "We couldn't confirm your submission. Check History before sending again"
      );

      // Refetched transactions list
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['transactions'] })
      );
    });

    it('maps UTR_EXISTS and DEPOSIT_LIMIT to visible friendly messages', async () => {
      vi.spyOn(walletApi, 'createDeposit')
        .mockRejectedValueOnce(
          new ApiError(ErrorCodes.UTR_EXISTS, 'UTR duplicate', {}, 409)
        )
        .mockRejectedValueOnce(
          new ApiError(ErrorCodes.DEPOSIT_LIMIT, 'Pending deposit limit reached', {}, 409)
        );

      await renderComponent(<DepositForm />);

      fireEvent.change(screen.getByTestId('deposit-amount-input'), {
        target: { value: '100.00' },
      });
      fireEvent.change(screen.getByTestId('deposit-utr-input'), {
        target: { value: '123456789012' },
      });

      const file = new File(['img'], 's.png', { type: 'image/png' });
      fireEvent.change(screen.getByTestId('deposit-screenshot-input'), {
        target: { files: [file] },
      });

      // First submit fails with UTR_EXISTS
      await act(async () => {
        fireEvent.click(screen.getByTestId('submit-deposit-btn'));
        await Promise.resolve();
      });
      expect(screen.getByTestId('deposit-utr-error')).toHaveTextContent(
        'This UTR has already been submitted'
      );

      // Second submit fails with DEPOSIT_LIMIT
      await act(async () => {
        fireEvent.click(screen.getByTestId('submit-deposit-btn'));
        await Promise.resolve();
      });
      expect(screen.getByTestId('deposit-submission-error')).toHaveTextContent(
        'You may have at most 3 pending deposits at a time'
      );
    });

    it('Requirement 10: copies UPI ID with visible Copied confirmation', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      await renderComponent(<DepositForm />);

      const copyBtn = screen.getByTestId('copy-upi-btn');
      await act(async () => {
        fireEvent.click(copyBtn);
        await Promise.resolve();
      });

      expect(writeTextMock).toHaveBeenCalledWith('merchant@booyah');
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    it('opens and closes the UTR example modal with tabbed guides', async () => {
      await renderComponent(<DepositForm />);

      const exampleBtn = screen.getByTestId('utr-example-btn');
      expect(exampleBtn).toBeInTheDocument();
      expect(screen.queryByTestId('utr-help-modal')).not.toBeInTheDocument();

      // Open modal
      await act(async () => {
        fireEvent.click(exampleBtn);
      });
      expect(screen.getByTestId('utr-help-modal')).toBeInTheDocument();
      expect(screen.getByTestId('utr-content-gpay')).toBeInTheDocument();

      // Switch to PhonePe tab
      await act(async () => {
        fireEvent.click(screen.getByTestId('utr-tab-phonepe'));
      });
      expect(screen.getByTestId('utr-content-phonepe')).toBeInTheDocument();

      // Switch to Paytm / Other tab
      await act(async () => {
        fireEvent.click(screen.getByTestId('utr-tab-other'));
      });
      expect(screen.getByTestId('utr-content-other')).toBeInTheDocument();

      // Close modal with Got It button
      await act(async () => {
        fireEvent.click(screen.getByTestId('close-utr-help-btn'));
      });
      expect(screen.queryByTestId('utr-help-modal')).not.toBeInTheDocument();
    });
  });

  describe('Withdraw (Section 8)', () => {
    it('submit button stays disabled until amount valid, UPI re-entry matches, and checkbox is ticked', async () => {
      await renderComponent(<WithdrawForm />);

      const submitBtn = screen.getByTestId('submit-withdraw-btn');
      const amountInput = screen.getByTestId('withdraw-amount-input');
      const upiInput = screen.getByTestId('confirm-upi-input');
      const checkbox = screen.getByTestId('confirm-checkbox');

      // Initially disabled
      expect(submitBtn).toBeDisabled();

      // Enter amount >= 50
      fireEvent.change(amountInput, { target: { value: '60.00' } });
      expect(submitBtn).toBeDisabled();

      // Enter mismatched UPI ID
      fireEvent.change(upiInput, { target: { value: 'wrong@upi' } });
      expect(submitBtn).toBeDisabled();

      // Enter matching UPI ID (case-insensitive)
      fireEvent.change(upiInput, { target: { value: 'PLAYER@UPI' } });
      expect(submitBtn).toBeDisabled();

      // Tick checkbox
      fireEvent.click(checkbox);

      // Now enabled!
      expect(submitBtn).toBeEnabled();
    });

    it('shows 24-hour lock message on UPI_RECENTLY_CHANGED (Requirement 11)', async () => {
      vi.spyOn(walletApi, 'createWithdrawal').mockRejectedValue(
        new ApiError(ErrorCodes.UPI_RECENTLY_CHANGED, 'UPI changed recently', {}, 403)
      );

      await renderComponent(<WithdrawForm />);

      fireEvent.change(screen.getByTestId('withdraw-amount-input'), {
        target: { value: '75.00' },
      });
      fireEvent.change(screen.getByTestId('confirm-upi-input'), {
        target: { value: 'player@upi' },
      });
      fireEvent.click(screen.getByTestId('confirm-checkbox'));

      await act(async () => {
        fireEvent.click(screen.getByTestId('submit-withdraw-btn'));
        await Promise.resolve();
      });

      expect(screen.getByTestId('withdraw-submission-error')).toHaveTextContent(
        'Withdrawals are blocked for 24 hours after a UPI ID change'
      );
    });

    it('shows one-pending-withdrawal message on WITHDRAWAL_PENDING', async () => {
      vi.spyOn(walletApi, 'createWithdrawal').mockRejectedValue(
        new ApiError(ErrorCodes.WITHDRAWAL_PENDING, 'Withdrawal pending exists', {}, 409)
      );

      await renderComponent(<WithdrawForm />);

      fireEvent.change(screen.getByTestId('withdraw-amount-input'), {
        target: { value: '80.00' },
      });
      fireEvent.change(screen.getByTestId('confirm-upi-input'), {
        target: { value: 'player@upi' },
      });
      fireEvent.click(screen.getByTestId('confirm-checkbox'));

      await act(async () => {
        fireEvent.click(screen.getByTestId('submit-withdraw-btn'));
        await Promise.resolve();
      });

      expect(screen.getByTestId('withdraw-submission-error')).toHaveTextContent(
        'You already have a pending withdrawal request'
      );
    });
  });

  describe('Transactions (Section 6.4 & 13.1)', () => {
    it('sends correct type value when clicking filter chips', async () => {
      const getTxSpy = vi.spyOn(walletApi, 'getTransactions');

      await renderComponent(<TransactionsList />);

      // Filter chips: All, Add Money, Referral, Withdrawal, Joining Fee, Winning, Refund
      fireEvent.click(screen.getByTestId('filter-chip-add_money'));
      expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'add_money' }));

      fireEvent.click(screen.getByTestId('filter-chip-referral'));
      expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'referral' }));

      fireEvent.click(screen.getByTestId('filter-chip-withdrawal'));
      expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'withdrawal' }));

      fireEvent.click(screen.getByTestId('filter-chip-join_fee'));
      expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'join_fee' }));

      fireEvent.click(screen.getByTestId('filter-chip-winning'));
      expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'winning' }));

      fireEvent.click(screen.getByTestId('filter-chip-refund'));
      expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'refund' }));
    });

    it('displays signed amounts with accessible labels and remaining balance', async () => {
      vi.spyOn(walletApi, 'getTransactions').mockResolvedValue(
        getTransactionsFixture((data) => {
          data.items = [
            {
              transactionId: 'BW-0000001',
              type: 'add_money',
              createdAt: '2026-10-10T10:00:00.000Z',
              amount: '100.00',
              remainingAmount: '100.00',
              wallet: 'add_money',
              refType: null,
              refId: null,
            },
            {
              transactionId: 'BW-0000002',
              type: 'join_fee',
              createdAt: '2026-10-10T11:00:00.000Z',
              amount: '-15.00',
              remainingAmount: '85.00',
              wallet: 'add_money',
              refType: 'match',
              refId: '1',
            },
          ];
        })
      );

      await renderComponent(<TransactionsList />);

      const signedAmounts = screen.getAllByTestId('transaction-signed-amount');
      expect(signedAmounts[0]).toHaveTextContent('+Rs100.00');
      expect(signedAmounts[0]).toHaveAttribute('aria-label', 'Credit of Rs100.00');

      expect(signedAmounts[1]).toHaveTextContent('-Rs15.00');
      expect(signedAmounts[1]).toHaveAttribute('aria-label', 'Debit of Rs15.00');

      expect(screen.getByText('BW-TRX-1')).toBeInTheDocument();
      expect(screen.getByText('BW-TRX-2')).toBeInTheDocument();
    });

    it('displays pending and rejected badges for pending/rejected transactions in history list', async () => {
      vi.spyOn(walletApi, 'getTransactions').mockResolvedValue(
        getTransactionsFixture((data) => {
          data.items = [
            {
              transactionId: 'BW-TRX-170',
              type: 'add_money',
              createdAt: '2026-10-31T08:44:00.000Z',
              amount: '25.00',
              remainingAmount: '80.00',
              wallet: 'add_money',
              refType: 'deposit',
              refId: 'BW-TRX-170',
              status: 'pending',
              statusReason: 'Verification in progress',
            },
            {
              transactionId: 'BW-TRX-171',
              type: 'withdrawal_hold',
              createdAt: '2026-10-31T09:00:00.000Z',
              amount: '-50.00',
              remainingAmount: '30.00',
              wallet: 'winning',
              refType: 'withdrawal',
              refId: 'BW-TRX-171',
              status: 'rejected',
              statusReason: 'Invalid UPI ID',
            },
          ];
        })
      );

      await renderComponent(<TransactionsList />);

      expect(screen.getByTestId('transaction-status-pending-BW-TRX-170')).toBeInTheDocument();
      expect(screen.getByTestId('transaction-status-pending-BW-TRX-170')).toHaveTextContent('Pending Review');

      expect(screen.getByTestId('transaction-status-rejected-BW-TRX-171')).toBeInTheDocument();
      expect(screen.getByTestId('transaction-status-rejected-BW-TRX-171')).toHaveTextContent('Rejected');
    });

    it('filters transactions by fromDate and toDate and clears filters on reset', async () => {
      const getTxSpy = vi.spyOn(walletApi, 'getTransactions').mockResolvedValue(getTransactionsFixture());

      await renderComponent(<TransactionsList showFilters={true} />);

      const fromInput = screen.getByTestId('filter-from-date');
      const toInput = screen.getByTestId('filter-to-date');

      // Enter fromDate
      fireEvent.change(fromInput, { target: { value: '2026-10-25' } });
      expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ fromDate: '2026-10-25' }));

      // Enter toDate
      fireEvent.change(toInput, { target: { value: '2026-10-31' } });
      expect(getTxSpy).toHaveBeenCalledWith(
        expect.objectContaining({ fromDate: '2026-10-25', toDate: '2026-10-31' })
      );

      // Clear button should be visible
      const clearBtn = screen.getByTestId('clear-date-filter-btn');
      expect(clearBtn).toBeInTheDocument();

      // Click clear button
      fireEvent.click(clearBtn);
      expect(fromInput).toHaveValue('');
      expect(toInput).toHaveValue('');
      expect(getTxSpy).toHaveBeenCalledWith(
        expect.objectContaining({ fromDate: undefined, toDate: undefined })
      );
    });

    it('displays empty state when no transactions exist', async () => {
      vi.spyOn(walletApi, 'getTransactions').mockResolvedValue(getTransactionsFixture());

      await renderComponent(<TransactionsList />);
      await waitFor(() => {
        expect(screen.getByTestId('transactions-empty-state')).toBeInTheDocument();
      });
    });

    it('preserves the active filter (e.g. Referral) when navigating to transaction details and clicking back', async () => {
      vi.spyOn(walletApi, 'getTransactions').mockResolvedValue(
        getTransactionsFixture((data) => {
          data.items = [
            {
              transactionId: 'BW-TRX-2',
              type: 'referral',
              createdAt: '2026-10-12T00:04:00.000Z',
              amount: '5.00',
              remainingAmount: '5.00',
              wallet: 'cashback',
              refType: 'user',
              refId: 'BW-USR-2',
            },
          ];
        })
      );
      vi.spyOn(walletApi, 'getTransactionDetail').mockResolvedValue({
        transactionId: 'BW-TRX-2',
        id: 2,
        type: 'referral',
        createdAt: '2026-10-12T00:04:00.000Z',
        amount: '5.00',
        remainingAmount: '5.00',
        wallet: 'cashback',
        walletName: 'Cashback Balance',
        status: 'successful',
        statusReason: null,
        breakdown: { deposited: '0.00', cashback: '5.00', winning: '0.00' },
        match: null,
        deposit: null,
        withdrawal: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/wallet/history']}>
            <AuthProvider>
              <Routes>
                <Route path="/wallet/history" element={<History />} />
                <Route path="/wallet/transactions/:id" element={<TransactionDetail />} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify "All" chip is initially selected and Referral is not
      const referralChip = await screen.findByTestId('filter-chip-referral');
      expect(referralChip).not.toHaveClass('bg-emerald-500');

      // Click "Referral" filter chip
      fireEvent.click(referralChip);
      expect(referralChip).toHaveClass('bg-emerald-500');

      // Verify transaction list shows the referral transaction
      const txItem = await screen.findByTestId('transaction-item-BW-TRX-2');
      expect(txItem).toBeInTheDocument();

      // Click on the transaction item to navigate to details
      fireEvent.click(txItem);

      // Verify we arrived on the transaction detail page
      await screen.findByTestId('transaction-detail-page');
      expect(screen.getByText('BW-TRX-2')).toBeInTheDocument();

      // Click Back button
      const backBtn = screen.getByTestId('transaction-detail-back-btn');
      fireEvent.click(backBtn);

      // Verify we are back on the History page
      await screen.findByTestId('wallet-history-page');

      // Check that "Referral" filter chip is STILL active/selected (did not reset to "All")
      const referralChipAfterBack = screen.getByTestId('filter-chip-referral');
      expect(referralChipAfterBack).toHaveClass('bg-emerald-500');
      const allChipAfterBack = screen.getByTestId('filter-chip-all');
      expect(allChipAfterBack).not.toHaveClass('bg-emerald-500');
    });
  });

  describe('Pending Poller (Requirement 9)', () => {
    it('polls every 30 seconds when any request is pending and stops when none are pending', () => {
      vi.useFakeTimers();
      const onRefetch = vi.fn();

      const { rerender } = renderHook(
        ({ deposits, withdrawals }) =>
          usePendingWalletPoller({
            deposits,
            withdrawals,
            onRefetch,
          }),
        {
          initialProps: {
            deposits: [
              {
                id: '1',
                amount: '50.00',
                utr: 'UTR123',
                status: 'pending' as const,
                screenshotUrl: 's.png',
                rejectReason: null,
                needsAdmin: false,
                createdAt: new Date().toISOString(),
                reviewedAt: null,
              },
            ],
            withdrawals: [],
          },
        }
      );

      // Fast forward 30 seconds: onRefetch called once
      act(() => {
        vi.advanceTimersByTime(30000);
      });
      expect(onRefetch).toHaveBeenCalledTimes(1);

      // Fast forward another 30 seconds: onRefetch called twice
      act(() => {
        vi.advanceTimersByTime(30000);
      });
      expect(onRefetch).toHaveBeenCalledTimes(2);

      // Status updates to approved -> hasPending becomes false -> stops polling
      rerender({
        deposits: [
          {
            id: '1',
            amount: '50.00',
            utr: 'UTR123',
            status: 'approved' as const,
            screenshotUrl: 's.png',
            rejectReason: null,
            needsAdmin: false,
            createdAt: new Date().toISOString(),
            reviewedAt: new Date().toISOString(),
          },
        ],
        withdrawals: [],
      });

      // Fast forward another 60 seconds: no new calls
      act(() => {
        vi.advanceTimersByTime(60000);
      });
      expect(onRefetch).toHaveBeenCalledTimes(2);
    });

    it('pauses polling when tab is hidden and refetches when tab becomes visible again', () => {
      vi.useFakeTimers();
      const onRefetch = vi.fn();

      renderHook(() =>
        usePendingWalletPoller({
          deposits: [
            {
              id: '1',
              amount: '50.00',
              utr: 'UTR123',
              status: 'pending' as const,
              screenshotUrl: 's.png',
              rejectReason: null,
              needsAdmin: false,
              createdAt: new Date().toISOString(),
              reviewedAt: null,
            },
          ],
          onRefetch,
        })
      );

      // Hide tab
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Advance 60s while hidden: no calls
      act(() => {
        vi.advanceTimersByTime(60000);
      });
      expect(onRefetch).not.toHaveBeenCalled();

      // Make tab visible again: immediately refetches and restarts interval
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(onRefetch).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(30000);
      });
      expect(onRefetch).toHaveBeenCalledTimes(2);
    });

    it('continues polling when a request is in employee_approved state', () => {
      vi.useFakeTimers();
      const onRefetch = vi.fn();

      renderHook(() =>
        usePendingWalletPoller({
          deposits: [
            {
              id: '1',
              amount: '50.00',
              utr: 'UTR123',
              status: 'employee_approved' as const,
              screenshotUrl: 's.png',
              rejectReason: null,
              needsAdmin: false,
              createdAt: new Date().toISOString(),
              reviewedAt: null,
            },
          ],
          withdrawals: [],
          onRefetch,
        })
      );

      act(() => {
        vi.advanceTimersByTime(30000);
      });
      expect(onRefetch).toHaveBeenCalledTimes(1);
    });

    it('pauses polling when offline and resumes when back online', () => {
      vi.useFakeTimers();
      const onRefetch = vi.fn();

      renderHook(() =>
        usePendingWalletPoller({
          deposits: [
            {
              id: '1',
              amount: '50.00',
              utr: 'UTR123',
              status: 'pending' as const,
              screenshotUrl: 's.png',
              rejectReason: null,
              needsAdmin: false,
              createdAt: new Date().toISOString(),
              reviewedAt: null,
            },
          ],
          withdrawals: [],
          onRefetch,
        })
      );

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      act(() => {
        vi.advanceTimersByTime(60000);
      });
      expect(onRefetch).not.toHaveBeenCalled();

      // Back online
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      expect(onRefetch).toHaveBeenCalledTimes(1);
    });
  });
});
