import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffNotificationBell } from '../src/components/notifications/StaffNotificationBell.js';
import { TopBar } from '../src/components/layout/TopBar.js';
import { apiClient } from '../src/api/client.js';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import * as staffApi from '../src/api/staff.js';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe('StaffNotificationBell Component & TopBar Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem('booyah_staff_token', 'test-token');

    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue({
      profile: {
        id: 'BW-STF-001',
        role: 'admin',
        name: 'Master Admin',
        email: 'admin@booyah.win',
        mobile: '9999999999',
        isActive: true,
      },
    } as any);
  });

  it('renders notification bell and unread badge in TopBar', async () => {
    const mockNotifications = {
      data: {
        items: [
          {
            id: '1',
            targetRole: 'all',
            staffId: null,
            type: 'deposit_submitted',
            title: 'New Deposit Request: ₹500',
            message: 'Player submitted deposit with UTR 123456789012.',
            actionUrl: '/deposits',
            metadata: { amount: '500.00' },
            isRead: false,
            createdAt: new Date().toISOString(),
          },
          {
            id: '2',
            targetRole: 'admin',
            staffId: null,
            type: 'match_status_created',
            title: 'Match Created',
            message: 'Match #BW-MCH-100 created.',
            actionUrl: '/matches/BW-MCH-100',
            metadata: { matchId: 'BW-MCH-100' },
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
        unreadCount: 2,
      },
    };

    vi.spyOn(apiClient, 'get').mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('/staff/notifications')) {
        return mockNotifications;
      }
      return {};
    });

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <StaffAuthProvider>
          <MemoryRouter>
            <TopBar />
          </MemoryRouter>
        </StaffAuthProvider>
      </QueryClientProvider>
    );

    const bellBtn = await screen.findByTestId('staff-notification-bell-btn');
    expect(bellBtn).toBeInTheDocument();

    const badge = await screen.findByTestId('staff-notification-unread-badge');
    expect(badge).toHaveTextContent('2');
  });

  it('toggles dropdown and shows notifications list on click', async () => {
    const mockNotifications = {
      data: {
        items: [
          {
            id: '10',
            targetRole: 'all',
            staffId: null,
            type: 'withdrawal_submitted',
            title: 'New Withdrawal Request',
            message: 'Player requested ₹100.00 withdrawal to UPI.',
            actionUrl: '/withdrawals',
            metadata: { withdrawalId: '10' },
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
        unreadCount: 1,
      },
    };

    vi.spyOn(apiClient, 'get').mockResolvedValue(mockNotifications);

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StaffNotificationBell />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bellBtn = await screen.findByTestId('staff-notification-bell-btn');
    fireEvent.click(bellBtn);

    const dropdown = await screen.findByTestId('staff-notification-dropdown');
    expect(dropdown).toBeInTheDocument();
    expect(screen.getByText('New Withdrawal Request')).toBeInTheDocument();
    expect(screen.getByText(/Player requested ₹100.00 withdrawal to UPI/)).toBeInTheDocument();
  });

  it('calls mark-all-read when clicking Mark all read button', async () => {
    const mockNotifications = {
      data: {
        items: [
          {
            id: '10',
            targetRole: 'all',
            staffId: null,
            type: 'withdrawal_submitted',
            title: 'New Withdrawal Request',
            message: 'Player requested ₹100.00 withdrawal to UPI.',
            actionUrl: '/withdrawals',
            metadata: { withdrawalId: '10' },
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
        unreadCount: 1,
      },
    };

    vi.spyOn(apiClient, 'get').mockResolvedValue(mockNotifications);
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ message: 'Marked all as read' });

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StaffNotificationBell />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bellBtn = await screen.findByTestId('staff-notification-bell-btn');
    fireEvent.click(bellBtn);

    const markAllBtn = await screen.findByTestId('staff-notification-mark-all-btn');
    expect(markAllBtn).toBeInTheDocument();
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/staff/notifications/mark-all-read');
    });
  });

  it('clicking a single notification calls PATCH /staff/notifications/:id/read', async () => {
    const mockNotifications = {
      data: {
        items: [
          {
            id: '42',
            targetRole: 'all',
            staffId: null,
            type: 'deposit_submitted',
            title: 'Deposit Submitted',
            message: 'Deposit for ₹200.00 submitted.',
            actionUrl: '/deposits',
            metadata: {},
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
        unreadCount: 1,
      },
    };

    vi.spyOn(apiClient, 'get').mockResolvedValue(mockNotifications);
    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({ message: 'Marked as read' });

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StaffNotificationBell />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bellBtn = await screen.findByTestId('staff-notification-bell-btn');
    fireEvent.click(bellBtn);

    const item = await screen.findByTestId('staff-notification-item');
    fireEvent.click(item);

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith('/staff/notifications/42/read');
    });
  });

  it('displays notification enable button and triggers subscription', async () => {
    const mockNotifications = {
      data: {
        items: [],
        unreadCount: 0,
      },
    };
    vi.spyOn(apiClient, 'get').mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('/push-key')) {
        return { publicKey: 'test-key' };
      }
      return mockNotifications;
    });

    // Mock Notification API & PushManager & serviceWorker in jsdom
    (window as any).Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    };
    (window as any).PushManager = class {};
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue(null),
        register: vi.fn().mockResolvedValue({}),
      },
      configurable: true,
    });

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StaffNotificationBell />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bellBtn = await screen.findByTestId('staff-notification-bell-btn');
    fireEvent.click(bellBtn);

    const enableBtn = await screen.findByTestId('staff-enable-push-btn');
    expect(enableBtn).toBeInTheDocument();
  });

  it('renders deposit_verified and withdrawal_verified notifications with appropriate action links', async () => {
    const mockNotifications = {
      data: {
        items: [
          {
            id: '20',
            targetRole: 'admin',
            staffId: null,
            type: 'deposit_verified',
            title: 'Deposit Final Approval Required',
            message: 'Employee verified ₹150.00 deposit (UTR: 56745636363). Final approval required.',
            actionUrl: '/deposits?status=employee_approved',
            metadata: { depositId: '20', amount: '150.00' },
            isRead: false,
            createdAt: new Date().toISOString(),
          },
          {
            id: '21',
            targetRole: 'admin',
            staffId: null,
            type: 'withdrawal_verified',
            title: 'Withdrawal Final Approval Required',
            message: 'Employee verified ₹200.00 withdrawal. Final approval required.',
            actionUrl: '/withdrawals?status=employee_approved',
            metadata: { withdrawalId: '21', amount: '200.00' },
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
        unreadCount: 2,
      },
    };

    vi.spyOn(apiClient, 'get').mockResolvedValue(mockNotifications);
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StaffNotificationBell />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bellBtn = await screen.findByTestId('staff-notification-bell-btn');
    fireEvent.click(bellBtn);

    const dropdown = await screen.findByTestId('staff-notification-dropdown');
    expect(dropdown).toBeInTheDocument();
    expect(screen.getByText('Deposit Final Approval Required')).toBeInTheDocument();
    expect(screen.getByText(/56745636363/)).toBeInTheDocument();
    expect(screen.getByText('Withdrawal Final Approval Required')).toBeInTheDocument();
  });
});

