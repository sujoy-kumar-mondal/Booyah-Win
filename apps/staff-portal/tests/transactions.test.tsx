import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Sidebar } from '../src/components/layout/Sidebar';
import { Transactions } from '../src/pages/Transactions';
import { TransactionDetail } from '../src/pages/TransactionDetail';
import * as staffApi from '../src/api/staff';
import type { StaffTransactionListItemDto, StaffTransactionDetailDto } from '../src/api/types';

vi.mock('../src/context/StaffAuthContext.js', () => ({
  useStaffAuth: () => ({
    staff: { id: '1', role: 'admin', name: 'Sujoy Admin', email: 'admin@booyah.win' },
    isAuthenticated: true,
  }),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe('Staff Portal - Transactions and Transaction Detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTransactions: StaffTransactionListItemDto[] = [
    {
      transactionId: 'BW-TRX-101',
      id: 101,
      userId: 'BW-USR-5',
      userName: 'Sujoy Mondal',
      userEmail: 'sujoy@example.com',
      userUsername: 'sujoy2003',
      wallet: 'add_money',
      walletName: 'Deposited',
      type: 'add_money',
      amount: '+500.00',
      balanceAfter: '500.00',
      totalAfter: '500.00',
      refType: 'deposit',
      refId: 'BW-DPT-12',
      createdAt: '2026-10-31T05:00:00.000Z',
    },
    {
      transactionId: 'BW-TRX-102',
      id: 102,
      userId: 'BW-USR-6',
      userName: 'Player Two',
      userEmail: 'player2@example.com',
      userUsername: 'player2',
      wallet: 'winning',
      walletName: 'Winning',
      type: 'winning',
      amount: '+250.00',
      balanceAfter: '250.00',
      totalAfter: '750.00',
      refType: 'match',
      refId: 'BW-MCH-45',
      createdAt: '2026-10-31T05:10:00.000Z',
    },
  ];

  const mockDetail: StaffTransactionDetailDto = {
    transactionId: 'BW-TRX-101',
    id: 101,
    userId: 'BW-USR-5',
    userName: 'Sujoy Mondal',
    userEmail: 'sujoy@example.com',
    userMobile: '9876543210',
    userUsername: 'sujoy2003',
    userFfId: '12345678',
    userFfName: 'SujoyFF',
    type: 'add_money',
    createdAt: '2026-10-31T05:00:00.000Z',
    amount: '+500.00',
    balanceAfter: '500.00',
    remainingAmount: '500.00',
    wallet: 'add_money',
    walletName: 'Deposited',
    status: 'successful',
    statusReason: null,
    refType: 'deposit',
    refId: 'BW-DPT-12',
    breakdown: null,
    deposit: {
      id: 'BW-DPT-12',
      amount: '500.00',
      utr: 'UTR987654321012',
      screenshotUrl: 'https://example.com/screenshot.png',
      status: 'approved',
      rejectReason: null,
      createdAt: '2026-10-31T04:55:00.000Z',
      reviewedAt: '2026-10-31T05:00:00.000Z',
      reviewedBy: 'admin@booyah.win',
    },
    match: null,
    withdrawal: null,
    referral: null,
    adjustment: null,
  };

  it('renders "Transaction" button in Sidebar directly below "Matches"', () => {
    render(
      <MemoryRouter>
        <Sidebar isOpen={true} />
      </MemoryRouter>
    );

    const matchesLink = screen.getByRole('link', { name: /matches/i });
    const transactionLink = screen.getByRole('link', { name: /transaction/i });
    expect(matchesLink).toBeInTheDocument();
    expect(transactionLink).toBeInTheDocument();
    expect(transactionLink).toHaveAttribute('href', '/transactions');

    // Verify ordering: Transaction appears after Matches
    const navLinks = screen.getAllByRole('link');
    const matchesIndex = navLinks.findIndex((el) => el.getAttribute('href') === '/matches');
    const transactionIndex = navLinks.findIndex((el) => el.getAttribute('href') === '/transactions');
    expect(transactionIndex).toBe(matchesIndex + 1);
  });

  it('renders transactions list in table format with search bar and dropdowns', async () => {
    vi.spyOn(staffApi, 'getStaffTransactions').mockResolvedValue({
      items: mockTransactions,
      nextCursor: null,
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <Transactions />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { name: /transactions/i })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/search by transaction id, user id, name, email/i)
    ).toBeInTheDocument();

    // Verify dropdowns
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getByText('All Wallets')).toBeInTheDocument();
    expect(screen.getByText('All Types')).toBeInTheDocument();

    // Verify table items
    await waitFor(() => {
      expect(screen.getByText('BW-TRX-101')).toBeInTheDocument();
      expect(screen.getByText('BW-TRX-102')).toBeInTheDocument();
      expect(screen.getByText('Sujoy Mondal')).toBeInTheDocument();
      expect(screen.getByText('Player Two')).toBeInTheDocument();
    });
  });

  it('triggers API query with search text and filters', async () => {
    const getTxnsSpy = vi.spyOn(staffApi, 'getStaffTransactions').mockResolvedValue({
      items: mockTransactions,
      nextCursor: null,
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <Transactions />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const searchInput = screen.getByPlaceholderText(/search by transaction id/i);
    await userEvent.type(searchInput, 'BW-TRX-101');

    await waitFor(() => {
      expect(getTxnsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'BW-TRX-101',
        })
      );
    });
  });

  it('renders dedicated transaction detail page with all information', async () => {
    vi.spyOn(staffApi, 'getStaffTransactionDetail').mockResolvedValue(mockDetail);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/transactions/BW-TRX-101']}>
          <Routes>
            <Route path="/transactions/:id" element={<TransactionDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'BW-TRX-101' })).toBeInTheDocument();
      expect(screen.getByText('Successful')).toBeInTheDocument();
      expect(screen.getByText('Sujoy Mondal')).toBeInTheDocument();
      expect(screen.getByText('BW-USR-5')).toBeInTheDocument();
      expect(screen.getByText('sujoy@example.com')).toBeInTheDocument();
      expect(screen.getByText('9876543210')).toBeInTheDocument();
      expect(screen.getByText('12345678')).toBeInTheDocument();
      expect(screen.getByText('SujoyFF')).toBeInTheDocument();
      expect(screen.getByText('UTR987654321012')).toBeInTheDocument();
    });
  });

  it('formats adjustment transaction refId to BW-STF-<id>', async () => {
    vi.spyOn(staffApi, 'getStaffTransactions').mockResolvedValue({
      items: [
        {
          transactionId: 'BW-TRX-159',
          id: 159,
          userId: 'BW-USR-2',
          userName: 'Sujoy BCA',
          userEmail: 'sujoybca@example.com',
          wallet: 'winning',
          walletName: 'Winning',
          type: 'admin_adjustment',
          amount: '+100.00',
          balanceAfter: '105.00',
          totalAfter: '105.00',
          refType: 'admin_adjustment',
          refId: '1',
          createdAt: '2026-10-31T05:25:00.000Z',
        },
      ],
      nextCursor: null,
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <Transactions />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('BW-TRX-159')).toBeInTheDocument();
      expect(screen.getByText('ref: BW-STF-1')).toBeInTheDocument();
    });
  });

  it('renders Joining Reward option in type dropdown, badge in list, and dedicated detail card', async () => {
    const mockJoiningRewardTxn: StaffTransactionListItemDto = {
      transactionId: 'BW-TRX-200',
      id: 200,
      userId: 'BW-USR-8',
      userName: 'New Player',
      userEmail: 'newplayer@example.com',
      userUsername: 'newplayer',
      wallet: 'cashback',
      walletName: 'Cashback',
      type: 'joining_reward',
      amount: '+10.00',
      balanceAfter: '10.00',
      totalAfter: '10.00',
      refType: 'joining_reward',
      refId: 'BW-USR-8',
      createdAt: '2026-10-31T06:00:00.000Z',
    };

    vi.spyOn(staffApi, 'getStaffTransactions').mockResolvedValue({
      items: [mockJoiningRewardTxn],
      nextCursor: null,
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <Transactions />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify option is in the types select
    expect(screen.getByRole('option', { name: 'Joining Rewards' })).toBeInTheDocument();

    // Verify item rendered with Joining Reward badge
    await waitFor(() => {
      expect(screen.getByText('BW-TRX-200')).toBeInTheDocument();
      expect(screen.getByText('Joining Reward')).toBeInTheDocument();
      expect(screen.getAllByText('Cashback').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('+Rs10.00')).toBeInTheDocument();
    });

    // Now test detail page
    const mockJoiningRewardDetail: StaffTransactionDetailDto = {
      transactionId: 'BW-TRX-200',
      id: 200,
      userId: 'BW-USR-8',
      userName: 'New Player',
      userEmail: 'newplayer@example.com',
      type: 'joining_reward',
      createdAt: '2026-10-31T06:00:00.000Z',
      amount: '+10.00',
      balanceAfter: '10.00',
      remainingAmount: '10.00',
      wallet: 'add_money',
      walletName: 'Deposited',
      status: 'successful',
      statusReason: null,
      refType: 'joining_reward',
      refId: 'BW-USR-8',
      breakdown: { deposited: '10.00' },
      match: null,
      deposit: null,
      withdrawal: null,
      referral: null,
      adjustment: null,
    };

    vi.spyOn(staffApi, 'getStaffTransactionDetail').mockResolvedValue(mockJoiningRewardDetail);

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/transactions/BW-TRX-200']}>
          <Routes>
            <Route path="/transactions/:id" element={<TransactionDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('joining-reward-details-card')).toBeInTheDocument();
      expect(screen.getByText('Joining Reward Details')).toBeInTheDocument();
      expect(screen.getByText('Welcome Bonus')).toBeInTheDocument();
    });
  });

  it('renders "View More Transactions" button at the bottom of the table and loads more transactions on click', async () => {
    const page1Txn: StaffTransactionListItemDto = {
      transactionId: 'BW-TRX-150',
      id: 150,
      userId: 'BW-USR-1',
      userName: 'Player One',
      userEmail: 'player1@example.com',
      wallet: 'add_money',
      walletName: 'Deposited',
      type: 'add_money',
      amount: '+100.00',
      balanceAfter: '100.00',
      totalAfter: '100.00',
      refType: 'deposit',
      refId: 'BW-DPT-1',
      createdAt: '2026-10-31T07:00:00.000Z',
    };

    const page2Txn: StaffTransactionListItemDto = {
      transactionId: 'BW-TRX-149',
      id: 149,
      userId: 'BW-USR-2',
      userName: 'Player Two',
      userEmail: 'player2@example.com',
      wallet: 'winning',
      walletName: 'Winning',
      type: 'winning',
      amount: '+50.00',
      balanceAfter: '150.00',
      totalAfter: '150.00',
      refType: 'match',
      refId: 'BW-MCH-10',
      createdAt: '2026-10-31T06:50:00.000Z',
    };

    const getStaffTransactionsSpy = vi.spyOn(staffApi, 'getStaffTransactions');
    getStaffTransactionsSpy.mockImplementation(async (params) => {
      if (params?.cursor === 'BW-TRX-150') {
        return {
          items: [page2Txn],
          nextCursor: null,
        };
      }
      return {
        items: [page1Txn],
        nextCursor: 'BW-TRX-150',
      };
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <Transactions />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Initial load: shows page 1 transaction and the "View More Transactions" button
    await waitFor(() => {
      expect(screen.getByText('BW-TRX-150')).toBeInTheDocument();
      expect(screen.getByTestId('view-more-transactions-btn')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view more transactions/i })).toBeInTheDocument();
    });

    // Click "View More Transactions"
    const viewMoreBtn = screen.getByTestId('view-more-transactions-btn');
    await userEvent.click(viewMoreBtn);

    // Second batch loads: both page 1 and page 2 are present, and button disappears because nextCursor is null
    await waitFor(() => {
      expect(screen.getByText('BW-TRX-150')).toBeInTheDocument();
      expect(screen.getByText('BW-TRX-149')).toBeInTheDocument();
      expect(screen.queryByTestId('view-more-transactions-btn')).not.toBeInTheDocument();
    });
  });
});
