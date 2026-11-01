import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StaffAuthProvider, useStaffAuth } from '../src/context/StaffAuthContext';
import { IdleTimeoutModal } from '../src/components/common/IdleTimeoutModal';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/api/client';
import * as staffApi from '../src/api/staff';

import { loadContractFixture } from './contractFixtures.js';
import { staffMeGuard } from '../src/api/guards.js';

const TestConsumer: React.FC = () => {
  const { isIdleWarnOpen, stayLoggedIn, logout, token } = useStaffAuth();
  return (
    <div>
      <div data-testid="auth-status">{token ? 'logged-in' : 'logged-out'}</div>
      <IdleTimeoutModal
        isOpen={isIdleWarnOpen}
        onStayLoggedIn={stayLoggedIn}
        onLogout={logout}
      />
    </div>
  );
};

describe('Requirement 10: Idle Timeout (25m Warning, 30m Auto-Logout) with Fake Timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();

    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me')
    );
    vi.spyOn(staffApi, 'logoutStaff').mockResolvedValue({
      message: 'Logged out successfully',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not warn before 25 minutes of inactivity', () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'active-token');

    render(
      <StaffAuthProvider>
        <TestConsumer />
      </StaffAuthProvider>
    );

    // Initial state: logged in, no warning modal
    expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-in');
    expect(screen.queryByTestId('idle-timeout-dialog')).not.toBeInTheDocument();

    // Advance 24 minutes (1440 seconds)
    act(() => {
      vi.advanceTimersByTime(24 * 60 * 1000);
    });

    // Still no warning at 24 minutes
    expect(screen.queryByTestId('idle-timeout-dialog')).not.toBeInTheDocument();
  });

  it('warns after 25 minutes of inactivity', () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'active-token');

    render(
      <StaffAuthProvider>
        <TestConsumer />
      </StaffAuthProvider>
    );

    // Advance to 25 minutes and 15 seconds (passes 25m boundary check)
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000 + 15000);
    });

    // Warning dialog must be visible
    expect(screen.getByTestId('idle-timeout-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('idle-dialog-message')).toHaveTextContent(
      'You have been inactive for 25 minutes'
    );
    expect(screen.getByTestId('idle-stay-btn')).toBeInTheDocument();
    expect(screen.getByTestId('idle-logout-btn')).toBeInTheDocument();
  });

  it('clicking Stay Logged In resets activity and closes the warning dialog', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'active-token');

    render(
      <StaffAuthProvider>
        <TestConsumer />
      </StaffAuthProvider>
    );

    // Advance past 25 minutes
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000 + 15000);
    });

    expect(screen.getByTestId('idle-timeout-dialog')).toBeInTheDocument();

    // Click "Stay Logged In"
    const stayBtn = screen.getByTestId('idle-stay-btn');
    act(() => {
      stayBtn.click();
    });

    // Warning should disappear immediately
    expect(screen.queryByTestId('idle-timeout-dialog')).not.toBeInTheDocument();

    // Advance another 20 minutes (total 45 minutes since start, but only 20m since reset)
    act(() => {
      vi.advanceTimersByTime(20 * 60 * 1000);
    });

    // Warning should STILL NOT be visible
    expect(screen.queryByTestId('idle-timeout-dialog')).not.toBeInTheDocument();
    expect(sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBe('active-token');
  });

  it('user activity (e.g. mousemove, keydown) resets the idle timer before 25 minutes', () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'active-token');

    render(
      <StaffAuthProvider>
        <TestConsumer />
      </StaffAuthProvider>
    );

    // Advance 20 minutes
    act(() => {
      vi.advanceTimersByTime(20 * 60 * 1000);
    });

    // User moves mouse or types
    act(() => {
      window.dispatchEvent(new Event('mousemove'));
    });

    // Advance another 10 minutes (total 30 mins since mount, but only 10m since user activity)
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });

    // Modal should NOT be shown because activity was reset at 20m
    expect(screen.queryByTestId('idle-timeout-dialog')).not.toBeInTheDocument();
  });

  it('automatically logs out at 30 minutes without activity and clears sessionStorage', async () => {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'active-token');

    render(
      <StaffAuthProvider>
        <TestConsumer />
      </StaffAuthProvider>
    );

    // Advance past 30 minutes
    act(() => {
      vi.advanceTimersByTime(30 * 60 * 1000 + 15000);
    });

    // Token should be removed from sessionStorage
    expect(sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-out');
  });

  it('remembered sessions (stored in localStorage) have NO idle warning or auto-logout', async () => {
    localStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'remembered-token');

    render(
      <StaffAuthProvider>
        <TestConsumer />
      </StaffAuthProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-in');

    // Advance 35 minutes (past the 25m warn and 30m logout marks)
    act(() => {
      vi.advanceTimersByTime(35 * 60 * 1000);
    });

    // Warning dialog should NOT be shown
    expect(screen.queryByTestId('idle-timeout-dialog')).not.toBeInTheDocument();
    // User should still be logged in and token intact
    expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-in');
    expect(localStorage.getItem(STAFF_TOKEN_STORAGE_KEY)).toBe('remembered-token');
  });
});
