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
});
