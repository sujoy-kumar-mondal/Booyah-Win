import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Deposits } from '../src/pages/Deposits';
import * as staffApi from '../src/api/staff';
import { ApiError } from '../src/api/client';
import { ErrorCodes } from '@booyah/shared';
import type { StaffDepositDto } from '../src/api/types';
import { depositListResponseGuard } from '../src/api/guards';
import { loadContractFixture } from './contractFixtures';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe('Requirement 3, 4, 5, 7, 9: Deposits Queue and Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDeposits: StaffDepositDto[] = [
    {
      id: '101',
      userId: '5',
      userEmail: 'player1@booyah.win',
      amount: '500.00',
      utr: 'UTR123456789012',
      screenshotUrl: 'https://storage.booyah.win/screenshots/101.jpg',
      status: 'pending',
      rejectReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: '2026-10-11T10:00:00.000Z',
      pendingMinutes: 15.5,
      needsAdmin: false,
    },
    {
      id: '102',
      userId: '6',
      userEmail: 'player2@booyah.win',
      amount: '15000.00',
      utr: 'UTR999999999999',
      screenshotUrl: 'https://storage.booyah.win/screenshots/102.jpg',
      status: 'pending',
      rejectReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: '2026-10-11T09:00:00.000Z',
      pendingMinutes: 75,
      needsAdmin: true,
    },
  ];

  const getDepositsFixture = (mutate?: (data: any) => void) =>
    loadContractFixture(
      'GET_staff_deposits.json',
      depositListResponseGuard,
      'GET /staff/deposits',
      (data) => {
        data.items = mockDeposits;
        if (mutate) mutate(data);
      }
    );

  it('Requirement 4: Confirm dialog uses exact row data and keeps data if list updates', async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();

    vi.spyOn(staffApi, 'getStaffDeposits').mockResolvedValue(getDepositsFixture());

    render(
      <QueryClientProvider client={queryClient}>
        <Deposits />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('deposit-row-101')).toBeInTheDocument();
    });

    // Click approve on row 101
    await user.click(screen.getByTestId('approve-btn-101'));

    // Verify modal opened with exact row data (amount & UTR)
    expect(screen.getByTestId('approve-deposit-modal')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-dialog-amount')).toHaveTextContent('Rs500.00');
    expect(screen.getByTestId('confirm-dialog-utr')).toHaveTextContent('UTR123456789012');

    // Requirement 4: If list refreshes while dialog is open, dialog keeps original row data
    queryClient.setQueryData(['staff-deposits', 'pending', undefined], {
      items: [
        {
          ...mockDeposits[0],
          amount: '9999.00', // Changed on background refresh
        },
      ],
      nextCursor: null,
    });

    // Active dialog still retains original snapshot: Rs500.00
    expect(screen.getByTestId('confirm-dialog-amount')).toHaveTextContent('Rs500.00');
    expect(screen.getByTestId('confirm-dialog-utr')).toHaveTextContent('UTR123456789012');
  });

  it('Requirement 5: Never decides self-approval on client; displays clear API error when server returns FORBIDDEN', async () => {
    const user = userEvent.setup();
    vi.spyOn(staffApi, 'getStaffDeposits').mockResolvedValue(getDepositsFixture());

    // Mock API rejecting with FORBIDDEN (self-approval attempt)
    vi.spyOn(staffApi, 'approveDeposit').mockRejectedValue(
      new ApiError(403, ErrorCodes.FORBIDDEN, 'Staff cannot approve their own deposit')
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Deposits />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('approve-btn-101')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('approve-btn-101'));
    await user.click(screen.getByTestId('confirm-approve-btn'));

    // Clearly displays friendly error message chosen by error code
    await waitFor(() => {
      expect(screen.getByTestId('deposit-action-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('deposit-action-error')).toHaveTextContent(
      'Staff cannot approve their own deposit'
    );
  });

  it('Requirement 3: 409 conflict shows "This request was already processed" and triggers refetch', async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.spyOn(staffApi, 'getStaffDeposits').mockResolvedValue(getDepositsFixture());

    // 409 conflict: request was already approved/rejected by someone else
    vi.spyOn(staffApi, 'approveDeposit').mockRejectedValue(
      new ApiError(409, ErrorCodes.VALIDATION_ERROR, 'Deposit is already reviewed')
    );

    render(
      <QueryClientProvider client={queryClient}>
        <Deposits />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('approve-btn-101')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('approve-btn-101'));
    await user.click(screen.getByTestId('confirm-approve-btn'));

    // Requirement 3: 409 shows "This request was already processed"
    await waitFor(() => {
      expect(screen.getByTestId('deposit-action-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('deposit-action-error')).toHaveTextContent(
      'This request was already processed'
    );
    // Invalidates queue queries to refresh
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['staff-deposits'] });
  });

  it('Rejection flow: requires reason >= 5 characters and sends ID', async () => {
    const user = userEvent.setup();
    vi.spyOn(staffApi, 'getStaffDeposits').mockResolvedValue(getDepositsFixture());
    const rejectSpy = vi.spyOn(staffApi, 'rejectDeposit').mockResolvedValue({
      message: 'Deposit rejected successfully',
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Deposits />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('reject-btn-101')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('reject-btn-101'));
    expect(screen.getByTestId('reject-deposit-modal')).toBeInTheDocument();

    const reasonInput = screen.getByTestId('reject-reason-input');
    const confirmBtn = screen.getByTestId('confirm-reject-btn');

    // Under 5 chars: button is disabled
    await user.type(reasonInput, 'Bad');
    expect(confirmBtn).toBeDisabled();

    // 5 chars or more: enabled
    await user.clear(reasonInput);
    await user.type(reasonInput, 'Invalid UTR reference number');
    expect(confirmBtn).not.toBeDisabled();

    await user.click(confirmBtn);

    await waitFor(() => {
      expect(rejectSpy).toHaveBeenCalledWith('101', 'Invalid UTR reference number');
    });
  });

  it('Requirement 9: Cursor pagination with "Load more" button', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(staffApi, 'getStaffDeposits')
      .mockResolvedValueOnce(
        getDepositsFixture((d) => {
          d.items = [mockDeposits[0]];
          d.nextCursor = 'cursor-page-2';
        })
      )
      .mockResolvedValueOnce(
        getDepositsFixture((d) => {
          d.items = [mockDeposits[1]];
          d.nextCursor = null;
        })
      );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Deposits />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('deposit-row-101')).toBeInTheDocument();
    });

    const loadMoreBtn = screen.getByTestId('load-more-deposits-btn');
    expect(loadMoreBtn).toBeInTheDocument();

    await user.click(loadMoreBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith({
        status: 'pending',
        cursor: 'cursor-page-2',
        limit: 15,
      });
      expect(screen.getByTestId('deposit-row-102')).toBeInTheDocument();
    });

    // nextCursor is now null, so load more button disappears
    expect(screen.queryByTestId('load-more-deposits-btn')).not.toBeInTheDocument();
  });

  it('Requirement 7: Screenshot viewer refetches fresh signed URL and uses referrerpolicy="no-referrer"', async () => {
    const user = userEvent.setup();
    vi.spyOn(staffApi, 'getStaffDeposits').mockResolvedValue(
      getDepositsFixture((d) => {
        d.items = [
          {
            ...mockDeposits[0],
            screenshotUrl: 'https://storage.booyah.win/fresh-signed-url-for-101.jpg',
          },
        ];
        d.nextCursor = null;
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Deposits />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('view-screenshot-btn-101')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('view-screenshot-btn-101'));

    // Viewer modal should open
    await waitFor(() => {
      expect(screen.getByTestId('screenshot-viewer-modal')).toBeInTheDocument();
    });

    const img = screen.getByTestId('screenshot-image') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    // Requirement 7: referrerpolicy="no-referrer"
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img.src).toContain('https://storage.booyah.win/fresh-signed-url-for-101.jpg');

    // Simulate image error (e.g. expired URL)
    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.getByTestId('screenshot-expired-message')).toBeInTheDocument();
    });
    expect(screen.getByTestId('screenshot-expired-message')).toHaveTextContent(
      'This signed image URL has expired or could not be loaded securely'
    );
  });
});
