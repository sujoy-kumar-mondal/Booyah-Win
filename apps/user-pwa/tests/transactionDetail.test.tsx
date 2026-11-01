import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransactionDetail } from '../src/pages/TransactionDetail.js';
import * as walletApi from '../src/api/wallet.js';
import type { TransactionDetailDto } from '../src/api/types.js';

describe('TransactionDetail Page', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    vi.restoreAllMocks();
  });

  const renderComponent = (transactionId: string = 'BW-0000154') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/wallet/transactions/${transactionId}`]}>
          <Routes>
            <Route path="/wallet/transactions/:id" element={<TransactionDetail />} />
            <Route path="/matches/:id" element={<div data-testid="mock-match-page">Match Page</div>} />
            <Route path="/support" element={<div data-testid="mock-support-page">Support Page</div>} />
            <Route path="/wallet" element={<div data-testid="mock-wallet-page">Wallet Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders match entry fee transaction with match info and breakdown', async () => {
    const mockMatchTxn: TransactionDetailDto = {
      transactionId: 'BW-0000154',
      id: 154,
      type: 'join_fee',
      createdAt: '2026-10-30T08:31:00.000Z',
      amount: '-10.00',
      remainingAmount: '0.00',
      wallet: 'all',
      walletName: 'Deposited, Cashback & Winning',
      status: 'successful',
      statusReason: null,
      breakdown: {
        deposited: '9.00',
        cashback: '1.00',
        winning: '0.00',
      },
      match: {
        id: 20,
        title: 'BATTLE ROYALE | SOLO | #20',
        gameMode: 'battle_royale',
        teamMode: 'solo',
        mapName: 'Bermuda',
        entryFee: '10.00',
        killPrice: '5.00',
        startTime: '2026-11-07T16:56:00.000Z',
        status: 'live',
        cancelReason: null,
        kills: 3,
        rank: 1,
        prizeAmount: '80.00',
      },
      deposit: null,
      withdrawal: null,
    };

    vi.spyOn(walletApi, 'getTransactionDetail').mockResolvedValue(mockMatchTxn);

    renderComponent('BW-0000154');

    // Amount & type
    await waitFor(() => {
      expect(screen.getByTestId('transaction-amount-display')).toHaveTextContent('-Rs10.00');
    });
    expect(screen.getByText('Match Entry Fee')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge-successful')).toBeInTheDocument();

    // Target wallet & remaining balance
    expect(screen.getByTestId('target-wallet-name')).toHaveTextContent('Deposited, Cashback & Winning');
    expect(screen.getByTestId('remaining-balance-display')).toHaveTextContent('Rs0.00');

    // Breakdown details
    expect(screen.getByTestId('wallet-breakdown-details')).toBeInTheDocument();
    expect(screen.getByText('Rs9.00')).toBeInTheDocument();

    // Transaction ID & Copy button
    expect(screen.getByTestId('transaction-display-id')).toHaveTextContent('BW-TRX-154');
    expect(screen.getByTestId('copy-txn-id-btn')).toBeInTheDocument();

    // Match card & clicking opens match details page
    expect(screen.getByTestId('transaction-match-card')).toBeInTheDocument();
    expect(screen.getByText('BATTLE ROYALE | SOLO | #20')).toBeInTheDocument();

    const viewMatchBtn = screen.getByTestId('view-match-details-btn');
    fireEvent.click(viewMatchBtn);

    expect(screen.getByTestId('mock-match-page')).toBeInTheDocument();
  });

  it('renders deposit transaction with UTR, status, and screenshot modal', async () => {
    const mockDepositTxn: TransactionDetailDto = {
      transactionId: 'BW-0000120',
      id: 120,
      type: 'add_money',
      createdAt: '2026-10-30T07:15:00.000Z',
      amount: '500.00',
      remainingAmount: '500.00',
      wallet: 'add_money',
      walletName: 'Deposited',
      status: 'successful',
      statusReason: null,
      breakdown: {
        deposited: '500.00',
      },
      match: null,
      deposit: {
        id: '15',
        amount: '500.00',
        utr: 'UTR123456789012',
        screenshotUrl: 'https://booyah.win/uploads/receipt.png',
        status: 'approved',
        rejectReason: null,
        createdAt: '2026-10-30T07:10:00.000Z',
        reviewedAt: '2026-10-30T07:15:00.000Z',
      },
      withdrawal: null,
    };

    vi.spyOn(walletApi, 'getTransactionDetail').mockResolvedValue(mockDepositTxn);

    renderComponent('BW-0000120');

    await waitFor(() => {
      expect(screen.getByTestId('transaction-amount-display')).toHaveTextContent('+Rs500.00');
    });

    expect(screen.getByTestId('status-badge-successful')).toBeInTheDocument();
    expect(screen.getByTestId('deposit-utr-display')).toHaveTextContent('UTR123456789012');
    expect(screen.getByTestId('copy-utr-btn')).toBeInTheDocument();
    expect(screen.getByTestId('deposit-request-time')).toBeInTheDocument();
    expect(screen.getByText('Request Made Time')).toBeInTheDocument();

    // Click screenshot thumbnail to open modal
    const thumbnail = screen.getByTestId('screenshot-thumbnail-container');
    fireEvent.click(thumbnail);

    expect(screen.getByTestId('screenshot-modal')).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByTestId('close-screenshot-modal-btn'));
    expect(screen.queryByTestId('screenshot-modal')).not.toBeInTheDocument();
  });

  it('renders withdrawal transaction with beneficiary UPI ID', async () => {
    const mockWithdrawTxn: TransactionDetailDto = {
      transactionId: 'BW-0000130',
      id: 130,
      type: 'withdrawal_hold',
      createdAt: '2026-10-30T09:00:00.000Z',
      amount: '-200.00',
      remainingAmount: '100.00',
      wallet: 'winning',
      walletName: 'Winning',
      status: 'pending',
      statusReason: null,
      breakdown: {
        winning: '200.00',
      },
      match: null,
      deposit: null,
      withdrawal: {
        id: '8',
        amount: '200.00',
        upiId: 'gamer@okaxis',
        status: 'pending',
        rejectReason: null,
        payoutRef: null,
        createdAt: '2026-10-30T09:00:00.000Z',
        processedAt: null,
      },
    };

    vi.spyOn(walletApi, 'getTransactionDetail').mockResolvedValue(mockWithdrawTxn);

    renderComponent('BW-0000130');

    await waitFor(() => {
      expect(screen.getByTestId('transaction-amount-display')).toHaveTextContent('-Rs200.00');
    });

    expect(screen.getByTestId('status-badge-pending')).toBeInTheDocument();
    expect(screen.getByTestId('withdrawal-upi-display')).toHaveTextContent('gamer@okaxis');
    expect(screen.getByTestId('copy-upi-btn')).toBeInTheDocument();
    expect(screen.getByTestId('withdrawal-request-time')).toBeInTheDocument();
  });

  it('renders rejected status with rejection note for rejected transaction', async () => {
    const mockRejectedTxn: TransactionDetailDto = {
      transactionId: 'BW-0000135',
      id: 135,
      type: 'add_money',
      createdAt: '2026-10-30T10:00:00.000Z',
      amount: '100.00',
      remainingAmount: '0.00',
      wallet: 'add_money',
      walletName: 'Deposited',
      status: 'rejected',
      statusReason: 'Invalid UTR reference provided in banking receipt.',
      breakdown: {
        deposited: '100.00',
      },
      match: null,
      deposit: {
        id: '22',
        amount: '100.00',
        utr: 'UTR999999999999',
        screenshotUrl: 'https://booyah.win/uploads/fake.png',
        status: 'rejected',
        rejectReason: 'Invalid UTR reference provided in banking receipt.',
        createdAt: '2026-10-30T09:50:00.000Z',
        reviewedAt: '2026-10-30T10:00:00.000Z',
      },
      withdrawal: null,
    };

    vi.spyOn(walletApi, 'getTransactionDetail').mockResolvedValue(mockRejectedTxn);

    renderComponent('BW-0000135');

    await waitFor(() => {
      expect(screen.getByTestId('status-badge-rejected')).toBeInTheDocument();
    });

    expect(screen.getByTestId('transaction-status-reason')).toHaveTextContent(
      'Invalid UTR reference provided in banking receipt.'
    );
  });

  it('renders cancelled status for match refund transaction', async () => {
    const mockCancelledTxn: TransactionDetailDto = {
      transactionId: 'BW-0000140',
      id: 140,
      type: 'refund',
      createdAt: '2026-10-30T11:00:00.000Z',
      amount: '20.00',
      remainingAmount: '120.00',
      wallet: 'all',
      walletName: 'Deposited, Cashback & Winning',
      status: 'cancelled',
      statusReason: 'Underfilled room host technical error',
      breakdown: {
        deposited: '20.00',
      },
      match: {
        id: 30,
        title: 'BATTLE ROYALE | SOLO | #30',
        gameMode: 'battle_royale',
        teamMode: 'solo',
        mapName: 'Bermuda',
        entryFee: '20.00',
        killPrice: '10.00',
        startTime: '2026-11-01T15:00:00.000Z',
        status: 'cancelled',
        cancelReason: 'Underfilled room host technical error',
      },
      deposit: null,
      withdrawal: null,
    };

    vi.spyOn(walletApi, 'getTransactionDetail').mockResolvedValue(mockCancelledTxn);

    renderComponent('BW-0000140');

    await waitFor(() => {
      expect(screen.getByTestId('status-badge-cancelled')).toBeInTheDocument();
    });

    expect(screen.getByTestId('transaction-status-reason')).toHaveTextContent(
      'Underfilled room host technical error'
    );
  });

  it('navigates to support on Contact Support button click', async () => {
    const mockTxn: TransactionDetailDto = {
      transactionId: 'BW-0000150',
      id: 150,
      type: 'admin_adjustment',
      createdAt: '2026-10-30T12:00:00.000Z',
      amount: '50.00',
      remainingAmount: '150.00',
      wallet: 'winning',
      walletName: 'Winning',
      status: 'successful',
      statusReason: null,
      breakdown: { winning: '50.00' },
      match: null,
      deposit: null,
      withdrawal: null,
    };

    vi.spyOn(walletApi, 'getTransactionDetail').mockResolvedValue(mockTxn);

    renderComponent('BW-0000150');

    await waitFor(() => {
      expect(screen.getByTestId('contact-support-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('contact-support-btn'));
    expect(screen.getByTestId('mock-support-page')).toBeInTheDocument();
  });

  it('renders deposit receipt image with relative signed URL and handles load error gracefully', async () => {
    const mockDepositTxn: TransactionDetailDto = {
      transactionId: 'BW-0000072',
      id: 72,
      type: 'add_money',
      createdAt: '2026-10-17T07:33:00.000Z',
      amount: '10.00',
      remainingAmount: '145.00',
      wallet: 'deposited',
      walletName: 'Deposited',
      status: 'successful',
      statusReason: null,
      breakdown: { deposited: '10.00' },
      match: null,
      deposit: {
        id: '12',
        amount: '10.00',
        utr: '531398166325',
        screenshotUrl: '/api/v1/files/00072bd10ff12b819cd639489b8f99bd.png?token=abcd&expires=12345',
        status: 'approved',
        rejectReason: null,
        createdAt: '2026-10-17T07:33:00.000Z',
        reviewedAt: '2026-10-17T07:35:00.000Z',
      },
      withdrawal: null,
    };

    vi.spyOn(walletApi, 'getTransactionDetail').mockResolvedValue(mockDepositTxn);

    renderComponent('BW-0000072');

    await waitFor(() => {
      expect(screen.getByTestId('deposit-utr-display')).toHaveTextContent('531398166325');
    });

    const img = screen.getByAltText('Deposit receipt proof') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('/api/v1/files/00072bd10ff12b819cd639489b8f99bd.png');

    // Trigger error on image load
    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.getByText('Image unavailable')).toBeInTheDocument();
    });
  });

  it('renders referral transaction with referred user username below Reference Type', async () => {
    const mockReferralTxn: TransactionDetailDto = {
      transactionId: 'BW-0000002',
      id: 2,
      type: 'referral',
      createdAt: '2026-10-12T00:04:00.000Z',
      amount: '5.00',
      remainingAmount: '5.00',
      wallet: 'cashback',
      walletName: 'Cashback',
      status: 'successful',
      statusReason: null,
      breakdown: { cashback: '5.00' },
      match: null,
      deposit: null,
      withdrawal: null,
      referral: {
        id: '1',
        referredUserId: '10',
        referredUsername: 'rohit_gamer',
        referredName: 'Rohit Sharma',
      },
    };

    vi.spyOn(walletApi, 'getTransactionDetail').mockResolvedValue(mockReferralTxn);

    renderComponent('BW-0000002');

    await waitFor(() => {
      expect(screen.getByTestId('transaction-amount-display')).toHaveTextContent('+Rs5.00');
    });

    expect(screen.getByText('Reference Type')).toBeInTheDocument();
    expect(screen.getByTestId('referred-user-display')).toHaveTextContent('rohit_gamer');
    expect(screen.getByText('Referred User')).toBeInTheDocument();
  });

  it('renders adjustment transaction with Adjustment title, fixed Reference Type and reason', async () => {
    const mockAdjustmentTxn: TransactionDetailDto = {
      transactionId: 'BW-0000153',
      id: 153,
      type: 'admin_adjustment',
      createdAt: '2026-10-30T08:10:00.000Z',
      amount: '5.00',
      remainingAmount: '10.00',
      wallet: 'add_money',
      walletName: 'Deposited',
      status: 'successful',
      statusReason: null,
      breakdown: { deposited: '5.00' },
      match: null,
      deposit: null,
      withdrawal: null,
      referral: null,
      adjustment: {
        reason: 'Compensation for server maintenance delay',
      },
    };

    vi.spyOn(walletApi, 'getTransactionDetail').mockResolvedValue(mockAdjustmentTxn);

    renderComponent('BW-0000153');

    await waitFor(() => {
      expect(screen.getByTestId('transaction-amount-display')).toHaveTextContent('+Rs5.00');
    });

    // Both top title and Reference Type should display "Adjustment", not "Admin Adjustment"
    const adjustmentElements = screen.getAllByText('Adjustment');
    expect(adjustmentElements).toHaveLength(2);
    expect(screen.queryByText('Admin Adjustment')).not.toBeInTheDocument();

    // Reference Type specifically displays "Adjustment"
    expect(screen.getByTestId('reference-type-display')).toHaveTextContent('Adjustment');
    expect(screen.queryByText('Admin_adjustment')).not.toBeInTheDocument();

    // Adjustment reason should be visible
    expect(screen.getByTestId('adjustment-reason-display')).toHaveTextContent('Compensation for server maintenance delay');
    expect(screen.getByText('Reason')).toBeInTheDocument();
  });

  it('renders adjustment transaction with fallback reason below Reference Type when reason is omitted', async () => {
    const mockAdjustmentWithoutReason: TransactionDetailDto = {
      transactionId: 'BW-TRX-158',
      id: 158,
      type: 'admin_adjustment',
      createdAt: '2026-10-30T15:54:38.000Z',
      amount: '50.00',
      remainingAmount: '60.00',
      wallet: 'winning',
      walletName: 'Winning',
      status: 'successful',
      statusReason: null,
      breakdown: { winning: '50.00' },
      match: null,
      deposit: null,
      withdrawal: null,
      referral: null,
      adjustment: null,
    };

    vi.spyOn(walletApi, 'getTransactionDetail').mockResolvedValue(mockAdjustmentWithoutReason);

    renderComponent('BW-TRX-158');

    await waitFor(() => {
      expect(screen.getByTestId('transaction-amount-display')).toHaveTextContent('+Rs50.00');
    });

    expect(screen.getByTestId('reference-type-display')).toHaveTextContent('Adjustment');
    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByTestId('adjustment-reason-display')).toHaveTextContent('Balance Adjustment');
  });

  it('renders joining reward transaction with Joining Reward title, Deposit wallet, and Welcome Bonus card', async () => {
    const mockJoiningTxn: TransactionDetailDto = {
      transactionId: 'BW-TRX-201',
      id: 201,
      type: 'joining_reward',
      createdAt: '2026-10-31T06:00:00.000Z',
      amount: '10.00',
      remainingAmount: '10.00',
      wallet: 'add_money',
      walletName: 'Deposited',
      status: 'successful',
      statusReason: null,
      breakdown: { deposited: '10.00' },
      match: null,
      deposit: null,
      withdrawal: null,
      referral: null,
      adjustment: null,
    };

    vi.spyOn(walletApi, 'getTransactionDetail').mockResolvedValue(mockJoiningTxn);

    renderComponent('BW-TRX-201');

    await waitFor(() => {
      expect(screen.getByTestId('transaction-amount-display')).toHaveTextContent('+Rs10.00');
    });

    expect(screen.getAllByText('Joining Reward')).toHaveLength(2);
    expect(screen.getByTestId('status-badge-successful')).toBeInTheDocument();
    expect(screen.getByTestId('target-wallet-name')).toHaveTextContent('Deposited');
    expect(screen.getByTestId('reference-type-display')).toHaveTextContent('Joining Reward');
    expect(screen.getByTestId('transaction-joining-reward-card')).toBeInTheDocument();
    expect(screen.getByText('Welcome Bonus')).toBeInTheDocument();
    expect(screen.getByText(/Your Joining Reward has been credited directly to your Deposit wallet/)).toBeInTheDocument();
  });
});

