import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext';
import { STAFF_TOKEN_STORAGE_KEY, setStoredStaffToken, clearStoredStaffToken } from '../src/api/client';
import { Sidebar } from '../src/components/layout/Sidebar';
import { RequireAdminRole, RequireStaffAuth } from '../src/components/auth/RouteGuards';
import { Login } from '../src/pages/Login';
import * as staffApi from '../src/api/staff';
import { staffMeGuard, staffLoginResponseGuard } from '../src/api/guards';
import { loadContractFixture } from './contractFixtures';

const getStaffMeFixture = (role: 'employee' | 'admin' = 'employee') =>
  loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me', (data) => {
    data.profile.role = role;
    if (role === 'admin') {
      data.profile.name = 'Super Admin';
      data.profile.email = 'admin@booyah.win';
    } else {
      data.profile.name = 'Employee One';
      data.profile.email = 'emp@booyah.win';
    }
  });

const getLoginVerifyFixture = () =>
  loadContractFixture(
    'POST_staff_auth_login_verify-otp.json',
    staffLoginResponseGuard,
    'POST /staff/auth/login/verify-otp',
    (data) => {
      data.token = 'new-staff-session-jwt';
      data.staff.email = 'officer@booyah.win';
    }
  );

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe('Requirements 2 & 8: Staff Auth, Storage, and Role Guarding', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Requirement 2: Token Storage (localStorage vs sessionStorage)', () => {
    it('uses the single constant STAFF_TOKEN_STORAGE_KEY and stores in localStorage when remembered, sessionStorage when not remembered', () => {
      expect(STAFF_TOKEN_STORAGE_KEY).toBe('booyah_staff_token');

      // Remembered: store in localStorage
      setStoredStaffToken('test-staff-jwt-token', true);
      expect(localStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBe('test-staff-jwt-token');
      expect(sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBeNull();

      // Not remembered: store in sessionStorage
      setStoredStaffToken('test-staff-jwt-token-session', false);
      expect(sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBe('test-staff-jwt-token-session');
      expect(localStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBeNull();

      // Clear removes both
      clearStoredStaffToken();
      expect(localStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBeNull();
      expect(sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBeNull();
    });
  });

  describe('Requirement 8: Employee vs Admin UI and Route Guards', () => {
    it('employees do NOT see admin placeholder sections in the sidebar', async () => {
      sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'employee-token');

      vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(getStaffMeFixture('employee'));

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <StaffAuthProvider>
              <Sidebar />
            </StaffAuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Operations navigation should exist (including Matches for staff)
      await waitFor(() => {
        expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
      });
      expect(screen.getByTestId('nav-matches')).toBeInTheDocument();
      expect(screen.getByTestId('nav-deposits')).toBeInTheDocument();
      expect(screen.getByTestId('nav-withdrawals')).toBeInTheDocument();

      // Requirement 8: Employees do not see admin sections
      expect(screen.queryByTestId('admin-sidebar-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-results')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-employees')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coming-soon-badge')).not.toBeInTheDocument();

      // Role badge reflects employee
      expect(screen.getByTestId('sidebar-role-badge')).toHaveTextContent('employee');
    });

    it('admins DO see admin placeholder navigation items in the sidebar', async () => {
      sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'admin-token');

      vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(getStaffMeFixture('admin'));

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <StaffAuthProvider>
              <Sidebar />
            </StaffAuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('admin-sidebar-section')).toBeInTheDocument();
      });
      expect(screen.getByTestId('nav-matches')).toBeInTheDocument();
      expect(screen.getByTestId('nav-results')).toBeInTheDocument();
      expect(screen.getByTestId('nav-employees')).toBeInTheDocument();
      expect(screen.getByTestId('nav-settings')).toBeInTheDocument();
      expect(screen.getByTestId('nav-audit-logs')).toBeInTheDocument();
      expect(screen.queryByTestId('coming-soon-badge')).not.toBeInTheDocument();
      expect(screen.getByTestId('sidebar-role-badge')).toHaveTextContent('admin');
    });

    it('Requirement 8: Route guard blocks employees from admin URLs typed directly', async () => {
      sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'employee-token');

      vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(getStaffMeFixture('employee'));

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter initialEntries={['/results']}>
            <StaffAuthProvider>
              <Routes>
                <Route
                  path="/results"
                  element={
                    <RequireStaffAuth>
                      <RequireAdminRole>
                        <div data-testid="admin-content">Admin Result Management</div>
                      </RequireAdminRole>
                    </RequireStaffAuth>
                  }
                />
              </Routes>
            </StaffAuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify the employee is blocked with friendly restricted screen
      await waitFor(() => {
        expect(screen.getByTestId('admin-forbidden-screen')).toBeInTheDocument();
      });
      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(screen.getByText(/requires Administrator privileges/i)).toBeInTheDocument();
      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    });

    it('admins CAN access admin-guarded routes without restriction', async () => {
      sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'admin-token');

      vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(getStaffMeFixture('admin'));

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter initialEntries={['/matches']}>
            <StaffAuthProvider>
              <Routes>
                <Route
                  path="/matches"
                  element={
                    <RequireStaffAuth>
                      <RequireAdminRole>
                        <div data-testid="admin-content">Admin Match Management</div>
                      </RequireAdminRole>
                    </RequireStaffAuth>
                  }
                />
              </Routes>
            </StaffAuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('admin-content')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('admin-forbidden-screen')).not.toBeInTheDocument();
    });
  });

  describe('2-Step OTP Staff Login Flow', () => {
    it('requests OTP and verifies OTP with default remember=true into localStorage', async () => {
      const user = userEvent.setup();
      const requestSpy = vi.spyOn(staffApi, 'requestStaffOtp').mockResolvedValue({
        message: 'OTP sent to registered staff email',
      });
      const verifySpy = vi.spyOn(staffApi, 'verifyStaffOtp').mockResolvedValue(
        getLoginVerifyFixture()
      );

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter initialEntries={['/login']}>
            <StaffAuthProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard</div>} />
              </Routes>
            </StaffAuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Step 1: Enter email
      const emailInput = screen.getByTestId('staff-email-input');
      await user.type(emailInput, 'officer@booyah.win');
      await user.click(screen.getByTestId('request-otp-btn'));

      await waitFor(() => {
        expect(requestSpy).toHaveBeenCalledWith('officer@booyah.win');
      });

      // Step 2: Enter OTP
      await waitFor(() => {
        expect(screen.getByTestId('staff-otp-input')).toBeInTheDocument();
      });
      expect(screen.getByTestId('remember-device-checkbox')).toBeChecked();

      const otpInput = screen.getByTestId('staff-otp-input');
      await user.type(otpInput, '123456');
      await user.click(screen.getByTestId('verify-otp-btn'));

      await waitFor(() => {
        expect(verifySpy).toHaveBeenCalledWith('officer@booyah.win', '123456', true);
      });

      // Token stored in localStorage (remembered)
      expect(localStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBe('new-staff-session-jwt');
      expect(sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('unchecking Keep me signed in stores token in sessionStorage (not remembered)', async () => {
      const user = userEvent.setup();
      vi.spyOn(staffApi, 'requestStaffOtp').mockResolvedValue({
        message: 'OTP sent to registered staff email',
      });
      const verifySpy = vi.spyOn(staffApi, 'verifyStaffOtp').mockResolvedValue(
        getLoginVerifyFixture()
      );

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter initialEntries={['/login']}>
            <StaffAuthProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard</div>} />
              </Routes>
            </StaffAuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Step 1: Enter email
      await user.type(screen.getByTestId('staff-email-input'), 'officer@booyah.win');
      await user.click(screen.getByTestId('request-otp-btn'));

      // Step 2: Uncheck remember checkbox
      await waitFor(() => {
        expect(screen.getByTestId('remember-device-checkbox')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('remember-device-checkbox'));
      expect(screen.getByTestId('remember-device-checkbox')).not.toBeChecked();

      await user.type(screen.getByTestId('staff-otp-input'), '123456');
      await user.click(screen.getByTestId('verify-otp-btn'));

      await waitFor(() => {
        expect(verifySpy).toHaveBeenCalledWith('officer@booyah.win', '123456', false);
      });

      // Token stored in sessionStorage (not remembered)
      expect(sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBe('new-staff-session-jwt');
      expect(localStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBeNull();
    });
  });
});
