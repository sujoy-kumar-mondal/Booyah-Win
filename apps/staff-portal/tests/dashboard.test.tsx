import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '../src/pages/Dashboard';
import * as staffApi from '../src/api/staff';
import { dashboardMetricsGuard } from '../src/api/guards';
import { loadContractFixture } from './contractFixtures';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe('Requirement 6: Staff Dashboard & Exact Overdue Boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getMetricsFixture = (mutate?: (data: any) => void) =>
    loadContractFixture(
      'GET_staff_dashboard.json',
      dashboardMetricsGuard,
      'GET /staff/dashboard',
      (data) => {
        data.pendingDepositsCount = 5;
        data.pendingWithdrawalsCount = 2;
        data.liveMatchesCount = 3;
        data.upcomingMatchesCount = 8;
        data.roomOpenMatchesCount = 1;
        data.completedMatchesCount = 15;
        data.resultsWaitingApprovalCount = 2;
        if (mutate) mutate(data);
      }
    );

  it('renders normal state when deposit <= 30m and withdrawal <= 1440m', async () => {
    vi.spyOn(staffApi, 'getStaffDashboard').mockResolvedValue(
      getMetricsFixture((data) => {
        data.oldestPendingDepositAgeMinutes = 30; // Exact boundary: 30 is NOT red
        data.oldestPendingWithdrawalAgeMinutes = 1440; // Exact boundary: 1440 is NOT red
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('deposit-count-value')).toHaveTextContent('5');
    });

    // 30 minutes is not overdue
    expect(screen.queryByTestId('deposit-overdue-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('deposit-oldest-age')).toHaveTextContent('30m');

    // 1440 minutes (24h) is not overdue
    expect(screen.queryByTestId('withdrawal-overdue-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('withdrawal-oldest-age')).toHaveTextContent('24h');

    // Counts check
    expect(screen.getByTestId('live-matches-count')).toHaveTextContent('3');
    expect(screen.getByTestId('upcoming-matches-count')).toHaveTextContent('8');
    expect(screen.getByTestId('room-open-matches-count')).toHaveTextContent('1');
    expect(screen.getByTestId('results-waiting-count')).toHaveTextContent('2');
  });

  it('Requirement 6: 30.01 minutes triggers RED overdue badge for deposit', async () => {
    vi.spyOn(staffApi, 'getStaffDashboard').mockResolvedValue(
      getMetricsFixture((data) => {
        data.oldestPendingDepositAgeMinutes = 30.01; // 30.01 is RED
        data.oldestPendingWithdrawalAgeMinutes = 100;
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('deposit-overdue-badge')).toBeInTheDocument();
    });
    expect(screen.getByTestId('deposit-overdue-badge')).toHaveTextContent('Overdue (>30m)');
    expect(screen.getByTestId('dashboard-deposits-card').className).toContain('border-rose-500');
  });

  it('Requirement 6: 1440.01 minutes triggers RED overdue badge for withdrawal', async () => {
    vi.spyOn(staffApi, 'getStaffDashboard').mockResolvedValue(
      getMetricsFixture((data) => {
        data.oldestPendingDepositAgeMinutes = 10;
        data.oldestPendingWithdrawalAgeMinutes = 1440.01; // 1440.01 is RED
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-overdue-badge')).toBeInTheDocument();
    });
    expect(screen.getByTestId('withdrawal-overdue-badge')).toHaveTextContent('Overdue (>24h)');
    expect(screen.getByTestId('dashboard-withdrawals-card').className).toContain('border-rose-500');
  });

  it('safely handles null ages with em-dash and no overdue badges', async () => {
    vi.spyOn(staffApi, 'getStaffDashboard').mockResolvedValue(
      getMetricsFixture((data) => {
        data.pendingDepositsCount = 0;
        data.oldestPendingDepositAgeMinutes = null;
        data.pendingWithdrawalsCount = 0;
        data.oldestPendingWithdrawalAgeMinutes = null;
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('deposit-count-value')).toHaveTextContent('0');
    });

    expect(screen.queryByTestId('deposit-overdue-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('withdrawal-overdue-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('deposit-oldest-age')).toHaveTextContent('—');
    expect(screen.getByTestId('withdrawal-oldest-age')).toHaveTextContent('—');
  });

  it('navigates to queues from action links', async () => {
    vi.spyOn(staffApi, 'getStaffDashboard').mockResolvedValue(getMetricsFixture());

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('view-deposits-queue-link')).toBeInTheDocument();
    });
    expect(screen.getByTestId('view-deposits-queue-link')).toHaveAttribute('href', '/deposits');
    expect(screen.getByTestId('view-withdrawals-queue-link')).toHaveAttribute('href', '/withdrawals');
  });

  it('displays total deposit and withdrawal amounts and allows toggling day/month', async () => {
    vi.spyOn(staffApi, 'getStaffDashboard').mockResolvedValue(
      getMetricsFixture((data) => {
        data.totalDepositsToday = 5000;
        data.totalDepositsMonth = 75000;
        data.totalWithdrawalsToday = 2000;
        data.totalWithdrawalsMonth = 30000;
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/₹ 5,000\.00/i)).toBeInTheDocument();
      expect(screen.getByText(/₹ 2,000\.00/i)).toBeInTheDocument();
    });

    // Switch to This Month
    const { fireEvent } = await import('@testing-library/react');
    const monthBtn = screen.getByRole('button', { name: /^this month$/i });
    fireEvent.click(monthBtn);

    expect(screen.getByText(/₹ 75,000\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/₹ 30,000\.00/i)).toBeInTheDocument();
  });

  it('renders real monthly financials and real match days without demo data', async () => {
    vi.spyOn(staffApi, 'getStaffDashboard').mockResolvedValue(
      getMetricsFixture((data) => {
        data.monthlyFinancials = [
          { month: 'OCT', deposits: 12000, withdrawals: 8000 },
          { month: 'NOV', deposits: 45000, withdrawals: 15000 },
        ];
        data.scheduledMatchDays = [7, 18];
        data.recentActivityTrends = [
          { date: '01 Nov', day: 1, matches: 2, deposits: 500 },
          { date: '02 Nov', day: 2, matches: 5, deposits: 1500 },
        ];
      })
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('OCT')).toBeInTheDocument();
      expect(screen.getByText('NOV')).toBeInTheDocument();
    });

    // Peak tooltip shows real peak amount (₹45.0k)
    expect(screen.getByText('₹45.0k')).toBeInTheDocument();

    // Calendar displays scheduled match days count
    expect(screen.getByText(/Match Day \(2\)/i)).toBeInTheDocument();
  });
});
