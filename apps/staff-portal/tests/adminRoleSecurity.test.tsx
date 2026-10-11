/**
 * Admin Role Security and Route Protection Tests
 * Section 16 & Requirement 8
 *
 * Requirements:
 * - Milestone 10c scope: admin pages in apps/staff-portal, visible and reachable only for admins.
 * - Sidebar coming soon entries become real pages; employees never see them.
 * - Route guard blocks typed URLs (renders admin-forbidden-screen).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { RequireAdminRole } from '../src/components/auth/RouteGuards.js';
import { Sidebar } from '../src/components/layout/Sidebar.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/context/StaffAuthContext.js';
import { loadContractFixture } from './contractFixtures.js';
import { staffMeGuard } from '../src/api/guards.js';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe('Admin Role Security and Navigation Protection', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'staff-token');
    vi.restoreAllMocks();
  });

  it('employees never see administration section in sidebar', async () => {
    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me', (d) => {
        d.profile.role = 'employee';
      })
    );

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
      expect(screen.getByTestId('staff-sidebar')).toBeInTheDocument();
    });

    // Operations links are visible
    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-matches')).toBeInTheDocument();

    // Admin section is completely omitted from DOM
    expect(screen.queryByTestId('admin-sidebar-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-employees')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-tiers')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-users')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-settings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-audit-logs')).not.toBeInTheDocument();
  });

  it('admins see real admin pages in sidebar without coming soon badges', async () => {
    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me', (d) => {
        d.profile.role = 'admin';
      })
    );

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

    // Real admin links are visible
    expect(screen.getByTestId('nav-results')).toBeInTheDocument();
    expect(screen.getByTestId('nav-employees')).toBeInTheDocument();
    expect(screen.getByTestId('nav-tiers')).toBeInTheDocument();
    expect(screen.getByTestId('nav-users')).toBeInTheDocument();
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument();
    expect(screen.getByTestId('nav-audit-logs')).toBeInTheDocument();

    // No "coming soon" badges remain
    expect(screen.queryByTestId('coming-soon-badge')).not.toBeInTheDocument();
  });

  it('typed URLs to admin routes are blocked for employee and render admin-forbidden-screen', async () => {
    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me', (d) => {
        d.profile.role = 'employee';
      })
    );

    const testRoutes = ['/employees', '/tiers', '/users', '/settings', '/audit-logs'];

    for (const route of testRoutes) {
      const { unmount } = render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter initialEntries={[route]}>
            <StaffAuthProvider>
              <Routes>
                <Route
                  path={route}
                  element={
                    <RequireAdminRole>
                      <div data-testid="admin-content">Admin Content</div>
                    </RequireAdminRole>
                  }
                />
              </Routes>
            </StaffAuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('admin-forbidden-screen')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
      expect(screen.getByText('Access Restricted')).toBeInTheDocument();

      unmount();
    }
  });
});
