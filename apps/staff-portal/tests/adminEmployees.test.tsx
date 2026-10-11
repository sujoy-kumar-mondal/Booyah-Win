/**
 * Admin Employee Management Page Tests
 * Section 16.1
 *
 * Requirements:
 * - Constraint 3: When PAN or Aadhaar is blank in an edit, OMIT the key from the request body. Test it.
 * - Constraint 7: Table cells tolerate null masked PAN and Aadhaar and show "-". Test it.
 * - Constraint 8: Search results from an older request never overwrite a newer one. Test it.
 * - Constraint 11: autocomplete="off" on PAN, Aadhaar and reason inputs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { Employees } from '../src/pages/Employees.js';
import * as adminApi from '../src/api/admin.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/context/StaffAuthContext.js';
import { loadContractFixture } from './contractFixtures.js';
import {
  staffMeGuard,
  employeeListResponseGuard,
  employeeSingleResponseGuard,
  employeeDeleteResponseGuard,
} from '../src/api/guards.js';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe('Admin Employees Management Page', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'admin-token');
    vi.restoreAllMocks();

    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me', (d) => {
        d.profile.id = '1';
        d.profile.role = 'admin';
      })
    );
  });

  it('table cells tolerate null masked PAN and Aadhaar and show "-"', async () => {
    vi.spyOn(adminApi, 'getAdminEmployees').mockResolvedValue(
      loadContractFixture(
        'GET_admin_employees.json',
        employeeListResponseGuard,
        'GET /admin/employees',
        (d) => {
          d.items = [
            {
              id: '4',
              role: 'employee',
              name: 'Contract Staff',
              email: 'staff@booyah.win',
              mobile: '9999999999',
              pan: null,
              aadhaar: null,
              createdBy: '1',
              createdAt: '2026-10-11T16:26:06.367Z',
            },
          ];
        }
      )
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Employees />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Contract Staff')).toBeInTheDocument();
    });

    const panCell = screen.getByTestId('employee-pan-4');
    const aadhaarCell = screen.getByTestId('employee-aadhaar-4');

    expect(panCell).toHaveTextContent('-');
    expect(aadhaarCell).toHaveTextContent('-');
  });

  it('omits pan and aadhaar keys from edit request body when blank', async () => {
    vi.spyOn(adminApi, 'getAdminEmployees').mockResolvedValue(
      loadContractFixture(
        'GET_admin_employees.json',
        employeeListResponseGuard,
        'GET /admin/employees',
        (d) => {
          d.items = [
            {
              id: '4',
              role: 'employee',
              name: 'Staff Member',
              email: 'staff@booyah.win',
              mobile: '9999999999',
              pan: 'XXXXXX234F',
              aadhaar: 'XXXX XXXX 9012',
              createdBy: '1',
              createdAt: '2026-10-11T16:26:06.367Z',
            },
          ];
        }
      )
    );

    const updateSpy = vi.spyOn(adminApi, 'updateAdminEmployee').mockResolvedValue(
      loadContractFixture(
        'PATCH_admin_employees_id.json',
        employeeSingleResponseGuard,
        'PATCH /admin/employees/:id'
      )
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Employees />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Staff Member')).toBeInTheDocument();
    });

    // Open edit modal
    fireEvent.click(screen.getByTestId('edit-employee-btn-4'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-employee-modal')).toBeInTheDocument();
    });

    // Change only the name, leave PAN and Aadhaar input blank
    fireEvent.change(screen.getByTestId('edit-employee-name-input'), {
      target: { value: 'Updated Staff Name' },
    });
    // Ensure PAN and Aadhaar are empty string
    fireEvent.change(screen.getByTestId('edit-employee-pan-input'), {
      target: { value: '   ' },
    });
    fireEvent.change(screen.getByTestId('edit-employee-aadhaar-input'), {
      target: { value: '' },
    });

    // Submit edit form
    fireEvent.click(screen.getByTestId('submit-edit-employee-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    const [calledId, calledPayload] = updateSpy.mock.calls[0];
    expect(calledId).toBe('4');
    expect(calledPayload.name).toBe('Updated Staff Name');
    // Verify pan and aadhaar keys are completely omitted
    expect('pan' in calledPayload).toBe(false);
    expect('aadhaar' in calledPayload).toBe(false);
    expect(calledPayload).not.toHaveProperty('pan');
    expect(calledPayload).not.toHaveProperty('aadhaar');
  });

  it('search results from an older request never overwrite a newer one in employees list', async () => {
    let resolveFirstQuery: ((val: any) => void) | null = null;
    let resolveSecondQuery: ((val: any) => void) | null = null;

    const fixtureFirst = loadContractFixture(
      'GET_admin_employees.json',
      employeeListResponseGuard,
      'GET /admin/employees',
      (d) => {
        d.items = [
          {
            id: '10',
            role: 'employee',
            name: 'Slow Response User',
            email: 'slow@booyah.win',
            mobile: '9111111111',
            pan: null,
            aadhaar: null,
            createdBy: '1',
            createdAt: '2026-10-11T16:26:06.367Z',
          },
        ];
      }
    );

    const fixtureSecond = loadContractFixture(
      'GET_admin_employees.json',
      employeeListResponseGuard,
      'GET /admin/employees',
      (d) => {
        d.items = [
          {
            id: '20',
            role: 'employee',
            name: 'Fast Response User',
            email: 'fast@booyah.win',
            mobile: '9222222222',
            pan: null,
            aadhaar: null,
            createdBy: '1',
            createdAt: '2026-10-11T16:26:06.367Z',
          },
        ];
      }
    );

    vi.spyOn(adminApi, 'getAdminEmployees').mockImplementation((params) => {
      if (params?.q === 'slow') {
        return new Promise((resolve) => {
          resolveFirstQuery = () => resolve(fixtureFirst);
        });
      }
      if (params?.q === 'fast') {
        return new Promise((resolve) => {
          resolveSecondQuery = () => resolve(fixtureSecond);
        });
      }
      return Promise.resolve(fixtureFirst);
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Employees />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const searchInput = screen.getByTestId('employee-search-input');

    // Trigger older search "slow"
    fireEvent.change(searchInput, { target: { value: 'slow' } });

    // Trigger newer search "fast" immediately
    fireEvent.change(searchInput, { target: { value: 'fast' } });

    // Resolve newer query ("fast") first
    expect(resolveSecondQuery).not.toBeNull();
    resolveSecondQuery!(null);

    await waitFor(() => {
      expect(screen.getByText('Fast Response User')).toBeInTheDocument();
    });

    // Now resolve older query ("slow") later
    expect(resolveFirstQuery).not.toBeNull();
    resolveFirstQuery!(null);

    // Ensure the older response does NOT overwrite the newer one
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('Fast Response User')).toBeInTheDocument();
    expect(screen.queryByText('Slow Response User')).not.toBeInTheDocument();
  });

  it('autocomplete is off on PAN and Aadhaar inputs in employee forms', async () => {
    vi.spyOn(adminApi, 'getAdminEmployees').mockResolvedValue(
      loadContractFixture(
        'GET_admin_employees.json',
        employeeListResponseGuard,
        'GET /admin/employees'
      )
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Employees />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Open create modal
    fireEvent.click(screen.getByTestId('create-employee-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('create-employee-modal')).toBeInTheDocument();
    });

    const createPanInput = screen.getByTestId('create-employee-pan-input');
    const createAadhaarInput = screen.getByTestId('create-employee-aadhaar-input');

    expect(createPanInput).toHaveAttribute('autocomplete', 'off');
    expect(createAadhaarInput).toHaveAttribute('autocomplete', 'off');
  });

  it('allows registering new employee and handles 409 email conflict', async () => {
    vi.spyOn(adminApi, 'getAdminEmployees').mockResolvedValue(
      loadContractFixture(
        'GET_admin_employees.json',
        employeeListResponseGuard,
        'GET /admin/employees'
      )
    );

    const createSpy = vi.spyOn(adminApi, 'createAdminEmployee').mockRejectedValue({
      status: 409,
      code: 'EMAIL_EXISTS',
      message: 'Email already registered',
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Employees />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByTestId('create-employee-btn'));

    fireEvent.change(screen.getByTestId('create-employee-name-input'), {
      target: { value: 'New Employee' },
    });
    fireEvent.change(screen.getByTestId('create-employee-mobile-input'), {
      target: { value: '9876543210' },
    });
    fireEvent.change(screen.getByTestId('create-employee-email-input'), {
      target: { value: 'duplicate@booyah.win' },
    });

    fireEvent.click(screen.getByTestId('submit-create-employee-btn'));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('create-employee-error')).toBeInTheDocument();
    });
  });

  it('deletes employee with confirmation modal and prevents deleting self', async () => {
    vi.spyOn(adminApi, 'getAdminEmployees').mockResolvedValue(
      loadContractFixture(
        'GET_admin_employees.json',
        employeeListResponseGuard,
        'GET /admin/employees',
        (d) => {
          d.items = [
            {
              id: '1', // Current admin ID
              role: 'admin',
              name: 'Admin Self',
              email: 'admin@booyah.win',
              mobile: '9000000000',
              pan: null,
              aadhaar: null,
              createdBy: null,
              createdAt: '2026-10-11T16:26:06.367Z',
            },
            {
              id: '4',
              role: 'employee',
              name: 'Target Employee',
              email: 'target@booyah.win',
              mobile: '9999999999',
              pan: null,
              aadhaar: null,
              createdBy: '1',
              createdAt: '2026-10-11T16:26:06.367Z',
            },
          ];
        }
      )
    );

    const deleteSpy = vi.spyOn(adminApi, 'deleteAdminEmployee').mockResolvedValue(
      loadContractFixture(
        'DELETE_admin_employees_id.json',
        employeeDeleteResponseGuard,
        'DELETE /admin/employees/:id'
      )
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StaffAuthProvider>
            <Employees />
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Self')).toBeInTheDocument();
      expect(screen.getByText('Target Employee')).toBeInTheDocument();
    });

    // Delete self button should be disabled
    const deleteSelfBtn = screen.getByTestId('delete-employee-btn-1');
    expect(deleteSelfBtn).toBeDisabled();

    // Delete target employee
    const deleteTargetBtn = screen.getByTestId('delete-employee-btn-4');
    expect(deleteTargetBtn).not.toBeDisabled();
    fireEvent.click(deleteTargetBtn);

    await waitFor(() => {
      expect(screen.getByTestId('delete-employee-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-delete-employee-btn'));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('4');
    });
  });
});
