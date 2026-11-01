import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Withdrawals } from '../src/pages/Withdrawals';
import * as staffApi from '../src/api/staff';
import { ApiError } from '../src/api/client';
import { ErrorCodes } from '@booyah/shared';
import type { StaffWithdrawalDto } from '../src/api/types';
import { withdrawalListResponseGuard } from '../src/api/guards';
import { loadContractFixture } from './contractFixtures';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe('Requirement 3, 4, 5, 9, 11: Withdrawal Queue and Settlement Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockWithdrawals: StaffWithdrawalDto[] = [
    {
      id: '201',
      userId: '7',
      userEmail: 'winner1@booyah.win',
      amount: '1200.00',
      upiId: 'gamer@oksbi',
      payoutRef: null,
      status: 'pending',
      rejectReason: null,
      processedBy: null,
      processedAt: null,
      createdAt: '2026-10-11T08:00:00.000Z',
    },
    {
      id: '202',
      userId: '8',
      userEmail: 'winner2@booyah.win',
      amount: '50000.00',
      upiId: 'sniper@okicici',
      payoutRef: null,
      status: 'pending',
      rejectReason: null,
      processedBy: null,
      processedAt: null,
      createdAt: '2026-10-10T08:00:00.000Z',
    },
  ];

  const getWithdrawalsFixture = (mutate?: (data: any) => void) =>
    loadContractFixture(
      'GET_staff_withdrawals.json',
      withdrawalListResponseGuard,
      'GET /staff/withdrawals',
      (data) => {
        data.items = mockWithdrawals;
        if (mutate) mutate(data);
      }
    );

  it('Requirement 4: Confirm Mark Paid modal uses exact row data and sends that row ID and payoutRef', async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    vi.spyOn(staffApi, 'getStaffWithdrawals').mockResolvedValue(getWithdrawalsFixture());
    const markPaidSpy = vi.spyOn(staffApi, 'markWithdrawalPaid').mockResolvedValue({
      message: 'Withdrawal marked as paid successfully',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <Withdrawals />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-row-201')).toBeInTheDocument();
    });

    // Open Mark Paid modal
    await user.click(screen.getByTestId('mark-paid-btn-201'));
    expect(screen.getByTestId('mark-paid-modal')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-dialog-amount')).toHaveTextContent('Rs1,200.00');
    expect(screen.getByTestId('confirm-dialog-upi')).toHaveTextContent('gamer@oksbi');

    // Confirm button disabled when payoutRef is empty
    const confirmBtn = screen.getByTestId('confirm-mark-paid-btn');
    expect(confirmBtn).toBeDisabled();

    // Type payout reference
    const refInput = screen.getByTestId('payout-ref-input');
    await user.type(refInput, 'BANK-PAYOUT-987654');
    expect(confirmBtn).not.toBeDisabled();

    // Submit
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(markPaidSpy).toHaveBeenCalledWith('201', 'BANK-PAYOUT-987654');
    });
  });

  it('Requirement 4: Dialog retains original row snapshot if list refetches while dialog is open', async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    vi.spyOn(staffApi, 'getStaffWithdrawals').mockResolvedValue(getWithdrawalsFixture());

    render(
      <QueryClientProvider client={queryClient}>
        <Withdrawals />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-row-201')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('mark-paid-btn-201'));
    expect(screen.getByTestId('confirm-dialog-amount')).toHaveTextContent('Rs1,200.00');

    // Queue updates in background
    queryClient.setQueryData(['staff-withdrawals', 'pending', undefined], {
      items: [
        {
          ...mockWithdrawals[0],
          amount: '8888.00',
        },
      ],
      nextCursor: null,
    });

    // Active dialog keeps original row data
    expect(screen.getByTestId('confirm-dialog-amount')).toHaveTextContent('Rs1,200.00');
  });

  it('Requirement 5: Never decides self-payout on client; relies on API error and displays friendly message', async () => {
    const user = userEvent.setup();
    vi.spyOn(staffApi, 'getStaffWithdrawals').mockResolvedValue(getWithdrawalsFixture());

    // Mock API rejecting with FORBIDDEN (self-settlement attempt)
    vi.spyOn(staffApi, 'markWithdrawalPaid').mockRejectedValue(
      new ApiError(403, ErrorCodes.FORBIDDEN, 'Staff cannot mark their own withdrawal as paid')
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Withdrawals />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('mark-paid-btn-201')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('mark-paid-btn-201'));
    await user.type(screen.getByTestId('payout-ref-input'), 'REF12345');
    await user.click(screen.getByTestId('confirm-mark-paid-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-action-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('withdrawal-action-error')).toHaveTextContent(
      'Staff cannot mark their own withdrawal as paid'
    );
  });

  it('Requirement 3: 409 conflict displays "This request was already processed" and invalidates queries', async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.spyOn(staffApi, 'getStaffWithdrawals').mockResolvedValue(getWithdrawalsFixture());
    vi.spyOn(staffApi, 'markWithdrawalPaid').mockRejectedValue(
      new ApiError(409, ErrorCodes.VALIDATION_ERROR, 'Withdrawal is already completed')
    );

    render(
      <QueryClientProvider client={queryClient}>
        <Withdrawals />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('mark-paid-btn-201')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('mark-paid-btn-201'));
    await user.type(screen.getByTestId('payout-ref-input'), 'REF-999');
    await user.click(screen.getByTestId('confirm-mark-paid-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-action-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('withdrawal-action-error')).toHaveTextContent(
      'This request was already processed'
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['staff-withdrawals'] });
  });

  it('Requirement 11: Copies UPI ID with visual feedback and NEVER logs UPI to console', async () => {
    const user = userEvent.setup();
    const consoleLogSpy = vi.spyOn(console, 'log');
    vi.spyOn(staffApi, 'getStaffWithdrawals').mockResolvedValue(getWithdrawalsFixture());

    // Mock clipboard
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Withdrawals />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('copy-upi-btn-201')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('copy-upi-btn-201'));

    expect(writeTextMock).toHaveBeenCalledWith('gamer@oksbi');
    expect(screen.getByText('Copied')).toBeInTheDocument();

    // Requirement 11: Never log UPI IDs
    for (const call of consoleLogSpy.mock.calls) {
      for (const arg of call) {
        expect(String(arg)).not.toContain('gamer@oksbi');
      }
    }
  });

  it('Rejection flow: requires reason >= 5 characters and calls reject API', async () => {
    const user = userEvent.setup();
    vi.spyOn(staffApi, 'getStaffWithdrawals').mockResolvedValue(getWithdrawalsFixture());
    const rejectSpy = vi.spyOn(staffApi, 'rejectWithdrawal').mockResolvedValue({
      message: 'Withdrawal rejected and refunded',
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Withdrawals />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('reject-btn-201')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('reject-btn-201'));
    expect(screen.getByTestId('reject-withdrawal-modal')).toBeInTheDocument();

    const reasonInput = screen.getByTestId('reject-reason-input');
    const confirmBtn = screen.getByTestId('confirm-reject-btn');

    await user.type(reasonInput, 'Bad');
    expect(confirmBtn).toBeDisabled();

    await user.clear(reasonInput);
    await user.type(reasonInput, 'UPI handle is invalid or inactive');
    expect(confirmBtn).not.toBeDisabled();

    await user.click(confirmBtn);

    await waitFor(() => {
      expect(rejectSpy).toHaveBeenCalledWith('201', 'UPI handle is invalid or inactive');
    });
  });

  it('Requirement 9: Cursor pagination with "Load more" button', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(staffApi, 'getStaffWithdrawals')
      .mockResolvedValueOnce(
        getWithdrawalsFixture((d) => {
          d.items = [mockWithdrawals[0]];
          d.nextCursor = 'cursor-wth-2';
        })
      )
      .mockResolvedValueOnce(
        getWithdrawalsFixture((d) => {
          d.items = [mockWithdrawals[1]];
          d.nextCursor = null;
        })
      );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Withdrawals />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-row-201')).toBeInTheDocument();
    });

    const loadMoreBtn = screen.getByTestId('load-more-withdrawals-btn');
    expect(loadMoreBtn).toBeInTheDocument();

    await user.click(loadMoreBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith({
        status: 'pending',
        cursor: 'cursor-wth-2',
        limit: 15,
      });
      expect(screen.getByTestId('withdrawal-row-202')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('load-more-withdrawals-btn')).not.toBeInTheDocument();
  });

  it('renders "Date" header without "Age" in withdrawal table', async () => {
    vi.spyOn(staffApi, 'getStaffWithdrawals').mockResolvedValue(getWithdrawalsFixture());

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Withdrawals />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-row-201')).toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByRole('columnheader', { name: 'Transaction ID' })).toBeInTheDocument();
    expect(screen.getByTestId('withdrawal-id-201')).toHaveTextContent('BW-TRX-201');
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Age/ })).not.toBeInTheDocument();
  });

  it('filters withdrawals by search bar: User name/email, Amount, Player UPI ID, Status, and combinations', async () => {
    vi.spyOn(staffApi, 'getStaffWithdrawals').mockResolvedValue(getWithdrawalsFixture());

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Withdrawals />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-row-201')).toBeInTheDocument();
      expect(screen.getByTestId('withdrawal-row-202')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('search-withdrawals');

    // 0. Search by Withdrawal ID: 'BW-WDL-201' -> matches row 201 only
    fireEvent.change(searchInput, { target: { value: 'BW-WDL-201' } });
    expect(screen.getByTestId('withdrawal-row-201')).toBeInTheDocument();
    expect(screen.queryByTestId('withdrawal-row-202')).not.toBeInTheDocument();

    // 1. Search by Player UPI ID: 'gamer@oksbi'
    fireEvent.change(searchInput, { target: { value: 'gamer@oksbi' } });
    expect(screen.getByTestId('withdrawal-row-201')).toBeInTheDocument();
    expect(screen.queryByTestId('withdrawal-row-202')).not.toBeInTheDocument();

    // 2. Search by Amount: '50000' -> matches row 202 only
    fireEvent.change(searchInput, { target: { value: '50000' } });
    expect(screen.queryByTestId('withdrawal-row-201')).not.toBeInTheDocument();
    expect(screen.getByTestId('withdrawal-row-202')).toBeInTheDocument();

    // 3. Search by User email: 'winner1@'
    fireEvent.change(searchInput, { target: { value: 'winner1@' } });
    expect(screen.getByTestId('withdrawal-row-201')).toBeInTheDocument();
    expect(screen.queryByTestId('withdrawal-row-202')).not.toBeInTheDocument();

    // 4. Search by Status: 'pending' -> matches both
    fireEvent.change(searchInput, { target: { value: 'pending' } });
    expect(screen.getByTestId('withdrawal-row-201')).toBeInTheDocument();
    expect(screen.getByTestId('withdrawal-row-202')).toBeInTheDocument();

    // 5. Search by combination: '50000 sniper'
    fireEvent.change(searchInput, { target: { value: '50000 sniper' } });
    expect(screen.queryByTestId('withdrawal-row-201')).not.toBeInTheDocument();
    expect(screen.getByTestId('withdrawal-row-202')).toBeInTheDocument();

    // 6. Search with no matches -> displays empty state
    fireEvent.change(searchInput, { target: { value: 'nonexistent-upi-query' } });
    expect(screen.getByTestId('withdrawals-search-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('withdrawal-row-201')).not.toBeInTheDocument();

    // 7. Clear search button restores list
    fireEvent.click(screen.getByText('Clear Search'));
    expect(screen.getByTestId('withdrawal-row-201')).toBeInTheDocument();
    expect(screen.getByTestId('withdrawal-row-202')).toBeInTheDocument();
  });
});
